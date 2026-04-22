/**
 * Jasper Plan-Edit Feedback Service — Phase 3 Jasper training loop
 *
 * Reads + writes the `jasperPlanEditFeedback` collection. This is the training
 * signal that captures three kinds of operator intervention on a draft plan:
 *
 *   - `edit`    — operator rewrote a step's summary / toolArgs
 *   - `delete`  — operator removed a step Jasper proposed
 *   - `reorder` — operator moved the step order around
 *
 * Each intervention is captured by the plan-editing API routes as a
 * `jasperPlanEditFeedback` doc in status `pending_review`. This service lets
 * a reviewer:
 *
 *   1. `listPendingJasperFeedback()`   — list all pending proposals
 *   2. `getJasperFeedback(id)`         — fetch one proposal
 *   3. `approveJasperPlanEdit(...)`    — create a new Jasper GM version from
 *                                        the proposal, deploy it, mark the
 *                                        feedback `approved`
 *   4. `rejectJasperPlanEdit(...)`     — discard the proposal, mark it
 *                                        `rejected` with a reason
 *
 * Standing rule #2 is enforced here: Jasper's Golden Master can ONLY be
 * modified via an approved `jasperPlanEditFeedback` record that itself was
 * generated from a real operator intervention. The approve and reject paths
 * both gate on the existence of the record AND its `pending_review` status.
 *
 * @module training/jasper-plan-feedback-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  createJasperGMVersionFromEdit,
  deployJasperGMVersion,
} from './jasper-golden-master-service';

// ============================================================================
// TYPES
// ============================================================================

const COLLECTION_NAME = 'jasperPlanEditFeedback';

function getCollectionPath(): string {
  return getSubCollection(COLLECTION_NAME);
}

/**
 * Status lifecycle for a single feedback record.
 *   pending_review → approved | rejected (terminal)
 */
export type JasperPlanFeedbackStatus = 'pending_review' | 'approved' | 'rejected';

/**
 * What the operator DID to provoke this feedback. `edit` is the most common,
 * but deletes and reorders also produce training signal: Jasper learns that
 * a certain step shouldn't have been proposed (delete) or that it ordered
 * steps wrong (reorder).
 */
export type JasperPlanFeedbackAction = 'edit' | 'delete' | 'reorder';

/**
 * A normalized feedback record returned by this service. The underlying
 * Firestore doc may have extra legacy fields (e.g. `targetSpecialistId`,
 * `beforeSection/afterSection` on `proposal`), but this record is the
 * canonical spec-defined shape every caller should use.
 */
