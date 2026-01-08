/**
 * Domain Rate Limiter
 * 
 * Implements domain-based rate limiting for web scraping to prevent
 * overwhelming target servers and getting blocked.
 * 
 * Features:
 * - Per-domain rate limiting
 * - Sliding window algorithm
 * - Minimum delay between requests
 * - Automatic cleanup of old entries
 * - Waiting queue for rate-limited requests
 */

import { logger } from '@/lib/logger/logger';
import type {
  DomainRateLimiter,
  RateLimitConfig,
  RateLimitStatus,
} from './scraper-runner-types';
import { extractDomain } from './scraper-runner-types';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60000,    // 1 minute
  minDelayMs: 1000,   // 1 second
};

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes

// ============================================================================
// TYPES
// ============================================================================

/**
 * Request timestamp tracking
 */
interface RequestWindow {
  timestamps: number[];
  windowStart: number;
  lastRequestAt: number;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Domain-based rate limiter with sliding window
 */
export class DomainBasedRateLimiter implements DomainRateLimiter {
  private limits = new Map<string, RequestWindow>();
  private cleanupTimer?: NodeJS.Timeout;
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Check if request is allowed for a domain
   */
  async checkLimit(domain: string): Promise<RateLimitStatus> {
    const normalizedDomain = this.normalizeDomain(domain);
    const now = Date.now();
    const window = this.getOrCreateWindow(normalizedDomain);

    // Remove timestamps outside the current window
    this.cleanupWindow(window, now);

    // Check if we've exceeded the limit
    const currentCount = window.timestamps.length;
    const allowed = currentCount < this.config.maxRequests;

    // Calculate time until window reset
    const oldestTimestamp = window.timestamps[0] || now;
    const resetInMs = Math.max(0, (oldestTimestamp + this.config.windowMs) - now);

    // Calculate remaining requests
    const remaining = Math.max(0, this.config.maxRequests - currentCount);

    const status: RateLimitStatus = {
      domain: normalizedDomain,
      allowed,
      remaining,
      resetInMs,
      currentCount,
      maxRequests: this.config.maxRequests,
    };

    // If not allowed, log warning
    if (!allowed) {
      logger.warn('Rate limit exceeded', {
        domain: normalizedDomain,
        currentCount,
        maxRequests: this.config.maxRequests,
        resetInMs,
      });
    }

    return status;
  }

  /**
   * Wait until a request slot is available
   * 
   * This method will wait (sleep) until the request can proceed,
   * respecting both rate limits and minimum delays.
   */
  async waitForSlot(domain: string): Promise<void> {
    const normalizedDomain = this.normalizeDomain(domain);
    const now = Date.now();
    const window = this.getOrCreateWindow(normalizedDomain);

    // Check minimum delay since last request
    const timeSinceLastRequest = now - window.lastRequestAt;
    const minDelayMs = this.config.minDelayMs ?? 0;
    
    if (timeSinceLastRequest < minDelayMs) {
      const delayNeeded = minDelayMs - timeSinceLastRequest;
      logger.debug('Waiting for minimum delay', {
        domain: normalizedDomain,
        delayMs: delayNeeded,
      });
      await this.sleep(delayNeeded);
    }

    // Check rate limit and wait if necessary
    let attempts = 0;
    const maxAttempts = 60; // Prevent infinite loops (max 1 minute of retries)

    while (attempts < maxAttempts) {
      const status = await this.checkLimit(normalizedDomain);

      if (status.allowed) {
        // Record this request
        this.recordRequest(normalizedDomain);
        return;
      }

      // Wait until the oldest request expires
      const waitMs = Math.min(status.resetInMs + 100, 5000); // Max 5 seconds per iteration
      logger.debug('Rate limit waiting', {
        domain: normalizedDomain,
        waitMs,
        remaining: status.remaining,
      });
      
      await this.sleep(waitMs);
      attempts++;
    }

    // If we get here, something is wrong - throw error
    throw new Error(`Rate limit timeout for domain: ${normalizedDomain}`);
  }

  /**
   * Reset limits for a domain
   */
  reset(domain: string): void {
    const normalizedDomain = this.normalizeDomain(domain);
    this.limits.delete(normalizedDomain);
    logger.debug('Rate limit reset', { domain: normalizedDomain });
  }

  /**
   * Get current status for a domain without checking limits
   */
  getStatus(domain: string): RateLimitStatus {
    const normalizedDomain = this.normalizeDomain(domain);
    const now = Date.now();
    const window = this.getOrCreateWindow(normalizedDomain);

    // Cleanup window
    this.cleanupWindow(window, now);

    const currentCount = window.timestamps.length;
    const allowed = currentCount < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - currentCount);
    const oldestTimestamp = window.timestamps[0] || now;
    const resetInMs = Math.max(0, (oldestTimestamp + this.config.windowMs) - now);

