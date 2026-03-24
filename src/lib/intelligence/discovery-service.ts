/**
 * Discovery Service — Firestore CRUD for operations, findings, and actions
 *
 * All reads/writes use the Admin SDK (server-side only).
 * Follows the pattern from mission-persistence.ts.
 *
 * @module lib/intelligence/discovery-service
 */

import { adminDb } from '@/lib/firebase/admin';
import {
  getDiscoveryOperationsCollection,
  getDiscoveryFindingsCollection,
  getDiscoveryActionsCollection,
} from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import {
  generateDiscoveryId,
  createEmptyContactInfo,
  createEmptyOperationStats,
  createEmptyActionData,
  type DiscoveryOperation,
  type DiscoveryFinding,
  type DiscoveryAction,
  type OperationStatus,
  type EnrichmentStatus,
  type ApprovalStatus,
  type OperationStats,
  type ContactInfo,
  type EnrichmentSourceResult,
  type DiscoveryActionData,
} from '@/types/intelligence-discovery';

const LOG_PREFIX = '[DiscoveryService]';

// ============================================================================
// GUARD
// ============================================================================

function ensureDb() {
  if (!adminDb) {
    throw new Error(`${LOG_PREFIX} Admin Firestore not available`);
  }
  return adminDb;
}

// ============================================================================
// OPERATIONS
// ============================================================================

export async function createOperation(params: {
  sourceId: string;
  sourceName: string;
  triggeredBy: 'schedule' | 'manual' | 'jasper';
  config: DiscoveryOperation['config'];
  createdBy: string;
}): Promise<DiscoveryOperation> {
  const db = ensureDb();
  const now = new Date().toISOString();
  const id = generateDiscoveryId('op');

  const operation: DiscoveryOperation = {
    id,
    sourceId: params.sourceId,
    sourceName: params.sourceName,
    status: 'queued',
    triggeredBy: params.triggeredBy,
    config: params.config,
    stats: createEmptyOperationStats(),
    startedAt: now,
    completedAt: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    createdBy: params.createdBy,
  };

  await db.collection(getDiscoveryOperationsCollection()).doc(id).set(operation);

  logger.info(`${LOG_PREFIX} Operation created`, { operationId: id, sourceId: params.sourceId });
  return operation;
}

export async function getOperation(operationId: string): Promise<DiscoveryOperation | null> {
  const db = ensureDb();
  const doc = await db.collection(getDiscoveryOperationsCollection()).doc(operationId).get();
  return doc.exists ? (doc.data() as DiscoveryOperation) : null;
}

export async function listOperations(options: {
  status?: OperationStatus;
  sourceId?: string;
  limit?: number;
  startAfter?: string;
}): Promise<{ operations: DiscoveryOperation[]; hasMore: boolean }> {
  const db = ensureDb();
  const { status, sourceId, limit = 20, startAfter } = options;

  let query = db
    .collection(getDiscoveryOperationsCollection())
    .orderBy('createdAt', 'desc');

  if (status) {
    query = query.where('status', '==', status);
  }
  if (sourceId) {
    query = query.where('sourceId', '==', sourceId);
  }
  if (startAfter) {
    const afterDoc = await db.collection(getDiscoveryOperationsCollection()).doc(startAfter).get();
    if (afterDoc.exists) {
      query = query.startAfter(afterDoc);
    }
  }

  const fetchLimit = Math.min(limit, 100);
  query = query.limit(fetchLimit + 1);

  const snap = await query.get();
  const operations: DiscoveryOperation[] = [];

  for (const doc of snap.docs.slice(0, fetchLimit)) {
    operations.push(doc.data() as DiscoveryOperation);
  }

  return { operations, hasMore: snap.docs.length > fetchLimit };
}

export async function updateOperationStatus(
  operationId: string,
  status: OperationStatus,
  error?: string
): Promise<void> {
  const db = ensureDb();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    status,
    updatedAt: now,
  };

  if (status === 'completed' || status === 'failed') {
    updates.completedAt = now;
  }
  if (error) {
    updates.error = error;
  }

  await db.collection(getDiscoveryOperationsCollection()).doc(operationId).update(updates);
  logger.info(`${LOG_PREFIX} Operation status updated`, { operationId, status });
}

