/**
 * Model Provider Abstraction
 * Unified interface for all AI providers
 * OpenRouter is preferred when available (one key for all models)
 */

import type {
  AIProvider,
  ModelName,
  ChatRequest,
  ChatResponse,
  IntelligentResponse,
} from '@/types/ai-models';
import { OpenRouterProvider, getAIProvider } from './openrouter-provider'
import { logger } from '@/lib/logger/logger';

/**
 * Base interface that all providers must implement
 */
export interface ModelProvider {
  provider: AIProvider;
  
  /**
   * Send a chat request
   */
  chat(request: ChatRequest): Promise<ChatResponse>;
  
  /**
   * Send a chat request with streaming
   */
  chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown>;
  
  /**
   * Check if model is available
   */
  isAvailable(model: ModelName): Promise<boolean>;
  
  /**
   * Get model capabilities
   */
  getCapabilities(model: ModelName): Promise<any>;
  
  /**
   * Estimate cost for a request
   */
  estimateCost(promptTokens: number, completionTokens: number, model: ModelName): number;
}

/**
 * Provider factory
 * Creates the appropriate provider based on model name
 */
export class ProviderFactory {
  private static providers: Map<AIProvider, ModelProvider> = new Map();
  
  /**
   * Register a provider
   */
  static register(provider: AIProvider, instance: ModelProvider): void {
    this.providers.set(provider, instance);
  }
  
  /**
   * Get provider for a model
   */
  static getProvider(model: ModelName): ModelProvider {
    const provider = this.getProviderName(model);
    const instance = this.providers.get(provider);
    
    if (!instance) {
      throw new Error(`Provider ${provider} not registered`);
    }
    
    return instance;
  }
  
  /**
   * Determine provider from model name
   */
  private static getProviderName(model: ModelName): AIProvider {
    if (model.startsWith('gpt-')) {return 'openai';}
    if (model.startsWith('claude-')) {return 'anthropic';}
    if (model.startsWith('gemini-')) {return 'google';}
    
    throw new Error(`Unknown model: ${model}`);
  }
  
  /**
   * Get all registered providers
   */
  static getAllProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }
}

/**
 * Helper to send chat request to any model
 */
export async function sendChatRequest(request: ChatRequest): Promise<ChatResponse> {
  const provider = ProviderFactory.getProvider(request.model);
  return provider.chat(request);
}

/**
 * Helper to send chat request with streaming
 */
export async function* sendChatRequestStream(
  request: ChatRequest
): AsyncGenerator<string, void, unknown> {
  const provider = ProviderFactory.getProvider(request.model);
  yield* provider.chatStream(request);
}

/**
 * Initialize all providers
 */
export async function initializeProviders(): Promise<void> {
  // Import and register providers
  const { OpenAIProvider } = await import('./providers/openai-provider');
  const { AnthropicProvider } = await import('./providers/anthropic-provider');
  const { GeminiProvider } = await import('./providers/gemini-provider');
  
  ProviderFactory.register('openai', new OpenAIProvider());
  ProviderFactory.register('anthropic', new AnthropicProvider());
  ProviderFactory.register('google', new GeminiProvider());
  
  logger.info('[Model Providers] Initialized: OpenAI, Anthropic, Google', { file: 'model-provider.ts' });
}




