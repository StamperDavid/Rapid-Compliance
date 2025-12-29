/**
 * Discovery Archive Service
 * 
 * Manages discovery archive storage with TTL (Time-To-Live) architecture.
 * Implements content hashing for duplicate detection and cost optimization.
 * 
 * THIS IS THE PROPRIETARY "MOAT" - 30-day cached discovery data.
 * 
 * Key Features:
 * - Auto-delete raw scrapes after 30 days (Firestore TTL)
 * - Content hashing (SHA-256) to avoid duplicate storage
 * - Storage cost tracking and projections
 * - Flagging for immediate deletion after verification
 * 
 * Per Hunter-Closer Directive:
 * - This is our proprietary discovery asset
 * - Replaces third-party data dependencies (Clearbit, ZoomInfo, Apollo)
 * - 30-day cache reduces token costs and builds competitive moat
 */

import { db } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';
import crypto from 'crypto';
import type { TemporaryScrape, ExtractedSignal } from '@/types/scraper-intelligence';

// ============================================================================
// CONSTANTS
// ============================================================================

const DISCOVERY_ARCHIVE_COLLECTION = 'discoveryArchive';
const TTL_DAYS = 30; // Updated from 7 to 30 per Hunter-Closer directive
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
 * Calculate expiration date (now + 30 days)
 * 
 * @returns Date object representing 30 days from now
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
 * Save or update a discovery archive entry with duplicate detection
 * 
 * If content with same hash exists, updates lastSeen and scrapeCount.
 * Otherwise, creates new discovery archive entry with 30-day TTL.
 * 
 * @param params - Scrape parameters
 * @returns Object with scrape and isNew flag
 * 
 * @throws Error if Firestore operation fails
 * 
 * @example
 * ```typescript
 * const { scrape, isNew } = await saveToDiscoveryArchive({
 *   organizationId: 'org_123',
 *   url: 'https://example.com',
 *   rawHtml: '<html>...</html>',
 *   cleanedContent: 'Cleaned text',
 *   metadata: { title: 'Example' }
 * });
 * 
 * if (isNew) {
 *   console.log('New discovery created');
 * } else {
 *   console.log('Duplicate detected, updated lastSeen');
 * }
 * ```
 */
export async function saveToDiscoveryArchive(params: {
  organizationId: string;
  workspaceId?: string;
  url: string;
  rawHtml: string;
  cleanedContent: string;
  metadata: TemporaryScrape['metadata'];
  relatedRecordId?: string;
}): Promise<{ scrape: TemporaryScrape; isNew: boolean }> {
  try {
    const { organizationId, workspaceId, url, rawHtml, cleanedContent, metadata, relatedRecordId } = params;

    // Calculate content hash for duplicate detection
    const contentHash = calculateContentHash(rawHtml);

    // Check if this exact content already exists for this organization (30-day cache)
    const existing = await db
      .collection(DISCOVERY_ARCHIVE_COLLECTION)
      .where('organizationId', '==', organizationId)
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

      logger.info('Discovery archive hit (duplicate detected)', {
        url,
        contentHash,
        scrapeCount: existingData.scrapeCount + 1,
        organizationId,
        message: 'Serving from 30-day cache - cost savings achieved',
      });

      return {
        scrape: { ...existingData, ...updated } as TemporaryScrape,
        isNew: false,
      };
    }

    // New content - create new discovery archive entry
    const now = new Date();
    const newScrape: TemporaryScrape = {
      id: db.collection(DISCOVERY_ARCHIVE_COLLECTION).doc().id,
      organizationId,
      workspaceId,
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
      Object.entries(newScrape).filter(([_, v]) => v !== undefined)
    );

    await db.collection(DISCOVERY_ARCHIVE_COLLECTION).doc(newScrape.id).set(cleanData);

    logger.info('New discovery archive entry created', {
      id: newScrape.id,
      url,
      sizeBytes: newScrape.sizeBytes,
      expiresAt: newScrape.expiresAt.toISOString(),
      organizationId,
      message: 'Cached for 30 days - building proprietary moat',
    });

    return { scrape: newScrape, isNew: true };
  } catch (error) {
    logger.error('Failed to save to discovery archive', error, {
      organizationId: params.organizationId,
      url: params.url,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to save to discovery archive: ${errorMessage}`);
  }
}

/**
 * Flag a discovery archive entry for immediate deletion
 * 
 * Called after client verification in Training Center.
 * Flagged entries are deleted by cleanup job immediately.
 * 
 * @param scrapeId - ID of the scrape to flag
 * @throws Error if Firestore operation fails
 * 
 * @example
 * ```typescript
 * await flagArchiveEntryForDeletion('scrape_123');
 * // Entry will be deleted by cleanup job
 * ```
 */
export async function flagArchiveEntryForDeletion(scrapeId: string): Promise<void> {
  try {
    await db.collection(DISCOVERY_ARCHIVE_COLLECTION).doc(scrapeId).update({
      flaggedForDeletion: true,
      verified: true,
      verifiedAt: new Date(),
    });

    logger.info('Discovery archive entry flagged for deletion', {
      scrapeId,
    });
  } catch (error) {
    logger.error('Failed to flag archive entry for deletion', error, {
      scrapeId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to flag archive entry for deletion: ${errorMessage}`);
  }
}

