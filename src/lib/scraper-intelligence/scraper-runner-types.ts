/**
 * Scraper Runner Types
 *
 * Type definitions for the intelligent web scraping orchestration system.
 * Supports multi-template scraping, caching, rate limiting, and queue management.
 */

import type { ScrapingPlatform } from '@/types/scraper-intelligence';

// ============================================================================
// BASE TYPES
// ============================================================================

/**
 * Generic metadata container for flexible data storage
 */
export type MetadataValue = string | number | boolean | null | undefined | MetadataObject | MetadataArray;
export interface MetadataObject {
  [key: string]: MetadataValue;
}
export type MetadataArray = MetadataValue[];

// ============================================================================
// JOB MANAGEMENT
// ============================================================================

/**
 * Status of a scrape job
 */
export type ScrapeJobStatus =
  | 'pending'      // Waiting in queue
  | 'running'      // Currently executing
  | 'completed'    // Successfully completed
  | 'failed'       // Failed after all retries
  | 'cancelled'    // Manually cancelled
  | 'cached';      // Result served from cache

/**
 * Priority levels for scrape jobs
 */
export type ScrapeJobPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Configuration for a scrape job
 */
export interface ScrapeJobConfig {
  /** Unique job identifier */
  jobId: string;
  
  /** Organization requesting the scrape */
  organizationId: string;
  
  /** Workspace ID (optional) */
  workspaceId?: string;
  
  /** Industry template to use */
  industryId: string;
  
  /** Target URL to scrape */
  url: string;
  
  /** Platform type */
  platform: ScrapingPlatform;
  
  /** Related record ID (lead, company, etc.) */
  relatedRecordId?: string;
  
  /** Job priority */
  priority: ScrapeJobPriority;
  
  /** Maximum retry attempts */
  maxRetries?: number;
  
  /** Timeout in milliseconds */
  timeoutMs?: number;
  
  /** Skip cache and force fresh scrape */
  skipCache?: boolean;

  /** Additional metadata */
  metadata?: MetadataObject;
}

/**
 * Result of a scrape job
 */
export interface ScrapeJobResult {
  /** Job configuration */
  config: ScrapeJobConfig;
  
  /** Job status */
  status: ScrapeJobStatus;
  
  /** Start time */
  startedAt: Date;
  
  /** Completion time */
  completedAt?: Date;
  
  /** Duration in milliseconds */
  durationMs?: number;
  
  /** Extracted signals (if successful) */
  signals?: Array<{
    signalId: string;
    signalLabel: string;
    value: MetadataValue;
    confidence: number;
  }>;
  
  /** Lead score (if calculated) */
  leadScore?: number;
  
  /** Temporary scrape ID */
  tempScrapeId?: string;
  
  /** Whether result came from cache */
  cached?: boolean;
  
  /** Cache age in milliseconds (if cached) */
  cacheAgeMs?: number;
  
  /** Error information (if failed) */
  error?: {
    message: string;
    code: string;
    attemptNumber: number;
    timestamp: Date;
  };
  
  /** Retry information */
  retries?: {
    attemptsMade: number;
    maxAttempts: number;
    nextRetryAt?: Date;
  };
  
  /** Storage metrics */
  storageReduction?: {
    rawSizeBytes: number;
    signalsSizeBytes: number;
    reductionPercent: number;
  };
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total jobs in queue */
  total: number;
  
  /** Jobs by status */
  byStatus: Record<ScrapeJobStatus, number>;
  
  /** Jobs by priority */
  byPriority: Record<ScrapeJobPriority, number>;
  
  /** Average wait time in milliseconds */
  avgWaitTimeMs: number;
  
  /** Average execution time in milliseconds */
  avgExecutionTimeMs: number;
  
  /** Queue capacity utilization (0-1) */
  utilization: number;
  
  /** Number of active workers */
  activeWorkers: number;
  
  /** Maximum concurrent workers */
  maxWorkers: number;
}

/**
 * Job queue interface
 */
export interface JobQueue {
  /** Add a job to the queue */
  enqueue(job: ScrapeJobConfig): Promise<void>;
  
  /** Get next job to process */
  dequeue(): Promise<ScrapeJobConfig | null>;
  
  /** Get job by ID */
  getJob(jobId: string): Promise<ScrapeJobResult | null>;
  
