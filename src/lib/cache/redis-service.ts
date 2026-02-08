/**
 * Redis Caching Service
 * High-performance caching layer for frequently accessed data
 */

import { logger } from '@/lib/logger/logger';
import type Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix for namespacing
}

interface CacheEntry {
  value: unknown;
  expiry: number;
}

export class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private memoryCache: Map<string, CacheEntry> = new Map();
  
  constructor() {
    // Initialize Redis client (will use ioredis in production)
    void this.initializeClient();
  }
  
  /**
   * Initialize Redis client
   */
  private async initializeClient() {
    try {
      // In production, use actual Redis
      if (process.env.REDIS_URL) {
        const Redis = (await import('ioredis')).default;
        this.client = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          lazyConnect: true,
        });
        
        await this.client.connect();
        this.isConnected = true;
        logger.info('[Redis] Connected successfully', { file: 'redis-service.ts' });
      } else {
        // Fallback to in-memory cache for development
        logger.warn('[Redis] No REDIS_URL found, using in-memory cache', { file: 'redis-service.ts' });
        this.isConnected = false;
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('[Redis] Connection failed:', errorObj, { file: 'redis-service.ts' });
      this.isConnected = false;
    }
  }
  
  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const fullKey = this.buildKey(key, options?.prefix);

    try {
      if (this.isConnected && this.client) {
        // Use Redis
        const value = await this.client.get(fullKey);
        if (value) {
          return JSON.parse(value) as T;
        }
        return null;
      } else {
        // Use in-memory cache
        const cached = this.memoryCache.get(fullKey);
        if (cached && cached.expiry > Date.now()) {
          return cached.value as T;
        }
        if (cached) {
          this.memoryCache.delete(fullKey);
        }
        return null;
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('[Cache] Get error:', errorObj, { file: 'redis-service.ts' });
      return null;
    }
  }
  
  /**
   * Set value in cache
   */
  async set(key: string, value: unknown, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.prefix);
    const ttl = options?.ttl ?? 3600; // Default 1 hour

    try {
      if (this.isConnected && this.client) {
        // Use Redis
        await this.client.setex(fullKey, ttl, JSON.stringify(value));
      } else {
        // Use in-memory cache
        const expiry = Date.now() + (ttl * 1000);
        this.memoryCache.set(fullKey, { value, expiry });

        // Clean up expired entries periodically
        if (this.memoryCache.size > 1000) {
          this.cleanupMemoryCache();
        }
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('[Cache] Set error:', errorObj, { file: 'redis-service.ts' });
    }
  }
  
  /**
   * Delete value from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.prefix);
    
    try {
      if (this.isConnected && this.client) {
        await this.client.del(fullKey);
      } else {
        this.memoryCache.delete(fullKey);
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('[Cache] Delete error:', errorObj, { file: 'redis-service.ts' });
    }
  }
  
  /**
   * Delete all keys matching pattern
   */
  async deletePattern(pattern: string, options?: CacheOptions): Promise<void> {
    const fullPattern = this.buildKey(pattern, options?.prefix);

    try {
      if (this.isConnected && this.client) {
        const keys = await this.client.keys(fullPattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } else {
        // Delete from in-memory cache
        const regex = new RegExp(fullPattern.replace('*', '.*'));
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
          }
        }
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('[Cache] Delete pattern error:', errorObj, { file: 'redis-service.ts' });
    }
  }
  
  /**
   * Check if key exists
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);
    
    try {
      if (this.isConnected && this.client) {
        const exists = await this.client.exists(fullKey);
        return exists === 1;
      } else {
        const cached = this.memoryCache.get(fullKey);
        return cached ? cached.expiry > Date.now() : false;
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('[Cache] Exists error:', errorObj, { file: 'redis-service.ts' });
      return false;
    }
  }
  
  /**
   * Get or set value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch from source
    const value = await fetcher();
    
    // Store in cache
    await this.set(key, value, options);
    
    return value;
  }
  
  /**
   * Increment counter
   */
  async increment(key: string, options?: CacheOptions): Promise<number> {
    const fullKey = this.buildKey(key, options?.prefix);

    try {
      if (this.isConnected && this.client) {
        return await this.client.incr(fullKey);
      } else {
        const cached = this.memoryCache.get(fullKey);
        const current = typeof cached?.value === 'number' ? cached.value : 0;
        const newValue = current + 1;
        await this.set(key, newValue, options);
        return newValue;
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('[Cache] Increment error:', errorObj, { file: 'redis-service.ts' });
      return 0;
    }
  }
  
  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const basePrefix =(process.env.CACHE_PREFIX !== '' && process.env.CACHE_PREFIX != null) ? process.env.CACHE_PREFIX : 'ai-crm';
    return prefix ? `${basePrefix}:${prefix}:${key}` : `${basePrefix}:${key}`;
  }
  
  /**
   * Clean up expired entries from in-memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expiry <= now) {
        this.memoryCache.delete(key);
      }
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    size: number;
    type: 'redis' | 'memory';
  }> {
    try {
      if (this.isConnected && this.client) {
        const info = await this.client.info('stats');
        const keysMatch = info.match(/keys=(\d+)/)?.[1];
        const size = parseInt(keysMatch ?? '0');
        return {
          connected: true,
          size,
          type: 'redis',
        };
      } else {
        return {
          connected: false,
          size: this.memoryCache.size,
          type: 'memory',
        };
      }
    } catch (_error) {
      return {
        connected: false,
        size: this.memoryCache.size,
        type: 'memory',
      };
    }
  }
  
  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.isConnected && this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

// Singleton instance
export const cacheService = new RedisService();

// Cache key builders for common patterns
export const CacheKeys = {
  // Agent caching
  agentConfig: (agentId: string) => `agent:config:${agentId}`,
  agentResponse: (agentId: string, messageHash: string) => `agent:response:${agentId}:${messageHash}`,

  // Customer caching
  customer: (customerId: string) => `customer:${customerId}`,
  customerList: (page: number) => `customer:list:${page}`,

  // Custom object schema caching
  objectSchema: (objectId: string) => `schema:${objectId}`,

  // E-commerce caching
  product: (workspaceId: string, productId: string) => `product:${workspaceId}:${productId}`,
  productList: (workspaceId: string, page: number) => `product:list:${workspaceId}:${page}`,
  cart: (customerId: string) => `cart:${customerId}`,

  // Analytics caching
  analytics: (metric: string, period: string) => `analytics:${metric}:${period}`,

  // Integration caching
  integration: (provider: string) => `integration:${provider}`,
};

// Cache TTLs (in seconds)
export const CacheTTL = {
  SECOND: 1,
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  
  // Specific use cases
  AGENT_CONFIG: 3600,      // 1 hour
  AGENT_RESPONSE: 300,     // 5 minutes
  CUSTOMER: 600,           // 10 minutes
  PRODUCT: 1800,           // 30 minutes
  SCHEMA: 3600,            // 1 hour
  ANALYTICS: 300,          // 5 minutes
  INTEGRATION: 1800,       // 30 minutes
};

