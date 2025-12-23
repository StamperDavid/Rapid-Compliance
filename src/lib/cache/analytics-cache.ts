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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

class AnalyticsCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
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
  private getCacheKey(namespace: string, key: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${namespace}:${key}:${paramString}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return now - entry.timestamp < entry.ttl;
  }

  /**
   * Get from cache
   */
  get<T>(namespace: string, key: string, params?: Record<string, any>): T | null {
    const cacheKey = this.getCacheKey(namespace, key, params);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(cacheKey);
      return null;
    }

    console.log(`[Cache] HIT: ${namespace}:${key}`);
    return entry.data as T;
  }

  /**
   * Set cache value
   */
  set<T>(
    namespace: string, 
    key: string, 
    data: T, 
    params?: Record<string, any>,
    customTTL?: number
  ): void {
    const cacheKey = this.getCacheKey(namespace, key, params);
    const ttl = customTTL || this.ttlConfig[key as keyof typeof this.ttlConfig] || this.defaultTTL;

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    console.log(`[Cache] SET: ${namespace}:${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(namespace: string, key: string, params?: Record<string, any>): void {
    const cacheKey = this.getCacheKey(namespace, key, params);
    const deleted = this.cache.delete(cacheKey);
    
    if (deleted) {
      console.log(`[Cache] INVALIDATED: ${namespace}:${key}`);
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

    console.log(`[Cache] INVALIDATED ${count} entries for namespace: ${namespace}`);
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
      console.log(`[Cache] CLEANED UP ${cleaned} expired entries`);
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
    console.log(`[Cache] CLEARED all ${size} entries`);
  }
}

// Singleton instance
export const analyticsCache = new AnalyticsCache();

/**
 * Cache wrapper for analytics functions
 * USAGE:
 * 
 * const result = await withCache(
 *   'org-123',
 *   'revenue',
 *   async () => calculateRevenue(orgId, period),
 *   { period: '30d' }
 * );
 */
export async function withCache<T>(
  organizationId: string,
  queryType: string,
  fetchFn: () => Promise<T>,
  params?: Record<string, any>,
  customTTL?: number
): Promise<T> {
  // Try cache first
  const cached = analyticsCache.get<T>(organizationId, queryType, params);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch data
  console.log(`[Cache] MISS: ${organizationId}:${queryType} - fetching...`);
  const data = await fetchFn();

  // Store in cache
  analyticsCache.set(organizationId, queryType, data, params, customTTL);

  return data;
}

/**
 * Invalidate analytics cache when data changes
 * Call this after creating/updating/deleting deals, orders, etc.
 */
export function invalidateAnalyticsCache(organizationId: string, dataType?: string): void {
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
      analyticsCache.invalidate(organizationId, queryType);
    });
  } else {
    // Invalidate everything for this org
    analyticsCache.invalidateNamespace(organizationId);
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
      console.log(`[Cache] Automatic cleanup: ${cleaned} expired, ${stats.validEntries} active`);
    }
  }, 10 * 60 * 1000); // Every 10 minutes
}

