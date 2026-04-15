/**
 * Per-Step Rerun Endpoint (M3 — per-step pause)
 *
 * POST /api/orchestrator/missions/[missionId]/steps/[stepId]/rerun
 *
 * The operator rejected a step's result and wants to retry. They
 * optionally edit the tool args first. This endpoint:
 *   1. Resets the step to PROPOSED via rerunMissionStep, optionally
 *      replacing its toolArgs
 *   2. Calls the shared step runner — the step transitions through
 *      RUNNING and ends back in AWAITING_APPROVAL with a fresh result
 *
 * The step ID stays the same — rerunning is an in-place retry, not a
 * new step. The history of prior runs is NOT preserved (the prior
 * toolResult/error/durationMs fields are stripped) because that lives
 * in the operator's head and the audit log; keeping every retry in the
 * step record would clutter the UI.
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
import { runOneStep } from '@/lib/orchestrator/step-runner';

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

    // Body is optional — operator may rerun with no edits.
    let parsed: { newToolArgs?: Record<string, unknown> } = {};
    try {
      const body: unknown = await request.json();
      const result = RerunSchema.safeParse(body);
      if (result.success) { parsed = result.data; }
    } catch {
      // Empty body is allowed — no edits, just rerun.
    }

    // Phase 1: reset the step to PROPOSED (with edited args if provided).
    // rerunMissionStep refuses if the step is not currently in
    // AWAITING_APPROVAL or FAILED — anything else means the rerun is
    // out of order and we should reject it.
    const reset = await rerunMissionStep(missionId, stepId, {
      ...(parsed.newToolArgs ? { newToolArgs: parsed.newToolArgs } : {}),
    });
    if (!reset) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not rerun step — it may not exist, or may not be in AWAITING_APPROVAL or FAILED status',
        },
        { status: 409 },
      );
    }

    // Phase 2: load the mission so we have conversationId + userPrompt
    // for the runner context.
    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission disappeared after rerun reset' },
        { status: 500 },
      );
    }

    // Phase 3: run the step. Same shared runner — RUNNING → execute →
    // AWAITING_APPROVAL with the new result.
    const runResult = await runOneStep({
      missionId,
      stepId,
      userId: user.uid,
      conversationId: mission.conversationId,
      userPrompt: mission.userPrompt,
    });

    if (!runResult.success && !runResult.mission) {
      return NextResponse.json(
        { success: false, error: runResult.error ?? 'Step runner failed during rerun' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      missionId,
      stepId,
      missionStatus: 'AWAITING_APPROVAL',
      stepStatus: runResult.success ? 'AWAITING_APPROVAL' : 'AWAITING_APPROVAL_WITH_ERROR',
      ...(runResult.error ? { stepError: runResult.error } : {}),
    });
  } catch (err) {
    logger.error('[StepAPI] rerun failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to rerun step' }, { status: 500 });
  }
}