export async function updateOperationStats(
  operationId: string,
  stats: Partial<OperationStats>
): Promise<void> {
  const db = ensureDb();

  const doc = await db.collection(getDiscoveryOperationsCollection()).doc(operationId).get();
  if (!doc.exists) {
    logger.warn(`${LOG_PREFIX} Operation not found for stats update`, { operationId });
    return;
  }

  const current = doc.data() as DiscoveryOperation;
  const mergedStats: OperationStats = { ...current.stats, ...stats };

  await db.collection(getDiscoveryOperationsCollection()).doc(operationId).update({
    stats: mergedStats,
    updatedAt: new Date().toISOString(),
  });
}

// ============================================================================
// FINDINGS
// ============================================================================

export async function createFinding(params: {
  operationId: string;
  sourceId: string;
  seedData: Record<string, string>;
}): Promise<DiscoveryFinding> {
  const db = ensureDb();
  const now = new Date().toISOString();
  const id = generateDiscoveryId('find');

  const finding: DiscoveryFinding = {
    id,
    operationId: params.operationId,
    sourceId: params.sourceId,
    seedData: params.seedData,
    enrichedData: createEmptyContactInfo(),
    enrichmentStatus: 'pending',
    enrichmentSources: [],
    confidenceScores: {},
    overallConfidence: 0,
    approvalStatus: 'pending',
    approvedBy: null,
    approvedAt: null,
    rejectionNotes: null,
    leadId: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(getDiscoveryFindingsCollection()).doc(id).set(finding);

  logger.debug(`${LOG_PREFIX} Finding created`, { findingId: id, operationId: params.operationId });
  return finding;
}

export async function getFinding(findingId: string): Promise<DiscoveryFinding | null> {
  const db = ensureDb();
  const doc = await db.collection(getDiscoveryFindingsCollection()).doc(findingId).get();
  return doc.exists ? (doc.data() as DiscoveryFinding) : null;
}

export async function listFindings(options: {
  operationId: string;
  enrichmentStatus?: EnrichmentStatus;
  approvalStatus?: ApprovalStatus;
  limit?: number;
  startAfter?: string;
}): Promise<{ findings: DiscoveryFinding[]; hasMore: boolean }> {
  const db = ensureDb();
  const { operationId, enrichmentStatus, approvalStatus, limit = 50, startAfter } = options;

  let query = db
    .collection(getDiscoveryFindingsCollection())
    .where('operationId', '==', operationId)
    .orderBy('createdAt', 'desc');

  if (enrichmentStatus) {
    query = query.where('enrichmentStatus', '==', enrichmentStatus);
  }
  if (approvalStatus) {
    query = query.where('approvalStatus', '==', approvalStatus);
  }
  if (startAfter) {
    const afterDoc = await db.collection(getDiscoveryFindingsCollection()).doc(startAfter).get();
    if (afterDoc.exists) {
      query = query.startAfter(afterDoc);
    }
  }

  const fetchLimit = Math.min(limit, 100);
  query = query.limit(fetchLimit + 1);

  const snap = await query.get();
  const findings: DiscoveryFinding[] = [];

  for (const doc of snap.docs.slice(0, fetchLimit)) {
    findings.push(doc.data() as DiscoveryFinding);
  }

  return { findings, hasMore: snap.docs.length > fetchLimit };
}

export async function updateFindingEnrichment(
  findingId: string,
  enrichedData: ContactInfo,
  enrichmentSources: EnrichmentSourceResult[],
  confidenceScores: Record<string, number>,
  overallConfidence: number,
  enrichmentStatus: EnrichmentStatus
): Promise<void> {
  const db = ensureDb();

  await db.collection(getDiscoveryFindingsCollection()).doc(findingId).update({
    enrichedData,
    enrichmentSources,
    confidenceScores,
    overallConfidence,
    enrichmentStatus,
    updatedAt: new Date().toISOString(),
  });

  logger.debug(`${LOG_PREFIX} Finding enrichment updated`, {
    findingId,
    enrichmentStatus,
    overallConfidence,
  });
}

export async function updateFindingApproval(
  findingId: string,
  approvalStatus: 'approved' | 'rejected',
  userId: string,
  rejectionNotes?: string
): Promise<void> {
  const db = ensureDb();
  const now = new Date().toISOString();

  await db.collection(getDiscoveryFindingsCollection()).doc(findingId).update({
    approvalStatus,
    approvedBy: userId,
    approvedAt: now,
    rejectionNotes: rejectionNotes ?? null,
    updatedAt: now,
  });

  logger.info(`${LOG_PREFIX} Finding approval updated`, { findingId, approvalStatus });
}

export async function bulkUpdateFindingApproval(
  findingIds: string[],
  approvalStatus: 'approved' | 'rejected',
  userId: string,
  rejectionNotes?: string
): Promise<number> {
  const db = ensureDb();
  const now = new Date().toISOString();
  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < findingIds.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = findingIds.slice(i, i + BATCH_SIZE);

    for (const findingId of chunk) {
      const ref = db.collection(getDiscoveryFindingsCollection()).doc(findingId);
      batch.update(ref, {
        approvalStatus,
        approvedBy: userId,
        approvedAt: now,
        rejectionNotes: rejectionNotes ?? null,
        updatedAt: now,
      });
    }

    await batch.commit();
    updated += chunk.length;
  }

  logger.info(`${LOG_PREFIX} Bulk approval updated`, { count: updated, approvalStatus });
  return updated;
}

