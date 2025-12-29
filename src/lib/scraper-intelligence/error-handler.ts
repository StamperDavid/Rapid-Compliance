/**
 * Error Handler
 * 
 * Intelligent error handling and retry logic for scrape operations.
 * Implements exponential backoff with jitter.
 * 
 * Features:
 * - Error classification and handling
 * - Retry decision logic
 * - Exponential backoff with jitter
 * - User-friendly error formatting
 * - Detailed error logging
 */

import { logger } from '@/lib/logger/logger';
import type {
  ErrorHandler,
  RetryStrategy,
  ScrapeErrorType,
} from './scraper-runner-types';
import { ScrapeError, calculateRetryDelay } from './scraper-runner-types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * HTTP status codes that should trigger retries
 */
const RETRYABLE_HTTP_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Error messages that indicate retryable errors
 */
const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /network/i,
  /connection/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /socket hang up/i,
];

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Production-ready error handler with retry logic
 */
export class ScraperErrorHandler implements ErrorHandler {
  constructor(private readonly retryStrategy: RetryStrategy) {}

  /**
   * Determine if an error should trigger a retry
   */
  shouldRetry(error: Error, attemptNumber: number): boolean {
    // Check if we've exceeded max attempts
    if (attemptNumber >= this.retryStrategy.maxAttempts) {
      logger.debug('Max retry attempts reached', {
        attemptNumber,
        maxAttempts: this.retryStrategy.maxAttempts,
      });
      return false;
    }

    // Check if error is marked as retryable
    if (error instanceof ScrapeError) {
      return error.retryable;
    }

    // Check for retryable HTTP status codes
    const statusCode = (error as any).statusCode || (error as any).status;
    if (statusCode && RETRYABLE_HTTP_CODES.includes(statusCode)) {
      logger.debug('Retryable HTTP status code', { statusCode });
      return true;
    }

    // Check for retryable error patterns
    const errorMessage = error.message || '';
    for (const pattern of RETRYABLE_ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        logger.debug('Retryable error pattern matched', {
          pattern: pattern.toString(),
          message: errorMessage,
        });
        return true;
      }
    }

    // By default, don't retry unknown errors
    logger.debug('Non-retryable error', {
      errorType: error.constructor.name,
      message: errorMessage,
    });
    return false;
  }

  /**
   * Calculate delay before next retry
   */
  getRetryDelay(attemptNumber: number): number {
    return calculateRetryDelay(attemptNumber, this.retryStrategy);
  }

  /**
   * Format error for user presentation
   */
  formatError(error: Error): { 
    message: string; 
    code: string; 
    retryable: boolean;
  } {
    if (error instanceof ScrapeError) {
      return {
        message: error.message,
        code: error.type,
        retryable: error.retryable,
      };
    }

    // Classify and format unknown errors
    const errorType = this.classifyError(error);
    const userMessage = this.getUserFriendlyMessage(error, errorType);
    const retryable = this.shouldRetry(error, 1);

    return {
      message: userMessage,
      code: errorType,
      retryable,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Classify error type
   */
  private classifyError(error: Error): ScrapeErrorType {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    ) {
      return 'network_error';
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('etimedout')
    ) {
      return 'timeout_error';
    }

    // Rate limit errors
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      (error as any).statusCode === 429
    ) {
      return 'rate_limit_error';
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid')
    ) {
      return 'validation_error';
    }

    // Extraction errors
    if (
      message.includes('extraction') ||
      message.includes('parse')
    ) {
      return 'extraction_error';
    }

    // Cache errors
    if (message.includes('cache')) {
      return 'cache_error';
    }

    return 'unknown_error';
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(error: Error, type: ScrapeErrorType): string {
    const messages: Record<ScrapeErrorType, string> = {
      network_error: 'Unable to connect to the website. Please check your internet connection and try again.',
      timeout_error: 'The request took too long to complete. The website may be slow or unavailable.',
      rate_limit_error: 'Too many requests to this website. Please wait a few minutes before trying again.',
      validation_error: 'Invalid request configuration. Please check your settings.',
      extraction_error: 'Unable to extract data from the website. The page structure may have changed.',
      cache_error: 'Cache operation failed. Data will be fetched directly.',
      unknown_error: 'An unexpected error occurred. Please try again later.',
    };

    const baseMessage = messages[type];

    // Add original error message if it provides additional context
    const originalMessage = error.message;
    if (originalMessage && !originalMessage.toLowerCase().includes('error')) {
      return `${baseMessage} Details: ${originalMessage}`;
    }

    return baseMessage;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new error handler
 */
export function createErrorHandler(retryStrategy: RetryStrategy): ErrorHandler {
  return new ScraperErrorHandler(retryStrategy);
}

// ============================================================================
// ERROR CREATION UTILITIES
// ============================================================================

/**
 * Create a network error
 */
export function createNetworkError(
  message: string,
  metadata?: Record<string, any>
): ScrapeError {
  return new ScrapeError(
    message,
    'network_error',
    503,
    true, // Retryable
    metadata
  );
}

/**
 * Create a timeout error
 */
export function createTimeoutError(
  url: string,
  timeoutMs: number,
  metadata?: Record<string, any>
): ScrapeError {
  return new ScrapeError(
    `Request to ${url} timed out after ${timeoutMs}ms`,
    'timeout_error',
    408,
    true, // Retryable
    { ...metadata, url, timeoutMs }
  );
}

/**
 * Create a rate limit error
 */
export function createRateLimitError(
  domain: string,
  resetInMs: number,
  metadata?: Record<string, any>
): ScrapeError {
  return new ScrapeError(
    `Rate limit exceeded for ${domain}. Retry after ${Math.ceil(resetInMs / 1000)}s`,
    'rate_limit_error',
    429,
    true, // Retryable
    { ...metadata, domain, resetInMs }
  );
}

/**
 * Create a validation error
 */
export function createValidationError(
  message: string,
  metadata?: Record<string, any>
): ScrapeError {
  return new ScrapeError(
    message,
    'validation_error',
    400,
    false, // Not retryable
    metadata
  );
}

/**
 * Create an extraction error
 */
export function createExtractionError(
  message: string,
  url: string,
  metadata?: Record<string, any>
): ScrapeError {
  return new ScrapeError(
    message,
    'extraction_error',
    422,
    false, // Not retryable (won't fix itself)
    { ...metadata, url }
  );
}

/**
 * Create a cache error
 */
export function createCacheError(
  message: string,
  metadata?: Record<string, any>
): ScrapeError {
  return new ScrapeError(
    message,
    'cache_error',
    500,
    false, // Not retryable
    metadata
  );
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Wrap an async function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  errorHandler: ErrorHandler,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (!errorHandler.shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // Calculate delay
      const delayMs = errorHandler.getRetryDelay(attempt);

      logger.warn('Retrying after error', {
        attempt,
        maxAttempts,
        delayMs,
        error: lastError.message,
      });

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // All retries exhausted
  throw lastError || new Error('Unknown error during retry');
}

/**
 * Wrap an async function with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new ScrapeError(
          errorMessage || `Operation timed out after ${timeoutMs}ms`,
          'timeout_error',
          408,
          true
        ));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Log error with structured context
 */
export function logError(
  error: Error,
  context: Record<string, any>,
  level: 'warn' | 'error' = 'error'
): void {
  const errorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error instanceof ScrapeError && {
      type: error.type,
      statusCode: error.statusCode,
      retryable: error.retryable,
      metadata: error.metadata,
    }),
  };

  if (level === 'error') {
    logger.error('Scraper error', error, context);
  } else {
    logger.warn('Scraper warning', { error: errorInfo, ...context });
  }
}
