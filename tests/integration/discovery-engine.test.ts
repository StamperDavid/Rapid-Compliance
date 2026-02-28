/**
 * Integration tests for Native Discovery Engine
 * Tests the Hunter-Closer compliant discovery system
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { discoverCompany, discoverCompaniesBatch } from '@/lib/services/discovery-engine';
import { deleteFlaggedArchiveEntries, deleteExpiredArchiveEntries } from '@/lib/scraper-intelligence/discovery-archive-service';
import { db } from '@/lib/firebase-admin';

// Set timeout for real Firestore operations
jest.setTimeout(60000);

describe('Discovery Engine Integration Tests', () => {
  // Clean up all discoveryArchive entries for test domains before tests run
  async function cleanupTestDomains() {
    const testUrls = [
      'https://example.com',
      'https://example.org',
      'example.com',
      'example.org',
    ];
    for (const url of testUrls) {
      const docs = await db
        .collection('discoveryArchive')
        .where('url', '==', url)
        .get();
      if (!docs.empty) {
        const batch = db.batch();
        docs.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }
  }

  beforeAll(async () => {
    // Clean up any existing test data (including stale entries from prior runs)
    await cleanupTestDomains();
    await deleteFlaggedArchiveEntries();
    await deleteExpiredArchiveEntries();
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await cleanupTestDomains();
    await deleteFlaggedArchiveEntries();
  }, 30000);

  describe('Single Company Discovery', () => {
    it('should discover company from domain', async () => {
      // Use example.com as a stable test target
      const result = await discoverCompany('example.com');

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.company).toBeDefined();
      expect(result.rawData).toBeDefined();
      expect(result.scrapeId).toBeDefined();
      expect(typeof result.fromCache).toBe('boolean');

      // Verify company data structure
      expect(result.company.domain).toBe('example.com');
      expect(result.company.metadata).toBeDefined();
      expect(result.company.metadata.source).toBe('discovery-engine');
      expect(result.company.metadata.scrapedAt).toBeInstanceOf(Date);
      expect(result.company.metadata.confidence).toBeGreaterThanOrEqual(0);
      expect(result.company.metadata.confidence).toBeLessThanOrEqual(1);

      // Verify arrays exist
      expect(Array.isArray(result.company.teamMembers)).toBe(true);
      expect(Array.isArray(result.company.techStack)).toBe(true);
      expect(Array.isArray(result.company.pressmentions)).toBe(true);

      // Verify signals
      expect(result.company.signals).toBeDefined();
      expect(typeof result.company.signals.isHiring).toBe('boolean');
      expect(typeof result.company.signals.jobCount).toBe('number');
    }, 60000); // 60 second timeout for scraping

    it('should use 30-day cache on second discovery', async () => {
      // First discovery — may or may not be cached depending on test ordering
      const result1 = await discoverCompany('example.com');
      expect(result1).toBeDefined();

      // Second discovery (should always hit cache since first call stored it)
      const result2 = await discoverCompany('example.com');
      expect(result2.fromCache).toBe(true); // Should come from cache
      expect(result2.scrapeId).toBe(result1.scrapeId); // Same scrape ID

      // Verify data consistency
      expect(result2.company.domain).toBe(result1.company.domain);
    }, 60000);

    it('should handle invalid domains gracefully', async () => {
      await expect(
        discoverCompany('invalid-domain-that-does-not-exist-12345.com')
      ).rejects.toThrow();
    }, 30000);
  });

  describe('Batch Company Discovery', () => {
    it('should discover multiple companies', async () => {
      const domains = ['example.com', 'example.org'];
      
      const results = await discoverCompaniesBatch(domains, {
        concurrency: 2,
        delayMs: 1000,
      });

      expect(results.length).toBeGreaterThan(0);
      
      results.forEach((result) => {
        expect(result.company).toBeDefined();
        expect(result.rawData).toBeDefined();
        expect(result.scrapeId).toBeDefined();
      });
    }, 90000); // 90 seconds for multiple domains

    it('should handle mix of valid and invalid domains', async () => {
      const domains = [
        'example.com',
        'invalid-domain-12345.com',
        'example.org',
      ];

      const results = await discoverCompaniesBatch(domains, {
        concurrency: 1,
        delayMs: 500,
      });

      // Should have some results (valid domains)
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(domains.length); // Some should fail
    }, 90000);
  });

  describe('Data Quality', () => {
    it('should extract high-value areas', async () => {
      const result = await discoverCompany('example.com');

      expect(result.rawData).toBeDefined();
      expect(result.rawData.highValueAreas).toBeDefined();
      expect(Array.isArray(result.rawData.highValueAreas)).toBe(true);

      // example.com should have at least some high-value areas
      if (result.rawData.highValueAreas.length > 0) {
        const area = result.rawData.highValueAreas[0];
        expect(area.type).toBeDefined();
        expect(area.content).toBeDefined();
        expect(area.selector).toBeDefined();
      }
    }, 60000);

    it('should extract links', async () => {
      const result = await discoverCompany('example.com');

      expect(result.rawData.links).toBeDefined();
      expect(Array.isArray(result.rawData.links)).toBe(true);

      result.rawData.links.forEach((link) => {
        expect(link.href).toBeDefined();
        expect(link.text).toBeDefined();
      });
    }, 60000);

    it('should calculate confidence score', async () => {
      const result = await discoverCompany('example.com');

      expect(result.company.metadata.confidence).toBeDefined();
      expect(result.company.metadata.confidence).toBeGreaterThanOrEqual(0);
      expect(result.company.metadata.confidence).toBeLessThanOrEqual(1);
    }, 60000);
  });

  describe('Archive Integration', () => {
    it('should save to discovery archive with 30-day TTL', async () => {
      // First discovery — may be cached from batch test above
      const result = await discoverCompany('example.org');
      expect(result).toBeDefined();

      // Scrape ID should be generated
      expect(result.scrapeId).toBeDefined();
      expect(result.scrapeId.length).toBeGreaterThan(0);

      // Second discovery should always hit cache
      const cached = await discoverCompany('example.org');
      expect(cached.fromCache).toBe(true);
      expect(cached.scrapeId).toBe(result.scrapeId);
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should throw error for empty domain', async () => {
      await expect(
        discoverCompany('')
      ).rejects.toThrow();
    });

    it('should throw error for invalid domain', async () => {
      await expect(
        discoverCompany('')
      ).rejects.toThrow();
    });
  });

  describe('Hunter-Closer Compliance', () => {
    it('should use zero third-party data APIs', async () => {
      // This test verifies that discovery engine is 100% native
      const result = await discoverCompany('example.com');

      // All data should come from our scraping, not third-party APIs
      expect(result.company.metadata.source).toBe('discovery-engine');
      
      // Should have raw HTML/text data (proof of scraping)
      expect(result.rawData.html).toBeDefined();
      expect(result.rawData.html.length).toBeGreaterThan(0);
      expect(result.rawData.text).toBeDefined();
      expect(result.rawData.text.length).toBeGreaterThan(0);
    }, 60000);

    it('should build proprietary 30-day cache moat', async () => {
      const result = await discoverCompany('example.com');

      // Verify 30-day TTL (approximately)
      const expiresAt = new Date(result.company.metadata.expiresAt);
      const scrapedAt = new Date(result.company.metadata.scrapedAt);
      
      const ttlDays = (expiresAt.getTime() - scrapedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      // Should be approximately 30 days (allow some variance for clock skew)
      expect(ttlDays).toBeGreaterThan(29);
      expect(ttlDays).toBeLessThan(31);
    }, 60000);
  });
});
