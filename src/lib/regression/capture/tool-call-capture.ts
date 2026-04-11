/**
 * Tool-Call Capture — records a full multi-step orchestration signature
 *
 * Runs a tool-calling conversation end-to-end against the honest model,
 * feeding canned mock results back for each tool call so the chain can
 * continue past step 1. Stops when the model emits a final text response
 * without tool calls, hits the max-step ceiling, or errors.
 *
 * The captured ToolCallSignature is the full ordered list of tool calls
 * with their argument key shapes — the ground truth that orchestration
 * regression runs diff against.
 */

import crypto from 'crypto';
import {
  REGRESSION_MAX_TOOL_STEPS,
  type ToolCallSignature,
  type ToolCallStep,
  type TerminalState,
} from '@/types/regression';
import {
  directChat,
  type DirectChatMessage,
  type DirectToolDefinition,
} from './openrouter-direct';

const GENERIC_MOCK_RESULT = { status: 'mocked', note: 'tool not scripted in case.mockToolResults' };

export interface ToolCallCaptureInput {
  modelId: string;                  // honest OpenRouter id
  systemPrompt: string;
  userMessage: string;
  tools: DirectToolDefinition[];
  mockToolResults: Record<string, unknown>;
  temperature: number;
  maxTokens: number;
}

export interface ToolCallCaptureResult {
  signature: ToolCallSignature;
  rawSteps: RawStepRecord[];        // per-step request/response for forensic run artifacts
}

export interface RawStepRecord {
  stepIndex: number;
  request: unknown;
  response: unknown;
  durationMs: number;
}

/**
 * Hash a sorted array of argument key names to produce a stable signature
 * fingerprint. Two tool calls with the same keys (in any order) produce
 * the same hash.
 */
function hashArgKeys(sortedKeys: string[]): string {
  const joined = sortedKeys.join('|');
  return crypto.createHash('sha1').update(joined).digest('hex').slice(0, 12);
}

function extractArgKeys(rawArgumentsJson: string): string[] {
  try {
    const parsed = JSON.parse(rawArgumentsJson) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed as Record<string, unknown>).sort();
    }
    return [];
  } catch {
    // Invalid JSON arguments — record the fact rather than crashing
    return ['<unparseable>'];
  }
}

function resolveMockResult(
  toolName: string,
  mockToolResults: Record<string, unknown>,
): unknown {
  if (toolName in mockToolResults) {
    return mockToolResults[toolName];
  }
  return GENERIC_MOCK_RESULT;
}

/**
 * Run the full tool-calling loop against the honest model and record every
 * step. One call to this function = one end-to-end capture = one candidate
 * signature.
 */
export async function captureToolCallChain(
  input: ToolCallCaptureInput,
): Promise<ToolCallCaptureResult> {
  const captureStartedAt = Date.now();
  const conversation: DirectChatMessage[] = [
    { role: 'system', content: input.systemPrompt },
    { role: 'user', content: input.userMessage },
  ];

  const steps: ToolCallStep[] = [];
  const rawSteps: RawStepRecord[] = [];
  let terminalState: TerminalState = 'MAX_STEPS_REACHED';
  let finalText: string | undefined;

  for (let stepIndex = 0; stepIndex < REGRESSION_MAX_TOOL_STEPS; stepIndex += 1) {
    let response;
    try {
      response = await directChat({
        modelId: input.modelId,
        messages: conversation,
        tools: input.tools,
        toolChoice: 'auto',
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      });
    } catch (err) {
      terminalState = 'PROVIDER_ERROR';
      rawSteps.push({
        stepIndex,
        request: { modelId: input.modelId, messages: conversation },
        response: { error: err instanceof Error ? err.message : String(err) },
        durationMs: 0,
      });
      break;
    }

    rawSteps.push({
      stepIndex,
      request: response.rawRequestBody,
      response: response.rawResponseBody,
      durationMs: response.durationMs,
    });

    const hasToolCalls = response.toolCalls.length > 0;

    if (!hasToolCalls) {
      // Model issued a terminal text response
      terminalState = response.content.trim().length > 0 ? 'FINAL_RESPONSE' : 'EMPTY_RESPONSE';
      finalText = response.content;
      break;
    }

    // Record each tool call as one step in the signature. A single model
    // response can contain multiple tool_calls in parallel — we preserve
    // their order as emitted.
    for (const toolCall of response.toolCalls) {
      const argKeys = extractArgKeys(toolCall.function.arguments);
      steps.push({
        index: steps.length,
        toolName: toolCall.function.name,
        argKeys,
        argKeyShapeHash: hashArgKeys(argKeys),
      });
    }

    // Append the assistant turn with its tool_calls so the model sees its
    // own prior moves on the next turn.
    conversation.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.toolCalls,
    });

    // Feed back one tool result message per tool_call using the case's
    // mock map. Identical mocks across baseline and candidate runs mean
    // any divergence is the model's doing, not the harness's.
    for (const toolCall of response.toolCalls) {
      const mockResult = resolveMockResult(toolCall.function.name, input.mockToolResults);
      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(mockResult),
      });
    }
  }

  if (steps.length >= REGRESSION_MAX_TOOL_STEPS) {
    terminalState = 'MAX_STEPS_REACHED';
  }

  const signature: ToolCallSignature = {
    kind: 'TOOL_CALLING',
    stepCount: steps.length,
    steps,
    terminalState,
    finalText,
    totalDurationMs: Date.now() - captureStartedAt,
  };

  return { signature, rawSteps };
}

export const __test_internal = {
  hashArgKeys,
  extractArgKeys,
  resolveMockResult,
  GENERIC_MOCK_RESULT,
};
