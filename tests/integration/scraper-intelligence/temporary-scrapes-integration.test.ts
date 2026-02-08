/**
 * Integration Tests for Temporary Scrapes Service
 *
 * These tests use REAL Firestore operations against the DEV database.
 * They create, read, update, and delete actual documents.
 *
 * IMPORTANT: All test data is cleaned up after each test.
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import { db } from '@/lib/firebase-admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import {
  saveTemporaryScrape,
  flagScrapeForDeletion,
  deleteFlaggedScrapes,
  deleteExpiredScrapes,
  getTemporaryScrape,
  getTemporaryScrapesByUrl,
  calculateStorageCost,
  getStorageStats,
} from '@/lib/scraper-intelligence/discovery-archive-service';
import type { TemporaryScrape } from '@/types/scraper-intelligence';

// ============================================================================
// TEST CONSTANTS
// ============================================================================

const TEST_ORG_ID = PLATFORM_ID;
const TEST_WORKSPACE_ID = 'test-workspace-scraper';
const TEMPORARY_SCRAPES_COLLECTION = 'temporary_scrapes';

// ============================================================================
// TEST DATA
// ============================================================================

const createTestScrapeData = (index: number = 1) => ({
  workspaceId: TEST_WORKSPACE_ID,
  url: `https://example.com/page${index}`,
  rawHtml: `<html><body><h1>Test Page ${index}</h1><p>Content for page ${index}</p></body></html>`,
  cleanedContent: `Test Page ${index}\nContent for page ${index}`,
  metadata: {
    title: `Test Page ${index}`,
    description: `Description for test page ${index}`,
    keywords: ['test', `page${index}`],
  },
  relatedRecordId: `lead-${index}`,
});

// ============================================================================
// CLEANUP UTILITIES
// ============================================================================

/**
 * Delete all test scrapes from Firestore
 */
