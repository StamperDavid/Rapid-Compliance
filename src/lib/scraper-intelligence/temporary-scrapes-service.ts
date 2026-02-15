/**
 * Temporary Scrapes Service
 * 
 * Manages temporary scrape storage with TTL (Time-To-Live) architecture.
 * Implements content hashing for duplicate detection and cost optimization.
 * 
 * Key Features:
 * - Auto-delete raw scrapes after 7 days (Firestore TTL)
 * - Content hashing (SHA-256) to avoid duplicate storage
 * - Storage cost tracking and projections
 * - Flagging for immediate deletion after verification
 */

import { db } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';
import crypto from 'crypto';
import type { TemporaryScrape } from '@/types/scraper-intelligence';

// ============================================================================
// CONSTANTS
// ============================================================================

const TEMPORARY_SCRAPES_COLLECTION = 'temporary_scrapes';
const TTL_DAYS = 7;
const FIRESTORE_COST_PER_GB_MONTHLY = 0.18; // USD

// ============================================================================
// CONTENT HASHING
// ============================================================================

/**
 * Calculate SHA-256 hash of content for duplicate detection
 * 
 * @param content - The content to hash (typically rawHtml)
 * @returns 64-character hex string (SHA-256 digest)
 * 
 * @example
 * ```typescript
 * const hash = calculateContentHash('<html>...</html>');
 * // Returns: 'a3b5c7d9e1f3...' (64 chars)
 * ```
 */
export function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate expiration date (now + 7 days)
 * 
 * @returns Date object representing 7 days from now
 */
