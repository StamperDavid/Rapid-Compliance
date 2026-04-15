/**
 * Plan Approve Endpoint (M3 — switched on LEGACY_MISSION_EXECUTION_MODEL)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/approve
 *
 * Approves a draft plan and starts execution. Mission must be in
 * PLAN_PENDING_APPROVAL status. The behavior depends on the
 * `LEGACY_MISSION_EXECUTION_MODEL` switch in src/lib/constants/platform.ts:
 *
 *   - LEGACY_MISSION_EXECUTION_MODEL = false (current default, M3):
 *     runs ONLY the first proposed step, parks it in AWAITING_APPROVAL,
 *     returns. The operator reviews the result and clicks approve on
 *     the step (which calls /missions/[id]/steps/[stepId]/approve) to
 *     run the next step.
 *
 *   - LEGACY_MISSION_EXECUTION_MODEL = true (M4 bridge):
 *     runs every approved step inline, sequentially, all the way to
 *     mission completion. No per-step pause. Used as a rollback path
 *     during M3 rollout.
 *
 * Body: empty object {} — no parameters needed.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  approvePlan,
  getMission,
  updateMissionStep,
  finalizeMission,
} from '@/lib/orchestrator/mission-persistence';
import { executeToolCall, type ToolCallContext } from '@/lib/orchestrator/jasper-tools';
import { runOneStep } from '@/lib/orchestrator/step-runner';
import { LEGACY_MISSION_EXECUTION_MODEL } from '@/lib/constants/platform';
import type { ToolCall } from '@/lib/ai/openrouter-provider';

export const dynamic = 'force-dynamic';

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

    // Step 1: flip status from PLAN_PENDING_APPROVAL → IN_PROGRESS.
    // approvePlan() returns false if the mission is not in plan-review
    // status, which means another caller already approved or rejected
    // it, or the mission does not exist.
    const flipped = await approvePlan(missionId);
    if (!flipped) {
      return NextResponse.json(
        { success: false, error: 'Could not approve — mission is not in plan-review status or does not exist.' },
        { status: 409 },
      );
    }

    // Step 2: load the now-IN_PROGRESS mission so we know which steps
    // to run.
    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission disappeared after approve flip — Firestore inconsistency' },
        { status: 500 },
      );
    }

    const proposedSteps = mission.steps.filter((s) => s.status === 'PROPOSED');
    if (proposedSteps.length === 0) {
      // No steps to run — finalize as COMPLETED so the mission doesn't
      // hang in IN_PROGRESS forever.
      await finalizeMission(missionId, 'COMPLETED');
      return NextResponse.json({ success: true, missionId, stepsRun: 0, status: 'COMPLETED' });
    }

    // ───────────────────────────────────────────────────────────────────
    // M3 — NEW PER-STEP PAUSE PATH (current default)
    // ───────────────────────────────────────────────────────────────────
    if (!LEGACY_MISSION_EXECUTION_MODEL) {
      const firstStep = proposedSteps[0];
      const result = await runOneStep({
        missionId,
        stepId: firstStep.stepId,
        userId: user.uid,
        conversationId: mission.conversationId,
        userPrompt: mission.userPrompt,
      });

      if (!result.success && !result.mission) {
        // Hard failure — couldn't even start the step. Return a 500 so
        // the operator knows something is wrong with the mission state.
        return NextResponse.json(
          { success: false, error: result.error ?? 'Step runner failed' },
          { status: 500 },
        );
      }

      // Soft failure (tool returned an error) is still a successful
      // pause — the step is parked in AWAITING_APPROVAL with the error
      // captured, the operator will see it and decide whether to rerun.
      return NextResponse.json({
        success: true,
        missionId,
        stepsRun: 1,
        totalSteps: proposedSteps.length,
        status: 'AWAITING_APPROVAL',
        firstStepStatus: result.success ? 'AWAITING_APPROVAL' : 'AWAITING_APPROVAL_WITH_ERROR',
        ...(result.error ? { firstStepError: result.error } : {}),
      });
    }

    // ───────────────────────────────────────────────────────────────────
    // LEGACY M4 → M3 BRIDGE — runs every step inline, sequentially
    // ───────────────────────────────────────────────────────────────────
    // Reachable only when LEGACY_MISSION_EXECUTION_MODEL === true. See
    // src/lib/constants/platform.ts for the rollback procedure and the
    // permanent-removal procedure. Do NOT modify this branch — when the
    // switch goes away, this whole if-block goes away with it.
    const toolContext: ToolCallContext = {
      conversationId: mission.conversationId,
      missionId,
      userPrompt: mission.userPrompt,
      userId: user.uid,
    };

    let anyFailed = false;

    for (const step of proposedSteps) {
      await updateMissionStep(missionId, step.stepId, {
        status: 'RUNNING',
      });

      const syntheticToolCall: ToolCall = {
        id: `bridge_${step.stepId}`,
        type: 'function',
        function: {
          name: step.toolName,
          arguments: JSON.stringify(step.toolArgs ?? {}),
        },
      };

      const stepStart = Date.now();
      let stepStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED';
      let resultText = '';
      let errorText: string | undefined;

      try {
        const result = await executeToolCall(syntheticToolCall, toolContext);
        resultText = result.content;
        try {
          const parsed = JSON.parse(result.content) as Record<string, unknown>;
          if (typeof parsed.error === 'string' && parsed.error.length > 0) {
            stepStatus = 'FAILED';
            errorText = parsed.error;
          }
        } catch {
          // Non-JSON — success
        }
      } catch (err: unknown) {
        stepStatus = 'FAILED';
        errorText = err instanceof Error ? err.message : String(err);
        logger.error('[PlanApprove/Legacy] Step execution threw', err instanceof Error ? err : undefined, {
          missionId, stepId: step.stepId, toolName: step.toolName,
        });
      }

      const stepDuration = Date.now() - stepStart;

      await updateMissionStep(missionId, step.stepId, {
        status: stepStatus,
        completedAt: new Date().toISOString(),
        durationMs: stepDuration,
        toolResult: resultText,
        ...(errorText ? { error: errorText } : {}),
      });

      if (stepStatus === 'FAILED') {
        anyFailed = true;
      }
    }

    const finalStatus: 'COMPLETED' | 'FAILED' = anyFailed ? 'FAILED' : 'COMPLETED';
    await finalizeMission(missionId, finalStatus);

    return NextResponse.json({
      success: true,
      missionId,
      stepsRun: proposedSteps.length,
      status: finalStatus,
      executionMode: 'LEGACY',
    });
  } catch (err) {
    logger.error('[PlanAPI] approve failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to approve plan' }, { status: 500 });
  }
}
