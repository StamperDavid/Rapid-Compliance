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
  | 'FAILED'
  | 'AWAITING_APPROVAL';

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

    const newStatus: MissionStatus =
      step.status === 'AWAITING_APPROVAL' ? 'AWAITING_APPROVAL' : 'IN_PROGRESS';

    await docRef.update({
      steps: FieldValue.arrayUnion(step),
      status: newStatus,
      updatedAt: new Date().toISOString(),
      ...(step.status === 'AWAITING_APPROVAL' ? { approvalRequired: true } : {}),
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
export async function updatePlannedStep(
  missionId: string,
  stepId: string,
  updates: { summary?: string; toolArgs?: Record<string, unknown> },
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

      const updatedStep = { ...mission.steps[stepIndex] };
      if (updates.summary !== undefined) { updatedStep.summary = updates.summary; }
      if (updates.toolArgs !== undefined) { updatedStep.toolArgs = updates.toolArgs; }
      const newSteps = [...mission.steps];
      newSteps[stepIndex] = updatedStep;

      transaction.update(docRef, {
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] updatePlannedStep failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Reorder the steps in a draft plan. Caller passes the new order as a
 * full list of stepIds. Every existing step must appear exactly once in
 * the new order — partial reorders are rejected to prevent accidental
 * step loss. Used by POST /plan/reorder.
 */
export async function reorderPlannedSteps(
  missionId: string,
  newOrder: string[],
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

      transaction.update(docRef, {
        steps: reorderedSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] reorderPlannedSteps failed', err instanceof Error ? err : undefined, {
      missionId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Remove a single step from a draft plan. Used by POST /plan/delete-step.
 * Mission must be in PLAN_PENDING_APPROVAL status. Cannot delete the last
 * remaining step — an empty plan would fail to execute. Operator should
 * scrap the whole mission instead via the reject endpoint.
 */
export async function deletePlannedStep(missionId: string, stepId: string): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let success = false;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;
      if (mission.status !== 'PLAN_PENDING_APPROVAL') { return; }
      if (mission.steps.length <= 1) { return; }

      const newSteps = mission.steps.filter((s) => s.stepId !== stepId);
      if (newSteps.length === mission.steps.length) { return; }

      transaction.update(docRef, {
        steps: newSteps,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] deletePlannedStep failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return false;
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
 * Find the next PROPOSED step in a mission. Returns null if there are
 * no more proposed steps (mission can finalize). Used by the per-step
 * runner after a step is approved to figure out what to run next.
 *
 * "Next" means the first step in the current array order whose status
 * is still PROPOSED. After a step is rerun, its status flips back to
 * PROPOSED, so this naturally re-picks the rerun step.
 */
export function findNextProposedStep(mission: Mission): MissionStep | null {
  return mission.steps.find((s) => s.status === 'PROPOSED') ?? null;
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
 * Park a step in AWAITING_APPROVAL after it finished running. Records
 * the duration, the tool result, and any error. Mission status flips
 * to AWAITING_APPROVAL too so the operator's Mission Control sidebar
 * shows the mission as needing attention.
 *
 * Called by the route handler after executeToolCall returns. The step
 * stays in AWAITING_APPROVAL until the operator approves or reruns it.
 */
export async function parkStepAwaitingApproval(
  missionId: string,
  stepId: string,
  result: { toolResult: string; durationMs: number; error?: string },
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
        status: 'AWAITING_APPROVAL',
        completedAt: new Date().toISOString(),
        durationMs: result.durationMs,
        toolResult: result.toolResult,
        ...(result.error ? { error: result.error } : {}),
      };

      transaction.update(docRef, {
        steps: newSteps,
        status: 'AWAITING_APPROVAL' as MissionStatus,
        approvalRequired: true,
        updatedAt: new Date().toISOString(),
      });
      success = true;
    });

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] parkStepAwaitingApproval failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return false;
  }
}

/**
 * Mark a step COMPLETED after the operator approved it. Returns the
 * mission so the route handler can find the next PROPOSED step (if any)
 * to run.
 *
 * Step must be in AWAITING_APPROVAL. Mission must be in either
 * IN_PROGRESS or AWAITING_APPROVAL (the latter is the normal case
 * because parkStepAwaitingApproval flipped both step and mission status).
 */
export async function markStepApproved(missionId: string, stepId: string): Promise<Mission | null> {
  if (!adminDb) { return null; }
  try {
    const docRef = adminDb.collection(missionsCollectionPath()).doc(missionId);
    let updatedMission: Mission | null = null;

    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) { return; }
      const mission = doc.data() as Mission;

      const stepIndex = mission.steps.findIndex((s) => s.stepId === stepId);
      if (stepIndex === -1) { return; }
      if (mission.steps[stepIndex].status !== 'AWAITING_APPROVAL') { return; }

      const newSteps = [...mission.steps];
      newSteps[stepIndex] = {
        ...newSteps[stepIndex],
        status: 'COMPLETED',
      };

      // Mission stays IN_PROGRESS while there are more proposed steps.
      // The route handler is responsible for finalizing if no more steps.
      const stillProposed = newSteps.some((s) => s.status === 'PROPOSED');
      const newMissionStatus: MissionStatus = stillProposed ? 'IN_PROGRESS' : 'IN_PROGRESS';

      transaction.update(docRef, {
        steps: newSteps,
        status: newMissionStatus,
        approvalRequired: false,
        updatedAt: new Date().toISOString(),
      });

      updatedMission = { ...mission, steps: newSteps, status: newMissionStatus };
    });

    return updatedMission;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[MissionPersistence] markStepApproved failed', err instanceof Error ? err : undefined, {
      missionId, stepId, error: errorMsg,
    });
    return null;
  }
}

/**
 * Reset a step to PROPOSED so it can be rerun. Optionally edits the
 * step's tool args first (used when the operator rejects a result and
 * wants to retry with different inputs). Returns the updated step or
 * null on failure.
 *
 * Step must be in AWAITING_APPROVAL (the only state from which rerun
 * makes sense — proposed steps haven't run yet, completed steps are
 * locked, failed steps need rerun via this same path).
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
      if (current.status !== 'AWAITING_APPROVAL' && current.status !== 'FAILED') { return; }

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

      const newSteps = [...mission.steps];
      newSteps[stepIndex] = reset;

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
