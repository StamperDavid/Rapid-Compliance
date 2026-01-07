/**
 * Progress Tracker
 * 
 * Real-time progress tracking system for scrape jobs.
 * Supports event subscriptions and progress history.
 * 
 * Features:
 * - Event emission and subscription
 * - Job-specific and global event streams
 * - Progress history with automatic cleanup
 * - Type-safe event handling
 */

import { logger } from '@/lib/logger/logger';
import type {
  ProgressTracker,
  ProgressEvent,
  ProgressEventType,
} from './scraper-runner-types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_HISTORY_PER_JOB = 100; // Keep last 100 events per job
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes
const MAX_SUBSCRIBER_HISTORY_DAYS = 1; // Keep events for 1 day max

// ============================================================================
// TYPES
// ============================================================================

/**
 * Event subscriber callback
 */
type SubscriberCallback = (event: ProgressEvent) => void;

/**
 * Subscription handle
 */
interface Subscription {
  id: string;
  jobId?: string; // undefined means subscribed to all events
  callback: SubscriberCallback;
  createdAt: Date;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * In-memory progress tracker with event subscriptions
 */
export class InMemoryProgressTracker implements ProgressTracker {
  private eventHistory = new Map<string, ProgressEvent[]>();
  private subscribers = new Map<string, Subscription>();
  private nextSubscriberId = 1;
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.startCleanup();
  }

  /**
   * Emit a progress event
   */
  emit(event: ProgressEvent): void {
    // Validate event
    if (!event.jobId || !event.type) {
      logger.error('Invalid progress event', { event });
      return;
    }

    // Add to history
    this.addToHistory(event);

    // Notify subscribers
    this.notifySubscribers(event);

    logger.debug('Progress event emitted', {
      jobId: event.jobId,
      type: event.type,
      progress: event.progress,
      message: event.message,
    });
  }

  /**
   * Subscribe to progress events for a specific job
   */
  subscribe(jobId: string, callback: SubscriberCallback): () => void {
    const subscription: Subscription = {
      id: this.generateSubscriptionId(),
      jobId,
      callback,
      createdAt: new Date(),
    };

    this.subscribers.set(subscription.id, subscription);

    logger.debug('Subscriber added', {
      subscriptionId: subscription.id,
      jobId,
      totalSubscribers: this.subscribers.size,
    });

    // Return unsubscribe function
    return () => {
      this.unsubscribe(subscription.id);
    };
  }

  /**
   * Subscribe to all progress events
   */
  subscribeAll(callback: SubscriberCallback): () => void {
    const subscription: Subscription = {
      id: this.generateSubscriptionId(),
      callback,
      createdAt: new Date(),
    };

    this.subscribers.set(subscription.id, subscription);

    logger.debug('Global subscriber added', {
      subscriptionId: subscription.id,
      totalSubscribers: this.subscribers.size,
    });

    // Return unsubscribe function
    return () => {
      this.unsubscribe(subscription.id);
    };
  }

  /**
   * Get progress history for a job
   */
  getProgress(jobId: string): ProgressEvent[] {
    return this.eventHistory.get(jobId) ?? [];
  }

  /**
   * Get latest progress event for a job
   */
  getLatestProgress(jobId: string): ProgressEvent | null {
    const history = this.eventHistory.get(jobId);
    return history && history.length > 0 
      ? history[history.length - 1] 
      : null;
  }

  /**
   * Clear progress history for a job
   */
  clear(jobId: string): void {
    this.eventHistory.delete(jobId);
    logger.debug('Progress history cleared', { jobId });
  }

  /**
   * Clear all progress history
   */
  clearAll(): void {
    this.eventHistory.clear();
    logger.info('All progress history cleared');
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): number {
    return this.subscribers.size;
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.subscribers.clear();
    this.eventHistory.clear();
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${this.nextSubscriberId++}_${Date.now()}`;
  }

  /**
   * Unsubscribe a subscriber
   */
  private unsubscribe(subscriptionId: string): void {
    const existed = this.subscribers.delete(subscriptionId);
    if (existed) {
      logger.debug('Subscriber removed', {
        subscriptionId,
        remainingSubscribers: this.subscribers.size,
      });
    }
  }

  /**
   * Add event to history
   */
  private addToHistory(event: ProgressEvent): void {
    let history = this.eventHistory.get(event.jobId);
    
    if (!history) {
      history = [];
      this.eventHistory.set(event.jobId, history);
    }

    history.push(event);

    // Trim history if too long
    if (history.length > MAX_HISTORY_PER_JOB) {
      history.shift(); // Remove oldest event
    }
  }

  /**
   * Notify all relevant subscribers
   */
  private notifySubscribers(event: ProgressEvent): void {
    let notifiedCount = 0;

    for (const subscription of this.subscribers.values()) {
      // Check if subscriber is interested in this event
      const isGlobalSubscriber = subscription.jobId === undefined;
      const isJobSubscriber = subscription.jobId === event.jobId;

      if (isGlobalSubscriber || isJobSubscriber) {
        try {
          subscription.callback(event);
          notifiedCount++;
        } catch (error) {
          logger.error('Subscriber callback error', error, {
            subscriptionId: subscription.id,
            eventType: event.type,
            jobId: event.jobId,
          });
        }
      }
    }

    if (notifiedCount > 0) {
      logger.debug('Subscribers notified', {
        count: notifiedCount,
        jobId: event.jobId,
        type: event.type,
      });
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldHistory();
    }, CLEANUP_INTERVAL_MS);

    // Don't keep the process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove old event history
   */
  private cleanupOldHistory(): void {
    const now = new Date();
    const maxAge = MAX_SUBSCRIBER_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    let cleanedJobs = 0;

    for (const [jobId, events] of this.eventHistory.entries()) {
      if (events.length === 0) {
        this.eventHistory.delete(jobId);
        cleanedJobs++;
        continue;
      }

      // Check if the latest event is too old
      const latestEvent = events[events.length - 1];
      const age = now.getTime() - latestEvent.timestamp.getTime();

      if (age > maxAge) {
        this.eventHistory.delete(jobId);
        cleanedJobs++;
      }
    }

    if (cleanedJobs > 0) {
      logger.debug('Progress history cleanup completed', {
        cleanedJobs,
        remainingJobs: this.eventHistory.size,
      });
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new progress tracker
 */
export function createProgressTracker(): ProgressTracker {
  return new InMemoryProgressTracker();
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Create a progress event
 */
export function createProgressEvent(
  jobId: string,
  type: ProgressEventType,
  message: string,
  progress?: number,
  data?: Record<string, any>
): ProgressEvent {
  return {
    jobId,
    type,
    message,
    timestamp: new Date(),
    progress,
    data,
  };
}

/**
 * Calculate progress percentage from current/total
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) {return 0;}
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}

/**
 * Format progress message
 */
export function formatProgressMessage(
  type: ProgressEventType,
  url: string,
  details?: string
): string {
  const messages: Record<ProgressEventType, string> = {
    job_queued: `Queued scrape for ${url}`,
    job_started: `Started scraping ${url}`,
    job_progress: `Scraping ${url}${details ? `: ${  details}` : ''}`,
    job_completed: `Completed scraping ${url}`,
    job_failed: `Failed to scrape ${url}${details ? `: ${  details}` : ''}`,
    job_cancelled: `Cancelled scraping ${url}`,
    job_cached: `Retrieved ${url} from cache`,
  };

  return messages[type] || `${type}: ${url}`;
}
