/**
 * Mission Persistence — Firestore-backed mission tracking for Mission Control
 *
 * Provides user-facing visibility into Jasper's multi-step delegations.
 * Separate from sagaState (internal orchestration). Missions are simpler,
 * user-facing documents designed for polling and display.
 *
 * Firestore Collection:
 * - organizations/{PLATFORM_ID}/missions/{missionId}
 *
 * @module orchestrator/mission-persistence
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { SocialPlatform } from '@/types/social';

// ============================================================================
// TYPES
// ============================================================================

export type MissionStatus =
  | 'PENDING'
  | 'PLAN_PENDING_APPROVAL'
  | 'IN_PROGRESS'
  | 'AWAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED';

export type MissionStepStatus =
  | 'PENDING'
  | 'PROPOSED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';
// Note: M3 used to include 'AWAITING_APPROVAL' as a step status for
// the per-step pause gate. The user reverted that design: steps now
// run sequentially without blocking. Mission-level AWAITING_APPROVAL
// (different field) is still used for the halt-on-double-failure case.

export interface MissionStep {
  stepId: string;
  toolName: string;
  delegatedTo: string;
  status: MissionStepStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  summary?: string;
  error?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  /**
   * List of specialist IDs this step's manager delegated to during execution.
   * Populated automatically by BaseManager's accumulator (M2a, April 15, 2026).
   * Mission Control's step-level grading UI reads this field to route prompt
   * corrections to the correct specialist's Golden Master. Undefined/empty
   * means no specialists contributed — either the step was pure manager work,
   * a direct tool call, or a pre-M2a legacy step.
   */
  specialistsUsed?: string[];
  /**
   * Operator's per-step approval flag (M3.7). Steps drafted by Jasper
   * land with this undefined/false. The operator must explicitly
   * approve each step (or click "approve all") in the plan review
   * screen before /plan/approve will accept the request. The runner
   * skips steps where this is not true.
   */
  operatorApproved?: boolean;
  /**
   * Set to true on every step AFTER a rerun step (M5). The operator
   * may have changed the upstream output, so downstream steps may now
   * be stale. The operator can either click "Still good" to clear the
   * flag without rerunning, or rerun the step to use the updated
   * upstream. Not auto-invalidating because some downstream steps
   * don't actually depend on upstream — this is a flag, not a force.
   */
  upstreamChanged?: boolean;
  /**
   * Set to true when the operator manually edited this step's
   * toolResult via the "Edit output directly" button (M6). Used as
   * an audit trail so future readers know the result is human-edited,
   * not what the agent actually produced. Editing the output does NOT
   * fire the Prompt Engineer or change any specialist's instructions
   * — it's a quick fix path for tweaks too small to justify training.
   */
  manuallyEdited?: boolean;
}

export interface Mission {
  missionId: string;
  conversationId: string;
  status: MissionStatus;
  title: string;
  userPrompt: string;
  steps: MissionStep[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  approvalRequired?: boolean;
  approvalId?: string;
  /** True once the user has submitted at least one grade for this mission */
  graded?: boolean;
  /**
   * Timestamp when Jasper drafted the plan for this mission via
   * `propose_mission_plan` (M4). Present when status is or has been
   * `PLAN_PENDING_APPROVAL`. Used to sort pending-plan missions by age in
   * the Mission Control "needs your review" bucket.
   */
  plannedAt?: string;
  /**
   * Auto-approve policy that the synthetic-trigger pipeline stamps on
   * inbound-event-driven missions when the corresponding org automation
   * flag is on (e.g. `automation/inbound.xDmReply.autoApprove === true`).
   *
   * - `'inbound_dm_reply'`: synthetic-trigger drives plan/approve + step
   *    execution + send_social_reply without any operator click. The
   *    Jasper → manager → specialist delegation path itself is unchanged
   *    — only the operator gates are skipped.
   * - undefined (default): the operator must approve in Mission Control
   *    as normal.
   *
   * Auto-approve is a separate capability from delegation per
   * `feedback_no_jasper_bypass_even_for_simple_replies`. It is only
   * intended to be turned on AFTER an operator has graded enough live
   * runs to trust the agent at the channel level.
   */
  autoApprove?: 'inbound_dm_reply';
  /**
   * Source event identifier for inbound-event-driven missions. Lets the
   * send-dm-reply endpoint find the original `inboundSocialEvents` doc
   * (to pull the sender's user id) and prevents the cron dispatcher from
   * double-firing the same event.
   */
  sourceEvent?: {
    kind:
      | 'inbound_x_dm'
      | 'inbound_bluesky_dm'
      | 'inbound_linkedin_dm'
      | 'inbound_facebook_dm'
      | 'inbound_instagram_dm'
      | 'inbound_pinterest_dm'
      | 'inbound_mastodon_dm';
    eventId: string;
    senderId?: string;
    senderHandle?: string;
  };
  /**
   * Freeform metadata bag stamped at mission-creation time.
   * Social-post-generation missions use this to record the target platform,
   * format, specialist, and origin uid so the pending-mission query can filter
   * by platform + kind without needing a separate index on user-generated fields.
   *
   * Convention: keep values as primitives (string | boolean | number | null) so
   * Firestore equality filters work without deserialization.
   */
  metadata?: Record<string, string | boolean | number | null>;
}

export interface ListMissionsOptions {
  status?: MissionStatus;
  limit?: number;
  startAfter?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function missionsCollectionPath(): string {
  return getSubCollection('missions');
}

// ============================================================================
// MISSION PERSISTENCE SERVICE
// ============================================================================

/**
 * Create a new mission document in Firestore.
 */
export async function createMission(mission: Mission): Promise<void> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — create skipped', {
      missionId: mission.missionId,
    });
    return;
  }

  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(mission.missionId);
    await docRef.set(mission);

    logger.info('[MissionPersistence] Mission created', {
      missionId: mission.missionId,
      title: mission.title,
      stepCount: mission.steps.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[MissionPersistence] Failed to create mission', error instanceof Error ? error : undefined, {
      missionId: mission.missionId,
      error: errorMsg,
    });
  }
}

