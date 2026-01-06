/**
 * Retry Utility with Exponential Backoff
 * 
 * Provides retry logic for operations that may fail transiently,
 * such as API calls, database operations, and LLM requests.
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Configurable max retries and delays
 * - Custom retry conditions
 * - Request cancellation support (AbortController)
 * - Detailed error logging
 * 
 * Usage:
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => await callOpenAI(prompt),
 *   {
 *     maxRetries: 3,
 *     baseDelayMs: 1000,
 *     maxDelayMs: 10000,
 *     shouldRetry: (error) => error.status === 429 || error.status >= 500
 *   }
 * );
 * ```
 */

import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface RetryOptions<T = any> {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  
  /** Base delay between retries in milliseconds (default: 1000) */
  baseDelayMs?: number;
  
  /** Maximum delay between retries in milliseconds (default: 30000 = 30s) */
  maxDelayMs?: number;
  
  /** Custom function to determine if error should trigger retry */
  shouldRetry?: (error: any, attempt: number) => boolean;
  
  /** Callback called before each retry */
  onRetry?: (error: any, attempt: number, delayMs: number) => void;
  
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  
  /** Operation name for logging (default: 'operation') */
  operationName?: string;
  
  /** Whether to add jitter to delay (default: true) */
  addJitter?: boolean;
}

export interface RetryResult<T> {
  /** Result of the operation */
  result: T;
  
  /** Number of attempts made */
  attempts: number;
  
  /** Total time spent in milliseconds */
  totalTimeMs: number;
  
  /** Whether operation succeeded */
  success: boolean;
}

// ============================================================================
// RETRY FUNCTIONS
// ============================================================================

/**
 * Retry an async operation with exponential backoff
 * 
 * @param operation - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the operation
 * @throws Last error if all retries exhausted
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions<T> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry = defaultShouldRetry,
    onRetry,
    signal,
    operationName = 'operation',
    addJitter = true
  } = options;
  
  const startTime = Date.now();
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check if operation was cancelled
      if (signal?.aborted) {
        throw new Error('Operation cancelled');
      }
      
      // Execute operation
      const result = await operation();
      
      // Log success if retries were needed
      if (attempt > 0) {
        logger.info(`${operationName} succeeded after ${attempt} retries`, {
          attempts: attempt + 1,
          totalTimeMs: Date.now() - startTime
        });
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const isLastAttempt = attempt === maxRetries;
      const shouldRetryError = shouldRetry(error, attempt);
      
      if (isLastAttempt || !shouldRetryError) {
        // Log final failure
        logger.error(`${operationName} failed after ${attempt + 1} attempts`, error as Error, {
          attempts: attempt + 1,
          totalTimeMs: Date.now() - startTime
        });
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const exponentialDelay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );
      
      // Add jitter to prevent thundering herd
      const jitter = addJitter ? Math.random() * 0.3 * exponentialDelay : 0;
      const delayMs = exponentialDelay + jitter;
      
      // Call retry callback
      if (onRetry) {
        onRetry(error, attempt + 1, delayMs);
      }
      
      // Log retry attempt
      logger.warn(`${operationName} failed, retrying in ${Math.round(delayMs)}ms`, {
        attempt: attempt + 1,
        maxRetries,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Wait before retrying
      await sleep(delayMs, signal);
    }
  }
  
  // This should never be reached, but TypeScript requires it
  throw lastError;
}

/**
 * Default retry condition - retry on network errors and 5xx status codes
 */
function defaultShouldRetry(error: any, attempt: number): boolean {
  // Never retry after max attempts
  if (attempt >= 10) {
    return false;
  }
  
  // Retry on network errors
  if (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENOTFOUND' ||
    error.message?.includes('network') ||
    error.message?.includes('timeout')
  ) {
    return true;
  }
  
  // Retry on rate limits (429)
  if (error.status === 429 || error.statusCode === 429) {
    return true;
  }
  
  // Retry on server errors (5xx)
  if (error.status >= 500 || error.statusCode >= 500) {
    return true;
  }
  
  // Don't retry on client errors (4xx, except 429)
  if ((error.status >= 400 && error.status < 500) || 
      (error.statusCode >= 400 && error.statusCode < 500)) {
    return false;
  }
  
  // Retry on unknown errors
  return true;
}

/**
 * Sleep for specified duration with cancellation support
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    // Handle cancellation
    if (signal?.aborted) {
      reject(new Error('Sleep cancelled'));
      return;
    }
    
    const timeoutId = setTimeout(resolve, ms);
    
    // Listen for cancellation
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new Error('Sleep cancelled'));
      }, { once: true });
    }
  });
}

// ============================================================================
// LLM-SPECIFIC RETRY PRESETS
// ============================================================================

/**
 * Retry options for OpenAI API calls
 */
export const OpenAIRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  operationName: 'OpenAI API call',
  shouldRetry: (error, attempt) => {
    // Retry on rate limits
    if (error.status === 429 || error.statusCode === 429) {
      return true;
    }
    
    // Retry on server errors
    if (error.status >= 500 || error.statusCode >= 500) {
      return true;
    }
    
    // Retry on timeout
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return true;
    }
    
    // Don't retry on invalid requests
    if (error.status === 400 || error.status === 401 || error.status === 403) {
      return false;
    }
    
    // Retry on unknown errors (but limit attempts)
    return attempt < 3;
  }
};

/**
 * Retry options for general LLM calls
 */
export const LLMRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 15000,
  operationName: 'LLM call',
  shouldRetry: (error, attempt) => {
    // Retry on rate limits and server errors
    return (
      error.status === 429 ||
      error.status >= 500 ||
      error.code === 'ETIMEDOUT' ||
      (attempt < 3 && !error.status)
    );
  }
};

/**
 * Retry options for database operations
 */
export const DatabaseRetryOptions: RetryOptions = {
  maxRetries: 5,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  operationName: 'Database operation',
  shouldRetry: (error, attempt) => {
    // Retry on deadlocks and timeouts
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('deadlock') ||
      error.message?.includes('timeout') ||
      (attempt < 5 && !error.status)
    );
  }
};

/**
 * Retry options for external API calls
 */
export const ExternalAPIRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  operationName: 'External API call',
  shouldRetry: defaultShouldRetry
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Retry with exponential backoff and return detailed result
 */
export async function retryWithBackoffDetailed<T>(
  operation: () => Promise<T>,
  options: RetryOptions<T> = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;
  
  try {
    const result = await retryWithBackoff(
      async () => {
        attempts++;
        return operation();
      },
      options
    );
    
    return {
      result,
      attempts,
      totalTimeMs: Date.now() - startTime,
      success: true
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Create an AbortController with timeout
 */
export function createAbortControllerWithTimeout(timeoutMs: number): AbortController {
  const controller = new AbortController();
  
  setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  return controller;
}
