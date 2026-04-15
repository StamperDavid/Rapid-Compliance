/**
 * Grade Submission Service — Phase 3 manager rebuild orchestrator
 *
 * This is the public API for the "human grades a specialist output →
 * Prompt Engineer proposes a surgical edit → human approves → new GM
 * version deploys" pipeline.
 *
 * Honors the standing rule: `no grades = no GM changes`. Every path by
 * which a specialist Golden Master can be edited in production flows
 * through this service, and every path requires an explicit human grade
 * + explanation as input.
 *
 * Flow:
 *   1. submitGrade() — human flags a specialist output with a grade +
 *      explanation. Service creates a TrainingFeedback record, loads the
 *      target specialist's current GM, runs the Prompt Engineer to
 *      propose a surgical edit, and returns the proposal for human review.
 *
 *   2. approvePromptEdit() — human approves the proposed edit in the UI.
 *      Service creates a new industry-scoped GM version with the edit
 *      applied, deploys it (deactivating the old version), invalidates
 *      the specialist's GM cache, and marks the feedback applied.
 *
 *   3. rejectPromptEdit() — human rejects the proposed edit. Service
 *      marks the feedback discarded with the rejection reason. No GM
 *      changes.
 *
 * @module training/grade-submission-service
 */

import { logger } from '@/lib/logger/logger';
import {
  createTrainingFeedback,
  linkFeedbackToImprovementRequest,
  markFeedbackApplied,
  markFeedbackDiscarded,
  markFeedbackClarificationNeeded,
  getTrainingFeedback,
} from './training-feedback-service';
import {
  getActiveSpecialistGMByIndustry,
  createIndustryGMVersionFromEdit,
  deployIndustryGMVersion,
} from './specialist-golden-master-service';
import {
  getPromptEngineer,
  type ProposePromptEditResult,
  type EditProposedResult,
  type ClarificationNeededResult,
} from '@/lib/agents/prompt-engineer/specialist';
import type { AgentMessage } from '@/lib/agents/types';
import type { TrainingFeedback } from '@/types/training';

const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

// ============================================================================
// SUBMIT GRADE
// ============================================================================

export interface SubmitGradeInput {
  targetSpecialistId: string;
  targetSpecialistName: string;
  sourceReportTaskId: string;
  sourceReportExcerpt: string;
  grade: TrainingFeedback['grade'];
  explanation: string;
  graderUserId: string;
  graderDisplayName?: string;
  industryKey?: string;
}

export type SubmitGradeResult =
  | {
      status: 'EDIT_PROPOSED';
      feedbackId: string;
      proposedEdit: EditProposedResult;
      targetSpecialistId: string;
      targetSpecialistCurrentPrompt: string;
    }
  | {
      status: 'CLARIFICATION_NEEDED';
      feedbackId: string;
      clarification: ClarificationNeededResult;
    }
  | {
      status: 'ERROR';
      feedbackId: string | null;
      error: string;
    };

/**
 * Submit a human grade on a specialist output. Creates the feedback record,
 * runs the Prompt Engineer to propose a surgical edit, and returns either
 * the proposed edit (for human review) or a clarification request (if the
 * correction is ambiguous).
 *
 * The feedback record starts as `pending_review`. It transitions to
 * `applied` when the human approves via `approvePromptEdit`, or `discarded`
 * when the human rejects via `rejectPromptEdit`, or `clarification_needed`
 * when the Prompt Engineer asks for more context.
 *
 * IMPORTANT: This function does NOT modify the target specialist's GM. The
 * GM is only modified after a separate `approvePromptEdit` call. This
 * preserves the human-in-the-loop guarantee.
 */