/**
 * Create a mission with a draft plan attached. Used by the M4
 * `propose_mission_plan` Jasper tool — Jasper hands us a list of step
 * proposals, we write the mission with status PLAN_PENDING_APPROVAL and
 * every step in PROPOSED status. No tool execution happens here; this is
 * a write-and-wait operation. The operator reviews the plan in Mission
 * Control and either approves it (which kicks off execution) or rejects
 * it (which moves the mission to FAILED).
 */
export interface PlannedStepInput {
  toolName: string;
  toolArgs: Record<string, unknown>;
  summary: string;
  specialistsExpected?: string[];
  order: number;
}

export async function createMissionWithPlan(input: {
  missionId: string;
  conversationId: string;
  title: string;
  userPrompt: string;
  plannedSteps: PlannedStepInput[];
}): Promise<void> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — createWithPlan skipped', {
      missionId: input.missionId,
    });
    return;
  }

  const now = new Date().toISOString();

  // Stable per-step IDs so the operator's edit/reorder/delete API calls
  // can address each step by ID after the plan is written.
  const sortedSteps = [...input.plannedSteps].sort((a, b) => a.order - b.order);
  const steps: MissionStep[] = sortedSteps.map((s, idx) => ({
    stepId: `plan_step_${input.missionId}_${idx + 1}`,
    toolName: s.toolName,
    delegatedTo: s.toolName.replace('delegate_to_', '').toUpperCase(),
    status: 'PROPOSED',
    startedAt: now,
    summary: s.summary,
    toolArgs: s.toolArgs,
    ...(s.specialistsExpected && s.specialistsExpected.length > 0
      ? { specialistsUsed: s.specialistsExpected }
      : {}),
  }));

  const mission: Mission = {
    missionId: input.missionId,
    conversationId: input.conversationId,
    status: 'PLAN_PENDING_APPROVAL',
    title: input.title,
    userPrompt: input.userPrompt,
    steps,
    createdAt: now,
    updatedAt: now,
    plannedAt: now,
  };

  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(input.missionId);
    await docRef.set(mission);

    logger.info('[MissionPersistence] Mission created with draft plan', {
      missionId: input.missionId,
      title: input.title,
      stepCount: steps.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[MissionPersistence] Failed to create mission with plan', error instanceof Error ? error : undefined, {
      missionId: input.missionId,
      error: errorMsg,
    });
  }
}

/**
 * Stamp inbound-event metadata + an auto-approve policy onto an existing
 * mission. Idempotent — a second call overwrites with the same values.
 *
 * The synthetic-trigger pipeline calls this AFTER Jasper proposed the
 * plan (so the mission already exists in PLAN_PENDING_APPROVAL) but
 * BEFORE the operator (or the auto-approve driver) approves. Stamping
 * before approval means the auto-approve driver can read these fields
 * to decide whether to drive the mission programmatically.
 */
export async function stampMissionSourceAndAutoApprove(input: {
  missionId: string;
  sourceEvent: NonNullable<Mission['sourceEvent']>;
  autoApprove?: Mission['autoApprove'];
}): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(input.missionId);
    const updates: Record<string, unknown> = {
      sourceEvent: input.sourceEvent,
      updatedAt: new Date().toISOString(),
    };
    if (input.autoApprove) {
      updates.autoApprove = input.autoApprove;
    }
    await docRef.update(updates);
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] stampMissionSourceAndAutoApprove failed', err instanceof Error ? err : undefined, {
      missionId: input.missionId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Append a step to an existing mission and update status/updatedAt.
 */
