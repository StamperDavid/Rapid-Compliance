/**
 * Model Fallback Service
 * Handles graceful degradation when AI models fail
 * 
 * Fallback Chain:
 * 1. Try primary model
 * 2. If fail: Try provider fallback (e.g., GPT-4 → GPT-3.5-turbo)
 * 3. If fail: Try different provider (e.g., OpenAI → Anthropic)
 * 4. If all fail: Use Gemini as last resort (always available, no API key needed in dev)
 */

import { sendUnifiedChatMessage, type UnifiedChatMessage, type UnifiedChatResponse } from './unified-ai-service';
import { logger } from '@/lib/logger/logger';

export interface FallbackRequest {
  model: string;
  messages: UnifiedChatMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface FallbackResponse extends UnifiedChatResponse {
  fallbackOccurred: boolean;
  attemptedModels: string[];
  failureReasons: string[];
}

/**
 * Model fallback chains
 */
export const FALLBACK_CHAINS: Record<string, string[]> = {
  // OpenAI fallbacks
  'gpt-4': ['gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3.5-sonnet', 'gemini-2.0-flash-exp'],
  'gpt-4-turbo': ['gpt-3.5-turbo', 'claude-3.5-sonnet', 'gemini-2.0-flash-exp'],
  'gpt-3.5-turbo': ['claude-3.5-sonnet', 'gemini-2.0-flash-exp'],
  
  // Anthropic fallbacks
  'claude-3.5-sonnet': ['claude-3-sonnet', 'gpt-4-turbo', 'gemini-2.0-flash-exp'],
  'claude-3-opus': ['claude-3.5-sonnet', 'gpt-4', 'gemini-2.0-flash-exp'],
  'claude-3-sonnet': ['claude-3.5-sonnet', 'gemini-2.0-flash-exp'],
  'claude-3-haiku': ['gemini-2.0-flash-exp', 'gpt-3.5-turbo', 'gemini-2.0-flash-exp'],
  
  // Gemini fallbacks (shouldn't need these, but just in case)
  'gemini-2.0-flash-exp': ['gemini-pro', 'gpt-3.5-turbo', 'gemini-2.0-flash-exp'],
  'gemini-pro': ['gemini-2.0-flash-exp', 'gpt-3.5-turbo', 'gemini-2.0-flash-exp'],
};

/**
 * Send request with automatic fallback on failure
 */
export async function sendWithFallback(
  request: FallbackRequest,
  organizationId?: string
): Promise<FallbackResponse> {
  const { model, messages, systemInstruction, temperature, maxTokens, topP } = request;
  
  // Build fallback chain
  const fallbackChain = [model, ...(FALLBACK_CHAINS[model] || ['gemini-2.0-flash-exp'])];
  const attemptedModels: string[] = [];
  const failureReasons: string[] = [];
  
  // Try each model in the chain
  for (const currentModel of fallbackChain) {
    attemptedModels.push(currentModel);
    
    try {
      logger.info(`Fallback Attempting model: ${currentModel}`, { file: 'model-fallback-service.ts' });
      
      const response = await sendUnifiedChatMessage({
        model: currentModel,
        messages,
        systemInstruction,
        temperature,
        maxTokens,
        topP,
      }, organizationId);
      
      // Success!
      const fallbackOccurred = currentModel !== model;
      
      if (fallbackOccurred) {
        logger.info(`Fallback Success with fallback model ${currentModel} (primary was ${model})`, { file: 'model-fallback-service.ts' });
      }
      
      return {
        ...response,
        fallbackOccurred,
        attemptedModels,
        failureReasons,
      };
      
    } catch (error: unknown) {
      // Extract error message - empty string is valid (Explicit Ternary for STRING)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failureReasons.push(`${currentModel}: ${errorMessage}`);

      logger.warn(`[Fallback] Model ${currentModel} failed: ${errorMessage}`, { file: 'model-fallback-service.ts' });
      
      // Continue to next model in chain
      continue;
    }
  }
  
  // All models failed
  const errorSummary = `All models failed. Attempted: ${attemptedModels.join(', ')}. Errors: ${failureReasons.join('; ')}`;
  logger.error(`[Fallback] ${errorSummary}`, new Error(`[Fallback] ${errorSummary}`), { file: 'model-fallback-service.ts' });
  
  throw new Error(errorSummary);
}

/**
 * Get recommended fallback model for a given model
 */
export function getRecommendedFallback(model: string): string {
  const chain = FALLBACK_CHAINS[model];
  const firstFallback = chain?.[0];
  // Model names are non-empty strings, use explicit ternary for string check
  return (firstFallback !== '' && firstFallback != null) ? firstFallback : 'gemini-2.0-flash-exp';
}

/**
 * Check if a model is available (has API key configured)
 */
export async function isModelAvailable(
  model: string,
  organizationId: string = 'demo'
): Promise<boolean> {
  try {
    // Try to send a minimal test request
    await sendUnifiedChatMessage({
      model,
      messages: [{ role: 'user', content: 'test' }],
      maxTokens: 1,
    }, organizationId);

    return true;
  } catch (_error: unknown) {
    return false;
  }
}

/**
 * Get all available models for an organization
 */
export async function getAvailableModels(
  organizationId: string = 'demo'
): Promise<string[]> {
  const allModels = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'claude-3.5-sonnet',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
    'gemini-2.0-flash-exp',
    'gemini-pro',
  ];
  
