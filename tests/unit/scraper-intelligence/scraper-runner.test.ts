/**
 * Scraper Runner Unit Tests
 * 
 * Comprehensive tests for all Scraper Runner components.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createScrapeCache,
  createDomainRateLimiter,
  createScrapeQueue,
  createProgressTracker,
  createErrorHandler,
  createScraperRunner,
  InMemoryScrapeCache,
  DomainBasedRateLimiter,
  InMemoryScrapeQueue,
  InMemoryProgressTracker,
  ScraperErrorHandler,
  ProductionScraperRunner,
  ScrapeError,
  generateJobId,
  extractDomain,
  calculateRetryDelay,
  DEFAULT_RETRY_STRATEGY,
} from '@/lib/scraper-intelligence';
import type {
  ScrapeJobConfig,
  ScrapeJobResult,
  ProgressEvent,
} from '@/lib/scraper-intelligence';

// ============================================================================
// CACHE TESTS
// ============================================================================

describe('ScraperCache', () => {
  let cache: InMemoryScrapeCache;

  beforeEach(() => {
    cache = createScrapeCache() as InMemoryScrapeCache;
  });

  afterEach(() => {
    cache.shutdown();
  });

  it('should set and get cache entries', async () => {
    const url = 'https://example.com';
    const result: ScrapeJobResult = {
      config: {
        jobId: 'test-1',
        industryId: 'saas-software',
        url,
        platform: 'website',
        priority: 'normal',
      },
      status: 'completed',
      startedAt: new Date(),
      signals: [{ signalId: 'hiring', signalLabel: 'Hiring', value: true, confidence: 0.9 }],
      leadScore: 75,
    };

    await cache.set(url, result);
    const cached = await cache.get(url);

    expect(cached).toBeDefined();
    expect(cached?.result.signals).toHaveLength(1);
    expect(cached?.result.leadScore).toBe(75);
  });

  it('should return null for cache miss', async () => {
    const cached = await cache.get('https://nonexistent.com');
    expect(cached).toBeNull();
  });

  it('should expire entries after TTL', async () => {
    const url = 'https://example.com';
    const result: ScrapeJobResult = {
      config: {
        jobId: 'test-1',
        industryId: 'saas-software',
        url,
        platform: 'website',
        priority: 'normal',
      },
      status: 'completed',
      startedAt: new Date(),
    };

    // Set with 100ms TTL
    await cache.set(url, result, 100);
    
    // Should exist immediately
    let cached = await cache.get(url);
    expect(cached).toBeDefined();

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be expired
    cached = await cache.get(url);
    expect(cached).toBeNull();
  });

  it('should invalidate specific entries', async () => {
    const url = 'https://example.com';
    const result: ScrapeJobResult = {
      config: {
        jobId: 'test-1',
        industryId: 'saas-software',
        url,
        platform: 'website',
        priority: 'normal',
      },
      status: 'completed',
      startedAt: new Date(),
    };

    await cache.set(url, result);
    await cache.invalidate(url);
    
    const cached = await cache.get(url);
    expect(cached).toBeNull();
  });

  it('should invalidate by pattern', async () => {
    const urls = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://other.com/page',
    ];

    for (const url of urls) {
      await cache.set(url, {
        config: {
          jobId: `test-${url}`,
          industryId: 'saas-software',
          url,
          platform: 'website',
          priority: 'normal',
        },
        status: 'completed',
        startedAt: new Date(),
      });
    }

    // Invalidate example.com URLs
    const count = await cache.invalidatePattern(/example\.com/);
    expect(count).toBe(2);

    // Verify
    expect(await cache.get(urls[0])).toBeNull();
    expect(await cache.get(urls[1])).toBeNull();
    expect(await cache.get(urls[2])).toBeDefined();
  });

  it('should track cache statistics', async () => {
    const url = 'https://example.com';
    const result: ScrapeJobResult = {
      config: {
        jobId: 'test-1',
        industryId: 'saas-software',
        url,
        platform: 'website',
        priority: 'normal',
      },
      status: 'completed',
      startedAt: new Date(),
    };

    // Miss
    await cache.get(url);

    // Set
    await cache.set(url, result);

    // Hit
    await cache.get(url);
    await cache.get(url);

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
    expect(stats.size).toBe(1);
  });
});

// ============================================================================
// RATE LIMITER TESTS
// ============================================================================

describe('DomainRateLimiter', () => {
  let rateLimiter: DomainBasedRateLimiter;

  beforeEach(() => {
    rateLimiter = createDomainRateLimiter({
      maxRequests: 3,
      windowMs: 1000,
      minDelayMs: 100,
    }) as DomainBasedRateLimiter;
  });

  afterEach(() => {
    rateLimiter.shutdown();
  });

  it('should allow requests within limit', async () => {
    const domain = 'example.com';

    const status1 = await rateLimiter.checkLimit(domain);
    expect(status1.allowed).toBe(true);
    expect(status1.remaining).toBe(2);

    const status2 = await rateLimiter.checkLimit(domain);
    expect(status2.allowed).toBe(true);
    expect(status2.remaining).toBe(1);
  });

  it('should block requests exceeding limit', async () => {
    const domain = 'example.com';

    // Use up the limit
    for (let i = 0; i < 3; i++) {
      await rateLimiter.waitForSlot(domain);
    }

    // Next request should be blocked
    const status = await rateLimiter.checkLimit(domain);
    expect(status.allowed).toBe(false);
    expect(status.remaining).toBe(0);
  });

  it('should reset limits after window expires', async () => {
    const domain = 'example.com';

    // Use up the limit
    for (let i = 0; i < 3; i++) {
      await rateLimiter.waitForSlot(domain);
    }

    // Should be blocked
    let status = await rateLimiter.checkLimit(domain);
    expect(status.allowed).toBe(false);

    // Wait for window to reset
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Should be allowed again
    status = await rateLimiter.checkLimit(domain);
    expect(status.allowed).toBe(true);
  });

  it('should normalize domain names', async () => {
    const variations = [
      'https://www.example.com/page',
      'http://example.com',
      'Example.Com',
      'www.example.com',
    ];

    // All variations should count toward same limit
    for (const url of variations) {
      await rateLimiter.waitForSlot(url);
    }

    const status = await rateLimiter.checkLimit('example.com');
    expect(status.currentCount).toBeGreaterThanOrEqual(3);
  });

  it('should enforce minimum delay between requests', async () => {
    const domain = 'example.com';
    const startTime = Date.now();

    await rateLimiter.waitForSlot(domain);
    await rateLimiter.waitForSlot(domain);

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(100); // minDelayMs
  });
});

// ============================================================================
// QUEUE TESTS
// ============================================================================

describe('ScraperQueue', () => {
  let queue: InMemoryScrapeQueue;

  beforeEach(() => {
    queue = createScrapeQueue(5) as InMemoryScrapeQueue;
  });

  afterEach(() => {
    queue.shutdown();
  });

  it('should enqueue and dequeue jobs', async () => {
    const config: ScrapeJobConfig = {
      jobId: 'test-1',
      industryId: 'saas-software',
      url: 'https://example.com',
      platform: 'website',
      priority: 'normal',
    };

    await queue.enqueue(config);
    const dequeued = await queue.dequeue();

    expect(dequeued).toBeDefined();
    expect(dequeued?.jobId).toBe('test-1');
  });

  it('should return null when queue is empty', async () => {
    const dequeued = await queue.dequeue();
    expect(dequeued).toBeNull();
  });

  it('should respect priority ordering', async () => {
    const configs: ScrapeJobConfig[] = [
      {
        jobId: 'low-1',
        industryId: 'saas-software',
        url: 'https://example.com/1',
        platform: 'website',
        priority: 'low',
      },
      {
        jobId: 'urgent-1',
        industryId: 'saas-software',
        url: 'https://example.com/2',
        platform: 'website',
        priority: 'urgent',
      },
      {
        jobId: 'normal-1',
        industryId: 'saas-software',
        url: 'https://example.com/3',
        platform: 'website',
        priority: 'normal',
      },
    ];

    for (const config of configs) {
      await queue.enqueue(config);
    }

    // Should dequeue in priority order
    const first = await queue.dequeue();
    expect(first?.priority).toBe('urgent');

    const second = await queue.dequeue();
    expect(second?.priority).toBe('normal');

    const third = await queue.dequeue();
    expect(third?.priority).toBe('low');
  });

  it('should track job status', async () => {
    const config: ScrapeJobConfig = {
      jobId: 'test-1',
      industryId: 'saas-software',
      url: 'https://example.com',
      platform: 'website',
      priority: 'normal',
    };

    await queue.enqueue(config);
    
    let result = await queue.getJob('test-1');
    expect(result?.status).toBe('pending');

    await queue.dequeue();
    
    result = await queue.getJob('test-1');
    expect(result?.status).toBe('running');
  });

  it('should cancel pending jobs', async () => {
    const config: ScrapeJobConfig = {
      jobId: 'test-1',
      industryId: 'saas-software',
      url: 'https://example.com',
      platform: 'website',
      priority: 'normal',
    };

    await queue.enqueue(config);
    const cancelled = await queue.cancelJob('test-1');

    expect(cancelled).toBe(true);

    const result = await queue.getJob('test-1');
    expect(result?.status).toBe('cancelled');
  });

  it('should provide queue statistics', async () => {
    const configs: ScrapeJobConfig[] = Array.from({ length: 5 }, (_, i) => ({
      jobId: `test-${i}`,
      industryId: 'saas-software',
      url: `https://example.com/${i}`,
      platform: 'website' as const,
      priority: i % 2 === 0 ? 'high' as const : 'normal' as const,
    }));

    for (const config of configs) {
      await queue.enqueue(config);
    }

    const stats = queue.getStats();
    expect(stats.total).toBe(5);
    expect(stats.byStatus.pending).toBe(5);
    expect(stats.byPriority.high).toBe(3);
    expect(stats.byPriority.normal).toBe(2);
  });
});

// ============================================================================
// PROGRESS TRACKER TESTS
// ============================================================================

describe('ProgressTracker', () => {
  let tracker: InMemoryProgressTracker;

  beforeEach(() => {
    tracker = createProgressTracker() as InMemoryProgressTracker;
  });

  afterEach(() => {
    tracker.shutdown();
  });

  it('should emit and retrieve progress events', () => {
    const event: ProgressEvent = {
      jobId: 'test-1',
      type: 'job_started',
      timestamp: new Date(),
      message: 'Job started',
      progress: 0,
    };

    tracker.emit(event);
    const history = tracker.getProgress('test-1');

    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('job_started');
  });

  it('should notify job-specific subscribers', (done) => {
    const jobId = 'test-1';
    let notified = false;

    const unsubscribe = tracker.subscribe(jobId, (event) => {
      expect(event.jobId).toBe(jobId);
      expect(event.type).toBe('job_started');
      notified = true;
      unsubscribe();
      done();
    });

    tracker.emit({
      jobId,
      type: 'job_started',
      timestamp: new Date(),
      message: 'Job started',
    });

    // Fail test if not notified within 100ms
    setTimeout(() => {
      if (!notified) {
        done(new Error('Subscriber not notified'));
      }
    }, 100);
  });

  it('should notify global subscribers', (done) => {
    let notified = false;

    const unsubscribe = tracker.subscribeAll((event) => {
      expect(event.jobId).toBe('test-1');
      notified = true;
      unsubscribe();
      done();
    });

    tracker.emit({
      jobId: 'test-1',
      type: 'job_started',
      timestamp: new Date(),
      message: 'Job started',
    });

    setTimeout(() => {
      if (!notified) {
        done(new Error('Global subscriber not notified'));
      }
    }, 100);
  });

  it('should clear progress history', () => {
    tracker.emit({
      jobId: 'test-1',
      type: 'job_started',
      timestamp: new Date(),
      message: 'Job started',
    });

    expect(tracker.getProgress('test-1')).toHaveLength(1);

    tracker.clear('test-1');
    expect(tracker.getProgress('test-1')).toHaveLength(0);
  });
});

// ============================================================================
// ERROR HANDLER TESTS
// ============================================================================

describe('ErrorHandler', () => {
  let errorHandler: ScraperErrorHandler;

  beforeEach(() => {
    errorHandler = createErrorHandler(DEFAULT_RETRY_STRATEGY) as ScraperErrorHandler;
  });

  it('should identify retryable errors', () => {
    const networkError = new Error('Network connection failed');
    expect(errorHandler.shouldRetry(networkError, 1)).toBe(true);

    const timeoutError = new Error('Request timeout');
    expect(errorHandler.shouldRetry(timeoutError, 1)).toBe(true);

    const validationError = new Error('Invalid input');
    expect(errorHandler.shouldRetry(validationError, 1)).toBe(false);
  });

  it('should respect max retry attempts', () => {
    const error = new Error('Network error');
    
    expect(errorHandler.shouldRetry(error, 1)).toBe(true);
    expect(errorHandler.shouldRetry(error, 2)).toBe(true);
    expect(errorHandler.shouldRetry(error, 3)).toBe(true);
    expect(errorHandler.shouldRetry(error, 4)).toBe(false); // Exceeds max (3)
  });

  it('should calculate retry delay with exponential backoff', () => {
    const delay1 = errorHandler.getRetryDelay(1);
    const delay2 = errorHandler.getRetryDelay(2);
    const delay3 = errorHandler.getRetryDelay(3);

    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
    expect(delay3).toBeLessThanOrEqual(DEFAULT_RETRY_STRATEGY.maxDelayMs);
  });

  it('should format errors for user presentation', () => {
    const error = new Error('ECONNRESET: Connection reset by peer');
    const formatted = errorHandler.formatError(error);

    expect(formatted.message).toContain('Unable to connect');
    expect(formatted.code).toBe('network_error');
    expect(formatted.retryable).toBe(true);
  });

  it('should handle ScrapeError instances', () => {
    const scrapeError = new ScrapeError(
      'Rate limit exceeded',
      'rate_limit_error',
      429,
      true
    );

    expect(errorHandler.shouldRetry(scrapeError, 1)).toBe(true);

    const formatted = errorHandler.formatError(scrapeError);
    expect(formatted.code).toBe('rate_limit_error');
    expect(formatted.retryable).toBe(true);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Utility Functions', () => {
  it('should generate unique job IDs', () => {
    const id1 = generateJobId();
    const id2 = generateJobId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^scrape_\d+_[a-z0-9]+$/);
  });

  it('should extract domain from URL', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
    expect(extractDomain('http://example.com:8080/path')).toBe('example.com');
    expect(extractDomain('invalid-url')).toBe('unknown');
  });

  it('should calculate retry delay', () => {
    const strategy = DEFAULT_RETRY_STRATEGY;
    
    const delay1 = calculateRetryDelay(1, strategy);
    const delay2 = calculateRetryDelay(2, strategy);
    const delay3 = calculateRetryDelay(3, strategy);

    // Exponential backoff
    expect(delay1).toBeGreaterThanOrEqual(strategy.baseDelayMs * 0.9); // Account for jitter
    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
    expect(delay3).toBeLessThanOrEqual(strategy.maxDelayMs);
  });
});