    return {
      domain: normalizedDomain,
      allowed,
      remaining,
      resetInMs,
      currentCount,
      maxRequests: this.config.maxRequests,
    };
  }

  /**
   * Get all tracked domains and their status
   */
  getAllStatus(): Map<string, RateLimitStatus> {
    const statuses = new Map<string, RateLimitStatus>();
    
    for (const domain of this.limits.keys()) {
      statuses.set(domain, this.getStatus(domain));
    }
    
    return statuses;
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.limits.clear();
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Normalize domain name (lowercase, remove www)
   */
  private normalizeDomain(domain: string): string {
    let normalized = domain.toLowerCase().trim();
    
    // Handle full URLs
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      normalized = extractDomain(normalized);
    }
    
    // Remove www prefix
    if (normalized.startsWith('www.')) {
      normalized = normalized.substring(4);
    }
    
    return normalized;
  }

  /**
   * Get or create request window for domain
   */
  private getOrCreateWindow(domain: string): RequestWindow {
    let window = this.limits.get(domain);
    
    if (!window) {
      window = {
        timestamps: [],
        windowStart: Date.now(),
        lastRequestAt: 0,
      };
      this.limits.set(domain, window);
    }
    
    return window;
  }

  /**
   * Remove timestamps outside the current window
   */
  private cleanupWindow(window: RequestWindow, now: number): void {
    const cutoff = now - this.config.windowMs;
    window.timestamps = window.timestamps.filter(ts => ts > cutoff);
    
    // Update window start if needed
    if (window.timestamps.length > 0) {
      window.windowStart = window.timestamps[0];
    } else {
      window.windowStart = now;
    }
  }

  /**
   * Record a request for a domain
   */
  private recordRequest(domain: string): void {
    const now = Date.now();
    const window = this.getOrCreateWindow(domain);
    
    window.timestamps.push(now);
    window.lastRequestAt = now;
    
    logger.debug('Request recorded', {
      domain,
      count: window.timestamps.length,
      maxRequests: this.config.maxRequests,
    });
  }

  /**
   * Start periodic cleanup of old entries
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldEntries();
    }, CLEANUP_INTERVAL_MS);

    // Don't keep the process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove entries for domains with no recent requests
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    const inactivityThreshold = 10 * 60 * 1000; // 10 minutes
    let cleanedCount = 0;

    for (const [domain, window] of this.limits.entries()) {
      // Clean up window first
      this.cleanupWindow(window, now);
      
      // Remove if no timestamps and no recent activity
      if (window.timestamps.length === 0 && 
          (now - window.lastRequestAt > inactivityThreshold)) {
        this.limits.delete(domain);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Rate limiter cleanup completed', { 
        cleanedDomains: cleanedCount,
        remainingDomains: this.limits.size,
      });
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new domain rate limiter
 */
export function createDomainRateLimiter(
  config?: Partial<RateLimitConfig>
): DomainRateLimiter {
  return new DomainBasedRateLimiter(config);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Calculate recommended rate limit for a domain
 * 
 * Conservative defaults to avoid getting blocked:
 * - Well-known APIs: Higher limits
 * - Public websites: Lower limits
 * - Unknown domains: Very conservative
 */
export function getRecommendedRateLimit(domain: string): RateLimitConfig {
  const normalizedDomain = domain.toLowerCase();

  // Well-known APIs (higher limits)
  const apiDomains = [
    'linkedin.com',
    'crunchbase.com',
    'clearbit.com',
    'hunter.io',
  ];

  if (apiDomains.some(api => normalizedDomain.includes(api))) {
    return {
      maxRequests: 20,
      windowMs: 60000,  // 1 minute
      minDelayMs: 500,   // 500ms between requests
    };
  }

  // Public websites (conservative)
  return {
    maxRequests: 10,
    windowMs: 60000,  // 1 minute
    minDelayMs: 1000,  // 1 second between requests
  };
}

/**
 * Calculate crawl delay from robots.txt
 * 
 * This is a simple parser - in production, you'd want a full robots.txt parser
 */
export function parseRobotsCrawlDelay(robotsTxt: string): number | null {
  const lines = robotsTxt.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith('crawl-delay:')) {
      const delay = parseFloat(trimmed.substring('crawl-delay:'.length).trim());
      if (!isNaN(delay)) {
        return delay * 1000; // Convert to milliseconds
      }
    }
  }
  
  return null;
}