export function calculateExpirationDate(): Date {
  const now = new Date();
  const expiration = new Date(now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000);
  return expiration;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Save or update a temporary scrape with duplicate detection
 * 
 * If content with same hash exists, updates lastSeen and scrapeCount.
 * Otherwise, creates new temporary scrape with TTL.
 * 
 * @param params - Scrape parameters
 * @returns Object with scrape and isNew flag
 * 
 * @throws Error if Firestore operation fails
 * 
 * @example
 * ```typescript
 * const { scrape, isNew } = await saveTemporaryScrape({
 *   url: 'https://example.com',
 *   rawHtml: '<html>...</html>',
 *   cleanedContent: 'Cleaned text',
 *   metadata: { title: 'Example' }
 * });
 * 
 * if (isNew) {
 *   console.log('New scrape created');
 * } else {
 *   console.log('Duplicate detected, updated lastSeen');
 * }
 * ```
 */
export async function saveTemporaryScrape(params: {
  url: string;
  rawHtml: string;
  cleanedContent: string;
  metadata: TemporaryScrape['metadata'];
  relatedRecordId?: string;
}): Promise<{ scrape: TemporaryScrape; isNew: boolean }> {
  try {
    const { url, rawHtml, cleanedContent, metadata, relatedRecordId } = params;

    // Calculate content hash for duplicate detection
    const contentHash = calculateContentHash(rawHtml);

    // Check if this exact content already exists
    const existing = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .where('contentHash', '==', contentHash)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Duplicate found - just update lastSeen and scrapeCount
      const doc = existing.docs[0];
      const existingData = doc.data() as TemporaryScrape;

      const updated: Partial<TemporaryScrape> = {
        lastSeen: new Date(),
        scrapeCount: existingData.scrapeCount + 1,
      };

      await doc.ref.update(updated);

      logger.info('Duplicate scrape detected, updated lastSeen', {
        url,
        contentHash,
        scrapeCount: existingData.scrapeCount + 1,
      });

      return {
        scrape: { ...existingData, ...updated } as TemporaryScrape,
        isNew: false,
      };
    }

    // New content - create new temporary scrape
    const now = new Date();
    const newScrape: TemporaryScrape = {
      id: db.collection(TEMPORARY_SCRAPES_COLLECTION).doc().id,
      url,
      rawHtml,
      cleanedContent,
      contentHash,
      createdAt: now,
      lastSeen: now,
      expiresAt: calculateExpirationDate(),
      scrapeCount: 1,
      metadata,
      sizeBytes: Buffer.byteLength(rawHtml, 'utf8'),
      verified: false,
      flaggedForDeletion: false,
      relatedRecordId,
    };

    // Filter out undefined values for Firestore
    const cleanData = Object.fromEntries(
      Object.entries(newScrape).filter(([_key, v]) => v !== undefined)
    );

    await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(newScrape.id).set(cleanData);

    logger.info('New temporary scrape created', {
      id: newScrape.id,
      url,
      sizeBytes: newScrape.sizeBytes,
      expiresAt: newScrape.expiresAt.toISOString(),
    });

    return { scrape: newScrape, isNew: true };
  } catch (error) {
    logger.error('Failed to save temporary scrape', error instanceof Error ? error : new Error(String(error)), {
      url: params.url,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to save temporary scrape: ${errorMessage}`);
  }
}

/**
 * Flag a temporary scrape for immediate deletion
 * 
 * Called after client verification in Training Center.
 * Flagged scrapes are deleted by cleanup job immediately.
 * 
 * @param scrapeId - ID of the scrape to flag
 * @throws Error if Firestore operation fails
 * 
 * @example
 * ```typescript
 * await flagScrapeForDeletion('scrape_123');
 * // Scrape will be deleted by cleanup job
 * ```
 */
export async function flagScrapeForDeletion(scrapeId: string): Promise<void> {
  try {
    await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrapeId).update({
      flaggedForDeletion: true,
      verified: true,
      verifiedAt: new Date(),
    });

    logger.info('Temporary scrape flagged for deletion', {
      scrapeId,
    });
  } catch (error) {
    logger.error('Failed to flag scrape for deletion', error instanceof Error ? error : new Error(String(error)), {
      scrapeId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to flag scrape for deletion: ${errorMessage}`);
  }
}

/**
 * Delete flagged scrapes immediately
 *
 * Called by cleanup job to remove scrapes flagged for deletion.
 * Processes up to 500 scrapes per batch (Firestore limit).
 *
 * @returns Number of scrapes deleted
 * @throws Error if Firestore operation fails
 * 
 * @example
 * ```typescript
 * const deleted = await deleteFlaggedScrapes('org_123');
 * console.log(`Deleted ${deleted} flagged scrapes`);
 * ```
 */
export async function deleteFlaggedScrapes(): Promise<number> {
  try {
    const flagged = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .where('flaggedForDeletion', '==', true)
      .limit(500) // Batch size
      .get();

    let deletedCount = 0;

    // Delete in batch for performance
    const batch = db.batch();
    flagged.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    await batch.commit();

    if (deletedCount > 0) {
      logger.info('Deleted flagged temporary scrapes', {
        deletedCount,
      });
    }

    return deletedCount;
  } catch (error) {
    logger.error('Failed to delete flagged scrapes', error instanceof Error ? error : new Error(String(error)));
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete flagged scrapes: ${errorMessage}`);
  }
}

/**
 * Delete expired scrapes (past expiresAt date)
 *
 * Fallback for when Firestore TTL is not available.
 * Should be called by Cloud Function on schedule (daily).
 *
 * @returns Number of scrapes deleted
 * @throws Error if Firestore operation fails
 */
export async function deleteExpiredScrapes(): Promise<number> {
  try {
    const now = new Date();

    const expired = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .where('expiresAt', '<=', now)
      .limit(500) // Batch size
      .get();

    let deletedCount = 0;

    const batch = db.batch();
    expired.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    await batch.commit();

    if (deletedCount > 0) {
      logger.info('Deleted expired temporary scrapes', {
        deletedCount,
      });
    }

    return deletedCount;
  } catch (error) {
    logger.error('Failed to delete expired scrapes', error instanceof Error ? error : new Error(String(error)));
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete expired scrapes: ${errorMessage}`);
  }
}

