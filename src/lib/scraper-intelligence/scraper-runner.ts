/**
 * Scraper Runner
 * 
 * Main orchestration engine for intelligent web scraping across all 49 industry templates.
 * Coordinates caching, rate limiting, queue management, and progress tracking.
 * 
 * Features:
 * - Multi-template scraping orchestration
 * - Intelligent caching (5-minute default TTL)
 * - Domain-based rate limiting
 * - Priority-based job queue
 * - Real-time progress tracking
 * - Automatic retry with exponential backoff
 * - Concurrent scrape management
 */

import { logger } from '@/lib/logger/logger';
import { processAndStoreScrape } from './scraper-intelligence-service';
import { getIndustryTemplate } from '@/lib/persona/industry-templates';
import { type ExtractedSignal } from '@/types/scraper-intelligence';
import {
  type ScraperRunner,
  type ScraperRunnerConfig,
  type ScrapeJobConfig,
  type ScrapeJobResult,
  type ScrapeCache,
  type DomainRateLimiter,
  type JobQueue,
  type ProgressTracker,
  type ErrorHandler,
  type QueueStats,
  type CacheStats,
  DEFAULT_RUNNER_CONFIG,
  extractDomain,
  generateJobId,
  ScrapeError,
} from './scraper-runner-types';
import { createScrapeCache, getScrapeCacheKey, calculateCacheTTL } from './scraper-cache';
import { createDomainRateLimiter } from './domain-rate-limiter';
import { createScrapeQueue, validateJobConfig } from './scraper-queue';
import { createProgressTracker, createProgressEvent, formatProgressMessage } from './progress-tracker';
import { createErrorHandler, withRetry, withTimeout, logError } from './error-handler';

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Production-ready scraper runner implementation
 */
export class ProductionScraperRunner implements ScraperRunner {
  private cache: ScrapeCache;
  private rateLimiter: DomainRateLimiter;
  private queue: JobQueue;
  private progressTracker: ProgressTracker;
  private errorHandler: ErrorHandler;
  private config: ScraperRunnerConfig;
  private running = false;
  private activeWorkers = 0;
  private shutdownSignal = false;

  // Statistics
  private stats = {
    completedJobs: 0,
    failedJobs: 0,
    cachedJobs: 0,
  };

  constructor(config: Partial<ScraperRunnerConfig> = {}) {
    this.config = { ...DEFAULT_RUNNER_CONFIG, ...config };

    // Initialize components
    this.cache = createScrapeCache(1000, this.config.cacheTtlMs);
    this.rateLimiter = createDomainRateLimiter(this.config.rateLimitConfig);
    this.queue = createScrapeQueue(this.config.maxConcurrent);
    this.progressTracker = createProgressTracker();
    this.errorHandler = createErrorHandler(this.config.retryStrategy);

    logger.info('Scraper Runner initialized', {
      maxConcurrent: this.config.maxConcurrent,
      cacheTtlMs: this.config.cacheTtlMs,
      enableCaching: this.config.enableCaching,
      enableProgressTracking: this.config.enableProgressTracking,
    });
  }

  /**
   * Submit a scrape job
   */
  async submitJob(config: ScrapeJobConfig): Promise<string> {
    // Validate configuration
    const validation = validateJobConfig(config);
    if (!validation.valid) {
      throw new ScrapeError(
        `Invalid job configuration: ${validation.errors.join(', ')}`,
        'validation_error',
        400,
        false,
        { errors: validation.errors }
      );
    }

    // Generate job ID if not provided
    if (!config.jobId) {
      config.jobId = generateJobId();
    }

    // Set defaults
    const jobConfig: ScrapeJobConfig = {
      ...config,
      priority: config.priority || 'normal',
      maxRetries: config.maxRetries ?? this.config.retryStrategy.maxAttempts,
      timeoutMs: config.timeoutMs ?? this.config.defaultTimeoutMs,
      skipCache: config.skipCache ?? false,
    };

    // Add to queue
    await this.queue.enqueue(jobConfig);

    // Emit progress event
    if (this.config.enableProgressTracking) {
      this.progressTracker.emit(createProgressEvent(
        jobConfig.jobId,
        'job_queued',
        formatProgressMessage('job_queued', jobConfig.url),
        0
      ));
    }

    // Start processing if not already running
    if (!this.running) {
      void this.startProcessing();
    }

    logger.info('Job submitted', {
      jobId: jobConfig.jobId,
      url: jobConfig.url,
      priority: jobConfig.priority,
      organizationId: jobConfig.organizationId,
    });

    return jobConfig.jobId;
  }