export async function addMissionStep(missionId: string, step: MissionStep): Promise<void> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — addStep skipped');
    return;
  }

  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);

    await docRef.update({
      steps: FieldValue.arrayUnion(step),
      status: 'IN_PROGRESS' as MissionStatus,
      updatedAt: new Date().toISOString(),
    });

    logger.info('[MissionPersistence] Step added', {
      missionId,
      stepId: step.stepId,
      toolName: step.toolName,
      status: step.status,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[MissionPersistence] Failed to add step', error instanceof Error ? error : undefined, {
      missionId,
      stepId: step.stepId,
      error: errorMsg,
    });
  }
}

/**
 * Update a specific step in-place within a mission document.
 *
 * Uses a Firestore transaction to prevent the read-modify-write race
 * condition that occurs when multiple tools complete in parallel and
 * all try to update different steps in the same embedded array.
 */
export async function updateMissionStep(
  missionId: string,
  stepId: string,
  updates: Partial<Pick<MissionStep, 'status' | 'completedAt' | 'durationMs' | 'summary' | 'error' | 'toolArgs' | 'toolResult' | 'specialistsUsed'>>
): Promise<void> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — updateStep skipped');
    return;
  }

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);

      await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          logger.warn('[MissionPersistence] Mission not found for step update', { missionId, stepId });
          return;
        }

        const mission = doc.data() as Mission;
        const stepIndex = mission.steps.findIndex((s) => s.stepId === stepId);

        if (stepIndex === -1) {
          logger.warn('[MissionPersistence] Step not found in mission', { missionId, stepId });
          return;
        }

        mission.steps[stepIndex] = { ...mission.steps[stepIndex], ...updates };

        transaction.update(docRef, {
          steps: mission.steps,
          updatedAt: new Date().toISOString(),
        });
      });

      logger.debug('[MissionPersistence] Step updated', {
        missionId,
        stepId,
        newStatus: updates.status,
      });
      return; // Success — exit retry loop
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Firestore transactions auto-retry contention, but if the transaction
      // itself fails (e.g. too much contention), we retry at this level too
      if (attempt < MAX_RETRIES && errorMsg.includes('ABORTED')) {
        logger.warn('[MissionPersistence] Step update contention, retrying', {
          missionId,
          stepId,
          attempt,
        });
        continue;
      }

      logger.error('[MissionPersistence] Failed to update step', error instanceof Error ? error : undefined, {
        missionId,
        stepId,
        attempt,
        error: errorMsg,
      });
    }
  }
}

/**
 * Load a single mission by ID.
 */
export async function getMission(missionId: string): Promise<Mission | null> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — getMission skipped');
    return null;
  }

  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as Mission;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[MissionPersistence] Failed to get mission', error instanceof Error ? error : undefined, {
      missionId,
      error: errorMsg,
    });
    return null;
  }
}

/**
 * List missions with optional status filter, pagination, ordered newest-first.
 */
export async function listMissions(
  options: ListMissionsOptions = {}
): Promise<{ missions: Mission[]; hasMore: boolean }> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — listMissions skipped');
    return { missions: [], hasMore: false };
  }

  const { status, limit = 20, startAfter } = options;

  try {
    let query = adminDb
      .collection(missionsCollectionPath())
      .orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }

    if (startAfter) {
      const afterDoc = await adminDb.collection(missionsCollectionPath()).doc(startAfter).get();
      if (afterDoc.exists) {
        query = query.startAfter(afterDoc);
      }
    }

    // Fetch one extra to determine hasMore
    const fetchLimit = Math.min(limit, 50);
    query = query.limit(fetchLimit + 1);

    const snap = await query.get();
    const missions: Mission[] = [];

    for (const doc of snap.docs.slice(0, fetchLimit)) {
      missions.push(doc.data() as Mission);
    }

    return {
      missions,
      hasMore: snap.docs.length > fetchLimit,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[MissionPersistence] Failed to list missions', error instanceof Error ? error : undefined, {
      error: errorMsg,
    });
    return { missions: [], hasMore: false };
  }
}

/**
 * Finalize a mission with a terminal status and optional error.
 */
export async function finalizeMission(
  missionId: string,
  status: 'COMPLETED' | 'FAILED',
  error?: string
): Promise<void> {
  if (!adminDb) { return; }

  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    await docRef.update({
      status,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(error ? { error } : {}),
    });

    logger.info('[MissionPersistence] Mission finalized', {
      missionId,
      status,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] Failed to finalize mission', err instanceof Error ? err : undefined, {
      missionId,
      error: errorMsg,
    });
  }
}

