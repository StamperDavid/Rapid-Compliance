/**
 * Scraper Queue
 * 
 * Priority-based job queue for managing concurrent scrape operations.
 * Implements efficient job scheduling with priority handling.
 * 
 * Features:
 * - Priority-based job scheduling
 * - Job status tracking
 * - Queue statistics
 * - Job cancellation
 * - Automatic cleanup of completed jobs
 */

import { logger } from '@/lib/logger/logger';
import {
  generateJobId as _generateJobId,
  type JobQueue,
  type ScrapeJobConfig,
  type ScrapeJobResult,
  type ScrapeJobStatus,
  type ScrapeJobPriority,
  type QueueStats,
} from './scraper-runner-types';

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIORITY_ORDER: Record<ScrapeJobPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const MAX_COMPLETED_HISTORY = 1000; // Keep last 1000 completed jobs
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes

// ============================================================================
// TYPES
// ============================================================================

/**
 * Internal job representation
 */
interface QueuedJob {
  config: ScrapeJobConfig;
  result: ScrapeJobResult;
  enqueuedAt: Date;
  priority: number; // Numeric priority for sorting
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * In-memory priority queue for scrape jobs
 */
export class InMemoryScrapeQueue implements JobQueue {
  private jobs = new Map<string, QueuedJob>();
  private pendingQueue: string[] = []; // Job IDs in priority order
  private cleanupTimer?: NodeJS.Timeout;
  
  // Statistics tracking
  private stats = {
    totalEnqueued: 0,
    totalCompleted: 0,
    totalFailed: 0,
    totalCancelled: 0,
    totalWaitTimeMs: 0,
    totalExecutionTimeMs: 0,
  };

  constructor(
    private readonly maxWorkers: number = 5
  ) {
    this.startCleanup();
  }

  /**
   * Add a job to the queue
   */
  enqueue(config: ScrapeJobConfig): Promise<void> {
    const jobId = config.jobId;
    const enqueuedAt = new Date();
    const priority = PRIORITY_ORDER[config.priority] || PRIORITY_ORDER.normal;

    // Create initial result
    const result: ScrapeJobResult = {
      config,
      status: 'pending',
      startedAt: enqueuedAt,
    };

    const job: QueuedJob = {
      config,
      result,
      enqueuedAt,
      priority,
    };

    // Add to jobs map
    this.jobs.set(jobId, job);

    // Add to pending queue in priority order
    this.insertIntoPriorityQueue(jobId, priority);

    this.stats.totalEnqueued++;

    logger.debug('Job enqueued', {
      jobId,
      url: config.url,
      priority: config.priority,
      queuePosition: this.pendingQueue.indexOf(jobId),
      queueSize: this.pendingQueue.length,
    });

    return Promise.resolve();
  }

  /**
   * Get next job to process
   *
   * Returns the highest priority pending job, or null if queue is empty
   */
  dequeue(): Promise<ScrapeJobConfig | null> {
    if (this.pendingQueue.length === 0) {
      return Promise.resolve(null);
    }

    // Get highest priority job (first in queue)
    const jobId = this.pendingQueue.shift();
    if (!jobId) {
      return Promise.resolve(null);
    }

    const job = this.jobs.get(jobId);
    if (!job) {
      logger.error('Job not found in map', new Error('Job not found'), { jobId });
      return Promise.resolve(null);
    }

    // Update status to running
    job.result.status = 'running';
    job.result.startedAt = new Date();

    logger.debug('Job dequeued', {
      jobId,
      url: job.config.url,
      priority: job.config.priority,
      waitTimeMs: job.result.startedAt.getTime() - job.enqueuedAt.getTime(),
    });

    return Promise.resolve(job.config);
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Promise<ScrapeJobResult | null> {
    const job = this.jobs.get(jobId);
    return Promise.resolve(job ? job.result : null);
  }

  /**
   * Update job result
   */
  updateJob(jobId: string, updates: Partial<ScrapeJobResult>): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      logger.warn('Cannot update non-existent job', { jobId });
      return Promise.resolve();
    }

