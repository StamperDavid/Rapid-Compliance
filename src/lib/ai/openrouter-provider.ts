/**
 * OpenRouter Provider
 * Universal AI provider that can access 100+ models through one API key
 */

import type { ModelName, ChatResponse } from '@/types/ai-models';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

export interface OpenRouterConfig {
  apiKey?: string;
  model?: ModelName;
  baseURL?: string;
}

/** JSON Schema property definition - compatible with ToolParameter */
interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: boolean | string[];
}

// Tool calling types (OpenAI-compatible format)
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, JsonSchemaProperty>;
      required: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * A single content block within a multipart message. OpenAI/OpenRouter's
 * spec accepts an array of these for vision-capable models. Claude
 * (Sonnet/Opus) supports multipart input via OpenRouter — the array is
 * forwarded through unchanged.
 */
export type ChatMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /**
   * Either a plain string (the common case) or an array of content
   * parts for multipart messages (text + images for vision-capable
   * models). String form is accepted unchanged; the array form is
   * forwarded through to OpenRouter as-is.
   */
  content: string | ChatMessageContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ChatCompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
}

/** OpenRouter API response structure */
interface OpenRouterAPIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** OpenRouter models list response */
interface OpenRouterModelsResponse {
  data: Array<{
    id: string;
    name: string;
    context_length: number;
    pricing: {
      prompt: string;
      completion: string;
    };
  }>;
}

/** API Keys structure for type safety */
interface APIKeys {
  ai?: {
    openrouterApiKey?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    geminiApiKey?: string;
  };
}

/** Provider result type */
interface ProviderResult {
  provider: string;
  apiKey: string;
}

/**
 * Map an OpenRouter `finish_reason` string to the typed `ChatResponse.finishReason`
 * union (`'stop' | 'length' | 'function_call' | 'content_filter'`).
 *
 * Known OpenRouter values:
 *   - 'stop' → end of response per model
 *   - 'length' → hit the max_tokens ceiling (TRUNCATED — caller must handle)
 *   - 'tool_calls' → model wants to call tools (mapped to 'function_call' here)
 *   - 'function_call' → legacy OpenAI variant
 *   - 'content_filter' → safety filter blocked output
 *
 * Anything unknown is mapped to 'stop' but logged so unmapped reasons are
 * visible. We deliberately do NOT silently swallow 'length' — it must reach
 * the caller as the literal `'length'` value.
 */
function mapFinishReason(raw: string | undefined): 'stop' | 'length' | 'function_call' | 'content_filter' {
  if (raw === 'length') { return 'length'; }
  if (raw === 'content_filter') { return 'content_filter'; }
  if (raw === 'function_call' || raw === 'tool_calls') { return 'function_call'; }
  if (raw === 'stop' || raw == null) { return 'stop'; }
  logger.warn(`[OpenRouter] Unmapped finish_reason='${raw}' — defaulting to 'stop'`, { file: 'openrouter-provider.ts' });
  return 'stop';
}

export class OpenRouterProvider {
  private apiKey: string | null = null;
  private baseURL: string;

  constructor(configOrOrgId: OpenRouterConfig | string) {
    if (typeof configOrOrgId === 'string') {
      this.baseURL = 'https://openrouter.ai/api/v1';
    } else {
      // Extract config values - empty strings are invalid (Explicit Ternary for STRINGS)
      const apiKeyVal = configOrOrgId.apiKey;
      const baseURLVal = configOrOrgId.baseURL;
      this.apiKey = (apiKeyVal !== '' && apiKeyVal != null) ? apiKeyVal : null;
      this.baseURL = (baseURLVal !== '' && baseURLVal != null) ? baseURLVal : 'https://openrouter.ai/api/v1';
    }
  }