// ============================================================================
// PLAN EDITING HELPERS (M4 — plan pre-approval lifecycle)
// ============================================================================
//
// All four helpers below operate on a mission in PLAN_PENDING_APPROVAL
// status. They reject the operation (return false) if the mission is in
// any other status — once execution starts (IN_PROGRESS) the operator
// can no longer edit the plan, only the individual steps as they pause.
// Plan editing is allowed only while the operator is reviewing the draft.

/**
 * Update a single step in a draft plan (summary or tool args).
 * Used by POST /api/orchestrator/missions/[missionId]/plan/edit-step.
 *
 * Mission must be in PLAN_PENDING_APPROVAL status. Step must be in
 * PROPOSED status. Updates outside {summary, toolArgs} are silently
 * dropped — operators can only edit what they own at plan time.
 */
export interface UpdatePlannedStepResult {
  success: boolean;
  /**
   * Snapshot of the step BEFORE the edit. Populated only on success. Used by
   * callers (notably the plan edit-step API) to feed a before/after delta
   * into Jasper's prompt-revision pipeline so operator plan edits feed back
   * into training.
   */
  before?: {
    toolName: string;
    summary?: string;
    toolArgs?: Record<string, unknown>;
  };
  /** Snapshot of the step AFTER the edit. Same purpose as `before`. */
  after?: {
    toolName: string;
    summary?: string;
    toolArgs?: Record<string, unknown>;
  };
}

export async function updatePlannedStep(
  missionId: string,
  stepId: string,
  updates: { summary?: string; toolArgs?: Record<string, unknown> },
): Promise<UpdatePlannedStepResult> {
  if (!adminDb) { return { success: false }; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;
    let before: UpdatePlannedStepResult['before'];
    let after: UpdatePlannedStepResult['after'];

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status !== 'PLAN_PENDING_APPROVAL') { return; }

      const stepIndex = mission.steps.findIndex((s) => s.stepId === stepId);
      if (stepIndex === -1) { return; }
      if (mission.steps[stepIndex].status !== 'PROPOSED') { return; }

      const original = mission.steps[stepIndex];
      before = {
        toolName: original.toolName,
        summary: original.summary,
        toolArgs: original.toolArgs,
      };

      const updatedStep = { ...original };
      if (updates.summary !== undefined) { updatedStep.summary = updates.summary; }
      if (updates.toolArgs !== undefined) { updatedStep.toolArgs = updates.toolArgs; }
      const newSteps = [...mission.steps];
      newSteps[stepIndex] = updatedStep;

      after = {
        toolName: updatedStep.toolName,
        summary: updatedStep.summary,
        toolArgs: updatedStep.toolArgs,
      };

      transaction.update(docRef, {
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return { success, before, after };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] updatePlannedStep failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return { success: false };
  }
}

/**
 * Result shape for `reorderPlannedSteps`. `success` is the primary backward-
 * compatible field every caller still checks. `before` / `after` are the
 * full stepId + toolName + order snapshots captured inside the same
 * Firestore transaction so callers that want to feed the reorder event into
 * Jasper's training pipeline don't need a second round-trip to Firestore to
 * reconstruct what changed.
 */
export interface ReorderPlannedStepsResult {
  success: boolean;
  before?: Array<{ stepId: string; toolName: string; order: number }>;
  after?: Array<{ stepId: string; toolName: string; order: number }>;
}

/**
 * Reorder the steps in a draft plan. Caller passes the new order as a
 * full list of stepIds. Every existing step must appear exactly once in
 * the new order — partial reorders are rejected to prevent accidental
 * step loss. Used by POST /plan/reorder.
 *
 * Returns both before and after snapshots (stepId + toolName + order index)
 * so the route handler can emit a training signal describing what Jasper
 * originally proposed vs. the operator's final ordering. Snapshots are only
 * populated on success.
 */
export async function reorderPlannedSteps(
  missionId: string,
  newOrder: string[],
): Promise<ReorderPlannedStepsResult> {
  if (!adminDb) { return { success: false }; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;
    let before: ReorderPlannedStepsResult['before'];
    let after: ReorderPlannedStepsResult['after'];

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status !== 'PLAN_PENDING_APPROVAL') { return; }

      // Every existing step must appear exactly once in newOrder
      const existingIds = new Set(mission.steps.map((s) => s.stepId));
      const newIds = new Set(newOrder);
      if (existingIds.size !== newIds.size) { return; }
      for (const id of existingIds) {
        if (!newIds.has(id)) { return; }
      }

      const stepMap = new Map(mission.steps.map((s) => [s.stepId, s]));
      const reorderedSteps = newOrder.map((id) => stepMap.get(id)).filter((s): s is MissionStep => s !== undefined);
      if (reorderedSteps.length !== mission.steps.length) { return; }

      // Capture BEFORE snapshot from the pre-mutation steps array, and AFTER
      // snapshot from the reordered array. Both use the index as `order` so
      // callers see the move pattern clearly.
      before = mission.steps.map((s, idx) => ({
        stepId: s.stepId,
        toolName: s.toolName,
        order: idx,
      }));
      after = reorderedSteps.map((s, idx) => ({
        stepId: s.stepId,
        toolName: s.toolName,
        order: idx,
      }));

      transaction.update(docRef, {
        steps: reorderedSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return { success, before, after };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] reorderPlannedSteps failed', err instanceof Error ? err : undefined, {
      missionId, error: errorMsg,
    });
    return { success: false };
  }
}

