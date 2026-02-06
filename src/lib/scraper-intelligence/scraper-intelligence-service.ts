/**
 * Scraper Intelligence Service
 * 
 * High-level service layer for managing research intelligence, signals, and distillation.
 * Provides CRUD operations, caching, rate limiting, and transaction support.
 * 
 * Features:
 * - Research intelligence management (CRUD)
 * - Extracted signals management (CRUD)
 * - Batch operations with transactions
 * - In-memory caching for performance
 * - Rate limiting to prevent abuse
 * - Comprehensive error handling
 * - Analytics and reporting
 */

import { db } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';
import {
  type ResearchIntelligence,
  type ExtractedSignal,
  type TemporaryScrape,
  type ScrapingPlatform,
  ResearchIntelligenceSchema,
  ExtractedSignalSchema
} from '@/types/scraper-intelligence';
import { distillScrape, calculateLeadScore } from './distillation-engine';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// ============================================================================
// CONSTANTS
// ============================================================================

const RESEARCH_INTELLIGENCE_COLLECTION = 'research_intelligence';
const EXTRACTED_SIGNALS_COLLECTION = 'extracted_signals';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max 100 requests per minute per org

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  set(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instances
const researchCache = new SimpleCache<ResearchIntelligence>();
const signalsCache = new SimpleCache<ExtractedSignal[]>();

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();

  check(maxRequests: number = RATE_LIMIT_MAX_REQUESTS): boolean {
    const now = Date.now();
    const entry = this.limits.get(DEFAULT_ORG_ID);

    // No entry or window expired - create new window
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.limits.set(DEFAULT_ORG_ID, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Within window - check if limit exceeded
    if (entry.count >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        organizationId: DEFAULT_ORG_ID,
        count: entry.count,
        maxRequests,
      });
      return false;
    }

    // Increment count
    entry.count++;
    return true;
  }

  reset(): void {
    this.limits.delete(DEFAULT_ORG_ID);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        this.limits.delete(key);
      }
    }
  }
}

const rateLimiter = new RateLimiter();

// Cleanup rate limiter every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class ScraperIntelligenceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScraperIntelligenceError';
  }
}

function handleFirestoreError(error: unknown, operation: string, context: Record<string, string | number | boolean | null>): never {
  const logContext: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      logContext[key] = value;
    } else {
      logContext[key] = String(value);
    }
  }
  logger.error(`Firestore ${operation} failed`, error instanceof Error ? error : new Error(String(error)), logContext);

  if (error instanceof ScraperIntelligenceError) {
    throw error;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  throw new ScraperIntelligenceError(
    `${operation} failed: ${message}`,
    'FIRESTORE_ERROR',
    500,
    context
  );
}

// ============================================================================
// RESEARCH INTELLIGENCE CRUD
// ============================================================================

/**
 * Get research intelligence for an industry
 *
 * Uses cache when available to reduce Firestore reads.
 *
 * @param industryId - Industry identifier
 * @returns Research intelligence or null if not found
 * @throws ScraperIntelligenceError if operation fails
 */
export async function getResearchIntelligence(
  industryId: string
): Promise<ResearchIntelligence | null> {
  try {
    // Check rate limit
    if (!rateLimiter.check()) {
      throw new ScraperIntelligenceError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429,
        { organizationId: DEFAULT_ORG_ID }
      );
    }

    // Check cache
    const cacheKey = `research:${DEFAULT_ORG_ID}:${industryId}`;
    const cached = researchCache.get(cacheKey);
    if (cached) {
      logger.debug('Research intelligence cache hit', { organizationId: DEFAULT_ORG_ID, industryId });
      return cached;
    }

    // Fetch from Firestore
    const doc = await db
      .collection(RESEARCH_INTELLIGENCE_COLLECTION)
      .doc(`${DEFAULT_ORG_ID}_${industryId}`)
      .get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as Record<string, unknown> | undefined;
    if (!data) {
      return null;
    }

    // Convert Firestore timestamps to proper format
    const rawMetadata = data.metadata as { lastUpdated?: unknown; version?: number; updatedBy?: 'system' | 'user'; notes?: string } | undefined;
    const research: ResearchIntelligence = {
      ...(data as Omit<ResearchIntelligence, 'metadata'>),
      metadata: {
        lastUpdated: rawMetadata?.lastUpdated ? toDate(rawMetadata.lastUpdated).toISOString() : new Date().toISOString(),
        version: rawMetadata?.version ?? 1,
        updatedBy: rawMetadata?.updatedBy ?? 'system',
        notes: rawMetadata?.notes,
      },
    };

    // Validate with Zod (this ensures type safety)
    ResearchIntelligenceSchema.parse(research);

    // Cache for future requests (use original typed object, not Zod result)
    researchCache.set(cacheKey, research);

    logger.info('Research intelligence fetched', { organizationId: DEFAULT_ORG_ID, industryId });

    return research;
  } catch (error) {
    return handleFirestoreError(error, 'getResearchIntelligence', {
      organizationId: DEFAULT_ORG_ID,
      industryId,
    });
  }
}

