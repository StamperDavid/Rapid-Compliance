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