/**
 * Result shape for `deletePlannedStep`. `success` is the primary backward-
 * compatible field. `deletedStep` is a snapshot of the step captured BEFORE
 * the mutation so callers can describe to the training pipeline exactly
 * which step Jasper proposed that the operator then threw away. Only
 * populated when the delete actually succeeded.
 */
export interface DeletePlannedStepResult {
  success: boolean;
  deletedStep?: {
    stepId: string;
    toolName: string;
    summary?: string;
    toolArgs?: Record<string, unknown>;
  };
}

/**
 * Remove a single step from a draft plan. Used by POST /plan/delete-step.
 * Mission must be in PLAN_PENDING_APPROVAL status. Cannot delete the last
 * remaining step — an empty plan would fail to execute. Operator should
 * scrap the whole mission instead via the reject endpoint.
 *
 * Returns the deleted-step snapshot on success so the route handler can feed
 * the delete event into Jasper's training pipeline. The snapshot is captured
 * inside the same Firestore transaction that performs the mutation, so the
 * returned state is consistent with what was actually removed.
 */
export async function deletePlannedStep(
  missionId: string,
  stepId: string,
): Promise<DeletePlannedStepResult> {
  if (!adminDb) { return { success: false }; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;
    let deletedStep: DeletePlannedStepResult['deletedStep'];

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status !== 'PLAN_PENDING_APPROVAL') { return; }
      if (mission.steps.length <= 1) { return; }

      const victim = mission.steps.find((s) => s.stepId === stepId);
      if (!victim) { return; }

      const newSteps = mission.steps.filter((s) => s.stepId !== stepId);
      if (newSteps.length === mission.steps.length) { return; }

      deletedStep = {
        stepId: victim.stepId,
        toolName: victim.toolName,
        summary: victim.summary,
        toolArgs: victim.toolArgs,
      };

      transaction.update(docRef, {
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return { success, deletedStep };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] deletePlannedStep failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return { success: false };
  }
}

/**
 * Approve a draft plan and move it from PLAN_PENDING_APPROVAL into
 * IN_PROGRESS. After this the operator can no longer edit individual
 * step args (they're locked in). Used by POST /plan/approve.
 *
 * NOTE (M4 → M3 bridge): this helper only flips the status. The actual
 * execution kick-off is handled by the route handler, which today
 * re-feeds the planned steps to Jasper as if they had just been typed.
 * Once M3 (per-step pause) lands, the route handler will switch to the
 * step-by-step runner instead.
 */
export async function approvePlan(missionId: string): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status !== 'PLAN_PENDING_APPROVAL') { return; }

      transaction.update(docRef, {
        status: 'IN_PROGRESS' as MissionStatus,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] approvePlan failed', err instanceof Error ? err : undefined, {
      missionId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Reject a draft plan and move it to FAILED with the operator's reason.
 * Used by POST /plan/reject. This is also the "scrap" path — there is
 * no "undo" once a plan is rejected. The mission stays in history for
 * audit but cannot be revived.
 */
export async function rejectPlan(missionId: string, reason?: string): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status !== 'PLAN_PENDING_APPROVAL') { return; }

      const now = new Date().toISOString();
      transaction.update(docRef, {
        status: 'FAILED' as MissionStatus,
        error: reason ?? 'Plan rejected by operator',
        completedAt: now,
        updatedAt: now,
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] rejectPlan failed', err instanceof Error ? err : undefined, {
      missionId, error: errorMsg,
    });
    return false;
  }
}

// ============================================================================
// PER-STEP PAUSE RUNNER (M3)
// ============================================================================
//
// These helpers implement the step-by-step execution model. After the
// operator approves a plan, only the first step runs immediately — it
// finishes in AWAITING_APPROVAL, the operator reviews the result, and
// either approves it (which triggers the next step) or reruns it
// (optionally with edited tool args). The runner is purely persistence
// state-machine moves; the actual tool execution is done by the caller
// (the route handler) via executeToolCall, since mission-persistence
// must not import jasper-tools (circular dependency).

