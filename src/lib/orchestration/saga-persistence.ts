/**
 * Saga State Persistence — Firestore-backed saga checkpoint/resume
 *
 * Solves the critical gap where saga state is lost on process crash or
 * Vercel cold-start. All saga state is now checkpointed to Firestore
 * after each step completion, and can be resumed from the last successful step.
 *
 * Firestore Collections:
 * - organizations/{PLATFORM_ID}/sagaState/{sagaId} — checkpoint data
 * - organizations/{PLATFORM_ID}/eventLog/{eventId} — event persistence with dedup
 *
 * @module orchestration/saga-persistence
 */

import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import type { SagaStatus } from '@/lib/agents/orchestrator/manager';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Serializable saga step (without function callbacks)
 */
export interface SerializedSagaStep {
  id: string;
  name: string;
  commandId: string;
  targetManager: string;
  payload: Record<string, unknown>;
  priority: string;
  dependencies: string[];
  required: boolean;
  timeout: number;
  retries: number;
}

/**
 * Serializable command result for persistence
 */
export interface SerializedCommandResult {
  commandId: string;
  managerId: string;
  status: 'SUCCESS' | 'FAILED' | 'COMPENSATED' | 'SKIPPED';
  data: unknown;
  errors: string[];
  executionTimeMs: number;
}

/**
 * Full persisted saga state document
 */
export interface PersistedSagaState {
  id: string;
  name: string;
  description: string;
  status: SagaStatus;
  currentStepIndex: number;
  completedStepIds: string[];
  results: Record<string, SerializedCommandResult>;
  steps: SerializedSagaStep[];
  startedAt: string;
  completedAt?: string;
  lastCheckpointAt: string;
  templateId?: string;
  goalId?: string;
  userGoal?: string;
  error?: string;
}

/**
 * Persisted event log entry for deduplication and replay
 */
export interface PersistedEventLog {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
  processedAt: string;
  deduplicationKey: string;
  matchedRules: string[];
  dispatchedActions: Array<{
    ruleId: string;
    targetManager: string;
    command: string;
    success: boolean;
    error?: string;
  }>;
  processingTimeMs: number;
  confirmed: boolean;
}

// ============================================================================
// SAGA PERSISTENCE SERVICE
// ============================================================================

/**
 * Get the Firestore collection path for saga state
 */
function sagaCollectionPath(): string {
  return `organizations/${PLATFORM_ID}/sagaState`;
}

/**
 * Get the Firestore collection path for event logs
 */
function eventLogCollectionPath(): string {
  return `organizations/${PLATFORM_ID}/eventLog`;
}

/**
 * Save a saga checkpoint to Firestore.
 * Called after each successful step completion.
 */
export async function checkpointSaga(state: PersistedSagaState): Promise<void> {
  if (!adminDb) {
    logger.warn('[SagaPersistence] Firestore not available — checkpoint skipped', {
      sagaId: state.id,
    });
    return;
  }

  try {
    const docRef = adminDb.collection(sagaCollectionPath()).doc(state.id);
    await docRef.set(
      {
        ...state,
        lastCheckpointAt: new Date().toISOString(),
      },
      { merge: true }
    );

    logger.info('[SagaPersistence] Checkpoint saved', {
      sagaId: state.id,
      status: state.status,
      completedSteps: state.completedStepIds.length,
      totalSteps: state.steps.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SagaPersistence] Failed to save checkpoint', error instanceof Error ? error : undefined, {
      sagaId: state.id,
      error: errorMsg,
    });
  }
}

/**
 * Load a saga state from Firestore by ID
 */
export async function loadSagaState(sagaId: string): Promise<PersistedSagaState | null> {
  if (!adminDb) {
    logger.warn('[SagaPersistence] Firestore not available — load skipped');
    return null;
  }

  try {
    const docRef = adminDb.collection(sagaCollectionPath()).doc(sagaId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as PersistedSagaState;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SagaPersistence] Failed to load saga state', error instanceof Error ? error : undefined, {
      sagaId,
      error: errorMsg,
    });
    return null;
  }
}

/**
 * Find all incomplete sagas (IN_PROGRESS or PENDING status).
 * Used by the operations-cycle cron to detect sagas that need resuming.
 */
export async function findIncompleteSagas(): Promise<PersistedSagaState[]> {
  if (!adminDb) {
    logger.warn('[SagaPersistence] Firestore not available — cannot find incomplete sagas');
    return [];
  }

  try {
    const collectionRef = adminDb.collection(sagaCollectionPath());

    // Query for IN_PROGRESS sagas
    const inProgressSnap = await collectionRef
      .where('status', '==', 'IN_PROGRESS')
      .orderBy('startedAt', 'desc')
      .limit(50)
      .get();

    // Query for PENDING sagas
    const pendingSnap = await collectionRef
      .where('status', '==', 'PENDING')
      .orderBy('startedAt', 'desc')
      .limit(50)
      .get();

    const results: PersistedSagaState[] = [];

    for (const doc of inProgressSnap.docs) {
      results.push(doc.data() as PersistedSagaState);
    }
    for (const doc of pendingSnap.docs) {
      results.push(doc.data() as PersistedSagaState);
    }

    if (results.length > 0) {
      logger.info('[SagaPersistence] Found incomplete sagas', {
        count: results.length,
        inProgress: inProgressSnap.size,
        pending: pendingSnap.size,
      });
    }

    return results;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SagaPersistence] Failed to find incomplete sagas', error instanceof Error ? error : undefined, {
      error: errorMsg,
    });
    return [];
  }
}