  /** Update job result */
  updateJob(jobId: string, updates: Partial<ScrapeJobResult>): Promise<void>;
  
  /** Mark job as completed */
  completeJob(
    jobId: string,
    result: Omit<ScrapeJobResult, 'config' | 'status' | 'startedAt'>
  ): Promise<void>;
  
  /** Mark job as failed */
  failJob(jobId: string, error: Error, attemptNumber: number): Promise<void>;
  
  /** Cancel a job */
  cancelJob(jobId: string): Promise<boolean>;
  
  /** Get queue statistics */
  getStats(): QueueStats;
  
  /** Clear all jobs */
  clear(): void;
  
  /** Shutdown and cleanup */
  shutdown(): void;
}

// ============================================================================
// CACHING
// ============================================================================

/**
 * Cache entry for scrape results
 */
export interface ScrapeCacheEntry {
  /** Cached result */
  result: ScrapeJobResult;
  
  /** Cache creation time */
  cachedAt: Date;
  
  /** Cache expiration time */
  expiresAt: Date;
  
  /** Number of cache hits */
  hits: number;
  
  /** Last access time */
  lastAccessedAt: Date;
  
  /** Content hash for validation */
  contentHash: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total cache entries */
  size: number;
  
  /** Total cache hits */
  hits: number;
  
  /** Total cache misses */
  misses: number;
  
  /** Cache hit rate (0-1) */
  hitRate: number;
  
  /** Average cache age in milliseconds */
  avgAgeMs: number;
  
  /** Memory usage estimate in bytes */
  estimatedSizeBytes: number;
  
  /** Eviction count */
  evictions: number;
}

/**
 * Cache interface
 */
export interface ScrapeCache {
  /** Get cached result */
  get(url: string): Promise<ScrapeCacheEntry | null>;
  
  /** Set cache entry */
  set(url: string, result: ScrapeJobResult, ttlMs?: number): Promise<void>;
  
  /** Invalidate cache entry */
  invalidate(url: string): Promise<void>;
  
  /** Invalidate by pattern */
  invalidatePattern(pattern: RegExp): Promise<number>;
  
  /** Get cache statistics */
  getStats(): CacheStats;
  
  /** Clear entire cache */
  clear(): void;
  
  /** Shutdown and cleanup */
  shutdown(): void;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  
  /** Time window in milliseconds */
  windowMs: number;
  
  /** Delay between requests in milliseconds */
  minDelayMs?: number;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  /** Domain being limited */
  domain: string;
  
  /** Whether request is allowed */
  allowed: boolean;
  
  /** Remaining requests in current window */
  remaining: number;
  
  /** Time until window reset in milliseconds */
  resetInMs: number;
  
  /** Current request count */
  currentCount: number;
  
  /** Maximum requests allowed */
  maxRequests: number;
}

/**
 * Rate limiter interface
 */
export interface DomainRateLimiter {
  /** Check if request is allowed */
  checkLimit(domain: string): Promise<RateLimitStatus>;
  
  /** Wait until request is allowed (with delay) */
  waitForSlot(domain: string): Promise<void>;
  
  /** Reset limits for a domain */
  reset(domain: string): void;
  
  /** Get current status for a domain */
  getStatus(domain: string): RateLimitStatus;
  
  /** Shutdown and cleanup */
  shutdown(): void;
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

/**
 * Progress event types
 */
export type ProgressEventType = 
  | 'job_queued'
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'job_cancelled'
  | 'job_cached';

/**
 * Progress event
 */
export interface ProgressEvent {
  /** Event type */
  type: ProgressEventType;
  
  /** Job ID */
  jobId: string;
  
  /** Event timestamp */
  timestamp: Date;
  
  /** Progress percentage (0-100) */
  progress?: number;
  
  /** Human-readable message */
  message: string;

  /** Additional data */
  data?: MetadataObject;
}

/**
 * Progress tracker interface
 */
export interface ProgressTracker {
  /** Emit progress event */
  emit(event: ProgressEvent): void;
  
  /** Subscribe to progress events */
  subscribe(jobId: string, callback: (event: ProgressEvent) => void): () => void;
  
  /** Subscribe to all events */
  subscribeAll(callback: (event: ProgressEvent) => void): () => void;
  
  /** Get current progress for a job */
  getProgress(jobId: string): ProgressEvent[];
  
  /** Clear progress history for a job */
  clear(jobId: string): void;
  