/**
 * Approve a single step in a draft plan. Operator clicked the
 * approve button on one step row in the plan review UI.
 *
 * Mission must be in PLAN_PENDING_APPROVAL. Step must be in PROPOSED.
 * Sets operatorApproved=true on the targeted step.
 */
export async function approvePlanStep(missionId: string, stepId: string): Promise<boolean> {
  return togglePlanStepApproval(missionId, stepId, true);
}

/**
 * Un-approve a single step in a draft plan. Operator clicked the
 * approve button on a step they previously approved (toggle off).
 * Sets operatorApproved=false on the targeted step.
 */
export async function unapprovePlanStep(missionId: string, stepId: string): Promise<boolean> {
  return togglePlanStepApproval(missionId, stepId, false);
}

async function togglePlanStepApproval(
  missionId: string,
  stepId: string,
  approved: boolean,
): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status !== 'PLAN_PENDING_APPROVAL') { return; }

      const stepIndex = mission.steps.findIndex((s) => s.stepId === stepId);
      if (stepIndex === -1) { return; }
      if (mission.steps[stepIndex].status !== 'PROPOSED') { return; }

      const newSteps = [...mission.steps];
      newSteps[stepIndex] = {
        ...newSteps[stepIndex],
        operatorApproved: approved,
      };

      transaction.update(docRef, {
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] togglePlanStepApproval failed', err instanceof Error ? err : undefined, {
      missionId, stepId, approved, error: errorMsg,
    });
    return false;
  }
}

/**
 * Approve every PROPOSED step in a draft plan in one call. The
 * operator clicked the "Approve all steps" button at the top of the
 * plan review UI. Mission must still be in PLAN_PENDING_APPROVAL.
 */
export async function approveAllPlanSteps(missionId: string): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status !== 'PLAN_PENDING_APPROVAL') { return; }

      const newSteps = mission.steps.map((s) =>
        s.status === 'PROPOSED' ? { ...s, operatorApproved: true } : s,
      );

      transaction.update(docRef, {
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] approveAllPlanSteps failed', err instanceof Error ? err : undefined, {
      missionId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Mark a step as RUNNING in Firestore. Called by the route handler
 * just before it dispatches the synthetic ToolCall to executeToolCall.
 * Returns false if the mission/step does not exist or the step is not
 * in a runnable state (PROPOSED).
 */
export async function markStepRunning(missionId: string, stepId: string): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;

      const stepIndex = mission.steps.findIndex((s) => s.stepId === stepId);
      if (stepIndex === -1) { return; }
      if (mission.steps[stepIndex].status !== 'PROPOSED') { return; }

      const newSteps = [...mission.steps];
      newSteps[stepIndex] = {
        ...newSteps[stepIndex],
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
      };

      transaction.update(docRef, {
        steps: newSteps,
        status: 'IN_PROGRESS' as MissionStatus,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] markStepRunning failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Mark a step done after it finished running. Records the duration, the
 * tool result, and any error. The step transitions from RUNNING into
 * either COMPLETED (success) or FAILED (error). The mission status
 * stays IN_PROGRESS — the runner is responsible for finalizing.
 *
 * Called by the step runner after executeToolCall returns.
 *
 * Replaces the M3-prototype parkStepAwaitingApproval — the user
 * corrected the design so steps no longer pause for human gating
 * between executions. They run sequentially to completion, the
 * operator reviews and grades after the fact via the existing
 * StepGradeWidget infrastructure (M2b).
 */
export async function markStepDone(
  missionId: string,
  stepId: string,
  result: { status: 'COMPLETED' | 'FAILED'; toolResult: string; durationMs: number; error?: string },
): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;

      const stepIndex = mission.steps.findIndex((s) => s.stepId === stepId);
      if (stepIndex === -1) { return; }
      if (mission.steps[stepIndex].status !== 'RUNNING') { return; }

      const newSteps = [...mission.steps];
      newSteps[stepIndex] = {
        ...newSteps[stepIndex],
        status: result.status,
        completedAt: new Date().toISOString(),
        durationMs: result.durationMs,
        toolResult: result.toolResult,
        ...(result.error ? { error: result.error } : {}),
      };

      transaction.update(docRef, {
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] markStepDone failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Halt a mission because a step failed twice in a row. Flips mission
 * status to AWAITING_APPROVAL so the operator's Mission Control
 * sidebar shows it as needing attention. The failed step stays in
 * FAILED status. The operator can rerun the step (which will resume
 * the mission) or scrap the mission entirely.
 *
 * NOTE: this is the only place AWAITING_APPROVAL is set on a mission
 * post-M3.6. The step-status AWAITING_APPROVAL was removed entirely;
 * mission-status AWAITING_APPROVAL means "halted at a failed step".
 */
export async function haltMissionAtFailedStep(missionId: string): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    await docRef.update({
      status: 'AWAITING_APPROVAL' as MissionStatus,
      approvalRequired: true,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] haltMissionAtFailedStep failed', err instanceof Error ? err : undefined, {
      missionId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Reset a step to PROPOSED so it can be rerun. Optionally edits the
 * step's tool args first (used when the operator wants to retry with
 * different inputs). Returns the updated step or null on failure.
 *
 * Step must be in FAILED or COMPLETED — operator can rerun a failed
 * step after the mission halted, or rerun a completed step they're
 * unhappy with even after the mission finished. Both cases also flip
 * the mission status back to IN_PROGRESS so the runner can pick it up.
 */
export async function rerunMissionStep(
  missionId: string,
  stepId: string,
  options?: { newToolArgs?: Record<string, unknown> },
): Promise<MissionStep | null> {
  if (!adminDb) { return null; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let updatedStep: MissionStep | null = null;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;

      const stepIndex = mission.steps.findIndex((s) => s.stepId === stepId);
      if (stepIndex === -1) { return; }
      const current = mission.steps[stepIndex];
      if (current.status !== 'FAILED' && current.status !== 'COMPLETED') { return; }

      const reset: MissionStep = {
        ...current,
        status: 'PROPOSED',
        startedAt: new Date().toISOString(),
        ...(options?.newToolArgs ? { toolArgs: options.newToolArgs } : {}),
      };
      // Strip prior-run fields so the Mission Control UI shows a fresh
      // step instead of stale completion data.
      delete reset.completedAt;
      delete reset.durationMs;
      delete reset.toolResult;
      delete reset.error;
      // The reset step itself is the source of the change — its own
      // upstream flag (if any) clears now because the operator
      // explicitly chose to rerun.
      delete reset.upstreamChanged;

      const newSteps = [...mission.steps];
      newSteps[stepIndex] = reset;

      // M5: every step AFTER the reset step gets the upstream-changed
      // flag (if it has already run). The operator decides per-step
      // whether the prior output is still valid or needs a rerun.
      // PROPOSED steps that haven't run yet don't get the flag — they
      // have no output to invalidate.
      for (let i = stepIndex + 1; i < newSteps.length; i++) {
        const downstream = newSteps[i];
        if (downstream.status === 'COMPLETED' || downstream.status === 'FAILED') {
          newSteps[i] = { ...downstream, upstreamChanged: true };
        }
      }

      transaction.update(docRef, {
        steps: newSteps,
        status: 'IN_PROGRESS' as MissionStatus,
        approvalRequired: false,
        updatedAt: new Date().toISOString(),
      });

      updatedStep = reset;
    });

    return updatedStep;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] rerunMissionStep failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return null;
  }
}

