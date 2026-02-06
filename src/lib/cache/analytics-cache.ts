/**
 * Analytics Caching Layer
 * BEST PRACTICE: Production-ready caching for expensive analytics queries
 *
 * Features:
 * - In-memory cache with TTL
 * - Cache invalidation on data changes
 * - Namespace isolation per organization
 * - Configurable TTL per query type
 */

import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

class AnalyticsCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  // TTL configuration per query type (in milliseconds)
  private readonly ttlConfig = {
    revenue: 5 * 60 * 1000,        // 5 minutes - changes frequently
    pipeline: 10 * 60 * 1000,      // 10 minutes - moderate changes
    winloss: 30 * 60 * 1000,       // 30 minutes - historical data, changes slowly
    forecast: 15 * 60 * 1000,      // 15 minutes
    leadScoring: 5 * 60 * 1000,    // 5 minutes - changes with new leads
    workflows: 10 * 60 * 1000,     // 10 minutes
    ecommerce: 5 * 60 * 1000,      // 5 minutes - real-time sales data
  };

  /**
   * Generate cache key
   */
  private getCacheKey(namespace: string, key: string, params?: Record<string, unknown>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${namespace}:${key}:${paramString}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: CacheEntry<unknown>): boolean {
    const now = Date.now();
    return now - entry.timestamp < entry.ttl;
  }

  /**
   * Get from cache
   */
  get<T>(namespace: string, key: string, params?: Record<string, unknown>): T | null {
    const cacheKey = this.getCacheKey(namespace, key, params);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(cacheKey);
      return null;
    }

    logger.info(`Cache HIT: ${namespace}:${key}`, { file: 'analytics-cache.ts' });
    return entry.data as T;
  }

  /**
   * Set cache value
   */
  set<T>(
    namespace: string,
    key: string,
    data: T,
    params?: Record<string, unknown>,
    customTTL?: number
  ): void {
    const cacheKey = this.getCacheKey(namespace, key, params);
    const ttl = customTTL ?? (this.ttlConfig[key as keyof typeof this.ttlConfig] || this.defaultTTL);

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    logger.info(`Cache SET: ${namespace}:${key} (TTL: ${ttl}ms)`, { file: 'analytics-cache.ts' });
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(namespace: string, key: string, params?: Record<string, unknown>): void {
    const cacheKey = this.getCacheKey(namespace, key, params);
    const deleted = this.cache.delete(cacheKey);

    if (deleted) {
      logger.info(`Cache INVALIDATED: ${namespace}:${key}`, { file: 'analytics-cache.ts' });
    }
  }

  /**
   * Invalidate all cache for a namespace (org)
   */
  invalidateNamespace(namespace: string): void {
    let count = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${namespace}:`)) {
        this.cache.delete(key);
        count++;
      }
    }

    logger.info(`Cache INVALIDATED ${count} entries for namespace: ${namespace}`, { file: 'analytics-cache.ts' });
  }

  /**
   * Clear all expired entries
   */
  cleanupExpired(): number {
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cache CLEANED UP ${cleaned} expired entries`, { file: 'analytics-cache.ts' });
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    memoryUsage: number;
  } {
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (this.isValid(entry)) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache CLEARED all ${size} entries`, { file: 'analytics-cache.ts' });
  }
}

// Singleton instance
export const analyticsCache = new AnalyticsCache();

/**
 * Cache wrapper for analytics functions
 * USAGE:
 *
 * const result = await withCache(
 *   'revenue',
 *   async () => calculateRevenue(period),
 *   { period: '30d' }
 * );
 */
export async function withCache<T>(
  queryType: string,
  fetchFn: () => Promise<T>,
  params?: Record<string, unknown>,
  customTTL?: number
): Promise<T> {
  // Try cache first
  const cached = analyticsCache.get<T>(DEFAULT_ORG_ID, queryType, params);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch data
  logger.info(`Cache MISS: ${DEFAULT_ORG_ID}:${queryType} - fetching...`, { file: 'analytics-cache.ts' });
  const data = await fetchFn();

  // Store in cache
  analyticsCache.set(DEFAULT_ORG_ID, queryType, data, params, customTTL);

  return data;
}

/**
 * Invalidate analytics cache when data changes
 * Call this after creating/updating/deleting deals, orders, etc.
 */
export function invalidateAnalyticsCache(dataType?: string): void {
  if (dataType) {
    // Invalidate specific query types affected by this data change
    const affectedQueries: Record<string, string[]> = {
      deal: ['pipeline', 'winloss', 'forecast'],
      order: ['revenue', 'ecommerce'],
      lead: ['leadScoring'],
      workflow: ['workflows'],
    };

    const queries = affectedQueries[dataType] || [];
    queries.forEach(queryType => {
      analyticsCache.invalidate(DEFAULT_ORG_ID, queryType);
    });
  } else {
    // Invalidate everything for this org
    analyticsCache.invalidateNamespace(DEFAULT_ORG_ID);
  }
}

/**
 * Automatic cleanup interval
 * Best practice: Run cleanup every 10 minutes to free memory
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = analyticsCache.cleanupExpired();
    if (cleaned > 0) {
      const stats = analyticsCache.getStats();
      logger.info(`Cache Automatic cleanup: ${cleaned} expired, ${stats.validEntries} active`, { file: 'analytics-cache.ts' });
    }
  }, 10 * 60 * 1000); // Every 10 minutes
}

