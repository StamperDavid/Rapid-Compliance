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

/**
 * Represents an error that may have HTTP status codes or network error codes
 */
export interface RetryableError {
  code?: string;
  status?: number;
  statusCode?: number;
  message?: string;
}

/**
 * Type guard to check if an error has the RetryableError shape
 */
function isRetryableError(error: unknown): error is RetryableError {
  return (
    typeof error === 'object' &&
    error !== null
  );
}

/**
 * Safely access error properties with type checking
 */
function getErrorCode(error: unknown): string | undefined {
  if (isRetryableError(error) && typeof error.code === 'string') {
    return error.code;
  }
  return undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  if (isRetryableError(error) && typeof error.status === 'number') {
    return error.status;
  }
  if (isRetryableError(error) && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  if (isRetryableError(error) && typeof error.message === 'string') {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return undefined;
}

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Base delay between retries in milliseconds (default: 1000) */
  baseDelayMs?: number;

  /** Maximum delay between retries in milliseconds (default: 30000 = 30s) */
  maxDelayMs?: number;

  /** Custom function to determine if error should trigger retry */
  shouldRetry?: (error: unknown, attempt: number) => boolean;

  /** Callback called before each retry */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;

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
  options: RetryOptions = {}
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
  let lastError: unknown;
  
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
function defaultShouldRetry(error: unknown, attempt: number): boolean {
  // Never retry after max attempts
  if (attempt >= 10) {
    return false;
  }

  const errorCode = getErrorCode(error);
  const errorStatus = getErrorStatus(error);
  const errorMessage = getErrorMessage(error);

  // Retry on network errors
  if (
    errorCode === 'ECONNRESET' ||
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ENOTFOUND' ||
    errorMessage?.includes('network') ||
    errorMessage?.includes('timeout')
  ) {
    return true;
  }

  // Retry on rate limits (429)
  if (errorStatus === 429) {
    return true;
  }

  // Retry on server errors (5xx)
  if (errorStatus !== undefined && errorStatus >= 500) {
    return true;
  }

  // Don't retry on client errors (4xx, except 429)
  if (errorStatus !== undefined && errorStatus >= 400 && errorStatus < 500) {
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
    const errorCode = getErrorCode(error);
    const errorStatus = getErrorStatus(error);
    const errorMessage = getErrorMessage(error);

    // Retry on rate limits
    if (errorStatus === 429) {
      return true;
    }

    // Retry on server errors
    if (errorStatus !== undefined && errorStatus >= 500) {
      return true;
    }

    // Retry on timeout
    if (errorCode === 'ETIMEDOUT' || errorMessage?.includes('timeout')) {
      return true;
    }

    // Don't retry on invalid requests
    if (errorStatus === 400 || errorStatus === 401 || errorStatus === 403) {
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
    const errorCode = getErrorCode(error);
    const errorStatus = getErrorStatus(error);

    // Retry on rate limits and server errors
    return (
      errorStatus === 429 ||
      (errorStatus !== undefined && errorStatus >= 500) ||
      errorCode === 'ETIMEDOUT' ||
      (attempt < 3 && errorStatus === undefined)
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
    const errorCode = getErrorCode(error);
    const errorStatus = getErrorStatus(error);
    const errorMessage = getErrorMessage(error);

    // Retry on deadlocks and timeouts
    const isConnReset = errorCode === 'ECONNRESET';
    const isTimeout = errorCode === 'ETIMEDOUT';
    const hasDeadlock = errorMessage ? errorMessage.includes('deadlock') : false;
    const hasTimeoutMsg = errorMessage ? errorMessage.includes('timeout') : false;
    const shouldRetry = attempt < 5 && errorStatus === undefined;
    return [isConnReset, isTimeout, hasDeadlock, hasTimeoutMsg, shouldRetry].some(Boolean);
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
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

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
