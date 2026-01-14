/**
 * OpenRouter Provider
 * Universal AI provider that can access 100+ models through one API key
 */

import type { ModelName } from '@/types/ai-models';
import { apiKeyService } from '@/lib/api-keys/api-key-service'
import { logger } from '@/lib/logger/logger';

export interface OpenRouterConfig {
  apiKey?: string;
  model?: ModelName;
  baseURL?: string;
  organizationId?: string;
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
      const orgIdVal = configOrOrgId.organizationId;
      this.apiKey = (apiKeyVal !== '' && apiKeyVal != null) ? apiKeyVal : null;
      this.baseURL = (baseURLVal !== '' && baseURLVal != null) ? baseURLVal : 'https://openrouter.ai/api/v1';
      this.organizationId = (orgIdVal !== '' && orgIdVal != null) ? orgIdVal : null;
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
      } catch (error: any) {
        // If 404 (model not found), try fallback
        if (error.message?.includes('404') && model !== OpenRouterProvider.FALLBACK_MODEL) {
          console.log(`[OpenRouter] Model ${model} returned 404, trying fallback: ${OpenRouterProvider.FALLBACK_MODEL}`);
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
  ) {
    const apiKey = await this.getApiKey();

    console.log(`[OpenRouter] Making request to model: ${model}`);
    console.log(`[OpenRouter] API Key passed to header: ${apiKey.slice(0, 12)}...`);

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': (process.env.NEXT_PUBLIC_APP_URL !== '' && process.env.NEXT_PUBLIC_APP_URL != null) ? process.env.NEXT_PUBLIC_APP_URL : 'http://localhost:3000',
        'X-Title': 'AI Sales Platform',
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

    const data = await response.json();
    console.log(`[OpenRouter] Response received from model: ${data.model}`);

    const responseContent = data.choices[0]?.message?.content ?? '';
    return {
      content: responseContent,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: data.model,
      provider: 'openrouter',
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
    return modelMap[model] || model;
  }

  /**
   * Get available models from OpenRouter
   */
  async getAvailableModels() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data; // Array of available models
    } catch (error: any) {
      logger.error('[OpenRouterProvider] Error fetching models:', error, { file: 'openrouter-provider.ts' });
      throw error;
    }
  }

  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      console.log('[OpenRouter] Using cached API key:', this.apiKey.slice(0, 8) + '...');
      return this.apiKey;
    }
    if (!this.organizationId) {
      console.error('[OpenRouter] No organizationId provided and no API key set');
      throw new Error('OpenRouter API key not configured');
    }
    console.log('[OpenRouter] Fetching API key for org:', this.organizationId);
    const keys = await apiKeyService.getKeys(this.organizationId);
    const key = keys?.ai?.openrouterApiKey;
    if (!key) {
      console.error('[OpenRouter] No openrouterApiKey found in keys:', {
        hasKeys: !!keys,
        hasAiSection: !!keys?.ai,
        aiKeys: keys?.ai ? Object.keys(keys.ai) : [],
      });
      throw new Error(`OpenRouter API key not configured for organization ${this.organizationId}. Please add it in the API Keys settings.`);
    }
    console.log('[OpenRouter] API key loaded:', key.slice(0, 8) + '...');
    this.apiKey = key;
    return key;
  }
}

/**
 * Helper to determine if we should use OpenRouter
 */
export function shouldUseOpenRouter(keys: any): boolean {
  return !!(keys?.ai?.openrouterApiKey);
}

/**
 * Helper to get the appropriate provider based on available keys
 */
export function getAIProvider(keys: any, preferredModel?: ModelName) {
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



















