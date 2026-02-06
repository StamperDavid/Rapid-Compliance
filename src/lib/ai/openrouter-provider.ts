/**
 * OpenRouter Provider
 * Universal AI provider that can access 100+ models through one API key
 */

import type { ModelName, ChatResponse } from '@/types/ai-models';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

export interface OpenRouterConfig {
  apiKey?: string;
  model?: ModelName;
  baseURL?: string;
  organizationId?: string;
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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
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

export class OpenRouterProvider {
  private apiKey: string | null = null;
  private baseURL: string;
  private organizationId: string | null = null;

  constructor(configOrOrgId: OpenRouterConfig | string) {
    if (typeof configOrOrgId === 'string') {
      this.organizationId = configOrOrgId;
      this.baseURL = 'https://openrouter.ai/api/v1';
    } else {
      // Extract config values - empty strings are invalid (Explicit Ternary for STRINGS)
      const apiKeyVal = configOrOrgId.apiKey;
      const baseURLVal = configOrOrgId.baseURL;
      this.apiKey = (apiKeyVal !== '' && apiKeyVal != null) ? apiKeyVal : null;
      this.baseURL = (baseURLVal !== '' && baseURLVal != null) ? baseURLVal : 'https://openrouter.ai/api/v1';
      this.organizationId = DEFAULT_ORG_ID;
    }
  }

  /**
   * Chat completion using OpenRouter
   * Works with ANY model: GPT-4, Claude, Gemini, Llama, etc.
   */
  // Fallback model if primary fails with 404
  private static readonly FALLBACK_MODEL = 'anthropic/claude-3-haiku';

  async chat(params: {
    model: ModelName;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }) {
    const openrouterModel = this.mapModelName(params.model);

    // Try primary model first, then fallback if 404
    const modelsToTry = [openrouterModel, OpenRouterProvider.FALLBACK_MODEL];

    for (const model of modelsToTry) {
      try {
        const result = await this.makeRequest(model, params);
        return result;
      } catch (error: unknown) {
        // If 404 (model not found), try fallback
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('404') && model !== OpenRouterProvider.FALLBACK_MODEL) {
          logger.info(`[OpenRouter] Model ${model} returned 404, trying fallback: ${OpenRouterProvider.FALLBACK_MODEL}`, { file: 'openrouter-provider.ts' });
          continue;
        }
        throw error;
      }
    }

    throw new Error('All models failed');
  }

  private async makeRequest(
    model: string,
    params: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
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
    logger.debug(`[OpenRouter] Response received from model: ${data.model}`, { file: 'openrouter-provider.ts' });

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
      finishReason: 'stop' as const,
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
    toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
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
      tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    } = {
      model: openrouterModel,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
      top_p: params.topP ?? 0.9,
    };

    // Add tools if provided
    if (params.tools && params.tools.length > 0) {
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
   * Map our internal model names to OpenRouter model identifiers
   */
  private mapModelName(model: ModelName): string {
    const modelMap: Record<string, string> = {
      // OpenAI models
      'gpt-4': 'openai/gpt-4',
      'gpt-4-turbo': 'openai/gpt-4-turbo',
      'gpt-4-turbo-preview': 'openai/gpt-4-turbo-preview',
      'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',

      // Anthropic models
      'claude-3-opus': 'anthropic/claude-3-opus',
      'claude-3-sonnet': 'anthropic/claude-3-sonnet',
      'claude-3-haiku': 'anthropic/claude-3-haiku',
      'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',

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
    if (!this.organizationId) {
      logger.error('[OpenRouter] No organizationId provided and no API key set', new Error('No organizationId'), { file: 'openrouter-provider.ts' });
      throw new Error('OpenRouter API key not configured');
    }
    logger.debug(`[OpenRouter] Fetching API key for org: ${this.organizationId}`, { file: 'openrouter-provider.ts' });
    const keys = await apiKeyService.getKeys();
    const key = keys?.ai?.openrouterApiKey;
    if (!key) {
      logger.error('[OpenRouter] No openrouterApiKey found in keys', new Error('No API key'), {
        file: 'openrouter-provider.ts',
        hasKeys: !!keys,
        hasAiSection: !!keys?.ai,
        aiKeys: keys?.ai ? Object.keys(keys.ai) : [],
      });
      throw new Error(`OpenRouter API key not configured for organization ${this.organizationId}. Please add it in the API Keys settings.`);
    }
    logger.debug(`[OpenRouter] API key loaded: ${key.slice(0, 8)}...`, { file: 'openrouter-provider.ts' });
    this.apiKey = key;
    return key;
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