  /** Shutdown and cleanup */
  shutdown(): void;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Error types
 */
export type ScrapeErrorType = 
  | 'network_error'
  | 'timeout_error'
  | 'rate_limit_error'
  | 'validation_error'
  | 'extraction_error'
  | 'cache_error'
  | 'unknown_error';

/**
 * Scrape error
 */
export class ScrapeError extends Error {
  constructor(
    message: string,
    public readonly type: ScrapeErrorType,
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false,
    public readonly metadata?: MetadataObject
  ) {
    super(message);
    this.name = 'ScrapeError';
  }
}

/**
 * Retry strategy
 */
export interface RetryStrategy {
  /** Maximum retry attempts */
  maxAttempts: number;
  
  /** Base delay in milliseconds */
  baseDelayMs: number;
  
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  
  /** Backoff multiplier */
  backoffMultiplier: number;
  
  /** Jitter factor (0-1) to prevent thundering herd */
  jitterFactor: number;
  
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

/**
 * Default retry strategy
 */
export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  exponentialBackoff: true,
};

/**
 * Error handler interface
 */
export interface ErrorHandler {
  /** Handle error and determine if retry should occur */
  shouldRetry(error: Error, attemptNumber: number): boolean;
  
  /** Calculate delay before next retry */
  getRetryDelay(attemptNumber: number): number;
  
  /** Transform error for user presentation */
  formatError(error: Error): { message: string; code: string; retryable: boolean };
}

// ============================================================================
// SCRAPER RUNNER
// ============================================================================

/**
 * Scraper Runner configuration
 */
export interface ScraperRunnerConfig {
  /** Maximum concurrent scrapes */
  maxConcurrent: number;
  
  /** Default cache TTL in milliseconds */
  cacheTtlMs: number;
  
  /** Default timeout per scrape in milliseconds */
  defaultTimeoutMs: number;
  
  /** Retry strategy */
  retryStrategy: RetryStrategy;
  
  /** Rate limit configuration per domain */
  rateLimitConfig: RateLimitConfig;
  
  /** Enable progress tracking */
  enableProgressTracking: boolean;
  
  /** Enable caching */
  enableCaching: boolean;
}

/**
 * Default runner configuration
 */
export const DEFAULT_RUNNER_CONFIG: ScraperRunnerConfig = {
  maxConcurrent: 5,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  defaultTimeoutMs: 30000,    // 30 seconds
  retryStrategy: DEFAULT_RETRY_STRATEGY,
  rateLimitConfig: {
    maxRequests: 10,
    windowMs: 60000,         // 1 minute
    minDelayMs: 1000,        // 1 second between requests
  },
  enableProgressTracking: true,
  enableCaching: true,
};

/**
 * Scraper Runner interface
 */
export interface ScraperRunner {
  /** Submit a scrape job */
  submitJob(config: ScrapeJobConfig): Promise<string>;
  
  /** Submit multiple jobs in batch */
  submitBatch(configs: ScrapeJobConfig[]): Promise<string[]>;
  
  /** Get job result */
  getJobResult(jobId: string): Promise<ScrapeJobResult | null>;
  
  /** Cancel a job */
  cancelJob(jobId: string): Promise<boolean>;
  
  /** Wait for job completion */
  waitForJob(jobId: string, timeoutMs?: number): Promise<ScrapeJobResult>;
  
  /** Get runner statistics */
  getStats(): {
    queue: QueueStats;
    cache: CacheStats;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
  
  /** Shutdown runner gracefully */
  shutdown(): Promise<void>;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Generate job ID
 */
export function generateJobId(): string {
  return `scrape_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Calculate cache key for URL
 */
export function getCacheKey(url: string, platform: ScrapingPlatform): string {
  return `${platform}:${url}`;
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attemptNumber: number,
  strategy: RetryStrategy
): number {
  let delay = strategy.baseDelayMs;
  
  if (strategy.exponentialBackoff) {
    delay = strategy.baseDelayMs * Math.pow(strategy.backoffMultiplier, attemptNumber - 1);
  }
  
  // Cap at max delay
  delay = Math.min(delay, strategy.maxDelayMs);
  
  // Add jitter to prevent thundering herd
  const jitter = delay * strategy.jitterFactor * (Math.random() - 0.5);
  delay = delay + jitter;
  
  return Math.round(delay);
}
