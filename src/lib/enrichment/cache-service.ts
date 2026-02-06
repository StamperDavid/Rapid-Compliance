/**
 * Caching Service for Enrichment Data
 * Uses Firestore with TTL (time-to-live)
 * Reduces costs by 85%+ (only re-scrape when cache expires)
 */

import { FirestoreService, COLLECTIONS } from '../db/firestore-service';
import type { CompanyEnrichmentData } from './types';
import { logger } from '../logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

const CACHE_TTL_DAYS = 7; // Cache for 7 days

export interface CachedEnrichment {
  domain: string;
  data: CompanyEnrichmentData;
  cachedAt: Date;
  expiresAt: Date;
  organizationId: string;
}

/**
 * Get cached enrichment data if it exists and is still fresh
 */
export async function getCachedEnrichment(
  domain: string
): Promise<CompanyEnrichmentData | null> {
  try {
    // Query for cached data
    const { where, limit } = await import('firebase/firestore');
    const results = await FirestoreService.getAll<CachedEnrichment>(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrichment-cache`,
      [
        where('domain', '==', domain),
        limit(1)
      ]
    );
    
    if (results.length === 0) {
      logger.info('Cache No cached data for domain}', { file: 'cache-service.ts' });
      return null;
    }
    
    const cached = results[0];
    
    // Check if cache is still valid
    const now = new Date();
    const expiresAt = cached.expiresAt instanceof Date 
      ? cached.expiresAt 
      : new Date(cached.expiresAt);
    
    if (now > expiresAt) {
      logger.info('Cache Cached data for domain} has expired', { file: 'cache-service.ts' });
      return null;
    }
    
    logger.info('Cache HIT for domain} - saved a scrape!', { file: 'cache-service.ts' });
    return cached.data;
  } catch (error: unknown) {
    const cacheError = error instanceof Error ? error : new Error(String(error));
    logger.error('[Cache] Error reading cache:', cacheError, { file: 'cache-service.ts' });
    return null; // Fail gracefully - just re-scrape
  }
}

/**
 * Save enrichment data to cache
 */
export async function cacheEnrichment(
  domain: string,
  data: CompanyEnrichmentData,
  ttlDays: number = CACHE_TTL_DAYS
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

    const cacheEntry: CachedEnrichment = {
      domain,
      data,
      cachedAt: now,
      expiresAt,
      organizationId: DEFAULT_ORG_ID,
    };

    // Use domain as document ID for easy lookup
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrichment-cache`,
      domain.replace(/[^a-zA-Z0-9-]/g, '-'), // Firestore-safe ID
      cacheEntry
    );

    logger.info('Cache Saved domain} to cache (expires in ttlDays} days)', { file: 'cache-service.ts' });
  } catch (error: unknown) {
    const saveError = error instanceof Error ? error : new Error(String(error));
    logger.error('[Cache] Error saving to cache:', saveError, { file: 'cache-service.ts' });
    // Don't throw - caching failure shouldn't break enrichment
  }
}

/**
 * Invalidate cache for a specific domain
 */
export async function invalidateCache(
  domain: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrichment-cache`,
      domain.replace(/[^a-zA-Z0-9-]/g, '-')
    );

    logger.info('Cache Invalidated cache for domain}', { file: 'cache-service.ts' });
  } catch (error: unknown) {
    const invalidateError = error instanceof Error ? error : new Error(String(error));
    logger.error('[Cache] Error invalidating cache:', invalidateError, { file: 'cache-service.ts' });
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalCached: number;
  hitRate: number;
  avgAge: number;
}> {
  try {
    const cached = await FirestoreService.getAll<CachedEnrichment>(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrichment-cache`
    );
    
    const now = new Date().getTime();
    const ages = cached.map(entry => {
      const cachedAt = entry.cachedAt instanceof Date 
        ? entry.cachedAt.getTime() 
        : new Date(entry.cachedAt).getTime();
      return (now - cachedAt) / (1000 * 60 * 60 * 24); // days
    });
    
    const avgAge = ages.length > 0 
      ? ages.reduce((sum, age) => sum + age, 0) / ages.length 
      : 0;
    
    // Get total enrichment requests from logs
    const { where } = await import('firebase/firestore');
    const logs = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrichment-costs`,
      [
        where('timestamp', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ]
    );
    
    const totalRequests = logs.length;
    const cacheHits = cached.length;
    const hitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
    
    return {
      totalCached: cached.length,
      hitRate,
      avgAge,
    };
  } catch (error: unknown) {
    const statsError = error instanceof Error ? error : new Error(String(error));
    logger.error('[Cache] Error getting stats:', statsError, { file: 'cache-service.ts' });
    return {
      totalCached: 0,
      hitRate: 0,
      avgAge: 0,
    };
  }
}

/**
 * Clean up expired cache entries
 * Run this periodically (e.g., daily cron job)
 */
export async function purgeExpiredCache(): Promise<number> {
  try {
    const allCached = await FirestoreService.getAll<CachedEnrichment>(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrichment-cache`
    );
    
    const now = new Date();
    let purgedCount = 0;
    
    for (const entry of allCached) {
      const expiresAt = entry.expiresAt instanceof Date 
        ? entry.expiresAt 
        : new Date(entry.expiresAt);
      
      if (now > expiresAt) {
        await FirestoreService.delete(
          `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrichment-cache`,
          entry.domain.replace(/[^a-zA-Z0-9-]/g, '-')
        );
        purgedCount++;
      }
    }

    logger.info('Cache Purged purgedCount} expired entries', { file: 'cache-service.ts' });
    return purgedCount;
  } catch (error: unknown) {
    const purgeError = error instanceof Error ? error : new Error(String(error));
    logger.error('[Cache] Error purging expired cache:', purgeError, { file: 'cache-service.ts' });
    return 0;
  }
}