  /**
   * Submit multiple jobs in batch
   */
  async submitBatch(configs: ScrapeJobConfig[]): Promise<string[]> {
    const jobIds: string[] = [];

    for (const config of configs) {
      try {
        const jobId = await this.submitJob(config);
        jobIds.push(jobId);
      } catch (error) {
        logger.error('Failed to submit batch job', error as Error, {
          url: config.url,
        });
        // Continue with other jobs
      }
    }

    logger.info('Batch submitted', {
      totalJobs: configs.length,
      submittedJobs: jobIds.length,
      failedJobs: configs.length - jobIds.length,
    });

    return jobIds;
  }

  /**
   * Get job result
   */
  async getJobResult(jobId: string): Promise<ScrapeJobResult | null> {
    return this.queue.getJob(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const cancelled = await this.queue.cancelJob(jobId);

    if (cancelled && this.config.enableProgressTracking) {
      const result = await this.queue.getJob(jobId);
      if (result) {
        this.progressTracker.emit(createProgressEvent(
          jobId,
          'job_cancelled',
          formatProgressMessage('job_cancelled', result.config.url)
        ));
      }
    }

    return cancelled;
  }

  /**
   * Wait for job completion
   */
  async waitForJob(
    jobId: string,
    timeoutMs: number = 60000
  ): Promise<ScrapeJobResult> {
    const startTime = Date.now();

     
    while (true) {
      const result = await this.queue.getJob(jobId);

      if (!result) {
        throw new ScrapeError(
          `Job not found: ${jobId}`,
          'validation_error',
          404,
          false
        );
      }

      // Check if completed
      if (
        result.status === 'completed' ||
        result.status === 'failed' ||
        result.status === 'cancelled' ||
        result.status === 'cached'
      ) {
        return result;
      }

      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new ScrapeError(
          `Timeout waiting for job ${jobId}`,
          'timeout_error',
          408,
          false
        );
      }

      // Wait before checking again
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 100);
      });
    }
  }

  /**
   * Get runner statistics
   */
  getStats(): {
    queue: QueueStats;
    cache: CacheStats;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    return {
      queue: this.queue.getStats(),
      cache: this.cache.getStats(),
      activeJobs: this.activeWorkers,
      completedJobs: this.stats.completedJobs,
      failedJobs: this.stats.failedJobs,
    };
  }

  /**
   * Shutdown runner gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down scraper runner...');
    this.shutdownSignal = true;

    // Wait for active workers to complete (max 30 seconds)
    const shutdownTimeout = 30000;
    const startTime = Date.now();

    while (this.activeWorkers > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 100);
      });
    }

    // Shutdown components
    this.cache.clear();
    this.progressTracker.shutdown();
    this.rateLimiter.shutdown();
    this.queue.shutdown();

    logger.info('Scraper runner shut down', {
      activeWorkersRemaining: this.activeWorkers,
    });
  }

  // ==========================================================================
  // PRIVATE METHODS - HELPERS
  // ==========================================================================

  /**
   * Convert ExtractedSignal to the signal format expected by ScrapeJobResult
   */
  private mapExtractedSignalToResultSignal(signal: ExtractedSignal): {
    signalId: string;
    signalLabel: string;
    value: import('./scraper-runner-types').MetadataValue;
    confidence: number;
  } {
    return {
      signalId: signal.signalId,
      signalLabel: signal.signalLabel,
      value: signal.sourceText,
      confidence: signal.confidence,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - PROCESSING
  // ==========================================================================

  /**
   * Start job processing loop
   */
  private async startProcessing(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    logger.info('Starting job processing');

    // Start worker loops
    const workers: Promise<void>[] = [];
    for (let i = 0; i < this.config.maxConcurrent; i++) {
      workers.push(this.workerLoop(i));
    }

    // Wait for all workers (they run until shutdown)
    await Promise.all(workers);

    this.running = false;
    logger.info('Job processing stopped');
  }

  /**
   * Worker loop for processing jobs
   */
  private async workerLoop(workerId: number): Promise<void> {
    logger.debug('Worker started', { workerId });

    while (!this.shutdownSignal) {
      try {
        // Get next job
        const jobConfig = await this.queue.dequeue();

        if (!jobConfig) {
          // No jobs available, wait before checking again
          await new Promise<void>(resolve => {
            setTimeout(() => resolve(), 1000);
          });
          continue;
        }

        // Process job
        this.activeWorkers++;
        await this.processJob(jobConfig);
        this.activeWorkers--;

      } catch (error) {
        logger.error('Worker loop error', error as Error, { workerId });
        this.activeWorkers = Math.max(0, this.activeWorkers - 1);
      }
    }

    logger.debug('Worker stopped', { workerId });
  }

  /**
   * Process a single job
   */
  private async processJob(config: ScrapeJobConfig): Promise<void> {
    const { jobId, url, organizationId, industryId, platform } = config;

    logger.info('Processing job', { jobId, url, organizationId, industryId });

    // Emit started event
    if (this.config.enableProgressTracking) {
      this.progressTracker.emit(createProgressEvent(
        jobId,
        'job_started',
        formatProgressMessage('job_started', url),
        10
      ));
    }

    try {
      // Step 1: Check cache (if enabled)
      if (this.config.enableCaching && !config.skipCache) {
        const cached = await this.checkCache(config);
        if (cached) {
          await this.queue.completeJob(jobId, {
            signals: cached.signals.map(s => this.mapExtractedSignalToResultSignal(s)),
            leadScore: cached.leadScore,
            tempScrapeId: cached.tempScrapeId,
            cached: true,
            cacheAgeMs: cached.cacheAgeMs,
            storageReduction: cached.storageReduction,
          });

          this.stats.cachedJobs++;
          this.stats.completedJobs++;

          if (this.config.enableProgressTracking) {
            this.progressTracker.emit(createProgressEvent(
              jobId,
              'job_cached',
              formatProgressMessage('job_cached', url),
              100
            ));
          }

          return;
        }
      }

      // Step 2: Wait for rate limit slot
      const domain = extractDomain(url);
      await this.rateLimiter.waitForSlot(domain);

      // Step 3: Execute scrape with retry logic
      const timeoutMs = config.timeoutMs ?? this.config.defaultTimeoutMs;
      const maxRetries = config.maxRetries ?? this.config.retryStrategy.maxAttempts;

      const result = await withRetry(
        () => withTimeout(
          () => this.executeScrape(config),
          timeoutMs,
          `Scrape timeout for ${url}`
        ),
        this.errorHandler,
        maxRetries
      );

      // Step 4: Cache result (if enabled)
      if (this.config.enableCaching) {
        const ttl = calculateCacheTTL(platform);
        const cacheKey = getScrapeCacheKey(url, platform, organizationId);

        const resultToCache: ScrapeJobResult = {
          config,
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          signals: result.signals.map(s => this.mapExtractedSignalToResultSignal(s)),
          leadScore: result.leadScore,
          tempScrapeId: result.tempScrapeId,
          storageReduction: result.storageReduction,
        };

        await this.cache.set(cacheKey, resultToCache, ttl);
      }

      // Step 5: Mark job as completed
      await this.queue.completeJob(jobId, {
        signals: result.signals.map(s => this.mapExtractedSignalToResultSignal(s)),
        leadScore: result.leadScore,
        tempScrapeId: result.tempScrapeId,
        storageReduction: result.storageReduction,
      });
      this.stats.completedJobs++;

      if (this.config.enableProgressTracking) {
        this.progressTracker.emit(createProgressEvent(
          jobId,
          'job_completed',
          formatProgressMessage('job_completed', url),
          100,
          { signalCount: result.signals?.length || 0 }
        ));
      }

      logger.info('Job completed successfully', {
        jobId,
        url,
        signalCount: result.signals?.length || 0,
        leadScore: result.leadScore,
      });

    } catch (error) {
      await this.handleJobError(config, error as Error);
    }
  }

  /**
   * Check cache for existing result
   */
  private async checkCache(config: ScrapeJobConfig): Promise<{
    signals: ExtractedSignal[];
    leadScore: number;
    tempScrapeId: string;
    cacheAgeMs: number;
    storageReduction?: {
      rawSizeBytes: number;
      signalsSizeBytes: number;
      reductionPercent: number;
    };
  } | null> {
    const { url, platform, organizationId } = config;
    const cacheKey = getScrapeCacheKey(url, platform, organizationId);

    const cached = await this.cache.get(cacheKey);

    if (cached) {
      const ageMs = Date.now() - cached.cachedAt.getTime();
      
      logger.info('Cache hit', {
        url,
        ageMs,
        hits: cached.hits,
      });

      // Convert cached result signals back to ExtractedSignal format
      const cachedSignals: ExtractedSignal[] = (cached.result.signals ?? []).map(s => ({
        signalId: s.signalId,
        signalLabel: s.signalLabel,
        sourceText: String(s.value),
        confidence: s.confidence,
        platform: config.platform,
        extractedAt: new Date(),
        sourceScrapeId: cached.result.tempScrapeId ?? '',
      }));

      return {
        signals: cachedSignals,
        leadScore: cached.result.leadScore ?? 0,
        tempScrapeId: cached.result.tempScrapeId ?? '',
        cacheAgeMs: ageMs,
        storageReduction: cached.result.storageReduction,
      };
    }

    logger.debug('Cache miss', { url });
    return null;
  }

  /**
   * Execute the actual scrape operation
   */
  private async executeScrape(config: ScrapeJobConfig): Promise<{
    signals: ExtractedSignal[];
    leadScore: number;
    tempScrapeId: string;
    storageReduction?: {
      rawSizeBytes: number;
      signalsSizeBytes: number;
      reductionPercent: number;
    };
  }> {
    const { url, organizationId, workspaceId, industryId, relatedRecordId, platform } = config;

    // Get industry template
    const template = await getIndustryTemplate(industryId);
    if (!template) {
      throw new ScrapeError(
        `Industry template not found: ${industryId}`,
        'validation_error',
        404,
        false,
        { industryId }
      );
    }

    // TODO: Replace with actual web scraping implementation
    // For now, this is a placeholder that calls the existing service
    // In production, you would:
    // 1. Fetch the webpage (using puppeteer, playwright, or axios)
    // 2. Extract content (convert HTML to markdown or text)
    // 3. Call processAndStoreScrape with the raw content

    // Placeholder scraping logic
    const rawHtml = `<!DOCTYPE html><html><body>Sample content for ${url}</body></html>`;
    const cleanedContent = `Sample content for ${url}`;
    const metadata = {
      title: 'Sample Page',
      description: 'Sample description',
      author: undefined,
      keywords: [],
    };

    // Process and store the scrape
    const result = await processAndStoreScrape({
      organizationId,
      workspaceId,
      industryId,
      recordId:(relatedRecordId !== '' && relatedRecordId != null) ? relatedRecordId : `temp_${Date.now()}`,
      url,
      rawHtml,
      cleanedContent,
      metadata,
      platform,
    });

    return {
      signals: result.signals,
      leadScore: result.leadScore,
      tempScrapeId: result.tempScrapeId,
      storageReduction: result.storageReduction,
    };
  }

  /**
   * Handle job error
   */
  private async handleJobError(config: ScrapeJobConfig, error: Error): Promise<void> {
    const { jobId, url } = config;

    logError(error, { jobId, url });

    // Determine attempt number (from retry context if available)
    const attemptNumber = (error as { attemptNumber?: number }).attemptNumber ?? 1;

    // Mark job as failed
    await this.queue.failJob(jobId, error, attemptNumber);
    this.stats.failedJobs++;

    // Emit failure event
    if (this.config.enableProgressTracking) {
      const formatted = this.errorHandler.formatError(error);
      this.progressTracker.emit(createProgressEvent(
        jobId,
        'job_failed',
        formatProgressMessage('job_failed', url, formatted.message),
        0,
        { error: formatted }
      ));
    }

    logger.error('Job failed', error, {
      jobId,
      url,
      attemptNumber,
    });
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new scraper runner instance
 */
export function createScraperRunner(
  config?: Partial<ScraperRunnerConfig>
): ScraperRunner {
  return new ProductionScraperRunner(config);
}

// ============================================================================
// SINGLETON (Optional)
// ============================================================================

let globalRunner: ScraperRunner | null = null;

/**
 * Get global scraper runner instance (singleton)
 */
export function getScraperRunner(
  config?: Partial<ScraperRunnerConfig>
): ScraperRunner {
  globalRunner ??= createScraperRunner(config);
  return globalRunner;
}

/**
 * Reset global scraper runner (for testing)
 */
export function resetScraperRunner(): void {
  if (globalRunner) {
    void globalRunner.shutdown();
    globalRunner = null;
  }
}
