/**
 * Training Feedback Service
 *
 * Stores human grades/corrections on specialist output. Each record is
 * the input to the Prompt Engineer's edit-proposal flow and the ONLY
 * path by which specialist Golden Master prompts get modified in
 * production.
 *
 * Honors the "no grades = no GM changes" standing rule: if a specialist
 * has zero TrainingFeedback records, its Golden Master is never touched.
 * This service is the gate that enforces that rule in code.
 *
 * Collection: `organizations/{orgId}/trainingFeedback`
 * Doc IDs:    `tfb_{targetSpecialistId}_{timestamp}`
 *
 * @module training/training-feedback-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { TrainingFeedback } from '@/types/training';

const TRAINING_FEEDBACK_COLLECTION = 'trainingFeedback';

function getFeedbackCollectionPath(): string {
  return getSubCollection(TRAINING_FEEDBACK_COLLECTION);
}

function buildFeedbackId(targetSpecialistId: string): string {
  return `tfb_${targetSpecialistId.toLowerCase()}_${Date.now()}`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface CreateTrainingFeedbackInput {
  targetSpecialistId: string;
  targetSpecialistName: string;
  sourceReportTaskId: string;
  sourceReportExcerpt: string;
  grade: TrainingFeedback['grade'];
  explanation: string;
  graderUserId: string;
  graderDisplayName?: string;
}

/**
 * Create a new training feedback record from a human grade.
 *
 * The record starts in status='pending_review'. The caller is expected
 * to invoke the Prompt Engineer next, then update this record with the
 * resulting improvement request ID.
 *
 * Fails loud if adminDb is unavailable — this is the only path by which
 * specialist prompts can be edited, so a silent skip would break the
 * standing rule.
 */
export async function createTrainingFeedback(
  input: CreateTrainingFeedbackInput,
): Promise<TrainingFeedback> {
  if (!adminDb) {
    throw new Error('[TrainingFeedbackService] adminDb not initialized — cannot create feedback record');
  }

  const now = new Date().toISOString();
  const id = buildFeedbackId(input.targetSpecialistId);

  const record: TrainingFeedback = {
    id,
    targetSpecialistId: input.targetSpecialistId,
    targetSpecialistName: input.targetSpecialistName,
    sourceReportTaskId: input.sourceReportTaskId,
    sourceReportExcerpt: input.sourceReportExcerpt,
    grade: input.grade,
    explanation: input.explanation,
    graderUserId: input.graderUserId,
    graderDisplayName: input.graderDisplayName,
    status: 'pending_review',
    linkedImprovementRequestId: null,
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection(getFeedbackCollectionPath()).doc(id).set(record);
  logger.info(`[TrainingFeedbackService] Created feedback ${id} for ${input.targetSpecialistId}`, {
    feedbackId: id,
    targetSpecialistId: input.targetSpecialistId,
    grade: input.grade,
  });
  return record;
}

/**
 * Link a training feedback record to the specialist improvement request
 * produced by the Prompt Engineer. Called immediately after the Prompt
 * Engineer runs.
 */
export async function linkFeedbackToImprovementRequest(
  feedbackId: string,
  improvementRequestId: string,
): Promise<void> {
  if (!adminDb) {
    throw new Error('[TrainingFeedbackService] adminDb not initialized');
  }
  await adminDb.collection(getFeedbackCollectionPath()).doc(feedbackId).update({
    linkedImprovementRequestId: improvementRequestId,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Mark a feedback record as applied. Called when the human approves
 * the Prompt Engineer's proposed edit and the new GM version is deployed.
 */
export async function markFeedbackApplied(feedbackId: string): Promise<void> {
  if (!adminDb) {
    throw new Error('[TrainingFeedbackService] adminDb not initialized');
  }
  const now = new Date().toISOString();
  await adminDb.collection(getFeedbackCollectionPath()).doc(feedbackId).update({
    status: 'applied',
    appliedAt: now,
    updatedAt: now,
  });
}

/**
 * Mark a feedback record as discarded. Called when the human rejects
 * the Prompt Engineer's proposed edit or decides the grade does not
 * warrant a prompt change.
 */
export async function markFeedbackDiscarded(
  feedbackId: string,
  reason: string,
): Promise<void> {
  if (!adminDb) {
    throw new Error('[TrainingFeedbackService] adminDb not initialized');
  }
  const now = new Date().toISOString();
  await adminDb.collection(getFeedbackCollectionPath()).doc(feedbackId).update({
    status: 'discarded',
    discardedAt: now,
    discardedReason: reason,
    updatedAt: now,
  });
}

/**
 * Mark a feedback record as awaiting clarification. Called when the
 * Prompt Engineer returned CLARIFICATION_NEEDED instead of an edit.
 */
export async function markFeedbackClarificationNeeded(
  feedbackId: string,
  notes?: string,
): Promise<void> {
  if (!adminDb) {
    throw new Error('[TrainingFeedbackService] adminDb not initialized');
  }
  await adminDb.collection(getFeedbackCollectionPath()).doc(feedbackId).update({
    status: 'clarification_needed',
    notes,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Read a single feedback record by ID.
 */
export async function getTrainingFeedback(
  feedbackId: string,
): Promise<TrainingFeedback | null> {
  if (!adminDb) { return null; }
  const doc = await adminDb.collection(getFeedbackCollectionPath()).doc(feedbackId).get();
  if (!doc.exists) { return null; }
  return doc.data() as TrainingFeedback;
}

/**
 * List training feedback records for a specific specialist, most recent
 * first. Used by the Training Lab UI to show feedback history per agent.
 */
export async function listTrainingFeedbackForSpecialist(
  targetSpecialistId: string,
  limit: number = 50,
): Promise<TrainingFeedback[]> {
  if (!adminDb) { return []; }
  const snap = await adminDb
    .collection(getFeedbackCollectionPath())
    .where('targetSpecialistId', '==', targetSpecialistId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as TrainingFeedback);
}

/**
 * List training feedback records in a given status across all specialists.
 * Used by the Training Lab home page to show "pending" items that need
 * human review.
 */
export async function listTrainingFeedbackByStatus(
  status: TrainingFeedback['status'],
  limit: number = 100,
): Promise<TrainingFeedback[]> {
  if (!adminDb) { return []; }
  const snap = await adminDb
    .collection(getFeedbackCollectionPath())
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as TrainingFeedback);
}