  /**
   * Chat completion using OpenRouter.
   *
   * Honest failure on 404. An earlier version of this method silently fell
   * back to claude-3-haiku when the requested model returned 404 — which
   * meant a specialist that asked for Sonnet 4.6 would get Haiku answering
   * instead with no visibility anywhere. That is exactly the class of
   * silent model-swap the regression harness was built to detect. No
   * fallback here. If the requested model is unavailable, the caller sees
   * the real 404.
   */
  async chat(params: {
    model: ModelName;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | ChatMessageContentPart[] }>;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }) {
    const openrouterModel = this.mapModelName(params.model);
    return this.makeRequest(openrouterModel, params);
  }

  private async makeRequest(
    model: string,
    params: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | ChatMessageContentPart[] }>;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    }
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const apiKey = await this.getApiKey();

    logger.debug(`[OpenRouter] Making request to model: ${model}`, { file: 'openrouter-provider.ts' });

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': (process.env.NEXT_PUBLIC_APP_URL !== '' && process.env.NEXT_PUBLIC_APP_URL != null) ? process.env.NEXT_PUBLIC_APP_URL : 'http://localhost:3000',
        'X-Title': 'SalesVelocity',
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 2048,
        top_p: params.topP ?? 0.9,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as OpenRouterAPIResponse;
    const rawFinishReason = data.choices[0]?.finish_reason;
    logger.debug(`[OpenRouter] Response received from model: ${data.model} (finish_reason=${rawFinishReason ?? 'undefined'})`, { file: 'openrouter-provider.ts' });

    const responseContent = data.choices[0]?.message?.content ?? '';
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    return {
      id: data.id,
      content: responseContent,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost: 0, // OpenRouter handles billing separately
      },
      model: data.model as ModelName,
      provider: 'openrouter',
      // HONESTY RULE (Task #45 follow-up, April 13 2026): surface the REAL
      // finish_reason returned by the model. The prior version of this
      // method hardcoded `'stop' as const`, silently lying about truncation.
      // That lie meant every callsite of `chat()` would treat a length-
      // truncated response as if it had finished cleanly, leading to
      // "JSON parse failed" errors that hid the true root cause (response
      // ran out of max_tokens mid-string). The Email Specialist's pirate
      // test caught this. The same silent lie was almost certainly the
      // cause of months of mysterious "LLM produced bad JSON" reports
      // across every other specialist that uses chat().
      finishReason: mapFinishReason(rawFinishReason),
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Chat completion with tool calling support.
   * Use this for Jasper's anti-hallucination system.
   */
  async chatWithTools(params: {
    model: ModelName;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }): Promise<ChatCompletionResponse> {
    const openrouterModel = this.mapModelName(params.model);
    const apiKey = await this.getApiKey();

    logger.debug(`[OpenRouter] Making tool-enabled request to model: ${openrouterModel}`, { file: 'openrouter-provider.ts' });
    logger.debug(`[OpenRouter] Tools provided: ${params.tools?.map(t => t.function.name).join(', ') ?? 'none'}`, { file: 'openrouter-provider.ts' });

    const requestBody: {
      model: string;
      messages: ChatMessage[];
      temperature: number;
      max_tokens: number;
      top_p: number;
      tools?: ToolDefinition[];
      tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
    } = {
      model: openrouterModel,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
      top_p: params.topP ?? 0.9,
    };

    // Add tools if provided — but omit them entirely when toolChoice is 'none'
    // (forces a text response without sending tool_choice:'none', which Bedrock rejects)
    if (params.tools && params.tools.length > 0 && params.toolChoice !== 'none') {
      requestBody.tools = params.tools;
      requestBody.tool_choice = params.toolChoice ?? 'auto';
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': (process.env.NEXT_PUBLIC_APP_URL !== '' && process.env.NEXT_PUBLIC_APP_URL != null) ? process.env.NEXT_PUBLIC_APP_URL : 'http://localhost:3000',
        'X-Title': 'SalesVelocity',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as OpenRouterAPIResponse;
    const message = data.choices[0]?.message;
    const finishReason = data.choices[0]?.finish_reason;

    logger.debug(`[OpenRouter] Response received. Finish reason: ${finishReason}`, { file: 'openrouter-provider.ts' });
    if (message?.tool_calls) {
      logger.debug(`[OpenRouter] Tool calls requested: ${message.tool_calls.map((tc: ToolCall) => tc.function.name).join(', ')}`, { file: 'openrouter-provider.ts' });
    }

    return {
      content: message?.content ?? '',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: data.model,
      provider: 'openrouter',
      toolCalls: message?.tool_calls,
      finishReason,
    };
  }

  /**
   * Map our internal model names to OpenRouter model identifiers.
   *
   * HONESTY RULE: every internal name must map to the OpenRouter id it
   * actually names. Never staple one version onto another's label (e.g.
   * never map 'claude-sonnet-4' to 'anthropic/claude-sonnet-4-6'). A prior
   * version of this table did exactly that and the regression harness
   * would have no chance of detecting a silent upgrade if it saw a
   * mismatched alias answering as the declared model. If a model is sunset
   * upstream, remove its row here — do not repoint it to a different model.
   */
  private mapModelName(model: ModelName): string {
    const modelMap: Record<string, string> = {
      // OpenAI models
      'gpt-4': 'openai/gpt-4',
      'gpt-4-turbo': 'openai/gpt-4-turbo',
      'gpt-4-turbo-preview': 'openai/gpt-4-turbo-preview',
      'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',

      // Anthropic models — each internal name maps to the OpenRouter id it
      // actually names. Latest Claude 4 generation is 4.6 across Sonnet
      // and Opus. Use claude-sonnet-4.6 for leaf specialists and
      // claude-opus-4.6 for orchestrators (Jasper, Prompt Engineer).
      'claude-3-opus': 'anthropic/claude-3-opus',
      'claude-3-sonnet': 'anthropic/claude-3-sonnet',
      'claude-3-haiku': 'anthropic/claude-3-haiku',
      'claude-sonnet-4': 'anthropic/claude-sonnet-4',
      'claude-sonnet-4.5': 'anthropic/claude-sonnet-4.5',
      'claude-sonnet-4.6': 'anthropic/claude-sonnet-4.6',
      'claude-opus-4': 'anthropic/claude-opus-4',
      'claude-opus-4.1': 'anthropic/claude-opus-4.1',
      'claude-opus-4.5': 'anthropic/claude-opus-4.5',
      'claude-opus-4.6': 'anthropic/claude-opus-4.6',
      'claude-haiku-4.5': 'anthropic/claude-haiku-4.5',

      // Google models
      'gemini-pro': 'google/gemini-pro',
      'gemini-pro-vision': 'google/gemini-pro-vision',
      'gemini-1.5-pro': 'google/gemini-pro-1.5',

      // Meta models
      'llama-3-70b': 'meta-llama/llama-3-70b-instruct',
      'llama-3-8b': 'meta-llama/llama-3-8b-instruct',
    };

    // Return mapped name or use as-is if not in map
    if (typeof model === 'string' && model.startsWith('openrouter/')) {
      return model.replace('openrouter/', '');
    }
    return modelMap[model] ?? model;
  }

  /**
   * Get available models from OpenRouter
   */
  async getAvailableModels(): Promise<OpenRouterModelsResponse['data']> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json() as OpenRouterModelsResponse;
      return data.data; // Array of available models
    } catch (error: unknown) {
      logger.error('[OpenRouterProvider] Error fetching models:', error instanceof Error ? error : new Error(String(error)), { file: 'openrouter-provider.ts' });
      throw error;
    }
  }

  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      logger.debug(`[OpenRouter] Using cached API key: ${this.apiKey.slice(0, 8)}...`, { file: 'openrouter-provider.ts' });
      return this.apiKey;
    }
    logger.debug(`[OpenRouter] Fetching API key for org: ${PLATFORM_ID}`, { file: 'openrouter-provider.ts' });

    // Strategy 1: Firestore (API Keys settings page)
    const keys = await apiKeyService.getKeys();
    const firestoreKey = keys?.ai?.openrouterApiKey;
    if (firestoreKey) {
      logger.debug(`[OpenRouter] API key loaded from Firestore: ${firestoreKey.slice(0, 8)}...`, { file: 'openrouter-provider.ts' });
      this.apiKey = firestoreKey;
      return firestoreKey;
    }

    // Strategy 2: Environment variable fallback
    const envKey = process.env.OPENROUTER_API_KEY;
    if (envKey) {
      logger.debug(`[OpenRouter] API key loaded from env var: ${envKey.slice(0, 8)}...`, { file: 'openrouter-provider.ts' });
      this.apiKey = envKey;
      return envKey;
    }

    logger.error('[OpenRouter] No openrouterApiKey found in Firestore or env', new Error('No API key'), {
      file: 'openrouter-provider.ts',
      hasKeys: !!keys,
      hasAiSection: !!keys?.ai,
      aiKeys: keys?.ai ? Object.keys(keys.ai) : [],
      hasEnvVar: !!process.env.OPENROUTER_API_KEY,
    });
    throw new Error(`OpenRouter API key not configured. Set OPENROUTER_API_KEY in Vercel env vars or add it in the API Keys settings.`);
  }
}

