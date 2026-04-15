/**
 * Per-Step Rerun Endpoint (M3.6 — corrected design)
 *
 * POST /api/orchestrator/missions/[missionId]/steps/[stepId]/rerun
 *
 * The operator wants to retry a step. Two cases:
 *
 *   - The mission halted at this step (mission status AWAITING_APPROVAL,
 *     step status FAILED). Operator clicks rerun. We reset the step to
 *     PROPOSED, optionally with edited args, then call the runner to
 *     RESUME the mission from there. If the rerun succeeds and there
 *     are more steps after it, those run automatically too. If the
 *     rerun fails twice, the mission halts again.
 *
 *   - The mission already finished (status COMPLETED) and the operator
 *     is unhappy with one specific step's result. They click rerun.
 *     The step resets, runs again, and if successful the mission
 *     finalizes COMPLETED again. Other completed steps are not
 *     re-executed — only the one the operator chose.
 *
 * Body: { newToolArgs?: Record<string, unknown> }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  rerunMissionStep,
  getMission,
} from '@/lib/orchestrator/mission-persistence';
import { runMissionToCompletion } from '@/lib/orchestrator/step-runner';

export const dynamic = 'force-dynamic';

const RerunSchema = z.object({
  newToolArgs: z.record(z.unknown()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string; stepId: string }> },
) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  try {
    const { missionId, stepId } = await params;
    if (!missionId || !stepId) {
      return NextResponse.json(
        { success: false, error: 'missionId and stepId are required' },
        { status: 400 },
      );
    }

    let parsed: { newToolArgs?: Record<string, unknown> } = {};
    try {
      const body: unknown = await request.json();
      const result = RerunSchema.safeParse(body);
      if (result.success) { parsed = result.data; }
    } catch {
      // Empty body is allowed — no edits, just rerun.
    }

    // Phase 1: reset the step to PROPOSED (with edited args if provided).
    // rerunMissionStep refuses if the step is not currently FAILED or
    // COMPLETED — those are the only states a rerun makes sense from.
    const reset = await rerunMissionStep(missionId, stepId, {
      ...(parsed.newToolArgs ? { newToolArgs: parsed.newToolArgs } : {}),
    });
    if (!reset) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not rerun step — it may not exist or may not be in a rerunnable status',
        },
        { status: 409 },
      );
    }

    // The reset step is PROPOSED with its existing operatorApproved
    // flag preserved. Since this step has already run before (was in
    // FAILED or COMPLETED), its operatorApproved was true at execution
    // time. rerunMissionStep doesn't touch that flag, so the runner
    // will pick the step up automatically.

    // Phase 2: load the mission for runner context, then run.
    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission disappeared after rerun reset' },
        { status: 500 },
      );
    }

    // Phase 3: run the mission to completion. The runner picks up at
    // the first runnable PROPOSED step (which is the one we just
    // reset) and continues from there. If there are additional
    // unrun-or-FAILED steps after the reset one, they run too.
    const runResult = await runMissionToCompletion({
      missionId,
      userId: user.uid,
      conversationId: mission.conversationId,
      userPrompt: mission.userPrompt,
    });

    return NextResponse.json({
      success: runResult.success,
      missionId,
      stepId,
      finalStatus: runResult.finalStatus,
      stepsRun: runResult.stepsRun,
      stepsFailed: runResult.stepsFailed,
      ...(runResult.haltedAtStepId ? { haltedAtStepId: runResult.haltedAtStepId } : {}),
      ...(runResult.error ? { error: runResult.error } : {}),
    });
  } catch (err) {
    logger.error('[StepAPI] rerun failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to rerun step' }, { status: 500 });
  }
}