export async function setFindingLeadId(findingId: string, leadId: string): Promise<void> {
  const db = ensureDb();

  await db.collection(getDiscoveryFindingsCollection()).doc(findingId).update({
    leadId,
    approvalStatus: 'converted',
    updatedAt: new Date().toISOString(),
  });
}

// ============================================================================
// ACTIONS (Audit Log)
// ============================================================================

export async function logAction(params: {
  operationId: string;
  findingId?: string;
  actionType: DiscoveryAction['actionType'];
  sourceUrl: string;
  targetUrl?: string;
  status: DiscoveryAction['status'];
  data?: Partial<DiscoveryActionData>;
  durationMs?: number;
}): Promise<DiscoveryAction> {
  const db = ensureDb();
  const now = new Date().toISOString();
  const id = generateDiscoveryId('act');

  const action: DiscoveryAction = {
    id,
    operationId: params.operationId,
    findingId: params.findingId ?? null,
    actionType: params.actionType,
    sourceUrl: params.sourceUrl,
    targetUrl: params.targetUrl ?? null,
    status: params.status,
    data: { ...createEmptyActionData(), ...params.data },
    durationMs: params.durationMs ?? null,
    startedAt: now,
    completedAt: params.status !== 'running' ? now : null,
  };

  await db.collection(getDiscoveryActionsCollection()).doc(id).set(action);

  logger.debug(`${LOG_PREFIX} Action logged`, {
    actionId: id,
    operationId: params.operationId,
    actionType: params.actionType,
    status: params.status,
  });

  return action;
}

export async function updateAction(
  actionId: string,
  updates: {
    status?: DiscoveryAction['status'];
    data?: Partial<DiscoveryActionData>;
    durationMs?: number;
  }
): Promise<void> {
  const db = ensureDb();
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {};

  if (updates.status) {
    updatePayload.status = updates.status;
    if (updates.status === 'completed' || updates.status === 'failed') {
      updatePayload.completedAt = now;
    }
  }
  if (updates.durationMs !== undefined) {
    updatePayload.durationMs = updates.durationMs;
  }
  if (updates.data) {
    const doc = await db.collection(getDiscoveryActionsCollection()).doc(actionId).get();
    if (doc.exists) {
      const existing = doc.data() as DiscoveryAction;
      updatePayload.data = { ...existing.data, ...updates.data };
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    await db.collection(getDiscoveryActionsCollection()).doc(actionId).update(updatePayload);
  }
}

export async function listActions(options: {
  operationId: string;
  findingId?: string;
  since?: string;
  limit?: number;
}): Promise<DiscoveryAction[]> {
  const db = ensureDb();
  const { operationId, findingId, since, limit = 50 } = options;

  let query = db
    .collection(getDiscoveryActionsCollection())
    .where('operationId', '==', operationId)
    .orderBy('startedAt', 'desc');

  if (findingId) {
    query = query.where('findingId', '==', findingId);
  }
  if (since) {
    query = query.where('startedAt', '>', since);
  }

  query = query.limit(Math.min(limit, 200));

  const snap = await query.get();
  const actions: DiscoveryAction[] = [];

  for (const doc of snap.docs) {
    actions.push(doc.data() as DiscoveryAction);
  }

  return actions;
}
