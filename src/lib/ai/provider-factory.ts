/**
 * AI Provider Factory
 * Creates and manages AI provider instances for different organizations
 * This is the main entry point for getting AI providers
 */

import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { OpenRouterProvider } from './openrouter-provider';
import type { ModelName, ChatRequest, ChatResponse } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

/**
 * Simple provider interface for chat routes
 */
export interface AIProvider {
  generateResponse(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    systemPrompt?: string,
    config?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    }
  ): Promise<{
    text: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
}

/** Internal provider interface for wrapping */
interface InternalProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
}

/**
 * AI Provider Factory
 * Creates provider instances with organization-specific configuration
 */
export class AIProviderFactory {
  /**
   * Create a provider instance for the specified model
   */
  static createProvider(
    model: ModelName
  ): AIProvider {
    // Determine which provider to use based on model name
    const providerType = this.getProviderType(model);

    // Create the appropriate provider instance
    let provider: InternalProvider;

    switch (providerType) {
      case 'openai':
        provider = new OpenAIProvider();
        break;

      case 'anthropic':
        provider = new AnthropicProvider();
        break;

      case 'google':
        provider = new GeminiProvider();
        break;

      case 'openrouter':
        provider = new OpenRouterProvider(DEFAULT_ORG_ID);
        break;

      default:
        throw new Error(`Unknown provider type for model: ${model}`);
    }

    // Wrap the provider with a consistent interface
    return this.wrapProvider(provider, model);
  }

  /**
   * Determine provider type from model name
   */
  private static getProviderType(model: ModelName): 'openai' | 'anthropic' | 'google' | 'openrouter' {
    // Convert to string and check
    const modelStr = String(model);

    // Check for OpenRouter format first (e.g., openrouter/anthropic/claude-3.5-sonnet)
    if (modelStr.includes('openrouter/') || modelStr.startsWith('openrouter/')) {
      return 'openrouter';
    }

    // Check for specific provider prefixes
    if (modelStr.startsWith('gpt-')) { return 'openai'; }
    if (modelStr.startsWith('claude-')) { return 'anthropic'; }
    if (modelStr.startsWith('gemini-')) { return 'google'; }

    // Default to OpenAI for common aliases
    if (modelStr === 'gpt-4-turbo' || modelStr === 'gpt-4') { return 'openai'; }

    throw new Error(`Cannot determine provider for model: ${modelStr}`);
  }

  /**
   * Wrap provider with consistent interface
   */
  private static wrapProvider(provider: InternalProvider, model: ModelName): AIProvider {
    return {
      async generateResponse(messages, systemPrompt, config) {
        try {
          // Convert messages to provider format
          const chatMessages = systemPrompt
            ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
            : messages;

          // Call provider's chat method
          const response = await provider.chat({
            model,
            messages: chatMessages,
            temperature: config?.temperature ?? 0.7,
            maxTokens: config?.maxTokens ?? 2048,
            topP: config?.topP ?? 0.9,
          });

          // Extract response content - empty string is valid AI response (use ?? for content)
          const responseText = response.content ?? '';
          return {
            text: responseText,
            usage: {
              // Token counts are NUMBERS - 0 is valid (use ?? for numbers)
              promptTokens: response.usage?.promptTokens ?? 0,
              completionTokens: response.usage?.completionTokens ?? 0,
              totalTokens: response.usage?.totalTokens ?? 0,
            },
          };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('[AIProviderFactory] Error generating response:', error instanceof Error ? error : new Error(errorMessage), { file: 'provider-factory.ts' });
          throw new Error(`AI generation failed: ${errorMessage}`);
        }
      },
    };
  }
}

/**
 * Export for convenience
 */
export default AIProviderFactory;
