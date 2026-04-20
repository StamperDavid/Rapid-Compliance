/**
 * step-runner — runs an approved mission plan to completion (M3.6 design)
 *
 * The runner walks a mission's PROPOSED steps in order, executes each
 * one via the real tool dispatcher, and either finishes the mission
 * (every step COMPLETED) or halts it at a failed step (the operator
 * can rerun or scrap from Mission Control).
 *
 * Failure handling: each step gets ONE automatic retry on failure. If
 * the second attempt also fails, the runner stops, marks the mission
 * AWAITING_APPROVAL, and returns. The operator decides what to do.
 *
 * No per-step pause for human approval. The user reverted that earlier
 * design — gating between every step turned automation into a chore.
 * Operator review and grading happens after the fact via the existing
 * StepGradeWidget infrastructure (M2b shipped that).
 *
 * @module orchestrator/step-runner
 */

import {
  getMission,
  markStepRunning,
  markStepDone,
  haltMissionAtFailedStep,
  finalizeMission,
  type Mission,
  type MissionStep,
} from './mission-persistence';
import { executeToolCall, type ToolCallContext } from './jasper-tools';
import type { ToolCall } from '@/lib/ai/openrouter-provider';
import { logger } from '@/lib/logger/logger';

export interface RunMissionInput {
  missionId: string;
  userId: string;
  conversationId: string;
  userPrompt: string;
}

export interface RunMissionResult {
  success: boolean;
  /** Final mission status — COMPLETED, AWAITING_APPROVAL (halted), or FAILED */
  finalStatus: 'COMPLETED' | 'AWAITING_APPROVAL' | 'FAILED';
  stepsRun: number;
  stepsFailed: number;
  haltedAtStepId?: string;
  error?: string;
}

interface StepRunOutcome {
  status: 'COMPLETED' | 'FAILED';
  toolResult: string;
  durationMs: number;
  error?: string;
}

/**
 * Run one step end-to-end and return the outcome. Does NOT advance to
 * the next step. Caller is responsible for the loop.
 *
 * Sequence:
 *   1. markStepRunning — flips PROPOSED → RUNNING
 *   2. Build a synthetic ToolCall, dispatch via executeToolCall
 *   3. markStepDone with COMPLETED or FAILED based on the result
 *
 * If executeToolCall throws, the step is still marked FAILED (with the
 * error captured) so it doesn't get stuck in RUNNING.
 */
async function runOneStepInternal(
  missionId: string,
  step: MissionStep,
  context: ToolCallContext,
): Promise<StepRunOutcome> {
  const ranOk = await markStepRunning(missionId, step.stepId);
  if (!ranOk) {
    return {
      status: 'FAILED',
      toolResult: JSON.stringify({ error: 'Could not start step — wrong status or missing' }),
      durationMs: 0,
      error: 'Could not start step',
    };
  }

  const syntheticToolCall: ToolCall = {
    id: `m3run_${step.stepId}`,
    type: 'function',
    function: {
      name: step.toolName,
      arguments: JSON.stringify(step.toolArgs ?? {}),
    },
  };

  const stepStart = Date.now();
  let toolResult = '';
  let stepError: string | undefined;
  let stepStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED';

  try {
    const result = await executeToolCall(syntheticToolCall, context);
    toolResult = result.content;
    // Tool-level errors come back as JSON with a top-level `error` field
    // — same convention every other dispatcher in the codebase uses.
    try {
      const parsed = JSON.parse(result.content) as Record<string, unknown>;
      if (typeof parsed.error === 'string' && parsed.error.length > 0) {
        stepError = parsed.error;
        stepStatus = 'FAILED';
      }
      // Unwrap delegate_to_* tool envelopes so the step's toolResult stores the
      // raw agent report data (IntelligenceBrief, ContentPackage, etc.) instead
      // of the outer {status, data, manager, reviewLink} wrapper. The Mission
      // Control review renderers expect the inner shape. Without this unwrap,
      // every delegate_to_* step falls through to DelegationResultReview which
      // only shows "Delegation completed successfully" instead of the rich
      // output.
      const isDelegateTool = step.toolName.startsWith('delegate_to_');
      const hasWrapperShape = isDelegateTool
        && typeof parsed === 'object'
        && parsed !== null
        && 'data' in parsed
        && typeof parsed.data === 'object'
        && parsed.data !== null;
      if (hasWrapperShape) {
        toolResult = JSON.stringify(parsed.data);
      }
    } catch {
      // Non-JSON tool result — treat as success
    }
  } catch (err: unknown) {
    stepError = err instanceof Error ? err.message : String(err);
    toolResult = JSON.stringify({ error: stepError });
    stepStatus = 'FAILED';
    logger.error('[StepRunner] executeToolCall threw', err instanceof Error ? err : undefined, {
      missionId, stepId: step.stepId, toolName: step.toolName,
    });
  }

  const durationMs = Date.now() - stepStart;

  await markStepDone(missionId, step.stepId, {
    status: stepStatus,
    toolResult,
    durationMs,
    ...(stepError ? { error: stepError } : {}),
  });

  return {
    status: stepStatus,
    toolResult,
    durationMs,
    ...(stepError ? { error: stepError } : {}),
  };
}

/**
 * Reset a FAILED step back to PROPOSED for the auto-retry path. Does
 * NOT touch toolArgs — that's reserved for the operator-driven manual
 * rerun (rerunMissionStep). Auto-retry is an in-place "try the same
 * thing again because the failure might be transient (network, rate
 * limit, brief outage)".
 */
async function resetForAutoRetry(missionId: string, stepId: string): Promise<boolean> {
  const { rerunMissionStep } = await import('./mission-persistence');
  const result = await rerunMissionStep(missionId, stepId);
  return result !== null;
}