/**
 * Clear the upstreamChanged flag on a single step (M5). Operator
 * looked at the step after an upstream rerun, decided the output is
 * still valid, and clicked "Still good — keep this output". Does NOT
 * rerun the step. The step keeps its existing toolResult.
 *
 * Step must be in COMPLETED or FAILED. Mission must NOT be in
 * PLAN_PENDING_APPROVAL — clearing flags on a draft plan makes no
 * sense (PROPOSED steps don't have outputs to flag stale).
 */
export async function clearStepUpstreamFlag(missionId: string, stepId: string): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status === 'PLAN_PENDING_APPROVAL') { return; }

      const stepIndex = mission.steps.findIndex((s) => s.stepId === stepId);
      if (stepIndex === -1) { return; }
      const current = mission.steps[stepIndex];
      if (current.status !== 'COMPLETED' && current.status !== 'FAILED') { return; }

      const updated = { ...current };
      delete updated.upstreamChanged;

      const newSteps = [...mission.steps];
      newSteps[stepIndex] = updated;

      transaction.update(docRef, {
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] clearStepUpstreamFlag failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Manually overwrite a step's toolResult (M6 — quick manual edit).
 * Operator clicked "Edit output directly" and pasted in their own
 * text. Sets manuallyEdited=true as the audit trail so we know this
 * result was not produced by the agent.
 *
 * Step must be in COMPLETED or FAILED. Mission cannot be in
 * PLAN_PENDING_APPROVAL — there's nothing to edit yet at plan time.
 *
 * The Prompt Engineer is NOT fired. No specialist instructions change.
 * This is a tweak path for small fixes too minor to train on.
 */
export async function manuallyEditStepOutput(
  missionId: string,
  stepId: string,
  newToolResult: string,
): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status === 'PLAN_PENDING_APPROVAL') { return; }

      const stepIndex = mission.steps.findIndex((s) => s.stepId === stepId);
      if (stepIndex === -1) { return; }
      const current = mission.steps[stepIndex];
      if (current.status !== 'COMPLETED' && current.status !== 'FAILED') { return; }

      const newSteps = [...mission.steps];
      newSteps[stepIndex] = {
        ...current,
        toolResult: newToolResult,
        manuallyEdited: true,
      };

      transaction.update(docRef, {
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] manuallyEditStepOutput failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Cancel a mission — sets status to FAILED with 'Cancelled by user'
 * and marks any RUNNING steps as FAILED.
 */
export async function cancelMission(missionId: string): Promise<boolean> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — cancelMission skipped');
    return false;
  }

  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        logger.warn('[MissionPersistence] Mission not found for cancel', { missionId });
        return;
      }

      const mission = doc.data() as Mission;
      const now = new Date().toISOString();

      // Mark any RUNNING steps as FAILED
      const updatedSteps = mission.steps.map((step) =>
        step.status === 'RUNNING'
          ? { ...step, status: 'FAILED' as MissionStepStatus, completedAt: now, error: 'Mission cancelled' }
          : step
      );

      transaction.update(docRef, {
        status: 'FAILED',
        error: 'Cancelled by user',
        completedAt: now,
        updatedAt: now,
        steps: updatedSteps,
      });
    });

    logger.info('[MissionPersistence] Mission cancelled', { missionId });
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] Failed to cancel mission', err instanceof Error ? err : undefined, {
      missionId,
      error: errorMsg,
    });
    return false;
  }
}