/**
 * Mark a saga as completed in Firestore
 */
export async function completeSaga(
  sagaId: string,
  finalStatus: SagaStatus,
  error?: string
): Promise<void> {
  if (!adminDb) { return; }

  try {
    const docRef = adminDb.collection(sagaCollectionPath()).doc(sagaId);
    await docRef.update({
      status: finalStatus,
      completedAt: new Date().toISOString(),
      lastCheckpointAt: new Date().toISOString(),
      ...(error ? { error } : {}),
    });

    logger.info('[SagaPersistence] Saga finalized', {
      sagaId,
      finalStatus,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[SagaPersistence] Failed to finalize saga', err instanceof Error ? err : undefined, {
      sagaId,
      error: errorMsg,
    });
  }
}

/**
 * Delete old completed sagas (cleanup, retention policy)
 */
export async function cleanupOldSagas(maxAgeDays: number = 30): Promise<number> {
  if (!adminDb) { return 0; }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    const cutoffIso = cutoffDate.toISOString();

    const collectionRef = adminDb.collection(sagaCollectionPath());

    // Find completed sagas older than cutoff
    const oldCompletedSnap = await collectionRef
      .where('status', 'in', ['COMPLETED', 'COMPENSATED', 'FAILED'])
      .where('completedAt', '<', cutoffIso)
      .limit(100)
      .get();

    if (oldCompletedSnap.empty) { return 0; }

    const batch = adminDb.batch();
    for (const doc of oldCompletedSnap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    logger.info('[SagaPersistence] Cleaned up old sagas', {
      deleted: oldCompletedSnap.size,
      maxAgeDays,
    });

    return oldCompletedSnap.size;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SagaPersistence] Cleanup failed', error instanceof Error ? error : undefined, {
      error: errorMsg,
    });
    return 0;
  }
}

// ============================================================================
// EVENT LOG PERSISTENCE
// ============================================================================

/**
 * Check if an event has already been processed (deduplication)
 */
export async function isEventProcessed(deduplicationKey: string): Promise<boolean> {
  if (!adminDb) { return false; }

  try {
    const collectionRef = adminDb.collection(eventLogCollectionPath());
    const snap = await collectionRef
      .where('deduplicationKey', '==', deduplicationKey)
      .where('confirmed', '==', true)
      .limit(1)
      .get();

    return !snap.empty;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SagaPersistence] Dedup check failed', error instanceof Error ? error : undefined, {
      deduplicationKey,
      error: errorMsg,
    });
    return false;
  }
}

/**
 * Persist an event log entry after processing
 */
export async function persistEventLog(entry: PersistedEventLog): Promise<void> {
  if (!adminDb) { return; }

  try {
    const docRef = adminDb.collection(eventLogCollectionPath()).doc(entry.id);
    await docRef.set(entry);

    logger.debug('[SagaPersistence] Event logged', {
      eventId: entry.id,
      eventType: entry.type,
      matchedRules: entry.matchedRules.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SagaPersistence] Failed to persist event log', error instanceof Error ? error : undefined, {
      eventId: entry.id,
      error: errorMsg,
    });
  }
}

/**
 * Confirm that an event's dispatched actions completed successfully.
 * Used for replay: unconfirmed events can be re-dispatched.
 */
export async function confirmEvent(eventId: string): Promise<void> {
  if (!adminDb) { return; }

  try {
    const docRef = adminDb.collection(eventLogCollectionPath()).doc(eventId);
    await docRef.update({ confirmed: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SagaPersistence] Failed to confirm event', error instanceof Error ? error : undefined, {
      eventId,
      error: errorMsg,
    });
  }
}

/**
 * Find unconfirmed events for replay.
 * These are events that were dispatched but not confirmed as completed.
 */
export async function findUnconfirmedEvents(
  maxAgeMinutes: number = 30
): Promise<PersistedEventLog[]> {
  if (!adminDb) { return []; }

  try {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - maxAgeMinutes);
    const cutoffIso = cutoffDate.toISOString();

    const collectionRef = adminDb.collection(eventLogCollectionPath());
    const snap = await collectionRef
      .where('confirmed', '==', false)
      .where('processedAt', '>', cutoffIso)
      .orderBy('processedAt', 'desc')
      .limit(50)
      .get();

    const results: PersistedEventLog[] = [];
    for (const doc of snap.docs) {
      results.push(doc.data() as PersistedEventLog);
    }

    if (results.length > 0) {
      logger.info('[SagaPersistence] Found unconfirmed events for replay', {
        count: results.length,
      });
    }

    return results;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SagaPersistence] Failed to find unconfirmed events', error instanceof Error ? error : undefined, {
      error: errorMsg,
    });
    return [];
  }
}

/**
 * Clean up old event logs (retention policy)
 */
export async function cleanupOldEventLogs(maxAgeDays: number = 7): Promise<number> {
  if (!adminDb) { return 0; }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    const cutoffIso = cutoffDate.toISOString();

    const collectionRef = adminDb.collection(eventLogCollectionPath());
    const oldSnap = await collectionRef
      .where('processedAt', '<', cutoffIso)
      .limit(200)
      .get();

    if (oldSnap.empty) { return 0; }

    const batch = adminDb.batch();
    for (const doc of oldSnap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    logger.info('[SagaPersistence] Cleaned up old event logs', {
      deleted: oldSnap.size,
      maxAgeDays,
    });

    return oldSnap.size;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SagaPersistence] Event log cleanup failed', error instanceof Error ? error : undefined, {
      error: errorMsg,
    });
    return 0;
  }
}
