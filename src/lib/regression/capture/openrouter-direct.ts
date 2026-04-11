/**
 * OpenRouter Direct Client — regression harness only
 *
 * Minimal OpenRouter client that bypasses OpenRouterProvider.mapModelName
 * so the harness sends EXACTLY the model id it was told to test, with no
 * alias rewrite. This is the whole point of the harness — if production
 * later grows a model alias, the harness still sees ground truth.
 *
 * Features intentionally NOT included here:
 *   - Model name aliasing
 *   - Silent fallback to a different model on 404
 *   - Tool-choice rewriting
 *   - Retry logic
 *
 * If any of those things happen in production via OpenRouterProvider, that
 * divergence is visible in a regression diff — which is what we want.
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';

const FILE = 'regression/capture/openrouter-direct.ts';

// OpenAI-compatible tool call shape (mirrors OpenRouter responses)
export interface DirectToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;              // JSON-serialized arguments from the model
  };
}

export interface DirectChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: DirectToolCall[];
  tool_call_id?: string;
  name?: string;                    // tool name for role='tool' messages
}

export interface DirectToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface DirectChatRequest {
  modelId: string;                  // honest OpenRouter id (e.g. 'anthropic/claude-sonnet-4.6')
  messages: DirectChatMessage[];
  tools?: DirectToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required';
  temperature: number;              // regression runs lock this to 0
  maxTokens: number;
}

export interface DirectChatResponse {
  content: string;
  toolCalls: DirectToolCall[];      // always an array, empty if none
  finishReason: string;
  modelReturned: string;            // OpenRouter's echoed model id (may be versioned)
  durationMs: number;
  rawResponseBody: unknown;         // for forensic run artifacts
  rawRequestBody: unknown;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface OpenRouterAPIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: DirectToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function getApiKey(): Promise<string> {
  const keys = await apiKeyService.getKeys();
  const firestoreKey = keys?.ai?.openrouterApiKey;
  if (firestoreKey && firestoreKey.length > 0) {return firestoreKey;}
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey && envKey.length > 0) {return envKey;}
  throw new Error(
    '[regression] OpenRouter API key not found in Firestore apiKeys doc or OPENROUTER_API_KEY env var.',
  );
}

/**
 * Send a single chat completion request to OpenRouter with the honest model
 * id. Returns both the parsed response and the raw request/response bodies
 * so run records can be inspected forensically.
 */
export async function directChat(request: DirectChatRequest): Promise<DirectChatResponse> {
  const apiKey = await getApiKey();
  const startedAt = Date.now();

  const body: Record<string, unknown> = {
    model: request.modelId,
    messages: request.messages,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
  };
  if (request.tools && request.tools.length > 0 && request.toolChoice !== 'none') {
    body.tools = request.tools;
    body.tool_choice = request.toolChoice ?? 'auto';
  }

  logger.debug(
    `[RegressionDirect] POST /chat/completions model=${request.modelId} tools=${request.tools?.length ?? 0} msgs=${request.messages.length}`,
    { file: FILE },
  );

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'SalesVelocity Regression Harness',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[RegressionDirect] OpenRouter ${res.status}: ${errText.slice(0, 500)}`);
  }

  const parsed = (await res.json()) as OpenRouterAPIResponse;
  const firstChoice = parsed.choices[0];
  const message = firstChoice?.message;
  const durationMs = Date.now() - startedAt;

  return {
    content: message?.content ?? '',
    toolCalls: message?.tool_calls ?? [],
    finishReason: firstChoice?.finish_reason ?? 'unknown',
    modelReturned: parsed.model,
    durationMs,
    rawResponseBody: parsed,
    rawRequestBody: body,
    usage: {
      promptTokens: parsed.usage?.prompt_tokens ?? 0,
      completionTokens: parsed.usage?.completion_tokens ?? 0,
      totalTokens: parsed.usage?.total_tokens ?? 0,
    },
  };
}
