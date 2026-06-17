/**
 * Agent Verification Ledger
 *
 * Persists pirate-test verification results so the telemetry page can show
 * each agent's real last-verified status (pass/fail, marker counts, when it
 * was last run). The pirate-test harness writes one record per agent after
 * every run; the telemetry UI reads the whole collection.
 *
 * Collection: `agentVerifications` (sub-collection of the platform org)
 * Doc IDs:   `{agentId}` (upsert/merge — one record per agent)
 *
 * @module agents/shared/verification-ledger
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { AgentVerificationRecord } from '@/types/training';

const VERIFICATION_COLLECTION = 'agentVerifications';

function getVerificationCollectionPath(): string {
  return getSubCollection(VERIFICATION_COLLECTION);
}

/**
 * Upsert a verification record by agentId. Latest run for an agent overwrites
 * the previous one (merge keeps the doc id stable at agentId).
 */
export async function recordVerification(record: AgentVerificationRecord): Promise<void> {
  if (!adminDb) {
    logger.error(
      '[VerificationLedger] adminDb not initialized — cannot record verification',
      undefined,
      { agentId: record.agentId },
    );
    return;
  }

  // Firestore rejects `undefined` field values; only include `error` when set.
  const payload: AgentVerificationRecord = {
    agentId: record.agentId,
    status: record.status,
    markersFound: record.markersFound,
    proseFieldsFound: record.proseFieldsFound,
    runAt: record.runAt,
    industryKey: record.industryKey,
    ...(record.error ? { error: record.error } : {}),
  };

  await adminDb
    .collection(getVerificationCollectionPath())
    .doc(record.agentId)
    .set(payload, { merge: true });

  logger.info(`[VerificationLedger] Recorded ${record.status} for ${record.agentId}`, {
    agentId: record.agentId,
    status: record.status,
    markersFound: record.markersFound,
  });
}

/**
 * Get the latest verification record for a single agent, or null if the agent
 * has never been verified.
 */
export async function getVerification(agentId: string): Promise<AgentVerificationRecord | null> {
  if (!adminDb) { return null; }

  const doc = await adminDb
    .collection(getVerificationCollectionPath())
    .doc(agentId)
    .get();

  if (!doc.exists) { return null; }
  return doc.data() as AgentVerificationRecord;
}

/**
 * Get every agent's latest verification record, keyed by agentId. Backs the
 * telemetry page's verified/unverified column.
 */
export async function getAllVerifications(): Promise<Record<string, AgentVerificationRecord>> {
  if (!adminDb) { return {}; }

  const snapshot = await adminDb.collection(getVerificationCollectionPath()).get();

  const result: Record<string, AgentVerificationRecord> = {};
  for (const doc of snapshot.docs) {
    result[doc.id] = doc.data() as AgentVerificationRecord;
  }
  return result;
}
