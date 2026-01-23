/**
 * Scraper Cache
 * 
 * Intelligent caching layer for scrape results with TTL support.
 * Implements LRU eviction when cache size exceeds limits.
 * 
 * Features:
 * - Time-based expiration (default 5 minutes)
 * - LRU eviction policy
 * - Pattern-based invalidation
 * - Hit/miss statistics
 * - Memory usage estimation
 */

import { logger } from '@/lib/logger/logger';
import {
  getCacheKey,
  type ScrapeCache,
  type ScrapeCacheEntry,
  type CacheStats,
  type ScrapeJobResult,
} from './scraper-runner-types';
import type { ScrapingPlatform } from '@/types/scraper-intelligence';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000; // Maximum number of cache entries
const CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every minute

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * In-memory cache with TTL and LRU eviction
 */
export class InMemoryScrapeCache implements ScrapeCache {
  private cache = new Map<string, ScrapeCacheEntry>();
  private accessOrder: string[] = []; // For LRU eviction
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly maxSize: number = MAX_CACHE_SIZE,
    private readonly defaultTtlMs: number = DEFAULT_TTL_MS
  ) {
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get cached result by URL
   */
  get(url: string): Promise<ScrapeCacheEntry | null> {
    const entry = this.cache.get(url);

    if (!entry) {
      this.stats.misses++;
      logger.debug('Cache miss', { url });
      return Promise.resolve(null);
    }

    // Check if expired
    const now = new Date();
    if (now > entry.expiresAt) {
      this.cache.delete(url);
      this.removeFromAccessOrder(url);
      this.stats.misses++;
      logger.debug('Cache expired', { url, expiresAt: entry.expiresAt.toISOString() });
      return Promise.resolve(null);
    }

    // Update access tracking
    entry.hits++;
    entry.lastAccessedAt = now;
    this.updateAccessOrder(url);

    this.stats.hits++;
    logger.debug('Cache hit', {
      url,
      hits: entry.hits,
      ageMs: now.getTime() - entry.cachedAt.getTime()
    });

    return Promise.resolve(entry);
  }

  /**
   * Set cache entry
   */
  set(
    url: string,
    result: ScrapeJobResult,
    ttlMs: number = this.defaultTtlMs
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Generate content hash for validation
    const contentHash = this.generateContentHash(result);

    const entry: ScrapeCacheEntry = {
      result: {
        ...result,
        cached: true,
        cacheAgeMs: 0,
      },
      cachedAt: now,
      expiresAt,
      hits: 0,
      lastAccessedAt: now,
      contentHash,
    };

    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(url)) {
      this.evictLRU();
    }

    this.cache.set(url, entry);
    this.updateAccessOrder(url);

    logger.debug('Cache set', {
      url,
      ttlMs,
      expiresAt: expiresAt.toISOString(),
      cacheSize: this.cache.size
    });

    return Promise.resolve();
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(url: string): Promise<void> {
    const existed = this.cache.delete(url);
    if (existed) {
      this.removeFromAccessOrder(url);
      logger.debug('Cache invalidated', { url });
    }
    return Promise.resolve();
  }

  /**
   * Invalidate entries matching pattern
   */
  async invalidatePattern(pattern: RegExp): Promise<number> {
    let count = 0;

    for (const url of this.cache.keys()) {
      if (pattern.test(url)) {
        await this.invalidate(url);
        count++;
      }
    }

    logger.info('Cache pattern invalidation', {
      pattern: pattern.toString(),
      invalidatedCount: count
    });

    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Calculate average age
    let totalAgeMs = 0;
    const now = new Date();
    
    for (const entry of this.cache.values()) {
      totalAgeMs += now.getTime() - entry.cachedAt.getTime();
    }
    
    const avgAgeMs = this.cache.size > 0 ? totalAgeMs / this.cache.size : 0;

    // Estimate memory usage (rough approximation)
    const estimatedSizeBytes = this.estimateMemoryUsage();

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      avgAgeMs,
      estimatedSizeBytes,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    logger.info('Cache cleared');
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
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, CLEANUP_INTERVAL_MS);

    // Don't keep the process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove expired entries
   */
  private cleanupExpired(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [url, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(url);
        this.removeFromAccessOrder(url);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cache cleanup completed', { cleanedCount });
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    // Remove oldest accessed entry
    const urlToEvict = this.accessOrder[0];
    this.cache.delete(urlToEvict);
    this.removeFromAccessOrder(urlToEvict);
    this.stats.evictions++;

    logger.debug('LRU eviction', { url: urlToEvict });
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(url: string): void {
    // Remove from current position
    this.removeFromAccessOrder(url);
    
    // Add to end (most recently used)
    this.accessOrder.push(url);
  }

  /**
   * Remove URL from access order
   */
  private removeFromAccessOrder(url: string): void {
    const index = this.accessOrder.indexOf(url);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Generate content hash for result validation
   */
  private generateContentHash(result: ScrapeJobResult): string {
    // Simple hash based on signals and metadata
    const data = JSON.stringify({
      signals: result.signals,
      leadScore: result.leadScore,
      url: result.config.url,
    });
    
    // Create simple hash (not cryptographic, just for change detection)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let totalBytes = 0;

    for (const entry of this.cache.values()) {
      // Rough estimation:
      // - Each entry overhead: ~200 bytes
      // - Each signal: ~100 bytes
      // - Metadata: ~500 bytes
      totalBytes += 200; // Entry overhead
      totalBytes += 500; // Metadata
      
      if (entry.result.signals) {
        totalBytes += entry.result.signals.length * 100;
      }
    }

    return totalBytes;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new scrape cache instance
 */
export function createScrapeCache(
  maxSize?: number,
  defaultTtlMs?: number
): ScrapeCache {
  return new InMemoryScrapeCache(maxSize, defaultTtlMs);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get cache key for a scrape request
 */
export function getScrapeCacheKey(
  url: string, 
  platform: ScrapingPlatform,
  organizationId?: string
): string {
  const base = getCacheKey(url, platform);
  return organizationId ? `${organizationId}:${base}` : base;
}

/**
 * Calculate cache TTL based on content freshness requirements
 */
export function calculateCacheTTL(platform: ScrapingPlatform): number {
  // Different platforms have different freshness requirements
  const ttlMap: Record<ScrapingPlatform, number> = {
    'website': 5 * 60 * 1000,           // 5 minutes
    'linkedin-jobs': 30 * 60 * 1000,    // 30 minutes
    'linkedin-company': 60 * 60 * 1000, // 1 hour
    'news': 15 * 60 * 1000,             // 15 minutes
    'crunchbase': 24 * 60 * 60 * 1000,  // 24 hours
    'dns': 7 * 24 * 60 * 60 * 1000,     // 7 days
    'google-business': 60 * 60 * 1000,  // 1 hour
    'social-media': 15 * 60 * 1000,     // 15 minutes
  };

  return ttlMap[platform] || DEFAULT_TTL_MS;
}

/**
 * Validate cache entry integrity
 */
export function validateCacheEntry(entry: ScrapeCacheEntry): boolean {
  // Check required fields
  if (!entry.result || !entry.cachedAt || !entry.expiresAt) {
    return false;
  }

  // Check dates are valid
  if (!(entry.cachedAt instanceof Date) || !(entry.expiresAt instanceof Date)) {
    return false;
  }

  // Check not expired
  if (new Date() > entry.expiresAt) {
    return false;
  }

  return true;
}