export interface JasperPlanFeedbackRecord {
  id: string;
  missionId: string;
  stepId: string;
  actionType: JasperPlanFeedbackAction;
  graderUserId: string;
  before: unknown;
  after: unknown;
  correction: string;
  proposal: {
    changeDescription: string;
    currentText: string;
    proposedText: string;
    rationale: string;
  };
  status: JasperPlanFeedbackStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  appliedVersionNumber?: number;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Narrow the raw Firestore document into the strict record shape. Unknown
 * fields are dropped; required fields are validated. Throws on invalid data
 * so we fail loud on malformed entries instead of silently corrupting the
 * review UI.
 *
 * Legacy fields are accepted for backward compat:
 *   - `proposal.beforeSection`  → `proposal.currentText`
 *   - `proposal.afterSection`   → `proposal.proposedText`
 *   - `proposal.changeDescription` → both `changeDescription` and fallback for `rationale`
 *   - missing `actionType`      → defaults to `'edit'` (the only action type
 *     that existed before this field was introduced)
 */
function deserializeRecord(
  id: string,
  data: FirebaseFirestore.DocumentData,
): JasperPlanFeedbackRecord {
  const allowedStatuses: readonly JasperPlanFeedbackStatus[] = [
    'pending_review',
    'approved',
    'rejected',
  ];
  const allowedActions: readonly JasperPlanFeedbackAction[] = ['edit', 'delete', 'reorder'];

  const rawStatus: unknown = data.status;
  const rawActionType: unknown = data.actionType;

  if (typeof data.missionId !== 'string' || typeof data.stepId !== 'string') {
    throw new Error(`jasperPlanEditFeedback ${id} is missing missionId or stepId`);
  }
  if (typeof data.graderUserId !== 'string') {
    throw new Error(`jasperPlanEditFeedback ${id} is missing graderUserId`);
  }
  if (typeof data.correction !== 'string') {
    throw new Error(`jasperPlanEditFeedback ${id} is missing correction`);
  }
  if (typeof data.createdAt !== 'string') {
    throw new Error(`jasperPlanEditFeedback ${id} is missing createdAt`);
  }
  if (typeof rawStatus !== 'string' || !(allowedStatuses as readonly string[]).includes(rawStatus)) {
    throw new Error(`jasperPlanEditFeedback ${id} has invalid status: ${String(rawStatus)}`);
  }

  // Legacy records may be missing actionType — default to 'edit'.
  const actionType: JasperPlanFeedbackAction = typeof rawActionType === 'string'
    && (allowedActions as readonly string[]).includes(rawActionType)
    ? (rawActionType as JasperPlanFeedbackAction)
    : 'edit';

  const proposalRaw: unknown = data.proposal;
  if (proposalRaw === null || typeof proposalRaw !== 'object') {
    throw new Error(`jasperPlanEditFeedback ${id} is missing proposal`);
  }
  const proposal = proposalRaw as Record<string, unknown>;

  // Normalize legacy field names.
  const currentText = typeof proposal.currentText === 'string'
    ? proposal.currentText
    : typeof proposal.beforeSection === 'string'
      ? proposal.beforeSection
      : '';
  const proposedText = typeof proposal.proposedText === 'string'
    ? proposal.proposedText
    : typeof proposal.afterSection === 'string'
      ? proposal.afterSection
      : '';
  const changeDescription = typeof proposal.changeDescription === 'string'
    ? proposal.changeDescription
    : '';
  const rationale = typeof proposal.rationale === 'string'
    ? proposal.rationale
    : changeDescription;

  if (!currentText || !proposedText) {
    throw new Error(`jasperPlanEditFeedback ${id} proposal is missing currentText/proposedText`);
  }

  const record: JasperPlanFeedbackRecord = {
    id,
    missionId: data.missionId,
    stepId: data.stepId,
    actionType,
    graderUserId: data.graderUserId,
    before: data.before ?? null,
    after: data.after ?? null,
    correction: data.correction,
    proposal: {
      changeDescription,
      currentText,
      proposedText,
      rationale,
    },
    status: rawStatus as JasperPlanFeedbackStatus,
    createdAt: data.createdAt,
    reviewedAt: typeof data.reviewedAt === 'string' ? data.reviewedAt : undefined,
    reviewedBy: typeof data.reviewedBy === 'string' ? data.reviewedBy : undefined,
    appliedVersionNumber: typeof data.appliedVersionNumber === 'number'
      ? data.appliedVersionNumber
      : undefined,
  };

  return record;
}

// ============================================================================
// LIST + GET
// ============================================================================

/**
 * Return every `jasperPlanEditFeedback` doc in status `pending_review`,
 * newest first. Empty array if the collection is empty or Firestore is
 * unavailable (logged). Malformed records are skipped and logged instead
 * of throwing — one bad doc should not break the whole reviewer queue.
 */
export async function listPendingJasperFeedback(): Promise<JasperPlanFeedbackRecord[]> {
  if (!adminDb) {
    logger.warn('[JasperPlanFeedback] adminDb not initialized — returning empty list');
    return [];
  }

  // No Firestore .orderBy here — that requires a composite index
  // (status + createdAt) that has to be created manually in the Firebase
  // console. Pending proposals are typically a handful, so client-side
  // sort is trivial cost and avoids the deploy friction. Same pattern
  // used by listJasperGMVersions.
  const snapshot = await adminDb
    .collection(getCollectionPath())
    .where('status', '==', 'pending_review')
    .get();

  const records: JasperPlanFeedbackRecord[] = [];
  for (const doc of snapshot.docs) {
    try {
      records.push(deserializeRecord(doc.id, doc.data()));
    } catch (err) {
      logger.warn('[JasperPlanFeedback] Skipping malformed record', {
        docId: doc.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Sort newest-first by createdAt (string ISO timestamp comparison works).
  records.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return records;
}

/**
 * Fetch a single feedback record by ID. Returns null if the doc is missing or
 * Firestore is unavailable. Throws deserialize errors as warnings and returns
 * null — callers should treat a null as "record does not exist or is unusable".
 */
export async function getJasperFeedback(
  feedbackId: string,
): Promise<JasperPlanFeedbackRecord | null> {
  if (!adminDb) {
    logger.warn('[JasperPlanFeedback] adminDb not initialized — cannot fetch record', {
      feedbackId,
    });
    return null;
  }

  const doc = await adminDb.collection(getCollectionPath()).doc(feedbackId).get();
  if (!doc.exists) { return null; }

  const data = doc.data();
  if (!data) { return null; }

  try {
    return deserializeRecord(doc.id, data);
  } catch (err) {
    logger.error(
      '[JasperPlanFeedback] Failed to deserialize record',
      err instanceof Error ? err : new Error(String(err)),
      { feedbackId },
    );
    return null;
  }
}

// ============================================================================
// APPROVE — gate for standing rule #2 ("no grades = no GM changes")
// ============================================================================

/**
 * Approve a pending plan-edit proposal. End-to-end:
 *   1. Read the feedback record, verify it exists and is in `pending_review`.
 *   2. Call `createJasperGMVersionFromEdit` with the proposal's `currentText`
 *      and either the operator's override or the original `proposedText`.
 *   3. Call `deployJasperGMVersion` with the new version number.
 *   4. Update the feedback record to `status: 'approved'`, stamp `reviewedAt`
 *      / `reviewedBy`, and record the `appliedVersionNumber`.
 *
 * Atomicity note: steps 1-3 cannot safely run inside a single Firestore
 * transaction because `createJasperGMVersionFromEdit` and
 * `deployJasperGMVersion` perform their own writes with their own
 * batch/query logic (query for active, batch deactivate/activate). We fall
 * back to "best effort with surfaced errors": if the GM version was created
 * but deploy or feedback-update failed, the error message carries the new
 * version number so an operator can retry the deploy manually. Step 4 itself
 * is a single-doc update and doesn't need a transaction.
 */
export async function approveJasperPlanEdit(
  feedbackId: string,
  approvedBy: string,
  optionalOverrides?: { proposedText?: string },
): Promise<{ success: boolean; newVersionNumber?: number; error?: string }> {
  const feedback = await getJasperFeedback(feedbackId);
  if (!feedback) {
    return { success: false, error: 'Feedback record not found' };
  }
  if (feedback.status !== 'pending_review') {
    return {
      success: false,
      error: `Feedback is in status '${feedback.status}', not 'pending_review' — cannot approve`,
    };
  }

  const currentText = feedback.proposal.currentText;
  const proposedText = optionalOverrides?.proposedText ?? feedback.proposal.proposedText;
  const rationale = feedback.proposal.rationale || feedback.proposal.changeDescription;

  if (currentText.length === 0 || proposedText.length === 0) {
    return {
      success: false,
      error: 'Proposal has empty currentText or proposedText — cannot approve',
    };
  }

  // Step 1: create the new GM version (not yet active).
  let newGM;
  try {
    newGM = await createJasperGMVersionFromEdit(
      {
        currentText,
        proposedText,
        rationale,
        sourceFeedbackId: feedbackId,
      },
      approvedBy,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[JasperPlanFeedback] Failed to create new Jasper GM version',
      err instanceof Error ? err : new Error(msg),
      { feedbackId },
    );
    return { success: false, error: `Failed to create new GM version: ${msg}` };
  }

  if (!newGM) {
    return {
      success: false,
      error: 'createJasperGMVersionFromEdit returned null — no active GM or Firestore unavailable',
    };
  }

  // Step 2: deploy the new version (flip active).
  let deployResult: { success: boolean; error?: string };
  try {
    deployResult = await deployJasperGMVersion(newGM.versionNumber);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[JasperPlanFeedback] Deploy threw after version was created',
      err instanceof Error ? err : new Error(msg),
      { feedbackId, newVersionNumber: newGM.versionNumber },
    );
    return {
      success: false,
      newVersionNumber: newGM.versionNumber,
      error: `GM v${newGM.versionNumber} created but deploy threw: ${msg}. Retry deploy manually.`,
    };
  }

  if (!deployResult.success) {
    return {
      success: false,
      newVersionNumber: newGM.versionNumber,
      error: `GM v${newGM.versionNumber} created but deploy failed: ${deployResult.error ?? 'unknown error'}. Retry deploy manually.`,
    };
  }

  // Step 3: mark the feedback approved.
  if (!adminDb) {
    return {
      success: false,
      newVersionNumber: newGM.versionNumber,
      error: 'GM deployed but adminDb unavailable — cannot mark feedback approved',
    };
  }

  const reviewedAt = new Date().toISOString();
  try {
    await adminDb
      .collection(getCollectionPath())
      .doc(feedbackId)
      .update({
        status: 'approved',
        reviewedAt,
        reviewedBy: approvedBy,
        appliedVersionNumber: newGM.versionNumber,
      });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[JasperPlanFeedback] Failed to mark feedback approved after deploy',
      err instanceof Error ? err : new Error(msg),
      { feedbackId, newVersionNumber: newGM.versionNumber },
    );
    return {
      success: false,
      newVersionNumber: newGM.versionNumber,
      error: `GM v${newGM.versionNumber} deployed but feedback status update failed: ${msg}`,
    };
  }

  logger.info('[JasperPlanFeedback] Approved plan edit — new Jasper GM deployed', {
    feedbackId,
    newVersionNumber: newGM.versionNumber,
    approvedBy,
  });

  return {
    success: true,
    newVersionNumber: newGM.versionNumber,
  };
}

// ============================================================================
// REJECT
// ============================================================================

/**
 * Reject a pending plan-edit proposal. Marks the feedback `rejected` with the
 * supplied reason. Jasper's Golden Master is NOT modified — the "no grades =
 * no GM changes" standing rule applies: a rejected proposal is a non-event
 * for the GM. The only side effect is the audit trail entry.
 *
 * Runs as a single-doc update (no transaction needed). We still validate that
 * the feedback is in `pending_review` so double-reject / reject-after-approve
 * is a clear error rather than silent state churn.
 */
export async function rejectJasperPlanEdit(
  feedbackId: string,
  rejectedBy: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  const feedback = await getJasperFeedback(feedbackId);
  if (!feedback) {
    return { success: false, error: 'Feedback record not found' };
  }
  if (feedback.status !== 'pending_review') {
    return {
      success: false,
      error: `Feedback is in status '${feedback.status}', not 'pending_review' — cannot reject`,
    };
  }

  if (!adminDb) {
    return { success: false, error: 'adminDb not initialized — cannot update record' };
  }

  const reviewedAt = new Date().toISOString();
  const trimmedReason = reason && reason.trim().length > 0
    ? reason.trim()
    : 'No reason supplied';

  try {
    await adminDb
      .collection(getCollectionPath())
      .doc(feedbackId)
      .update({
        status: 'rejected',
        reviewedAt,
        reviewedBy: rejectedBy,
        rejectionReason: trimmedReason,
      });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[JasperPlanFeedback] Failed to mark feedback rejected',
      err instanceof Error ? err : new Error(msg),
      { feedbackId },
    );
    return { success: false, error: `Failed to update record: ${msg}` };
  }

  logger.info('[JasperPlanFeedback] Rejected plan edit proposal', {
    feedbackId,
    rejectedBy,
    reason: trimmedReason,
  });

  return { success: true };
}