/**
 * Save or update research intelligence
 *
 * @param industryId - Industry identifier
 * @param research - Research intelligence configuration
 * @throws ScraperIntelligenceError if validation or save fails
 */
export async function saveResearchIntelligence(
  industryId: string,
  research: ResearchIntelligence
): Promise<void> {
  try {
    // Check rate limit
    if (!rateLimiter.check()) {
      throw new ScraperIntelligenceError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429,
        { organizationId: DEFAULT_ORG_ID }
      );
    }

    // Validate with Zod
    const validated = ResearchIntelligenceSchema.parse(research);

    // Save to Firestore
    const docId = `${DEFAULT_ORG_ID}_${industryId}`;
    await db
      .collection(RESEARCH_INTELLIGENCE_COLLECTION)
      .doc(docId)
      .set(validated, { merge: true });

    // Invalidate cache
    const cacheKey = `research:${DEFAULT_ORG_ID}:${industryId}`;
    researchCache.invalidate(cacheKey);

    logger.info('Research intelligence saved', { organizationId: DEFAULT_ORG_ID, industryId });
  } catch (error) {
    return handleFirestoreError(error, 'saveResearchIntelligence', {
      organizationId: DEFAULT_ORG_ID,
      industryId,
    });
  }
}

/**
 * Delete research intelligence
 *
 * @param industryId - Industry identifier
 * @throws ScraperIntelligenceError if delete fails
 */
export async function deleteResearchIntelligence(
  industryId: string
): Promise<void> {
  try {
    const docId = `${DEFAULT_ORG_ID}_${industryId}`;
    await db
      .collection(RESEARCH_INTELLIGENCE_COLLECTION)
      .doc(docId)
      .delete();

    // Invalidate cache
    const cacheKey = `research:${DEFAULT_ORG_ID}:${industryId}`;
    researchCache.invalidate(cacheKey);

    logger.info('Research intelligence deleted', { organizationId: DEFAULT_ORG_ID, industryId });
  } catch (error) {
    return handleFirestoreError(error, 'deleteResearchIntelligence', {
      organizationId: DEFAULT_ORG_ID,
      industryId,
    });
  }
}

/**
 * List all research intelligence for an organization
 *
 * @returns Array of research intelligence configurations
 * @throws ScraperIntelligenceError if query fails
 */
export async function listResearchIntelligence(): Promise<Array<{ industryId: string; research: ResearchIntelligence }>> {
  try {
    const snapshot = await db
      .collection(RESEARCH_INTELLIGENCE_COLLECTION)
      .get();

    const results = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const industryId = doc.id.replace(`${DEFAULT_ORG_ID}_`, '');
      const rawMetadata = data.metadata as { lastUpdated?: unknown; version?: number; updatedBy?: 'system' | 'user'; notes?: string } | undefined;

      return {
        industryId,
        research: {
          ...(data as Omit<ResearchIntelligence, 'metadata'>),
          metadata: {
            lastUpdated: rawMetadata?.lastUpdated ? toDate(rawMetadata.lastUpdated).toISOString() : new Date().toISOString(),
            version: rawMetadata?.version ?? 1,
            updatedBy: rawMetadata?.updatedBy ?? 'system',
            notes: rawMetadata?.notes,
          },
        },
      };
    });

    logger.info('Listed research intelligence', {
      organizationId: DEFAULT_ORG_ID,
      count: results.length
    });

    return results;
  } catch (error) {
    return handleFirestoreError(error, 'listResearchIntelligence', {
      organizationId: DEFAULT_ORG_ID,
    });
  }
}

// ============================================================================
// EXTRACTED SIGNALS CRUD
// ============================================================================

