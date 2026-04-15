/**
 * Per-Step Approve Endpoint (M3 — per-step pause)
 *
 * POST /api/orchestrator/missions/[missionId]/steps/[stepId]/approve
 *
 * The operator approved a step that was parked in AWAITING_APPROVAL.
 * This endpoint:
 *   1. Marks the step as COMPLETED in Firestore (markStepApproved)
 *   2. Finds the next PROPOSED step in the mission (findNextProposedStep)
 *   3. If a next step exists, runs it via the shared step runner — the
 *      next step ends in AWAITING_APPROVAL and the operator gets to
 *      review it
 *   4. If no next step exists, finalizes the mission as COMPLETED
 *
 * The HTTP request stays open for the duration of the next step. Long
 * tools (multi-minute manager delegations) will hold the request — for
 * dev that's fine, for production hosting we'd use waitUntil.
 *
 * Body: empty object {} — no parameters needed.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  markStepApproved,
  findNextProposedStep,
  finalizeMission,
} from '@/lib/orchestrator/mission-persistence';
import { runOneStep } from '@/lib/orchestrator/step-runner';

export const dynamic = 'force-dynamic';

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

    // Phase 1: flip the approved step from AWAITING_APPROVAL → COMPLETED.
    // markStepApproved returns the updated mission so we don't have to
    // re-read it.
    const updatedMission = await markStepApproved(missionId, stepId);
    if (!updatedMission) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not approve step — it may not exist or may not be in AWAITING_APPROVAL status',
        },
        { status: 409 },
      );
    }

    // Phase 2: find the next proposed step. If none, the mission is
    // done — finalize it as COMPLETED.
    const nextStep = findNextProposedStep(updatedMission);
    if (!nextStep) {
      // Decide final status by looking at every step. If any step
      // failed, the mission is FAILED; otherwise COMPLETED. (A step
      // that the operator chose to approve despite an error counts as
      // a known-failed step — the operator made the call.)
      const anyFailed = updatedMission.steps.some(
        (s) => s.error !== undefined && s.error.length > 0,
      );
      const finalStatus: 'COMPLETED' | 'FAILED' = anyFailed ? 'FAILED' : 'COMPLETED';
      await finalizeMission(missionId, finalStatus);

      return NextResponse.json({
        success: true,
        missionId,
        approvedStepId: stepId,
        nextStepId: null,
        missionStatus: finalStatus,
        message: `Mission finished — ${finalStatus.toLowerCase()}`,
      });
    }

    // Phase 3: run the next step. runOneStep transitions it through
    // RUNNING and parks it in AWAITING_APPROVAL with the result. The
    // operator will see the new state in Mission Control via SSE.
    const runResult = await runOneStep({
      missionId,
      stepId: nextStep.stepId,
      userId: user.uid,
      conversationId: updatedMission.conversationId,
      userPrompt: updatedMission.userPrompt,
    });

    if (!runResult.success && !runResult.mission) {
      return NextResponse.json(
        { success: false, error: runResult.error ?? 'Next-step runner failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      missionId,
      approvedStepId: stepId,
      nextStepId: nextStep.stepId,
      missionStatus: 'AWAITING_APPROVAL',
      nextStepStatus: runResult.success ? 'AWAITING_APPROVAL' : 'AWAITING_APPROVAL_WITH_ERROR',
      ...(runResult.error ? { nextStepError: runResult.error } : {}),
    });
  } catch (err) {
    logger.error('[StepAPI] approve failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to approve step' }, { status: 500 });
  }
}
