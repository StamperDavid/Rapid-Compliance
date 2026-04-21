/**
 * Plan Edit-Step Endpoint (M4)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/edit-step
 *
 * Edits a single step in a draft plan — operator can change the
 * one-line summary and/or the tool arguments. Mission must be in
 * PLAN_PENDING_APPROVAL status; step must be in PROPOSED status.
 *
 * Body: {
 *   stepId: string,
 *   updates: { summary?: string, toolArgs?: Record<string, unknown> }
 * }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { updatePlannedStep, type UpdatePlannedStepResult } from '@/lib/orchestrator/mission-persistence';
import { getActiveJasperGoldenMaster } from '@/lib/orchestrator/jasper-golden-master';
import { proposePromptRevision } from '@/lib/training/prompt-engineer-agent';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

const EditStepSchema = z.object({
  stepId: z.string().min(1).max(200),
  updates: z.object({
    summary: z.string().min(1).max(500).optional(),
    toolArgs: z.record(z.unknown()).optional(),
  }).refine(
    (v) => v.summary !== undefined || v.toolArgs !== undefined,
    { message: 'updates must include at least one of: summary, toolArgs' },
  ),
});

/**
 * Fire-and-forget: capture the operator's edit as a training signal for
 * Jasper. Loads Jasper's active GM, asks the Prompt Engineer to propose a
 * surgical edit, persists the proposal to `jasperPlanEditFeedback` for a
 * future review UI. Non-fatal — logged but does not affect the API response.
 */
async function proposeJasperRevisionFromEdit(
  missionId: string,
  stepId: string,
  result: UpdatePlannedStepResult,
  graderUserId: string,
): Promise<void> {
  if (!result.before || !result.after) { return; }

  const before = result.before;
  const after = result.after;
  const correction = [
    `While drafting the plan for mission ${missionId}, you produced step "${stepId}" with toolName=${before.toolName}.`,
    '',
    'ORIGINAL (what you wrote):',
    `  summary: ${JSON.stringify(before.summary ?? '')}`,
    `  toolArgs: ${JSON.stringify(before.toolArgs ?? {}, null, 2)}`,
    '',
    'OPERATOR EDIT (what they changed it to):',
    `  summary: ${JSON.stringify(after.summary ?? '')}`,
    `  toolArgs: ${JSON.stringify(after.toolArgs ?? {}, null, 2)}`,
    '',
    'Extract the general pattern from this correction and adjust your plan-drafting behavior so future prompts that match this shape produce the operator\'s edited version on first pass. The correction is authoritative — you were wrong to produce the original.',
  ].join('\n');

  try {
    const gm = await getActiveJasperGoldenMaster();
    if (gm === null) {
      logger.warn('[PlanEditTraining] No active Jasper GM — skipping Prompt Engineer call', { missionId, stepId });
      return;
    }

    const proposal = await proposePromptRevision({
      agentType: 'orchestrator',
      currentSystemPrompt: gm.systemPrompt,
      correction,
      context: `Plan edit on mission ${missionId}, step ${stepId}`,
    });

    if (!adminDb) {
      logger.warn('[PlanEditTraining] Firestore admin not available — cannot persist proposal', { missionId, stepId });
      return;
    }

    const feedbackId = `planedit_${missionId}_${stepId}_${Date.now()}`;
    const collectionPath = getSubCollection('jasperPlanEditFeedback');
    await adminDb.collection(collectionPath).doc(feedbackId).set({
      id: feedbackId,
      missionId,
      stepId,
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
      feedbackId,
      missionId,
      stepId,
      changeDescription: proposal.changeDescription,
    });
  } catch (err) {
    logger.warn('[PlanEditTraining] Proposal failed — edit itself still landed', {
      missionId,
      stepId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> },
) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  try {
    const { missionId } = await params;
    if (!missionId) {
      return NextResponse.json({ success: false, error: 'missionId is required' }, { status: 400 });
    }

    const body: unknown = await request.json();
    const parsed = EditStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await updatePlannedStep(missionId, parsed.data.stepId, parsed.data.updates);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not edit step — mission may not be in plan-review status, step may not be in proposed status, or the IDs may not exist.',
        },
        { status: 409 },
      );
    }

    // Fire-and-forget: capture the edit as a training signal for Jasper.
    // Does NOT block the response — the Prompt Engineer LLM call takes
    // seconds and the operator doesn't need to wait.
    void proposeJasperRevisionFromEdit(missionId, parsed.data.stepId, result, user.uid);

    return NextResponse.json({ success: true, missionId, stepId: parsed.data.stepId });
  } catch (err) {
    logger.error('[PlanAPI] edit-step failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to edit step' }, { status: 500 });
  }
}