/**
 * Save extracted signals to permanent storage
 *
 * Signals are saved to lead/company records for permanent retention.
 *
 * @param recordId - Lead or company ID
 * @param signals - Array of extracted signals
 * @throws ScraperIntelligenceError if save fails
 */
export async function saveExtractedSignals(
  recordId: string,
  signals: ExtractedSignal[]
): Promise<void> {
  try {
    // Check rate limit
    if (!rateLimiter.check()) {
      throw new ScraperIntelligenceError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429,
        { organizationId: DEFAULT_ORG_ID }
      );
    }

    // Validate signals
    const validated = signals.map((signal) => ExtractedSignalSchema.parse(signal));

    // Use transaction for atomic update
    await db.runTransaction(async (transaction) => {
      const docRef = db
        .collection(EXTRACTED_SIGNALS_COLLECTION)
        .doc(`${DEFAULT_ORG_ID}_${recordId}`);

      const doc = await transaction.get(docRef);

      if (doc.exists) {
        // Append to existing signals
        const data = doc.data() as { signals?: ExtractedSignal[] } | undefined;
        const existing = data?.signals ?? [];
        transaction.update(docRef, {
          signals: [...existing, ...validated],
          updatedAt: new Date(),
        });
      } else {
        // Create new document
        transaction.set(docRef, {
          organizationId: DEFAULT_ORG_ID,
          recordId,
          signals: validated,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    // Invalidate cache
    signalsCache.invalidatePattern(`signals:${DEFAULT_ORG_ID}:${recordId}`);

    logger.info('Extracted signals saved', {
      organizationId: DEFAULT_ORG_ID,
      recordId,
      signalCount: signals.length,
    });
  } catch (error) {
    return handleFirestoreError(error, 'saveExtractedSignals', {
      organizationId: DEFAULT_ORG_ID,
      recordId,
      signalCount: signals.length,
    });
  }
}

/**
 * Get extracted signals for a record
 *
 * @param recordId - Lead or company ID
 * @returns Array of signals
 * @throws ScraperIntelligenceError if query fails
 */
export async function getExtractedSignals(
  recordId: string
): Promise<ExtractedSignal[]> {
  try {
    // Check cache
    const cacheKey = `signals:${DEFAULT_ORG_ID}:${recordId}`;
    const cached = signalsCache.get(cacheKey);
    if (cached) {
      logger.debug('Signals cache hit', { organizationId: DEFAULT_ORG_ID, recordId });
      return cached;
    }

    // Fetch from Firestore
    const doc = await db
      .collection(EXTRACTED_SIGNALS_COLLECTION)
      .doc(`${DEFAULT_ORG_ID}_${recordId}`)
      .get();

    if (!doc.exists) {
      return [];
    }

    const data = doc.data() as { signals?: Array<Record<string, unknown>> } | undefined;
    const signalsData = data?.signals ?? [];
    const signals = signalsData.map((signal) => ({
      ...signal,
      extractedAt: toDate(signal.extractedAt),
    })) as ExtractedSignal[];

    // Cache for future requests
    signalsCache.set(cacheKey, signals);

    logger.info('Extracted signals fetched', {
      organizationId: DEFAULT_ORG_ID,
      recordId,
      signalCount: signals.length,
    });

    return signals;
  } catch (error) {
    return handleFirestoreError(error, 'getExtractedSignals', {
      organizationId: DEFAULT_ORG_ID,
      recordId,
    });
  }
}

/**
 * Query signals by platform
 *
 * @param platform - Scraping platform
 * @param limit - Max results (default: 100)
 * @returns Array of records with signals
 */
export async function querySignalsByPlatform(
  platform: ScrapingPlatform,
  limit: number = 100
): Promise<Array<{ recordId: string; signals: ExtractedSignal[] }>> {
  try {
    const snapshot = await db
      .collection(EXTRACTED_SIGNALS_COLLECTION)
      .limit(limit)
      .get();

    const results: Array<{ recordId: string; signals: ExtractedSignal[] }> = [];

    for (const doc of snapshot.docs) {
      const data = doc.data() as { recordId: string; signals?: Array<Record<string, unknown>> };
      const recordId = data.recordId;
      const signalsData = data.signals ?? [];
      const allSignals = signalsData.map((signal) => ({
        ...signal,
        extractedAt: toDate(signal.extractedAt),
      })) as ExtractedSignal[];

      // Filter by platform
      const platformSignals = allSignals.filter((s) => s.platform === platform);

      if (platformSignals.length > 0) {
        results.push({ recordId, signals: platformSignals });
      }
    }

    logger.info('Queried signals by platform', {
      organizationId: DEFAULT_ORG_ID,
      platform,
      resultCount: results.length,
    });

    return results;
  } catch (error) {
    return handleFirestoreError(error, 'querySignalsByPlatform', {
      organizationId: DEFAULT_ORG_ID,
      platform,
    });
  }
}

/**
 * Delete signals for a record
 *
 * @param recordId - Lead or company ID
 * @throws ScraperIntelligenceError if delete fails
 */
export async function deleteExtractedSignals(
  recordId: string
): Promise<void> {
  try {
    await db
      .collection(EXTRACTED_SIGNALS_COLLECTION)
      .doc(`${DEFAULT_ORG_ID}_${recordId}`)
      .delete();

    // Invalidate cache
    signalsCache.invalidatePattern(`signals:${DEFAULT_ORG_ID}:${recordId}`);

    logger.info('Extracted signals deleted', { organizationId: DEFAULT_ORG_ID, recordId });
  } catch (error) {
    return handleFirestoreError(error, 'deleteExtractedSignals', {
      organizationId: DEFAULT_ORG_ID,
      recordId,
    });
  }
}

// ============================================================================
// ORCHESTRATION & ANALYTICS
// ============================================================================

/**
 * Full distillation workflow with signal extraction and storage
 * 
 * This is the main entry point for processing a scrape:
 * 1. Distills raw HTML into signals
 * 2. Saves signals to permanent storage
 * 3. Returns results with storage metrics
 * 
 * @param params - Distillation parameters
 * @returns Distillation result with storage info
 */
export async function processAndStoreScrape(params: {
  workspaceId?: string;
  industryId: string;
  recordId: string;
  url: string;
  rawHtml: string;
  cleanedContent: string;
  metadata: TemporaryScrape['metadata'];
  platform: ScrapingPlatform;
}): Promise<{
  signals: ExtractedSignal[];
  tempScrapeId: string;
  leadScore: number;
  storageReduction: {
    rawSizeBytes: number;
    signalsSizeBytes: number;
    reductionPercent: number;
  };
}> {
  const startTime = Date.now();

  try {
    const { industryId, recordId, workspaceId, url, rawHtml, cleanedContent, metadata, platform } = params;

    // Step 1: Get research intelligence
    const research = await getResearchIntelligence(industryId);
    if (!research) {
      throw new ScraperIntelligenceError(
        `Research intelligence not found for industry: ${industryId}`,
        'RESEARCH_NOT_FOUND',
        404,
        { organizationId: DEFAULT_ORG_ID, industryId }
      );
    }

    // Step 2: Distill scrape
    const distillResult = await distillScrape({
      organizationId: DEFAULT_ORG_ID,
      workspaceId,
      url,
      rawHtml,
      cleanedContent,
      metadata,
      research,
      platform,
      relatedRecordId: recordId,
    });

    // Step 3: Calculate lead score
    const leadScore = calculateLeadScore(
      distillResult.signals,
      research,
      { platform }
    );

    // Step 4: Save signals to permanent storage
    if (distillResult.signals.length > 0) {
      await saveExtractedSignals(recordId, distillResult.signals);
    }

    logger.info('Scrape processed and stored', {
      organizationId: DEFAULT_ORG_ID,
      recordId,
      url,
      signalsDetected: distillResult.signals.length,
      leadScore,
      durationMs: Date.now() - startTime,
    });

    return {
      signals: distillResult.signals,
      tempScrapeId: distillResult.tempScrapeId,
      leadScore,
      storageReduction: distillResult.storageReduction,
    };
  } catch (error) {
    return handleFirestoreError(error, 'processAndStoreScrape', {
      organizationId: DEFAULT_ORG_ID,
      url: params.url,
    });
  }
}

/**
 * Get analytics for extracted signals
 *
 * @param recordId - Lead or company ID
 * @returns Analytics object
 */
export async function getSignalAnalytics(
  recordId: string
): Promise<{
  totalSignals: number;
  signalsByPlatform: Record<ScrapingPlatform, number>;
  averageConfidence: number;
  topSignals: Array<{ signalId: string; signalLabel: string; count: number }>;
  oldestSignal: Date | null;
  newestSignal: Date | null;
}> {
  try {
    const signals = await getExtractedSignals(recordId);

    const totalSignals = signals.length;

    const signalsByPlatform: Record<ScrapingPlatform, number> = {
      website: 0,
      'linkedin-jobs': 0,
      'linkedin-company': 0,
      news: 0,
      crunchbase: 0,
      dns: 0,
      'google-business': 0,
      'social-media': 0,
    };

    let totalConfidence = 0;

    for (const signal of signals) {
      signalsByPlatform[signal.platform]++;
      totalConfidence += signal.confidence;
    }

    const averageConfidence = totalSignals > 0 ? totalConfidence / totalSignals : 0;

    // Count signal occurrences
    const signalCounts = new Map<string, { label: string; count: number }>();
    for (const signal of signals) {
      const existing = signalCounts.get(signal.signalId);
      if (existing) {
        existing.count++;
      } else {
        signalCounts.set(signal.signalId, {
          label: signal.signalLabel,
          count: 1,
        });
      }
    }

    // Get top 10 signals
    const topSignals = Array.from(signalCounts.entries())
      .map(([signalId, data]) => ({
        signalId,
        signalLabel: data.label,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get date range
    const dates = signals.map((s) => s.extractedAt.getTime());
    const oldestSignal = dates.length > 0 ? new Date(Math.min(...dates)) : null;
    const newestSignal = dates.length > 0 ? new Date(Math.max(...dates)) : null;

    return {
      totalSignals,
      signalsByPlatform,
      averageConfidence,
      topSignals,
      oldestSignal,
      newestSignal,
    };
  } catch (error) {
    return handleFirestoreError(error, 'getSignalAnalytics', {
      organizationId: DEFAULT_ORG_ID,
      recordId,
    });
  }
}

/**
 * Batch process multiple scrapes with transaction support
 * 
 * @param scrapes - Array of scrapes to process
 * @returns Array of results
 */
export async function batchProcessScrapes(
  scrapes: Array<{
    workspaceId?: string;
    industryId: string;
    recordId: string;
    url: string;
    rawHtml: string;
    cleanedContent: string;
    metadata: TemporaryScrape['metadata'];
    platform: ScrapingPlatform;
  }>
): Promise<Array<Awaited<ReturnType<typeof processAndStoreScrape>>>> {
  logger.info('Starting batch scrape processing', {
    count: scrapes.length,
  });

  const results: Array<Awaited<ReturnType<typeof processAndStoreScrape>>> = [];

  // Process sequentially to avoid rate limits and Firestore overload
  for (const scrape of scrapes) {
    try {
      const result = await processAndStoreScrape(scrape);
      results.push(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Batch processing item failed', err, {
        url: scrape.url,
        organizationId: DEFAULT_ORG_ID,
      });
      // Continue with next item
    }
  }

  logger.info('Batch scrape processing complete', {
    total: scrapes.length,
    successful: results.length,
    failed: scrapes.length - results.length,
  });

  return results;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  researchCache.clear();
  signalsCache.clear();
  logger.info('All caches cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  researchCacheSize: number;
  signalsCacheSize: number;
} {
  return {
    researchCacheSize: researchCache.size(),
    signalsCacheSize: signalsCache.size(),
  };
}

/**
 * Invalidate caches for an organization
 */
export function invalidateOrganizationCaches(): void {
  researchCache.invalidatePattern(`research:${DEFAULT_ORG_ID}:`);
  signalsCache.invalidatePattern(`signals:${DEFAULT_ORG_ID}:`);
  logger.info('Organization caches invalidated', { organizationId: DEFAULT_ORG_ID });
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Convert Firestore Timestamp to JavaScript Date
 */
function toDate(timestamp: unknown): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp && typeof (timestamp as { toDate?: () => Date }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  if ((timestamp as { seconds?: number })?.seconds) {
    return new Date((timestamp as { seconds: number }).seconds * 1000);
  }
  return new Date(timestamp as string | number);
}

/**
 * Health check for service
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  cacheStats: ReturnType<typeof getCacheStats>;
  timestamp: Date;
}> {
  try {
    // Test Firestore connectivity
    await db.collection(RESEARCH_INTELLIGENCE_COLLECTION).limit(1).get();

    return {
      status: 'healthy',
      cacheStats: getCacheStats(),
      timestamp: new Date(),
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Health check failed', err);
    return {
      status: 'unhealthy',
      cacheStats: getCacheStats(),
      timestamp: new Date(),
    };
  }
}