/**
 * Helper to determine if we should use OpenRouter
 */
export function shouldUseOpenRouter(keys: APIKeys | null | undefined): boolean {
  return !!(keys?.ai?.openrouterApiKey);
}

/**
 * Helper to get the appropriate provider based on available keys
 */
export function getAIProvider(keys: APIKeys | null | undefined, preferredModel?: ModelName): ProviderResult | null {
  // If OpenRouter is available, prefer it (can access all models)
  if (keys?.ai?.openrouterApiKey) {
    return {
      provider: 'openrouter',
      apiKey: keys.ai.openrouterApiKey,
    };
  }

  // Fall back to model-specific providers
  if (preferredModel?.startsWith('gpt-') && keys?.ai?.openaiApiKey) {
    return {
      provider: 'openai',
      apiKey: keys.ai.openaiApiKey,
    };
  }

  if (preferredModel?.startsWith('claude-') && keys?.ai?.anthropicApiKey) {
    return {
      provider: 'anthropic',
      apiKey: keys.ai.anthropicApiKey,
    };
  }

  if (preferredModel?.startsWith('gemini-') && keys?.ai?.geminiApiKey) {
    return {
      provider: 'gemini',
      apiKey: keys.ai.geminiApiKey,
    };
  }

  // Return first available
  if (keys?.ai?.openaiApiKey) {
    return { provider: 'openai', apiKey: keys.ai.openaiApiKey };
  }
  if (keys?.ai?.anthropicApiKey) {
    return { provider: 'anthropic', apiKey: keys.ai.anthropicApiKey };
  }
  if (keys?.ai?.geminiApiKey) {
    return { provider: 'gemini', apiKey: keys.ai.geminiApiKey };
  }

  return null;
}
