/**
 * OpenRouter Provider
 * Universal AI provider that can access 100+ models through one API key
 */

import type { ModelName } from '@/types/ai-models';
import { apiKeyService } from '@/lib/api-keys/api-key-service';

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
      this.apiKey = configOrOrgId.apiKey || null;
      this.baseURL = configOrOrgId.baseURL || 'https://openrouter.ai/api/v1';
      this.organizationId = configOrOrgId.organizationId || null;
    }
  }

  /**
   * Chat completion using OpenRouter
   * Works with ANY model: GPT-4, Claude, Gemini, Llama, etc.
   */
  async chat(params: {
    model: ModelName;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }) {
    try {
      // Map internal model names to OpenRouter model names
      const openrouterModel = this.mapModelName(params.model);

      const apiKey = await this.getApiKey();
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'AI Sales Platform',
        },
        body: JSON.stringify({
          model: openrouterModel,
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

      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model,
        provider: 'openrouter',
      };
    } catch (error: any) {
      console.error('[OpenRouterProvider] Error:', error);
      throw error;
    }
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
      console.error('[OpenRouterProvider] Error fetching models:', error);
      throw error;
    }
  }

  private async getApiKey(): Promise<string> {
    if (this.apiKey) return this.apiKey;
    if (!this.organizationId) {
      throw new Error('OpenRouter API key not configured');
    }
    const keys = await apiKeyService.getKeys(this.organizationId);
    const key = keys?.ai?.openrouterApiKey;
    if (!key) {
      throw new Error(`OpenRouter API key not configured for organization ${this.organizationId}. Please add it in the API Keys settings.`);
    }
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
















