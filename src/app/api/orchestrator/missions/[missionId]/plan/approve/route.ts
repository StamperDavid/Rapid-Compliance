/**
 * Plan Approve Endpoint (M4)
 *
 * POST /api/orchestrator/missions/[missionId]/plan/approve
 *
 * Approves a draft plan and runs the steps. Mission must be in
 * PLAN_PENDING_APPROVAL status. After approval the operator cannot
 * edit individual steps any further (until M3 lands and per-step pause
 * gives them a new edit point between steps).
 *
 * **TEMPORARY M4 → M3 BRIDGE — REMOVE WHEN M3 LANDS:**
 *
 * Today this endpoint runs every approved step sequentially in-process,
 * one after another, by directly invoking executeToolCall with the
 * operator-approved toolName + toolArgs. The steps go through the
 * normal manager review gate (per Standing Rule "Jasper delegates to
 * managers") and write their results to the mission step records.
 *
 * The behavior the operator will see:
 *   1. Click approve
 *   2. Mission flips to IN_PROGRESS in the SSE stream
 *   3. Each PROPOSED step runs sequentially (NOT parallel — the bridge
 *      respects step order so M3 has a clean upgrade path)
 *   4. Step statuses update live in Mission Control via the existing
 *      mission stream
 *   5. Mission flips to COMPLETED or FAILED when the last step finishes
 *
 * What's MISSING from this bridge until M3 lands:
 *   - No per-step pause — the bridge runs all approved steps to
 *     completion without stopping for operator review between them.
 *   - No "approve / edit / rerun" buttons during execution — the
 *     approval was at plan time, before any step ran.
 *   - The HTTP request stays open for the entire mission duration.
 *     Long missions may exceed Vercel's 30s timeout on hobby tier.
 *     For dev this is fine — there is no timeout.
 *
 * M3 will replace the inline loop here with a queued advance-mission
 * call that runs ONE step at a time and returns. Then the operator
 * approves each step before the next one starts.
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
    // to run. Snapshot is fine — once approved, no further edits are
    // allowed via the plan endpoints.
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

    // Step 3: run each approved step sequentially. The bridge does NOT
    // run in parallel because M3 will replace it with a step-by-step
    // pause — keeping the bridge sequential makes the upgrade clean.
    const toolContext: ToolCallContext = {
      conversationId: mission.conversationId,
      missionId,
      userPrompt: mission.userPrompt,
      userId: user.uid,
    };

    let anyFailed = false;

    for (const step of proposedSteps) {
      // Mark this step as RUNNING in Firestore so the SSE stream pushes
      // the update to the operator's Mission Control view.
      await updateMissionStep(missionId, step.stepId, {
        status: 'RUNNING',
      });

      // Build a synthetic ToolCall to feed executeToolCall. The id is
      // synthetic — executeToolCall only uses it for the response
      // tool_call_id, which we don't care about here because we're not
      // feeding the result back into an LLM.
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
        // Detect tool-level errors via the same convention chat/route uses
        // — top-level `error` field in JSON content marks failure.
        try {
          const parsed = JSON.parse(result.content) as Record<string, unknown>;
          if (typeof parsed.error === 'string' && parsed.error.length > 0) {
            stepStatus = 'FAILED';
            errorText = parsed.error;
          }
        } catch {
          // Non-JSON content — treat as success
        }
      } catch (err: unknown) {
        stepStatus = 'FAILED';
        errorText = err instanceof Error ? err.message : String(err);
        logger.error('[PlanApprove] Step execution threw', err instanceof Error ? err : undefined, {
          missionId, stepId: step.stepId, toolName: step.toolName,
        });
      }

      const stepDuration = Date.now() - stepStart;

      // Persist the final step state. The bridge writes RUNNING → terminal
      // directly without going through trackMissionStep, because the
      // step ID was assigned at plan time and lives in the embedded
      // steps array — trackMissionStep's stack-based ID map would not
      // know about it.
      await updateMissionStep(missionId, step.stepId, {
        status: stepStatus,
        completedAt: new Date().toISOString(),
        durationMs: stepDuration,
        toolResult: resultText,
        ...(errorText ? { error: errorText } : {}),
      });

      if (stepStatus === 'FAILED') {
        anyFailed = true;
        // Continue running subsequent steps even if one fails — the
        // operator can review the partial mission after it ends.
        // Stopping on first failure would lose work that might still
        // be useful (the M3 design will let the operator pause/edit
        // here instead).
      }
    }

    // Step 4: finalize mission. FAILED if any step failed, COMPLETED
    // otherwise. This matches the chat/route post-loop convention.
    const finalStatus: 'COMPLETED' | 'FAILED' = anyFailed ? 'FAILED' : 'COMPLETED';
    await finalizeMission(missionId, finalStatus);

    return NextResponse.json({
      success: true,
      missionId,
      stepsRun: proposedSteps.length,
      status: finalStatus,
    });
  } catch (err) {
    logger.error('[PlanAPI] approve failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: 'Failed to approve plan' }, { status: 500 });
  }
}