export async function submitGrade(input: SubmitGradeInput): Promise<SubmitGradeResult> {
  const industryKey = input.industryKey ?? DEFAULT_INDUSTRY_KEY;

  // Step 1: create the feedback record
  let feedback: TrainingFeedback;
  try {
    feedback = await createTrainingFeedback({
      targetSpecialistId: input.targetSpecialistId,
      targetSpecialistName: input.targetSpecialistName,
      sourceReportTaskId: input.sourceReportTaskId,
      sourceReportExcerpt: input.sourceReportExcerpt,
      grade: input.grade,
      explanation: input.explanation,
      graderUserId: input.graderUserId,
      graderDisplayName: input.graderDisplayName,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[GradeSubmission] Failed to create training feedback record', error instanceof Error ? error : new Error(msg));
    return { status: 'ERROR', feedbackId: null, error: `Failed to create feedback record: ${msg}` };
  }

  // Step 2: load the target specialist's current GM
  const activeGM = await getActiveSpecialistGMByIndustry(input.targetSpecialistId, industryKey);
  if (!activeGM) {
    const error = `No active Golden Master found for ${input.targetSpecialistId}:${industryKey}. Seed the specialist before grading.`;
    await markFeedbackDiscarded(feedback.id, error);
    return { status: 'ERROR', feedbackId: feedback.id, error };
  }

  const rawSystemPrompt = activeGM.config.systemPrompt;
  const currentPrompt = typeof rawSystemPrompt === 'string'
    ? rawSystemPrompt
    : activeGM.systemPromptSnapshot;
  if (!currentPrompt || currentPrompt.length < 100) {
    const error = `Target specialist GM ${activeGM.id} has no usable systemPrompt (length=${currentPrompt?.length ?? 0})`;
    await markFeedbackDiscarded(feedback.id, error);
    return { status: 'ERROR', feedbackId: feedback.id, error };
  }

  // Step 3: invoke Prompt Engineer to propose a surgical edit
  const promptEngineer = getPromptEngineer();
  await promptEngineer.initialize();

  const message: AgentMessage = {
    id: `grade_submit_${feedback.id}`,
    timestamp: new Date(),
    from: 'GRADE_SUBMISSION_SERVICE',
    to: 'PROMPT_ENGINEER',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      action: 'propose_prompt_edit',
      targetSpecialistId: input.targetSpecialistId,
      targetSpecialistName: input.targetSpecialistName,
      currentSystemPrompt: currentPrompt,
      correctedReportExcerpt: input.sourceReportExcerpt,
      humanCorrection: {
        grade: input.grade,
        explanation: input.explanation,
      },
      priorVersionCount: activeGM.version,
    },
    requiresResponse: true,
    traceId: `grade_${feedback.id}`,
  };

  const report = await promptEngineer.execute(message);

  if (report.status !== 'COMPLETED') {
    const errMsg = (report.errors ?? []).join(' | ') || 'Prompt Engineer returned non-COMPLETED status';
    await markFeedbackDiscarded(feedback.id, `Prompt Engineer execution failed: ${errMsg}`);
    return { status: 'ERROR', feedbackId: feedback.id, error: errMsg };
  }

  const result = report.data as ProposePromptEditResult;

  if (result.status === 'CLARIFICATION_NEEDED') {
    await markFeedbackClarificationNeeded(
      feedback.id,
      result.rationale,
    );
    return {
      status: 'CLARIFICATION_NEEDED',
      feedbackId: feedback.id,
      clarification: result,
    };
  }

  // EDIT_PROPOSED — link the feedback to the proposed edit. The improvement
  // request ID is the feedback ID itself for now (we aren't creating a
  // separate SpecialistImprovementRequest doc yet — that becomes Phase 3d
  // follow-up). The proposed edit lives in memory / returns to the caller.
  await linkFeedbackToImprovementRequest(feedback.id, feedback.id);

  return {
    status: 'EDIT_PROPOSED',
    feedbackId: feedback.id,
    proposedEdit: result,
    targetSpecialistId: input.targetSpecialistId,
    targetSpecialistCurrentPrompt: currentPrompt,
  };
}

// ============================================================================
// APPROVE PROMPT EDIT
// ============================================================================

export interface ApprovePromptEditInput {
  feedbackId: string;
  approvedEdit: EditProposedResult;
  approverUserId: string;
  approverDisplayName?: string;
  industryKey?: string;
}

export type ApprovePromptEditResult =
  | {
      status: 'DEPLOYED';
      feedbackId: string;
      newVersion: number;
      newGMDocId: string;
    }
  | {
      status: 'ERROR';
      feedbackId: string;
      error: string;
    };

/**
 * Human approved the proposed edit. Creates a new industry-scoped GM
 * version with the edit applied, deploys it atomically, and marks the
 * feedback record as applied.
 *
 * The approvedEdit object should be the exact EditProposedResult that
 * came back from submitGrade — the UI may have let the human tweak the
 * proposedText, in which case approvedEdit.proposedText will be the
 * edited version. Either way, currentText must appear verbatim in the
 * active GM's systemPrompt or the operation fails.
 */
export async function approvePromptEdit(
  input: ApprovePromptEditInput,
): Promise<ApprovePromptEditResult> {
  const industryKey = input.industryKey ?? DEFAULT_INDUSTRY_KEY;

  const feedback = await getTrainingFeedback(input.feedbackId);
  if (!feedback) {
    return { status: 'ERROR', feedbackId: input.feedbackId, error: 'Feedback record not found' };
  }
  if (feedback.status === 'applied') {
    return { status: 'ERROR', feedbackId: input.feedbackId, error: 'Feedback already applied' };
  }
  if (feedback.status === 'discarded') {
    return { status: 'ERROR', feedbackId: input.feedbackId, error: 'Feedback was already discarded' };
  }

  // Create the new GM version with the edit applied
  let newGM;
  try {
    newGM = await createIndustryGMVersionFromEdit(
      feedback.targetSpecialistId,
      industryKey,
      {
        currentText: input.approvedEdit.currentText,
        proposedText: input.approvedEdit.proposedText,
        rationale: input.approvedEdit.rationale,
        sourceTrainingFeedbackId: input.feedbackId,
      },
      `grade-submission-service (approver=${input.approverDisplayName ?? input.approverUserId})`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[GradeSubmission] Failed to create new GM version', error instanceof Error ? error : new Error(msg));
    return { status: 'ERROR', feedbackId: input.feedbackId, error: msg };
  }

  if (!newGM) {
    return { status: 'ERROR', feedbackId: input.feedbackId, error: 'createIndustryGMVersionFromEdit returned null' };
  }

  // Deploy the new version (deactivates the old, activates the new, invalidates cache)
  const deployResult = await deployIndustryGMVersion(
    feedback.targetSpecialistId,
    industryKey,
    newGM.version,
  );
  if (!deployResult.success) {
    return {
      status: 'ERROR',
      feedbackId: input.feedbackId,
      error: `New version created but deploy failed: ${deployResult.error}`,
    };
  }

  // Mark the feedback applied
  await markFeedbackApplied(input.feedbackId);

  logger.info(
    `[GradeSubmission] Approved edit for ${feedback.targetSpecialistId} — deployed v${newGM.version}`,
    {
      feedbackId: input.feedbackId,
      specialistId: feedback.targetSpecialistId,
      newVersion: newGM.version,
    },
  );

  return {
    status: 'DEPLOYED',
    feedbackId: input.feedbackId,
    newVersion: newGM.version,
    newGMDocId: newGM.id,
  };
}

// ============================================================================
// REJECT PROMPT EDIT
// ============================================================================

export interface RejectPromptEditInput {
  feedbackId: string;
  reason: string;
  rejecterUserId: string;
}

export async function rejectPromptEdit(input: RejectPromptEditInput): Promise<{ status: 'DISCARDED' | 'ERROR'; error?: string }> {
  const feedback = await getTrainingFeedback(input.feedbackId);
  if (!feedback) {
    return { status: 'ERROR', error: 'Feedback record not found' };
  }
  if (feedback.status === 'applied') {
    return { status: 'ERROR', error: 'Feedback already applied — cannot reject' };
  }

  await markFeedbackDiscarded(
    input.feedbackId,
    `Human rejected proposed edit: ${input.reason} (by ${input.rejecterUserId})`,
  );

  logger.info(`[GradeSubmission] Rejected edit for ${feedback.targetSpecialistId}`, {
    feedbackId: input.feedbackId,
    specialistId: feedback.targetSpecialistId,
    rejecterUserId: input.rejecterUserId,
  });

  return { status: 'DISCARDED' };
}