/**
 * Get temporary scrape by ID
 * 
 * @param scrapeId - ID of the scrape
 * @returns Scrape object or null if not found
 * @throws Error if Firestore operation fails
 */
export async function getTemporaryScrape(scrapeId: string): Promise<TemporaryScrape | null> {
  try {
    const doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrapeId).get();

    if (!doc.exists) {
      return null;
    }

    const raw = doc.data();
    if (!raw) {
      return null;
    }

    return {
      ...raw,
      createdAt: toDate(raw.createdAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
      lastSeen: toDate(raw.lastSeen as Date | FirestoreTimestamp | { seconds: number } | string | number),
      expiresAt: toDate(raw.expiresAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
      verifiedAt: raw.verifiedAt ? toDate(raw.verifiedAt as Date | FirestoreTimestamp | { seconds: number } | string | number) : undefined,
    } as TemporaryScrape;
  } catch (error) {
    logger.error('Failed to get temporary scrape', error instanceof Error ? error : new Error(String(error)), {
      scrapeId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get temporary scrape: ${errorMessage}`);
  }
}

/**
 * Get temporary scrape by content hash
 *
 * @param contentHash - SHA-256 content hash
 * @returns Scrape object or null if not found
 * @throws Error if Firestore operation fails
 */
export async function getTemporaryScrapeByHash(
  contentHash: string
): Promise<TemporaryScrape | null> {
  try {
    const docs = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .where('contentHash', '==', contentHash)
      .limit(1)
      .get();

    if (docs.empty) {
      return null;
    }

    const raw = docs.docs[0].data();
    return {
      id: docs.docs[0].id,
      ...raw,
      createdAt: toDate(raw.createdAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
      lastSeen: toDate(raw.lastSeen as Date | FirestoreTimestamp | { seconds: number } | string | number),
      expiresAt: toDate(raw.expiresAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
      verifiedAt: raw.verifiedAt ? toDate(raw.verifiedAt as Date | FirestoreTimestamp | { seconds: number } | string | number) : undefined,
    } as TemporaryScrape;
  } catch (error) {
    logger.error('Failed to get temporary scrape by hash', error instanceof Error ? error : new Error(String(error)), {
      contentHash: contentHash.substring(0, 16),
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get temporary scrape by hash: ${errorMessage}`);
  }
}

/**
 * Get temporary scrapes for a URL (for training UI)
 *
 * Returns most recent scrapes for a URL, ordered by creation date.
 *
 * @param url - URL to search for
 * @returns Array of scrapes (up to 10 most recent)
 * @throws Error if Firestore operation fails
 */
export async function getTemporaryScrapesByUrl(
  url: string
): Promise<TemporaryScrape[]> {
  try {
    const docs = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .where('url', '==', url)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    return docs.docs.map((doc) => {
      const raw = doc.data();
      return {
        ...raw,
        createdAt: toDate(raw.createdAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
        lastSeen: toDate(raw.lastSeen as Date | FirestoreTimestamp | { seconds: number } | string | number),
        expiresAt: toDate(raw.expiresAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
        verifiedAt: raw.verifiedAt ? toDate(raw.verifiedAt as Date | FirestoreTimestamp | { seconds: number } | string | number) : undefined,
      } as TemporaryScrape;
    });
  } catch (error) {
    logger.error('Failed to get temporary scrapes by URL', error instanceof Error ? error : new Error(String(error)), {
      url,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get temporary scrapes: ${errorMessage}`);
  }
}

// ============================================================================
// COST TRACKING
// ============================================================================

/**
 * Calculate storage cost estimate for an organization
 *
 * Provides current storage usage and projected savings with TTL architecture.
 *
 * @returns Cost analysis object
 * @throws Error if Firestore operation fails
 * 
 * @example
 * ```typescript
 * const cost = await calculateStorageCost('org_123');
 * console.log(`Current storage: ${cost.totalBytes / 1024 / 1024} MB`);
 * console.log(`Monthly cost: $${cost.estimatedMonthlyCostUSD}`);
 * console.log(`Savings with TTL: $${cost.projectedSavingsWithTTL}`);
 * ```
 */
export async function calculateStorageCost(): Promise<{
  totalScrapes: number;
  totalBytes: number;
  estimatedMonthlyCostUSD: number;
  projectedSavingsWithTTL: number;
}> {
  try {
    const scrapes = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .get();

    const totalBytes = scrapes.docs.reduce((sum, doc) => {
      const data = doc.data() as TemporaryScrape;
      return sum + data.sizeBytes;
    }, 0);

    // Firestore pricing: ~$0.18/GB/month
    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const estimatedMonthlyCostUSD = totalGB * FIRESTORE_COST_PER_GB_MONTHLY;

    // Without TTL, scrapes would grow indefinitely
    // Estimate: 100 scrapes/day × 30 days = 3000 scrapes
    // With TTL: only last 7 days = 700 scrapes
    // Savings: (3000 - 700) / 3000 = 76.7%
    const savingsPercentage = 0.767;
    const projectedSavingsWithTTL = estimatedMonthlyCostUSD * savingsPercentage;

    return {
      totalScrapes: scrapes.size,
      totalBytes,
      estimatedMonthlyCostUSD,
      projectedSavingsWithTTL,
    };
  } catch (error) {
    logger.error('Failed to calculate storage cost', error instanceof Error ? error : new Error(String(error)));
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to calculate storage cost: ${errorMessage}`);
  }
}

/**
 * Firestore Timestamp interface
 */
interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}

/**
 * Convert Firestore Timestamp to JavaScript Date
 * Firestore returns Timestamp objects, not Date objects
 */
function toDate(timestamp: Date | FirestoreTimestamp | { seconds: number } | string | number): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp && typeof (timestamp as FirestoreTimestamp).toDate === 'function') {
    return (timestamp as FirestoreTimestamp).toDate();
  }
  if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}

/**
 * Get storage statistics for monitoring
 *
 * @returns Statistics object
 */
export async function getStorageStats(): Promise<{
  totalScrapes: number;
  verifiedScrapes: number;
  flaggedForDeletion: number;
  averageSizeBytes: number;
  oldestScrape: Date | null;
  newestScrape: Date | null;
}> {
  try {
    const scrapes = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .get();

    const data = scrapes.docs.map((doc) => {
      const raw = doc.data();
      return {
        ...raw,
        createdAt: toDate(raw.createdAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
        lastSeen: toDate(raw.lastSeen as Date | FirestoreTimestamp | { seconds: number } | string | number),
        expiresAt: toDate(raw.expiresAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
        verifiedAt: raw.verifiedAt ? toDate(raw.verifiedAt as Date | FirestoreTimestamp | { seconds: number } | string | number) : undefined,
      } as TemporaryScrape;
    });

    const totalScrapes = data.length;
    const verifiedScrapes = data.filter((s) => s.verified).length;
    const flaggedForDeletion = data.filter((s) => s.flaggedForDeletion).length;
    const totalBytes = data.reduce((sum, s) => sum + s.sizeBytes, 0);
    const averageSizeBytes = totalScrapes > 0 ? totalBytes / totalScrapes : 0;

    const dates = data.map((s) => s.createdAt.getTime());
    const oldestScrape = dates.length > 0 ? new Date(Math.min(...dates)) : null;
    const newestScrape = dates.length > 0 ? new Date(Math.max(...dates)) : null;

    return {
      totalScrapes,
      verifiedScrapes,
      flaggedForDeletion,
      averageSizeBytes,
      oldestScrape,
      newestScrape,
    };
  } catch (error) {
    logger.error('Failed to get storage stats', error instanceof Error ? error : new Error(String(error)));
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get storage stats: ${errorMessage}`);
  }
}