/**
 * Delete a mission permanently from Firestore.
 * Used when the user decides they don't want the mission at all.
 */
export async function deleteMission(missionId: string): Promise<boolean> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — deleteMission skipped');
    return false;
  }

  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.warn('[MissionPersistence] Mission not found for delete', { missionId });
      return false;
    }

    await docRef.delete();

    logger.info('[MissionPersistence] Mission deleted', { missionId });
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] Failed to delete mission', err instanceof Error ? err : undefined, {
      missionId,
      error: errorMsg,
    });
    return false;
  }
}

/**
 * Bulk-delete all missions in terminal states (COMPLETED and/or FAILED).
 * Returns the count of deleted missions.
 */
export async function bulkDeleteTerminalMissions(): Promise<number> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — bulkDelete skipped');
    return 0;
  }

  try {
    const collPath = missionsCollectionPath();
    const snap = await adminDb
      .collection(collPath)
      .where('status', 'in', ['COMPLETED', 'FAILED'])
      .get();

    if (snap.empty) {
      return 0;
    }

    // Firestore batch writes max 500 docs per batch
    const BATCH_SIZE = 500;
    let deleted = 0;

    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = snap.docs.slice(i, i + BATCH_SIZE);

      for (const doc of chunk) {
        batch.delete(doc.ref);
      }

      await batch.commit();
      deleted += chunk.length;
    }

    logger.info('[MissionPersistence] Bulk delete completed', { deleted });
    return deleted;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] Bulk delete failed', err instanceof Error ? err : undefined, {
      error: errorMsg,
    });
    return 0;
  }
}

// ============================================================================
// PLATFORM PENDING MISSION QUERY
// ============================================================================

/**
 * Returns the most-recent AWAITING_APPROVAL mission tagged with the given
 * platform in its `metadata.platform` field, along with its first FAILED
 * step (the step that halted the mission).
 *
 * Used by the InlineReviewCard to surface pending operator decisions
 * directly inside the platform dashboard without requiring the operator to
 * open Mission Control first.
 *
 * Returns null when no matching mission is found or Firestore is unavailable.
 *
 * NOTE: This query requires a composite Firestore index on
 *   (metadata.platform ASC, status ASC, createdAt DESC).
 * If the index is missing, Firestore returns an error with a link to create
 * it — add that index to firestore.indexes.json and deploy once.
 */
export async function findPendingMissionForPlatform(
  platform: SocialPlatform,
): Promise<{ mission: Mission; step: MissionStep } | null> {
  if (!adminDb) {
    logger.warn('[MissionPersistence] Firestore not available — findPendingMissionForPlatform skipped');
    return null;
  }

  try {
    const snap = await adminDb
      .collection(missionsCollectionPath())
      .where('metadata.platform', '==', platform)
      .where('status', '==', 'AWAITING_APPROVAL')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {
      return null;
    }

    const mission = snap.docs[0].data() as Mission;
    const failedStep = mission.steps.find((s) => s.status === 'FAILED') ?? null;

    if (!failedStep) {
      // Mission is AWAITING_APPROVAL but no failed step found — data anomaly,
      // skip rather than returning a mission with no actionable step.
      return null;
    }

    return { mission, step: failedStep };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] findPendingMissionForPlatform failed', err instanceof Error ? err : undefined, {
      platform,
      error: errorMsg,
    });
    return null;
  }
}
