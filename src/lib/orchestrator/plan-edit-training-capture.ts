/**
 * Plan-edit training capture
 *
 * Shared fire-and-forget helper that turns operator corrections during plan
 * review (edit-step, delete-step, reorder) into Jasper training proposals.
 *
 * Loads Jasper's active GM, asks the Prompt Engineer to propose a surgical
 * GM edit that would have produced the operator's corrected output, and
 * persists the proposal to `jasperPlanEditFeedback` with status 'pending_review'.
 * The JasperPlanFeedbackBanner UI then surfaces it for human approval.
 *
 * Standing Rule #2: this helper writes ONLY a proposal — never modifies a GM.
 * Human approval via approveJasperPlanEdit is the only path that creates a
 * new GM version.
 *
 * Non-fatal: every error is logged but never thrown. The plan mutation that
 * triggered this call has already succeeded by the time we run.
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getActiveJasperGoldenMaster } from '@/lib/orchestrator/jasper-golden-master';
import { proposePromptRevision } from '@/lib/training/prompt-engineer-agent';

export type PlanCorrectionActionType = 'edit' | 'delete' | 'reorder';

export interface PlanCorrectionInput {
  missionId: string;
  stepId: string | null;          // null for reorder (correction is on the plan as a whole)
  actionType: PlanCorrectionActionType;
  before: unknown;                // shape varies by actionType (step snapshot or order list)
  after: unknown;                 // null for delete; new order for reorder; updated step for edit
  graderUserId: string;
}

function buildCorrection(input: PlanCorrectionInput): string {
  const { missionId, stepId, actionType, before, after } = input;
  const stepRef = stepId !== null ? `step "${stepId}"` : 'the step ordering';

  const actionDescriptor: Record<PlanCorrectionActionType, string> = {
    edit: 'changed the step\'s summary or arguments',
    delete: 'deleted the step entirely',
    reorder: 'reordered the steps in the plan',
  };

  const lines: string[] = [
    `While drafting the plan for mission ${missionId}, you produced ${stepRef}.`,
    `The operator ${actionDescriptor[actionType]}.`,
    '',
    'ORIGINAL (what you wrote):',
    `  ${JSON.stringify(before, null, 2).split('\n').join('\n  ')}`,
    '',
  ];

  if (actionType === 'delete') {
    lines.push('OPERATOR ACTION: deleted this step. The step should not appear in plans of this shape.');
  } else {
    lines.push('OPERATOR CORRECTION (what they replaced it with):');
    lines.push(`  ${JSON.stringify(after, null, 2).split('\n').join('\n  ')}`);
  }

  lines.push('');
  lines.push(
    'Extract the GENERAL pattern from this correction and adjust your plan-drafting behavior so future prompts of this shape produce the operator\'s corrected version on first pass. The correction is authoritative — you were wrong to produce the original.',
  );
  lines.push(
    'IMPORTANT: only propose an edit if a clear GENERAL rule emerges — do not over-fit to a single one-off correction.',
  );

  return lines.join('\n');
}

export interface CapturedJasperProposal {
  feedbackId: string;
  agentType: 'orchestrator';
  beforeSection: string;
  afterSection: string;
  changeDescription: string;
  fullRevisedPrompt: string;
  clarifyingQuestion?: string;
}

/**
 * Capture an operator's plan correction as a Jasper training proposal.
 * Awaits the Prompt Engineer call so the caller can return the proposal in
 * the API response — the UI then opens the existing PromptRevisionPopup
 * inline with this proposal as input. The 3-box picker (Keep / Accept /
 * Rewrite) submits to /api/training/jasper-plan-feedback/[id]/{approve,reject}.
 *
 * Returns the proposal + feedbackId on success, null on any failure (no GM,
 * Firestore unavailable, Prompt Engineer error). All errors are logged. The
 * caller is expected to gracefully degrade (the plan mutation itself has
 * already landed by the time this runs).
 *
 * Standing Rule #2 still gated downstream: this only WRITES the proposal to
 * status='pending_review'. No GM mutation happens until the operator
 * explicitly clicks Accept in the popup, which calls the approve endpoint.
 */
export async function captureJasperPlanCorrection(
  input: PlanCorrectionInput,
): Promise<CapturedJasperProposal | null> {
  const { missionId, stepId, actionType, before, after, graderUserId } = input;
  const logKey = { missionId, stepId, actionType };

  try {
    const gm = await getActiveJasperGoldenMaster();
    if (gm === null) {
      logger.warn('[PlanEditTraining] No active Jasper GM — skipping Prompt Engineer call', logKey);
      return null;
    }

    const correction = buildCorrection(input);
    const proposal = await proposePromptRevision({
      agentType: 'orchestrator',
      currentSystemPrompt: gm.systemPrompt,
      correction,
      context: `Plan ${actionType} on mission ${missionId}${stepId !== null ? `, step ${stepId}` : ''}`,
    });

    if (!adminDb) {
      logger.warn('[PlanEditTraining] Firestore admin not available — cannot persist proposal', logKey);
      return null;
    }

    const stepIdSegment = stepId ?? 'reorder';
    const feedbackId = `planedit_${missionId}_${stepIdSegment}_${Date.now()}`;
    const collectionPath = getSubCollection('jasperPlanEditFeedback');
    await adminDb.collection(collectionPath).doc(feedbackId).set({
      id: feedbackId,
      missionId,
      stepId: stepId ?? null,
      actionType,
      graderUserId,
      targetSpecialistId: 'JASPER_ORCHESTRATOR',
      targetSpecialistName: 'Jasper (Orchestrator)',
      before,
      after,
      correction,
      proposal,
      status: 'pending_review',
      createdAt: new Date().toISOString(),
    });
    logger.info('[PlanEditTraining] Jasper revision proposal persisted', {
      ...logKey,
      feedbackId,
      changeDescription: proposal.changeDescription,
    });

    return {
      feedbackId,
      agentType: 'orchestrator',
      beforeSection: proposal.beforeSection ?? '',
      afterSection: proposal.afterSection ?? '',
      changeDescription: proposal.changeDescription ?? '',
      fullRevisedPrompt: proposal.fullRevisedPrompt ?? '',
      clarifyingQuestion: proposal.clarifyingQuestion,
    };
  } catch (err) {
    logger.warn('[PlanEditTraining] Proposal failed — plan correction itself still landed', {
      ...logKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