async function cleanupTestScrapes() {
  const scrapes = await db
    .collection(TEMPORARY_SCRAPES_COLLECTION)
    .get();

  const batch = db.batch();
  scrapes.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  if (scrapes.size > 0) {
    await batch.commit();
    console.log(`[Cleanup] Deleted ${scrapes.size} test scrapes`);
  }
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Temporary Scrapes Service - Integration Tests', () => {
  // Cleanup before and after all tests
  beforeAll(async () => {
    await cleanupTestScrapes();
  });

  afterAll(async () => {
    await cleanupTestScrapes();
  });

  // Cleanup after each test to ensure isolation
  afterEach(async () => {
    await cleanupTestScrapes();
  });

  // ============================================================================
  // SAVE TEMPORARY SCRAPE
  // ============================================================================

  describe('saveTemporaryScrape', () => {
    it('should create new scrape on first save', async () => {
      const testData = createTestScrapeData(1);
      
      const { scrape, isNew } = await saveTemporaryScrape(testData);

      expect(isNew).toBe(true);
      expect(scrape.id).toBeDefined();
      expect(scrape.url).toBe(testData.url);
      expect(scrape.rawHtml).toBe(testData.rawHtml);
      expect(scrape.cleanedContent).toBe(testData.cleanedContent);
      expect(scrape.contentHash).toHaveLength(64); // SHA-256
      expect(scrape.scrapeCount).toBe(1);
      expect(scrape.verified).toBe(false);
      expect(scrape.flaggedForDeletion).toBe(false);
      expect(scrape.sizeBytes).toBeGreaterThan(0);
      expect(scrape.expiresAt).toBeInstanceOf(Date);
      
      // Verify it's actually in Firestore
      const doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape.id).get();
      expect(doc.exists).toBe(true);
    });

    it('should detect duplicate and update lastSeen', async () => {
      const testData = createTestScrapeData(1);
      
      // First save
      const { scrape: scrape1, isNew: isNew1 } = await saveTemporaryScrape(testData);
      expect(isNew1).toBe(true);
      expect(scrape1.scrapeCount).toBe(1);
      
      // Wait a bit to ensure timestamps differ
      await new Promise((resolve) => { setTimeout(resolve, 100); });
      
      // Second save with same content
      const { scrape: scrape2, isNew: isNew2 } = await saveTemporaryScrape(testData);
      expect(isNew2).toBe(false);
      expect(scrape2.id).toBe(scrape1.id); // Same document
      expect(scrape2.scrapeCount).toBe(2); // Incremented
      expect(scrape2.lastSeen.getTime()).toBeGreaterThan(scrape1.lastSeen.getTime());
      
      // Verify Firestore has updated data
      const doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape1.id).get();
      const data = doc.data() as TemporaryScrape;
      expect(data.scrapeCount).toBe(2);
    });

    it('should increment scrapeCount on duplicate', async () => {
      const testData = createTestScrapeData(1);
      
      // Save 5 times
      const scrapes: TemporaryScrape[] = [];
      for (let i = 0; i < 5; i++) {
        const { scrape } = await saveTemporaryScrape(testData);
        scrapes.push(scrape);
        await new Promise((resolve) => { setTimeout(resolve, 50); });
      }
      
      // All should have same ID (same document)
      const ids = new Set(scrapes.map(s => s.id));
      expect(ids.size).toBe(1);
      
      // Scrape count should be 5
      expect(scrapes[4].scrapeCount).toBe(5);
    });

    it('should create new scrape if content changes', async () => {
      const testData1 = createTestScrapeData(1);
      const testData2 = {
        ...testData1,
        rawHtml: '<html><body><h1>Different Content</h1></body></html>',
      };
      
      const { scrape: scrape1 } = await saveTemporaryScrape(testData1);
      const { scrape: scrape2 } = await saveTemporaryScrape(testData2);
      
      // Should be different documents
      expect(scrape1.id).not.toBe(scrape2.id);
      expect(scrape1.contentHash).not.toBe(scrape2.contentHash);
      
      // Both should exist in Firestore
      const docs = await db
        .collection(TEMPORARY_SCRAPES_COLLECTION)
        .get();
      expect(docs.size).toBe(2);
    });

    it('should calculate sizeBytes correctly', async () => {
      const testData = createTestScrapeData(1);
      const expectedSize = Buffer.byteLength(testData.rawHtml, 'utf8');
      
      const { scrape } = await saveTemporaryScrape(testData);
      
      expect(scrape.sizeBytes).toBe(expectedSize);
    });

    it('should set expiresAt to 7 days from now', async () => {
      const beforeCreate = new Date();
      const { scrape } = await saveTemporaryScrape(createTestScrapeData(1));
      const afterCreate = new Date();
      
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const expectedExpiration = beforeCreate.getTime() + sevenDaysMs;
      
      // Allow 5 second variance for test execution
      expect(scrape.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiration - 5000);
      expect(scrape.expiresAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + sevenDaysMs + 5000);
    });

    it('should handle multiple organizations separately', async () => {
      const org1Data = { ...createTestScrapeData(1), };
      const org2Data = { ...createTestScrapeData(1), };
      
      const { scrape: scrape1 } = await saveTemporaryScrape(org1Data);
      const { scrape: scrape2 } = await saveTemporaryScrape(org2Data);
      
      // Same content, different orgs → different documents
      expect(scrape1.id).not.toBe(scrape2.id);
      expect(scrape1.contentHash).toBe(scrape2.contentHash); // Same content
      
      // Cleanup org-1 and org-2 test data
      await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape1.id).delete();
      await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape2.id).delete();
    });
  });

  // ============================================================================
  // FLAG SCRAPE FOR DELETION
  // ============================================================================

  describe('flagScrapeForDeletion', () => {
    it('should flag scrape for deletion', async () => {
      const { scrape } = await saveTemporaryScrape(createTestScrapeData(1));
      
      await flagScrapeForDeletion(scrape.id);
      
      const doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape.id).get();
      const data = doc.data() as TemporaryScrape;
      
      expect(data.flaggedForDeletion).toBe(true);
    });

    it('should set verified to true', async () => {
      const { scrape } = await saveTemporaryScrape(createTestScrapeData(1));
      
      await flagScrapeForDeletion(scrape.id);
      
      const doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape.id).get();
      const data = doc.data() as TemporaryScrape;
      
      expect(data.verified).toBe(true);
    });

    it('should set verifiedAt timestamp', async () => {
      const before = new Date();
      const { scrape } = await saveTemporaryScrape(createTestScrapeData(1));
      
      await flagScrapeForDeletion(scrape.id);
      
      const doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape.id).get();
      const rawData = doc.data();
      const after = new Date();

      expect(rawData?.verifiedAt).toBeDefined();

      // Convert Firestore Timestamp to Date
      const verifiedAtValue = rawData?.verifiedAt;
      const verifiedAt = verifiedAtValue && typeof verifiedAtValue === 'object' && 'toDate' in verifiedAtValue
        ? (verifiedAtValue as { toDate: () => Date }).toDate()
        : new Date(verifiedAtValue as string | number | Date);
      
      expect(verifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(verifiedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ============================================================================
  // DELETE FLAGGED SCRAPES
  // ============================================================================

  describe('deleteFlaggedScrapes', () => {
    it('should delete all flagged scrapes', async () => {
      // Create 3 scrapes, flag 2 of them
      const scrapes = await Promise.all([
        saveTemporaryScrape(createTestScrapeData(1)),
        saveTemporaryScrape(createTestScrapeData(2)),
        saveTemporaryScrape(createTestScrapeData(3)),
      ]);
      
      await flagScrapeForDeletion(scrapes[0].scrape.id);
      await flagScrapeForDeletion(scrapes[1].scrape.id);
      
      const deletedCount = await deleteFlaggedScrapes();
      
      expect(deletedCount).toBe(2);
      
      // Verify only unflagged scrape remains
      const remaining = await db
        .collection(TEMPORARY_SCRAPES_COLLECTION)
        .get();

      expect(remaining.size).toBe(1);
      expect(remaining.docs[0].id).toBe(scrapes[2].scrape.id);
    });

    it('should return correct count of deleted scrapes', async () => {
      // Create 5 scrapes, flag all of them
      const scrapes = await Promise.all(
        Array.from({ length: 5 }, (_, i) => saveTemporaryScrape(createTestScrapeData(i + 1)))
      );
      
      await Promise.all(scrapes.map(({ scrape }) => flagScrapeForDeletion(scrape.id)));
      
      const deletedCount = await deleteFlaggedScrapes();
      
      expect(deletedCount).toBe(5);
    });

    it('should only delete scrapes for specified organization', async () => {
      // Create scrapes for two orgs
      const org1Scrape = await saveTemporaryScrape(createTestScrapeData(1));
      const org2Scrape = await saveTemporaryScrape({
        ...createTestScrapeData(2),
      });
      
      await flagScrapeForDeletion(org1Scrape.scrape.id);
      await flagScrapeForDeletion(org2Scrape.scrape.id);
      
      const deletedCount = await deleteFlaggedScrapes();
      
      expect(deletedCount).toBe(1);
      
      // Verify org2 scrape still exists
      const org2Doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(org2Scrape.scrape.id).get();
      expect(org2Doc.exists).toBe(true);
      
      // Cleanup
      await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(org2Scrape.scrape.id).delete();
    });

    it('should return 0 if no flagged scrapes exist', async () => {
      const deletedCount = await deleteFlaggedScrapes();
      expect(deletedCount).toBe(0);
    });
  });

  // ============================================================================
  // DELETE EXPIRED SCRAPES
  // ============================================================================

  describe('deleteExpiredScrapes', () => {
    it('should delete scrapes past expiresAt', async () => {
      // Create a scrape with expired date
      const { scrape } = await saveTemporaryScrape(createTestScrapeData(1));
      
      // Manually set expiration to past
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape.id).update({
        expiresAt: pastDate,
      });
      
      const deletedCount = await deleteExpiredScrapes();
      
      expect(deletedCount).toBe(1);
      
      // Verify scrape was deleted
      const doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape.id).get();
      expect(doc.exists).toBe(false);
    });

    it('should not delete scrapes before expiresAt', async () => {
      const { scrape } = await saveTemporaryScrape(createTestScrapeData(1));
      
      const deletedCount = await deleteExpiredScrapes();
      
      expect(deletedCount).toBe(0);
      
      // Verify scrape still exists
      const doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrape.id).get();
      expect(doc.exists).toBe(true);
    });

    it('should handle multiple expired scrapes', async () => {
      // Create 3 scrapes
      const scrapes = await Promise.all([
        saveTemporaryScrape(createTestScrapeData(1)),
        saveTemporaryScrape(createTestScrapeData(2)),
        saveTemporaryScrape(createTestScrapeData(3)),
      ]);
      
      // Expire first two
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await Promise.all([
        db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrapes[0].scrape.id).update({ expiresAt: pastDate }),
        db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrapes[1].scrape.id).update({ expiresAt: pastDate }),
      ]);
      
      const deletedCount = await deleteExpiredScrapes();
      
      expect(deletedCount).toBe(2);
      
      // Verify only unexpired scrape remains
      const remaining = await db
        .collection(TEMPORARY_SCRAPES_COLLECTION)
        .get();

      expect(remaining.size).toBe(1);
      expect(remaining.docs[0].id).toBe(scrapes[2].scrape.id);
    });
  });

  // ============================================================================
  // GET TEMPORARY SCRAPE
  // ============================================================================

  describe('getTemporaryScrape', () => {
    it('should return scrape by ID', async () => {
      const { scrape: created } = await saveTemporaryScrape(createTestScrapeData(1));
      
      const fetched = await getTemporaryScrape(created.id);
      
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.url).toBe(created.url);
      expect(fetched!.contentHash).toBe(created.contentHash);
    });

    it('should return null for non-existent ID', async () => {
      const fetched = await getTemporaryScrape('non-existent-id');
      
      expect(fetched).toBeNull();
    });
  });

  // ============================================================================
  // GET TEMPORARY SCRAPES BY URL
  // ============================================================================

  describe('getTemporaryScrapesByUrl', () => {
    it('should return scrapes for URL', async () => {
      const url = 'https://example.com/same-url';
      
      // Create 3 scrapes with same URL but different content
      await Promise.all([
        saveTemporaryScrape({ ...createTestScrapeData(1), url }),
        saveTemporaryScrape({ ...createTestScrapeData(2), url }),
        saveTemporaryScrape({ ...createTestScrapeData(3), url }),
      ]);
      
      const scrapes = await getTemporaryScrapesByUrl(url);

      expect(scrapes).toHaveLength(3);
      scrapes.forEach((scrape) => {
        expect(scrape.url).toBe(url);
      });
    });

    it('should return empty array for unknown URL', async () => {
      const scrapes = await getTemporaryScrapesByUrl('https://unknown.com');
      
      expect(scrapes).toEqual([]);
    });

    it('should limit results to 10', async () => {
      const url = 'https://example.com/many-scrapes';
      
      // Create 15 scrapes
      await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          saveTemporaryScrape({ ...createTestScrapeData(i + 1), url })
        )
      );
      
      const scrapes = await getTemporaryScrapesByUrl(url);
      
      expect(scrapes).toHaveLength(10);
    });

    it('should order by createdAt descending', async () => {
      const url = 'https://example.com/ordered';
      
      // Create scrapes with delays to ensure different timestamps
      for (let i = 1; i <= 3; i++) {
        await saveTemporaryScrape({ ...createTestScrapeData(i), url });
        await new Promise((resolve) => { setTimeout(resolve, 100); });
      }
      
      const scrapes = await getTemporaryScrapesByUrl(url);
      
      // Should be ordered newest first
      expect(scrapes[0].createdAt.getTime()).toBeGreaterThan(scrapes[1].createdAt.getTime());
      expect(scrapes[1].createdAt.getTime()).toBeGreaterThan(scrapes[2].createdAt.getTime());
    });
  });

  // ============================================================================
  // CALCULATE STORAGE COST
  // ============================================================================

  describe('calculateStorageCost', () => {
    it('should calculate total bytes correctly', async () => {
      const testData = createTestScrapeData(1);
      const expectedSize = Buffer.byteLength(testData.rawHtml, 'utf8');
      
      await saveTemporaryScrape(testData);
      
      const cost = await calculateStorageCost();
      
      expect(cost.totalBytes).toBe(expectedSize);
      expect(cost.totalScrapes).toBe(1);
    });

    it('should estimate monthly cost', async () => {
      await saveTemporaryScrape(createTestScrapeData(1));
      
      const cost = await calculateStorageCost();
      
      expect(cost.estimatedMonthlyCostUSD).toBeGreaterThan(0);
      expect(cost.estimatedMonthlyCostUSD).toBeLessThan(1); // Should be very small for one scrape
    });

    it('should project savings with TTL', async () => {
      await saveTemporaryScrape(createTestScrapeData(1));
      
      const cost = await calculateStorageCost();
      
      expect(cost.projectedSavingsWithTTL).toBeGreaterThan(0);
      // Savings should be ~76.7% of monthly cost
      expect(cost.projectedSavingsWithTTL).toBeGreaterThan(cost.estimatedMonthlyCostUSD * 0.7);
    });

    it('should return zero for no scrapes', async () => {
      const cost = await calculateStorageCost();
      
      expect(cost.totalScrapes).toBe(0);
      expect(cost.totalBytes).toBe(0);
      expect(cost.estimatedMonthlyCostUSD).toBe(0);
      expect(cost.projectedSavingsWithTTL).toBe(0);
    });
  });

  // ============================================================================
  // GET STORAGE STATS
  // ============================================================================

  describe('getStorageStats', () => {
    it('should return accurate statistics', async () => {
      // Create 3 scrapes, verify 1
      const scrapes = await Promise.all([
        saveTemporaryScrape(createTestScrapeData(1)),
        saveTemporaryScrape(createTestScrapeData(2)),
        saveTemporaryScrape(createTestScrapeData(3)),
      ]);
      
      await flagScrapeForDeletion(scrapes[0].scrape.id);
      
      const stats = await getStorageStats();
      
      expect(stats.totalScrapes).toBe(3);
      expect(stats.verifiedScrapes).toBe(1);
      expect(stats.flaggedForDeletion).toBe(1);
    });

    it('should calculate average size correctly', async () => {
      const data1 = createTestScrapeData(1);
      const data2 = createTestScrapeData(2);
      
      await saveTemporaryScrape(data1);
      await saveTemporaryScrape(data2);
      
      const size1 = Buffer.byteLength(data1.rawHtml, 'utf8');
      const size2 = Buffer.byteLength(data2.rawHtml, 'utf8');
      const expectedAvg = (size1 + size2) / 2;
      
      const stats = await getStorageStats();
      
      expect(stats.averageSizeBytes).toBe(expectedAvg);
    });

    it('should find oldest and newest scrapes', async () => {
      const scrape1 = await saveTemporaryScrape(createTestScrapeData(1));
      await new Promise((resolve) => { setTimeout(resolve, 100); });
      await saveTemporaryScrape(createTestScrapeData(2));
      await new Promise((resolve) => { setTimeout(resolve, 100); });
      const scrape3 = await saveTemporaryScrape(createTestScrapeData(3));
      
      const stats = await getStorageStats();
      
      expect(stats.oldestScrape).not.toBeNull();
      expect(stats.newestScrape).not.toBeNull();
      expect(stats.oldestScrape!.getTime()).toBeCloseTo(scrape1.scrape.createdAt.getTime(), -2);
      expect(stats.newestScrape!.getTime()).toBeCloseTo(scrape3.scrape.createdAt.getTime(), -2);
    });
  });
});
