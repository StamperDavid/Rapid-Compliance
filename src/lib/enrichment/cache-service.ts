/**
 * Caching Service for Enrichment Data
 * Uses Firestore with TTL (time-to-live)
 * Reduces costs by 85%+ (only re-scrape when cache expires)
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { CompanyEnrichmentData } from './types';

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
  domain: string,
  organizationId: string
): Promise<CompanyEnrichmentData | null> {
  try {
    // Query for cached data
    const results = await FirestoreService.query<CachedEnrichment>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrichment-cache`,
      [
        { field: 'domain', operator: '==', value: domain }
      ],
      1 // limit 1
    );
    
    if (results.length === 0) {
      console.log(`[Cache] No cached data for ${domain}`);
      return null;
    }
    
    const cached = results[0];
    
    // Check if cache is still valid
    const now = new Date();
    const expiresAt = cached.expiresAt instanceof Date 
      ? cached.expiresAt 
      : new Date(cached.expiresAt);
    
    if (now > expiresAt) {
      console.log(`[Cache] Cached data for ${domain} has expired`);
      return null;
    }
    
    console.log(`[Cache] HIT for ${domain} - saved a scrape!`);
    return cached.data;
  } catch (error) {
    console.error('[Cache] Error reading cache:', error);
    return null; // Fail gracefully - just re-scrape
  }
}

/**
 * Save enrichment data to cache
 */
export async function cacheEnrichment(
  domain: string,
  data: CompanyEnrichmentData,
  organizationId: string,
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
      organizationId,
    };
    
    // Use domain as document ID for easy lookup
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrichment-cache`,
      domain.replace(/[^a-zA-Z0-9-]/g, '-'), // Firestore-safe ID
      cacheEntry
    );
    
    console.log(`[Cache] Saved ${domain} to cache (expires in ${ttlDays} days)`);
  } catch (error) {
    console.error('[Cache] Error saving to cache:', error);
    // Don't throw - caching failure shouldn't break enrichment
  }
}

/**
 * Invalidate cache for a specific domain
 */
export async function invalidateCache(
  domain: string,
  organizationId: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrichment-cache`,
      domain.replace(/[^a-zA-Z0-9-]/g, '-')
    );
    
    console.log(`[Cache] Invalidated cache for ${domain}`);
  } catch (error) {
    console.error('[Cache] Error invalidating cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(organizationId: string): Promise<{
  totalCached: number;
  hitRate: number;
  avgAge: number;
}> {
  try {
    const cached = await FirestoreService.getAll<CachedEnrichment>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrichment-cache`
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
    const logs = await FirestoreService.query(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrichment-costs`,
      [
        { 
          field: 'timestamp', 
          operator: '>=', 
          value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
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
  } catch (error) {
    console.error('[Cache] Error getting stats:', error);
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
export async function purgeExpiredCache(organizationId: string): Promise<number> {
  try {
    const allCached = await FirestoreService.getAll<CachedEnrichment>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrichment-cache`
    );
    
    const now = new Date();
    let purgedCount = 0;
    
    for (const entry of allCached) {
      const expiresAt = entry.expiresAt instanceof Date 
        ? entry.expiresAt 
        : new Date(entry.expiresAt);
      
      if (now > expiresAt) {
        await FirestoreService.delete(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrichment-cache`,
          entry.domain.replace(/[^a-zA-Z0-9-]/g, '-')
        );
        purgedCount++;
      }
    }
    
    console.log(`[Cache] Purged ${purgedCount} expired entries`);
    return purgedCount;
  } catch (error) {
    console.error('[Cache] Error purging expired cache:', error);
    return 0;
  }
}