/**
 * Run an approved mission plan from wherever it currently is to
 * completion. Picks up at the first PROPOSED step (and skips steps the
 * operator hasn't approved yet — see findRunnableProposedStep).
 *
 * Loop:
 *   1. Find the next runnable step (PROPOSED + operatorApproved=true)
 *   2. If none, finalize the mission and return
 *   3. Run the step
 *   4. If success, loop
 *   5. If failure, auto-retry once
 *   6. If retry also fails, halt the mission and return
 *
 * Used by:
 *   - POST /api/orchestrator/missions/[id]/plan/approve (after the
 *     operator approves the plan, kicks off execution from step 1)
 *   - POST /api/orchestrator/missions/[id]/steps/[stepId]/rerun (after
 *     the operator reruns a failed or completed step, picks up from
 *     wherever the runner can find a PROPOSED step — usually the one
 *     just reset, then any unfinished steps after it)
 */
export async function runMissionToCompletion(input: RunMissionInput): Promise<RunMissionResult> {
  const { missionId, userId, conversationId, userPrompt } = input;
  // suppressStepTracking=true because this runner drives plan_step_* state
  // directly via markStepRunning/markStepDone. Without it, the tool wrapper's
  // trackMissionStep would ALSO append separate step_delegate_* rows, which
  // is Bug D — the UI then shows 2×N rows for an N-step plan.
  const toolContext: ToolCallContext = { conversationId, missionId, userPrompt, userId, suppressStepTracking: true };

  let stepsRun = 0;
  let stepsFailed = 0;

  // Hard upper bound on iterations to prevent infinite loops if the
  // step status state machine somehow gets stuck. The plan should
  // never have more than ~50 steps in practice.
  const MAX_STEPS = 100;

  for (let i = 0; i < MAX_STEPS; i++) {
    const mission = await getMission(missionId);
    if (!mission) {
      return {
        success: false,
        finalStatus: 'FAILED',
        stepsRun,
        stepsFailed,
        error: 'Mission disappeared mid-execution',
      };
    }

    const nextStep = findRunnableProposedStep(mission);
    if (!nextStep) {
      // No more runnable steps. Decide whether the mission is done or
      // partially done. If any step is FAILED, the mission failed.
      // Otherwise it's COMPLETED.
      const anyFailed = mission.steps.some((s) => s.status === 'FAILED');
      const finalStatus: 'COMPLETED' | 'FAILED' = anyFailed ? 'FAILED' : 'COMPLETED';
      await finalizeMission(missionId, finalStatus);
      return {
        success: !anyFailed,
        finalStatus,
        stepsRun,
        stepsFailed,
      };
    }

    // First attempt
    const firstAttempt = await runOneStepInternal(missionId, nextStep, toolContext);
    stepsRun++;

    if (firstAttempt.status === 'COMPLETED') {
      continue; // Loop to next step
    }

    // First attempt failed. Auto-retry once.
    logger.info('[StepRunner] Step failed on first attempt — retrying once', {
      missionId,
      stepId: nextStep.stepId,
      toolName: nextStep.toolName,
      error: firstAttempt.error,
    });

    const resetOk = await resetForAutoRetry(missionId, nextStep.stepId);
    if (!resetOk) {
      // Couldn't reset for retry — halt the mission with the failure visible
      stepsFailed++;
      await haltMissionAtFailedStep(missionId);
      return {
        success: false,
        finalStatus: 'AWAITING_APPROVAL',
        stepsRun,
        stepsFailed,
        haltedAtStepId: nextStep.stepId,
        error: 'Could not reset step for auto-retry',
      };
    }

    // Re-read the step — its IDs are the same but state was just reset.
    // We pass the same step object since toolName/toolArgs are unchanged.
    const secondAttempt = await runOneStepInternal(missionId, nextStep, toolContext);
    stepsRun++;

    if (secondAttempt.status === 'COMPLETED') {
      logger.info('[StepRunner] Step succeeded on auto-retry', {
        missionId, stepId: nextStep.stepId,
      });
      continue;
    }

    // Both attempts failed. Halt the mission.
    stepsFailed++;
    logger.warn('[StepRunner] Step failed twice — halting mission', {
      missionId,
      stepId: nextStep.stepId,
      toolName: nextStep.toolName,
      firstError: firstAttempt.error,
      secondError: secondAttempt.error,
    });
    await haltMissionAtFailedStep(missionId);
    return {
      success: false,
      finalStatus: 'AWAITING_APPROVAL',
      stepsRun,
      stepsFailed,
      haltedAtStepId: nextStep.stepId,
      error: secondAttempt.error ?? 'Step failed twice',
    };
  }

  // Hit the iteration limit — something is wrong with the state machine
  await haltMissionAtFailedStep(missionId);
  return {
    success: false,
    finalStatus: 'AWAITING_APPROVAL',
    stepsRun,
    stepsFailed,
    error: `Hit MAX_STEPS=${MAX_STEPS} iteration limit`,
  };
}

/**
 * Find the next step the runner is allowed to execute. Returns null
 * if there are no runnable steps left (mission is done or stuck).
 *
 * A step is runnable when:
 *   - status === 'PROPOSED'
 *   - operatorApproved === true (M3.7)
 *
 * Steps that are still PROPOSED but operator-unapproved get skipped —
 * they stay in the plan but don't run. Once M3.7's hard gate is in
 * place (every step must be approved or deleted before /plan/approve
 * accepts the call) this skip path will rarely fire in practice, but
 * we keep the filter for robustness in case a step somehow slips
 * through.
 */
function findRunnableProposedStep(mission: Mission): MissionStep | null {
  return mission.steps.find(
    (s) => s.status === 'PROPOSED' && s.operatorApproved === true,
  ) ?? null;
}