  const availabilityChecks = await Promise.all(
    allModels.map(async (model) => ({
      model,
      available: await isModelAvailable(model, organizationId),
    }))
  );
  
  return availabilityChecks
    .filter(check => check.available)
    .map(check => check.model);
}

/**
 * Smart model selection based on availability
 * Returns best available model for the use case
 */
export async function selectBestAvailableModel(
  preferredModel: string,
  organizationId: string = 'demo'
): Promise<string> {
  // Check if preferred model is available
  if (await isModelAvailable(preferredModel, organizationId)) {
    return preferredModel;
  }
  
  // Try fallback chain
  const fallbackChain = FALLBACK_CHAINS[preferredModel] ?? [];
  
  for (const fallbackModel of fallbackChain) {
    if (await isModelAvailable(fallbackModel, organizationId)) {
      logger.info(`Fallback Using ${fallbackModel} instead of ${preferredModel}`, { file: 'model-fallback-service.ts' });
      return fallbackModel;
    }
  }
  
  // Default to Gemini (no API key required in dev)
  return 'gemini-2.0-flash-exp';
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on auth errors
      if (lastError.message.includes('API key') || lastError.message.includes('401')) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);

      logger.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. Retrying in ${delay}ms...`, { file: 'model-fallback-service.ts' });

      await new Promise<void>(resolve => { setTimeout(resolve, delay); });
    }
  }

  throw lastError;
}

/**
 * Circuit breaker pattern for model calls
 */
class CircuitBreaker {
  private failures: Map<string, number> = new Map();
  private lastFailTime: Map<string, number> = new Map();
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute
  
  /**
   * Check if circuit is open (too many failures)
   */
  isOpen(model: string): boolean {
    // Failure counts are NUMBERS - 0 is valid (use ?? for numbers)
    const failures = this.failures.get(model) ?? 0;
    const lastFail = this.lastFailTime.get(model) ?? 0;
    const timeSinceLastFail = Date.now() - lastFail;
    
    // Reset if timeout passed
    if (timeSinceLastFail > this.resetTimeout) {
      this.failures.set(model, 0);
      return false;
    }
    
    return failures >= this.failureThreshold;
  }
  
  /**
   * Record a failure
   */
  recordFailure(model: string): void {
    // Failure count is a NUMBER - 0 is valid (use ?? for numbers)
    const failures = (this.failures.get(model) ?? 0) + 1;
    this.failures.set(model, failures);
    this.lastFailTime.set(model, Date.now());
    
    if (failures >= this.failureThreshold) {
      logger.warn(`[CircuitBreaker] Circuit opened for ${model} (${failures} failures)`, { file: 'model-fallback-service.ts' });
    }
  }
  
  /**
   * Record a success
   */
  recordSuccess(model: string): void {
    this.failures.set(model, 0);
  }
}

export const circuitBreaker = new CircuitBreaker();

/**
 * Send with circuit breaker protection
 */
export async function sendWithCircuitBreaker(
  request: FallbackRequest,
  organizationId?: string
): Promise<FallbackResponse> {
  const { model } = request;
  
  // Check circuit breaker
  if (circuitBreaker.isOpen(model)) {
    logger.warn(`[CircuitBreaker] Circuit is open for ${model}, using fallback`, { file: 'model-fallback-service.ts' });
    
    // Use fallback directly
    const fallbackModel = getRecommendedFallback(model);
    return sendWithFallback({
      ...request,
      model: fallbackModel,
    }, organizationId);
  }
  
  try {
    const response = await sendWithFallback(request, organizationId);
    circuitBreaker.recordSuccess(model);
    return response;
  } catch (error) {
    circuitBreaker.recordFailure(model);
    throw error;
  }
}






