/**
 * Delete flagged entries immediately
 * 
 * Called by cleanup job to remove entries flagged for deletion.
 * Processes up to 500 entries per batch (Firestore limit).
 * 
 * @param organizationId - Organization ID to filter entries
 * @returns Number of entries deleted
 * @throws Error if Firestore operation fails
 * 
 * @example
 * ```typescript
 * const deleted = await deleteFlaggedArchiveEntries('org_123');
 * console.log(`Deleted ${deleted} flagged entries`);
 * ```
 */
export async function deleteFlaggedArchiveEntries(organizationId: string): Promise<number> {
  try {
    const flagged = await db
      .collection(DISCOVERY_ARCHIVE_COLLECTION)
      .where('organizationId', '==', organizationId)
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
      logger.info('Deleted flagged discovery archive entries', {
        deletedCount,
        organizationId,
      });
    }

    return deletedCount;
  } catch (error) {
    logger.error('Failed to delete flagged archive entries', error, {
      organizationId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete flagged archive entries: ${errorMessage}`);
  }
}

/**
 * Delete expired entries (past expiresAt date)
 * 
 * Fallback for when Firestore TTL is not available.
 * Should be called by Cloud Function on schedule (daily).
 * 
 * @param organizationId - Organization ID to filter entries
 * @returns Number of entries deleted
 * @throws Error if Firestore operation fails
 */
export async function deleteExpiredArchiveEntries(organizationId: string): Promise<number> {
  try {
    const now = new Date();
    
    const expired = await db
      .collection(DISCOVERY_ARCHIVE_COLLECTION)
      .where('organizationId', '==', organizationId)
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
      logger.info('Deleted expired discovery archive entries', {
        deletedCount,
        organizationId,
      });
    }

    return deletedCount;
  } catch (error) {
    logger.error('Failed to delete expired archive entries', error, {
      organizationId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete expired archive entries: ${errorMessage}`);
  }
}

/**
 * Get discovery archive entry by ID
 * 
 * @param scrapeId - ID of the entry
 * @returns Entry object or null if not found
 * @throws Error if Firestore operation fails
 */
