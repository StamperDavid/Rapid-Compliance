/**
 * step-runner — runs a single approved mission step through the per-step
 * pause execution model (M3).
 *
 * The runner stitches together three things that have to live in
 * different files:
 *   - persistence state-machine moves (mission-persistence.ts)
 *   - the actual tool execution (jasper-tools.ts → executeToolCall)
 *   - the route handler (api/orchestrator/missions/[id]/...)
 *
 * It can't go in mission-persistence.ts because importing jasper-tools
 * from there would create a circular dependency. It can't go inside a
 * route handler because three routes need to call it. So it sits here.
 *
 * @module orchestrator/step-runner
 */

import {
  getMission,
  markStepRunning,
  parkStepAwaitingApproval,
  type Mission,
} from './mission-persistence';
import { executeToolCall, type ToolCallContext } from './jasper-tools';
import type { ToolCall } from '@/lib/ai/openrouter-provider';
import { logger } from '@/lib/logger/logger';

export interface RunOneStepInput {
  missionId: string;
  stepId: string;
  userId: string;
  conversationId: string;
  userPrompt: string;
}

export interface RunOneStepResult {
  success: boolean;
  /**
   * The mission state after the step finished, with the step parked in
   * AWAITING_APPROVAL. Null if the step couldn't be run for any reason
   * (mission missing, step missing, step in wrong status, executeToolCall
   * threw before persistence completed).
   */
  mission: Mission | null;
  error?: string;
}

/**
 * Run one mission step end-to-end and park it in AWAITING_APPROVAL.
 *
 * Sequence:
 *   1. markStepRunning — flips PROPOSED → RUNNING. Returns false if
 *      the step doesn't exist or isn't proposed.
 *   2. Read the mission to grab the step's toolName + toolArgs (the
 *      operator may have edited the args during plan review).
 *   3. Build a synthetic ToolCall and dispatch via executeToolCall.
 *      The tool result content is the raw JSON the tool returned.
 *   4. parkStepAwaitingApproval — flips RUNNING → AWAITING_APPROVAL
 *      with the result captured. Mission flips to AWAITING_APPROVAL
 *      too so the operator's sidebar shows it as needing attention.
 *
 * If executeToolCall throws, the catch path still calls parkStepAwaiting
 * Approval with the error so the operator can see what went wrong instead
 * of finding a step stuck in RUNNING forever. Either way the function
 * returns the new mission state.
 */
export async function runOneStep(input: RunOneStepInput): Promise<RunOneStepResult> {
  const { missionId, stepId, userId, conversationId, userPrompt } = input;

  // Phase 1 — flip step status to RUNNING (and mission to IN_PROGRESS).
  // Refuses if the step is not currently PROPOSED, which is intentional —
  // the route handler should only call this on a step it has just reset
  // or one that came out of plan approval.
  const ranOk = await markStepRunning(missionId, stepId);
  if (!ranOk) {
    return {
      success: false,
      mission: null,
      error: 'Could not start step — it may not exist or may not be in proposed status',
    };
  }

  // Phase 2 — read the mission so we can grab the step's tool name +
  // args. We re-read instead of relying on a snapshot from before
  // markStepRunning because the operator may have edited args between
  // approving the plan and when this code runs (in the rerun path).
  const mission = await getMission(missionId);
  if (!mission) {
    return { success: false, mission: null, error: 'Mission disappeared' };
  }
  const step = mission.steps.find((s) => s.stepId === stepId);
  if (!step) {
    return { success: false, mission, error: 'Step disappeared after start' };
  }

  // Phase 3 — dispatch the actual tool call.
  const syntheticToolCall: ToolCall = {
    id: `m3run_${stepId}`,
    type: 'function',
    function: {
      name: step.toolName,
      arguments: JSON.stringify(step.toolArgs ?? {}),
    },
  };

  const toolContext: ToolCallContext = {
    conversationId,
    missionId,
    userPrompt,
    userId,
  };

  const stepStart = Date.now();
  let toolResult = '';
  let stepError: string | undefined;

  try {
    const result = await executeToolCall(syntheticToolCall, toolContext);
    toolResult = result.content;
    // Detect tool-level errors via the convention used everywhere else
    // in the codebase: top-level `error` field in JSON content.
    try {
      const parsed = JSON.parse(result.content) as Record<string, unknown>;
      if (typeof parsed.error === 'string' && parsed.error.length > 0) {
        stepError = parsed.error;
      }
    } catch {
      // Non-JSON tool result — treat as success
    }
  } catch (err: unknown) {
    stepError = err instanceof Error ? err.message : String(err);
    toolResult = JSON.stringify({ error: stepError });
    logger.error('[StepRunner] executeToolCall threw', err instanceof Error ? err : undefined, {
      missionId, stepId, toolName: step.toolName,
    });
  }

  const stepDuration = Date.now() - stepStart;

  // Phase 4 — park the step in AWAITING_APPROVAL with the captured
  // result. parkStepAwaitingApproval refuses if the step is not in
  // RUNNING — which it should be from Phase 1 — but we still check the
  // return value.
  const parkedOk = await parkStepAwaitingApproval(missionId, stepId, {
    toolResult,
    durationMs: stepDuration,
    ...(stepError ? { error: stepError } : {}),
  });

  if (!parkedOk) {
    return {
      success: false,
      mission,
      error: 'Step ran but could not be parked in AWAITING_APPROVAL — Firestore inconsistency',
    };
  }

  // Re-read mission to return the up-to-date state to the caller.
  const finalMission = await getMission(missionId);

  return {
    success: stepError === undefined,
    mission: finalMission,
    ...(stepError ? { error: stepError } : {}),
  };
}