    // Merge updates
    Object.assign(job.result, updates);

    // Update statistics based on status
    if (updates.status) {
      this.updateStats(job, updates.status);
    }

    logger.debug('Job updated', {
      jobId,
      status: job.result.status,
      updates: Object.keys(updates),
    });

    return Promise.resolve();
  }

  /**
   * Mark job as completed
   */
  async completeJob(
    jobId: string,
    result: Omit<ScrapeJobResult, 'config' | 'status' | 'startedAt'>
  ): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      logger.warn('Cannot complete non-existent job', { jobId });
      return;
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - job.result.startedAt.getTime();

    await this.updateJob(jobId, {
      ...result,
      status: 'completed',
      completedAt,
      durationMs,
    });

    logger.info('Job completed', {
      jobId,
      url: job.config.url,
      durationMs,
      signalCount: result.signals?.length ?? 0,
    });
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: string, error: Error, attemptNumber: number): Promise<void> {
    const job = this.jobs.get(jobId);

    if (!job) {
      logger.warn('Cannot fail non-existent job', { jobId });
      return;
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - job.result.startedAt.getTime();

    // Extract error code with proper typing
    const errorWithCode = error as Error & { code?: string };
    const errorCode = (errorWithCode.code && errorWithCode.code !== '')
      ? errorWithCode.code
      : 'UNKNOWN_ERROR';

    await this.updateJob(jobId, {
      status: 'failed',
      completedAt,
      durationMs,
      error: {
        message: error.message,
        code: errorCode,
        attemptNumber,
        timestamp: new Date(),
      },
    });

    logger.error('Job failed', error, {
      jobId,
      url: job.config.url,
      attemptNumber,
      durationMs,
    });
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);

    if (!job) {
      return false;
    }

    // Can only cancel pending jobs
    if (job.result.status !== 'pending') {
      logger.warn('Cannot cancel non-pending job', {
        jobId,
        status: job.result.status,
      });
      return false;
    }

    // Remove from pending queue
    const index = this.pendingQueue.indexOf(jobId);
    if (index !== -1) {
      this.pendingQueue.splice(index, 1);
    }

    // Update status
    await this.updateJob(jobId, {
      status: 'cancelled',
      completedAt: new Date(),
    });

    logger.info('Job cancelled', { jobId, url: job.config.url });

    return true;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const byStatus: Record<ScrapeJobStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      cached: 0,
    };

    const byPriority: Record<ScrapeJobPriority, number> = {
      urgent: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    let runningCount = 0;

    for (const job of this.jobs.values()) {
      byStatus[job.result.status]++;
      byPriority[job.config.priority]++;
      
      if (job.result.status === 'running') {
        runningCount++;
      }
    }

    const avgWaitTimeMs = this.stats.totalEnqueued > 0
      ? this.stats.totalWaitTimeMs / this.stats.totalEnqueued
      : 0;

    const avgExecutionTimeMs = this.stats.totalCompleted > 0
      ? this.stats.totalExecutionTimeMs / this.stats.totalCompleted
      : 0;

    const utilization = this.maxWorkers > 0
      ? runningCount / this.maxWorkers
      : 0;

    return {
      total: this.jobs.size,
      byStatus,
      byPriority,
      avgWaitTimeMs,
      avgExecutionTimeMs,
      utilization,
      activeWorkers: runningCount,
      maxWorkers: this.maxWorkers,
    };
  }

  /**
   * Get all pending jobs
   */
  getPendingJobs(): ScrapeJobConfig[] {
    return this.pendingQueue
      .map(jobId => this.jobs.get(jobId))
      .filter((job): job is QueuedJob => job !== undefined)
      .map(job => job.config);
  }

  /**
   * Get all running jobs
   */
  getRunningJobs(): ScrapeJobConfig[] {
    return Array.from(this.jobs.values())
      .filter(job => job.result.status === 'running')
      .map(job => job.config);
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    this.jobs.clear();
    this.pendingQueue = [];
    logger.info('Queue cleared');
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Insert job into priority queue maintaining sort order
   */
  private insertIntoPriorityQueue(jobId: string, priority: number): void {
    // Find insertion point (binary search would be more efficient for large queues)
    let insertIndex = this.pendingQueue.length;
    
    for (let i = 0; i < this.pendingQueue.length; i++) {
      const existingJobId = this.pendingQueue[i];
      const existingJob = this.jobs.get(existingJobId);
      
      if (existingJob && existingJob.priority > priority) {
        insertIndex = i;
        break;
      }
    }

    this.pendingQueue.splice(insertIndex, 0, jobId);
  }

  /**
   * Update statistics based on job status change
   */
  private updateStats(job: QueuedJob, newStatus: ScrapeJobStatus): void {
    const now = new Date();

    switch (newStatus) {
      case 'running': {
        // Calculate wait time
        const waitTime = now.getTime() - job.enqueuedAt.getTime();
        this.stats.totalWaitTimeMs += waitTime;
        break;
      }

      case 'completed':
        this.stats.totalCompleted++;
        if (job.result.durationMs) {
          this.stats.totalExecutionTimeMs += job.result.durationMs;
        }
        break;

      case 'failed':
        this.stats.totalFailed++;
        if (job.result.durationMs) {
          this.stats.totalExecutionTimeMs += job.result.durationMs;
        }
        break;

      case 'cancelled':
        this.stats.totalCancelled++;
        break;
    }
  }

  /**
   * Start periodic cleanup of old completed jobs
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldJobs();
    }, CLEANUP_INTERVAL_MS);

    // Don't keep the process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove old completed/failed/cancelled jobs
   */
  private cleanupOldJobs(): void {
    const completedJobs: Array<{ jobId: string; completedAt: Date }> = [];

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        job.result.status === 'completed' ||
        job.result.status === 'failed' ||
        job.result.status === 'cancelled'
      ) {
        if (job.result.completedAt) {
          completedJobs.push({ jobId, completedAt: job.result.completedAt });
        }
      }
    }

    // Sort by completion time (oldest first)
    completedJobs.sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

    // Remove oldest jobs if over limit
    const toRemove = Math.max(0, completedJobs.length - MAX_COMPLETED_HISTORY);
    let removedCount = 0;

    for (let i = 0; i < toRemove; i++) {
      const jobId = completedJobs[i].jobId;
      this.jobs.delete(jobId);
      removedCount++;
    }

    if (removedCount > 0) {
      logger.debug('Queue cleanup completed', {
        removedJobs: removedCount,
        remainingJobs: this.jobs.size,
      });
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new scrape queue
 */
export function createScrapeQueue(maxWorkers?: number): JobQueue {
  return new InMemoryScrapeQueue(maxWorkers);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Calculate job priority based on various factors
 */
export function calculateJobPriority(config: ScrapeJobConfig): ScrapeJobPriority {
  // If explicitly set, use that
  if (config.priority) {
    return config.priority;
  }

  // Otherwise, calculate based on factors
  let score = 0;

  // Factor 1: Platform urgency
  const platformScores: Partial<Record<string, number>> = {
    'news': 3,           // Time-sensitive
    'social-media': 2,   // Moderately time-sensitive
    'website': 1,        // Standard
    'dns': -1,           // Can be delayed
  };
  score += platformScores[config.platform] ?? 0;

  // Factor 2: Organization priority (could be added later)
  // score += organizationPriorityScore;

  // Map score to priority
  if (score >= 3) {return 'urgent';}
  if (score >= 1) {return 'high';}
  if (score <= -1) {return 'low';}
  return 'normal';
}

/**
 * Validate job configuration
 */
export function validateJobConfig(config: ScrapeJobConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.jobId) {
    errors.push('Job ID is required');
  }

  if (!config.industryId) {
    errors.push('Industry ID is required');
  }

  if (!config.url) {
    errors.push('URL is required');
  }

  if (!config.platform) {
    errors.push('Platform is required');
  }

  // Validate URL format
  if (config.url) {
    try {
      new URL(config.url);
    } catch {
      errors.push('Invalid URL format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