export async function getFromDiscoveryArchive(scrapeId: string): Promise<TemporaryScrape | null> {
  try {
    const doc = await db.collection(DISCOVERY_ARCHIVE_COLLECTION).doc(scrapeId).get();

    if (!doc.exists) {
      return null;
    }

    const raw = doc.data();
    if (!raw) {
      return null;
    }

    return {
      ...raw,
      createdAt: toDate(raw.createdAt),
      lastSeen: toDate(raw.lastSeen),
      expiresAt: toDate(raw.expiresAt),
      verifiedAt: raw.verifiedAt ? toDate(raw.verifiedAt) : undefined,
    } as TemporaryScrape;
  } catch (error) {
    logger.error('Failed to get from discovery archive', error, {
      scrapeId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get from discovery archive: ${errorMessage}`);
  }
}

/**
 * Get discovery archive entry by content hash
 * 
 * @param organizationId - Organization ID
 * @param contentHash - SHA-256 content hash
 * @returns Entry object or null if not found
 * @throws Error if Firestore operation fails
 */
export async function getFromDiscoveryArchiveByHash(
  organizationId: string,
  contentHash: string
): Promise<TemporaryScrape | null> {
  try {
    const docs = await db
      .collection(DISCOVERY_ARCHIVE_COLLECTION)
      .where('organizationId', '==', organizationId)
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
      createdAt: toDate(raw.createdAt),
      lastSeen: toDate(raw.lastSeen),
      expiresAt: toDate(raw.expiresAt),
      verifiedAt: raw.verifiedAt ? toDate(raw.verifiedAt) : undefined,
    } as TemporaryScrape;
  } catch (error) {
    logger.error('Failed to get from discovery archive by hash', error, {
      organizationId,
      contentHash: contentHash.substring(0, 16),
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get from discovery archive by hash: ${errorMessage}`);
  }
}

/**
 * Get discovery archive entries for a URL (for training UI)
 * 
 * Returns most recent entries for a URL, ordered by creation date.
 * 
 * @param organizationId - Organization ID
 * @param url - URL to search for
 * @returns Array of entries (up to 10 most recent)
 * @throws Error if Firestore operation fails
 */
export async function getFromDiscoveryArchiveByUrl(
  organizationId: string,
  url: string
): Promise<TemporaryScrape[]> {
  try {
    const docs = await db
      .collection(DISCOVERY_ARCHIVE_COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('url', '==', url)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    return docs.docs.map((doc) => {
      const raw = doc.data();
      return {
        ...raw,
        createdAt: toDate(raw.createdAt),
        lastSeen: toDate(raw.lastSeen),
        expiresAt: toDate(raw.expiresAt),
        verifiedAt: raw.verifiedAt ? toDate(raw.verifiedAt) : undefined,
      } as TemporaryScrape;
    });
  } catch (error) {
    logger.error('Failed to get from discovery archive by URL', error, {
      organizationId,
      url,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get from discovery archive: ${errorMessage}`);
  }
}

// ============================================================================
// COST TRACKING
// ============================================================================

/**
 * Calculate storage cost estimate for an organization
 * 
 * Provides current storage usage and projected savings with 30-day TTL architecture.
 * 
 * @param organizationId - Organization ID
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
export async function calculateStorageCost(organizationId: string): Promise<{
  totalScrapes: number;
  totalBytes: number;
  estimatedMonthlyCostUSD: number;
  projectedSavingsWithTTL: number;
}> {
  try {
    const scrapes = await db
      .collection(DISCOVERY_ARCHIVE_COLLECTION)
      .where('organizationId', '==', organizationId)
      .get();

    const totalBytes = scrapes.docs.reduce((sum, doc) => {
      const data = doc.data() as TemporaryScrape;
      return sum + data.sizeBytes;
    }, 0);

    // Firestore pricing: ~$0.18/GB/month
    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const estimatedMonthlyCostUSD = totalGB * FIRESTORE_COST_PER_GB_MONTHLY;

    // Without TTL, scrapes would grow indefinitely
    // Estimate: 100 scrapes/day × 365 days = 36,500 scrapes
    // With 30-day TTL: only last 30 days = 3,000 scrapes
    // Savings: (36,500 - 3,000) / 36,500 = 91.8%
    const savingsPercentage = 0.918;
    const projectedSavingsWithTTL = estimatedMonthlyCostUSD * savingsPercentage;

    return {
      totalScrapes: scrapes.size,
      totalBytes,
      estimatedMonthlyCostUSD,
      projectedSavingsWithTTL,
    };
  } catch (error) {
    logger.error('Failed to calculate storage cost', error, {
      organizationId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to calculate storage cost: ${errorMessage}`);
  }
}

/**
 * Convert Firestore Timestamp to JavaScript Date
 * Firestore returns Timestamp objects, not Date objects
 */
function toDate(timestamp: any): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp && timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}

/**
 * Get storage statistics for monitoring
 * 
 * @param organizationId - Organization ID
 * @returns Statistics object
 */
export async function getStorageStats(organizationId: string): Promise<{
  totalScrapes: number;
  verifiedScrapes: number;
  flaggedForDeletion: number;
  averageSizeBytes: number;
  oldestScrape: Date | null;
  newestScrape: Date | null;
}> {
  try {
    const scrapes = await db
      .collection(DISCOVERY_ARCHIVE_COLLECTION)
      .where('organizationId', '==', organizationId)
      .get();

    const data = scrapes.docs.map((doc) => {
      const raw = doc.data();
      return {
        ...raw,
        createdAt: toDate(raw.createdAt),
        lastSeen: toDate(raw.lastSeen),
        expiresAt: toDate(raw.expiresAt),
        verifiedAt: raw.verifiedAt ? toDate(raw.verifiedAt) : undefined,
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
    logger.error('Failed to get storage stats', error, {
      organizationId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get storage stats: ${errorMessage}`);
  }
}

// Backward compatibility exports (deprecated - use new names)
/** @deprecated Use saveToDiscoveryArchive instead */
export const saveTemporaryScrape = saveToDiscoveryArchive;
/** @deprecated Use getFromDiscoveryArchive instead */
export const getTemporaryScrape = getFromDiscoveryArchive;
/** @deprecated Use getFromDiscoveryArchiveByHash instead */
export const getTemporaryScrapeByHash = getFromDiscoveryArchiveByHash;
/** @deprecated Use getFromDiscoveryArchiveByUrl instead */
export const getTemporaryScrapesByUrl = getFromDiscoveryArchiveByUrl;
/** @deprecated Use flagArchiveEntryForDeletion instead */
export const flagScrapeForDeletion = flagArchiveEntryForDeletion;
/** @deprecated Use deleteFlaggedArchiveEntries instead */
export const deleteFlaggedScrapes = deleteFlaggedArchiveEntries;
/** @deprecated Use deleteExpiredArchiveEntries instead */
export const deleteExpiredScrapes = deleteExpiredArchiveEntries;
