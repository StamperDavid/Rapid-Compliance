/**
 * Integration tests for Distillation Engine
 * 
 * Tests the end-to-end distillation flow with REAL Firestore operations.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import {
  distillScrape,
  distillBatch,
} from '@/lib/scraper-intelligence/distillation-engine';
import {
  getTemporaryScrape,
  deleteFlaggedScrapes,
  deleteExpiredScrapes,
} from '@/lib/scraper-intelligence/discovery-archive-service';
import type {
  ResearchIntelligence,
  ScrapingPlatform,
} from '@/types/scraper-intelligence';
import { db } from '@/lib/firebase-admin';

describe('Distillation Engine Integration Tests', () => {
  const TEST_ORG_ID = 'test-org-distillation';
  const TEST_WORKSPACE_ID = 'test-workspace';
  const TEMPORARY_SCRAPES_COLLECTION = 'temporary_scrapes';

  // Cleanup after each test
  afterEach(async () => {
    try {
      const scrapes = await db
        .collection(TEMPORARY_SCRAPES_COLLECTION)
        .where('organizationId', '==', TEST_ORG_ID)
        .get();

      const batch = db.batch();
      scrapes.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  // Mock research intelligence for HVAC industry
  const mockResearch: ResearchIntelligence = {
    scrapingStrategy: {
      primarySource: 'website',
      secondarySources: ['linkedin-jobs'],
      frequency: 'per-lead',
      enableCaching: true,
      cacheTtlSeconds: 3600,
    },
    highValueSignals: [
      {
        id: 'emergency-service',
        label: 'Emergency Service',
        description: '24/7 emergency HVAC service',
        keywords: ['24/7', 'emergency', 'emergency service', 'urgent repair'],
        platform: 'any',
        priority: 'CRITICAL',
        action: 'increase-score',
        scoreBoost: 30,
      },
      {
        id: 'hiring',
        label: 'Hiring',
        description: 'Actively hiring technicians',
        keywords: ['hiring', "we're hiring", 'join our team', 'careers'],
        platform: 'any',
        priority: 'HIGH',
        action: 'increase-score',
        scoreBoost: 25,
      },
      {
        id: 'expansion',
        label: 'Expansion',
        description: 'Opening new locations',
        keywords: ['new location', 'expansion', 'opening soon'],
        platform: 'any',
        priority: 'MEDIUM',
        action: 'increase-score',
        scoreBoost: 15,
      },
    ],
    fluffPatterns: [
      {
        id: 'copyright',
        pattern: '©.*All rights reserved',
        description: 'Copyright notice',
      },
      {
        id: 'privacy',
        pattern: 'Privacy Policy|Terms of Service',
        description: 'Legal links',
      },
    ],
    scoringRules: [
      {
        id: 'careers-page',
        name: 'Has Careers Page',
        description: 'Bonus for careers page',
        condition: 'careersPageExists == true',
        scoreBoost: 10,
        priority: 1,
        enabled: true,
      },
    ],
    customFields: [],
    metadata: {
      lastUpdated: new Date(),
      version: 1,
      updatedBy: 'system',
    },
  };

  describe('distillScrape', () => {
    it('should distill scrape and save to Firestore', async () => {
      const rawHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>ABC HVAC Company</title></head>
          <body>
            <h1>ABC HVAC - 24/7 Emergency Service</h1>
            <p>We provide professional HVAC services with emergency response available 24/7.</p>
            <p>We're hiring experienced HVAC technicians! Join our growing team.</p>
            <footer>© 2025 ABC HVAC. All rights reserved. Privacy Policy</footer>
          </body>
        </html>
      `;

      const cleanedContent = `
        ABC HVAC - 24/7 Emergency Service
        We provide professional HVAC services with emergency response available 24/7.
        We're hiring experienced HVAC technicians! Join our growing team.
        © 2025 ABC HVAC. All rights reserved. Privacy Policy
      `;

      const result = await distillScrape({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        url: 'https://abchvac.example.com',
        rawHtml,
        cleanedContent,
        metadata: {
          title: 'ABC HVAC Company',
          description: 'Professional HVAC services',
        },
        research: mockResearch,
        platform: 'website',
      });

      // Verify signals detected
      expect(result.signals.length).toBeGreaterThanOrEqual(2);
      
      const emergencySignal = result.signals.find(
        (s) => s.signalId === 'emergency-service'
      );
      expect(emergencySignal).toBeDefined();
      expect(emergencySignal?.confidence).toBeGreaterThan(0);

      const hiringSignal = result.signals.find((s) => s.signalId === 'hiring');
      expect(hiringSignal).toBeDefined();

      // Verify temporary scrape saved
      expect(result.tempScrapeId).toBeDefined();
      expect(result.isNewScrape).toBe(true);

      // Verify scrape exists in Firestore
      const scrape = await getTemporaryScrape(result.tempScrapeId);
      expect(scrape).not.toBeNull();
      expect(scrape?.url).toBe('https://abchvac.example.com');
      expect(scrape?.organizationId).toBe(TEST_ORG_ID);
      
      // Verify fluff was removed
      expect(scrape?.cleanedContent).not.toContain('© 2025');
      expect(scrape?.cleanedContent).not.toContain('Privacy Policy');

      // Verify storage reduction
      expect(result.storageReduction.rawSizeBytes).toBeGreaterThan(0);
      expect(result.storageReduction.signalsSizeBytes).toBeLessThan(
        result.storageReduction.rawSizeBytes
      );
      expect(result.storageReduction.reductionPercent).toBeGreaterThan(90);
    }, 30000);

    it('should detect duplicate content and update lastSeen', async () => {
      const params = {
        organizationId: TEST_ORG_ID,
        url: 'https://duplicate.example.com',
        rawHtml: '<html><body>Test content</body></html>',
        cleanedContent: 'Test content',
        metadata: { title: 'Test' },
        research: mockResearch,
        platform: 'website' as ScrapingPlatform,
      };

      // First distillation
      const result1 = await distillScrape(params);
      expect(result1.isNewScrape).toBe(true);

      // Second distillation with same content
      const result2 = await distillScrape(params);
      expect(result2.isNewScrape).toBe(false);
      expect(result2.tempScrapeId).toBe(result1.tempScrapeId); // Same scrape ID

      // Verify scrape count incremented
      const scrape = await getTemporaryScrape(result2.tempScrapeId);
      expect(scrape?.scrapeCount).toBe(2);
    }, 30000);

    it('should create new scrape when content changes', async () => {
      const baseParams = {
        organizationId: TEST_ORG_ID,
        url: 'https://changing.example.com',
        metadata: { title: 'Test' },
        research: mockResearch,
        platform: 'website' as ScrapingPlatform,
      };

      // First scrape
      const result1 = await distillScrape({
        ...baseParams,
        rawHtml: '<html><body>Version 1</body></html>',
        cleanedContent: 'Version 1',
      });

      // Second scrape with different content
      const result2 = await distillScrape({
        ...baseParams,
        rawHtml: '<html><body>Version 2</body></html>',
        cleanedContent: 'Version 2',
      });

      expect(result1.tempScrapeId).not.toBe(result2.tempScrapeId);
      expect(result2.isNewScrape).toBe(true);
    }, 30000);

    it('should link signals to correct temporary scrape', async () => {
      const rawHtml = '<html><body>We offer 24/7 emergency service</body></html>';
      const cleanedContent = 'We offer 24/7 emergency service';

      const result = await distillScrape({
        organizationId: TEST_ORG_ID,
        url: 'https://test.example.com',
        rawHtml,
        cleanedContent,
        metadata: { title: 'Test' },
        research: mockResearch,
        platform: 'website',
      });

      // All signals should reference the temporary scrape
      for (const signal of result.signals) {
        expect(signal.sourceScrapeId).toBe(result.tempScrapeId);
      }
    }, 30000);

    it('should handle scrapes with no detected signals', async () => {
      const rawHtml = '<html><body>Generic company information</body></html>';
      const cleanedContent = 'Generic company information';

      const result = await distillScrape({
        organizationId: TEST_ORG_ID,
        url: 'https://generic.example.com',
        rawHtml,
        cleanedContent,
        metadata: { title: 'Generic' },
        research: mockResearch,
        platform: 'website',
      });

      expect(result.signals.length).toBe(0);
      expect(result.tempScrapeId).toBeDefined(); // Still saves temporary scrape
    }, 30000);
  });

  describe('distillBatch', () => {
    it('should distill multiple scrapes', async () => {
      const scrapes = [
        {
          organizationId: TEST_ORG_ID,
          url: 'https://company1.example.com',
          rawHtml: '<html><body>24/7 emergency service available</body></html>',
          cleanedContent: '24/7 emergency service available',
          metadata: { title: 'Company 1' },
          platform: 'website' as ScrapingPlatform,
        },
        {
          organizationId: TEST_ORG_ID,
          url: 'https://company2.example.com',
          rawHtml: "<html><body>We're hiring HVAC techs!</body></html>",
          cleanedContent: "We're hiring HVAC techs!",
          metadata: { title: 'Company 2' },
          platform: 'website' as ScrapingPlatform,
        },
        {
          organizationId: TEST_ORG_ID,
          url: 'https://company3.example.com',
          rawHtml: '<html><body>Opening new location next month</body></html>',
          cleanedContent: 'Opening new location next month',
          metadata: { title: 'Company 3' },
          platform: 'website' as ScrapingPlatform,
        },
      ];

      const results = await distillBatch(scrapes, mockResearch);

      expect(results.length).toBe(3);
      expect(results[0]?.signals.length).toBeGreaterThan(0);
      expect(results[1]?.signals.length).toBeGreaterThan(0);
      expect(results[2]?.signals.length).toBeGreaterThan(0);

      // Verify all scrapes saved to Firestore
      for (const result of results) {
        const scrape = await getTemporaryScrape(result.tempScrapeId);
        expect(scrape).not.toBeNull();
      }
    }, 60000);

    it('should continue batch processing after error', async () => {
      const scrapes = [
        {
          organizationId: TEST_ORG_ID,
          url: 'https://valid1.example.com',
          rawHtml: '<html><body>Valid content</body></html>',
          cleanedContent: 'Valid content',
          metadata: { title: 'Valid 1' },
          platform: 'website' as ScrapingPlatform,
        },
        // Invalid scrape (missing required fields will cause error in service layer)
        {
          organizationId: '',
          url: '', // Invalid URL
          rawHtml: '',
          cleanedContent: '',
          metadata: {},
          platform: 'website' as ScrapingPlatform,
        },
        {
          organizationId: TEST_ORG_ID,
          url: 'https://valid2.example.com',
          rawHtml: '<html><body>Valid content 2</body></html>',
          cleanedContent: 'Valid content 2',
          metadata: { title: 'Valid 2' },
          platform: 'website' as ScrapingPlatform,
        },
      ];

      const results = await distillBatch(scrapes, mockResearch);

      // Should successfully process 2 out of 3 (skipping the invalid one)
      expect(results.length).toBeGreaterThanOrEqual(2);
    }, 60000);
  });

  describe('TTL and Cleanup', () => {
    it('should set expiration date 7 days in future', async () => {
      const result = await distillScrape({
        organizationId: TEST_ORG_ID,
        url: 'https://ttl-test.example.com',
        rawHtml: '<html><body>Test</body></html>',
        cleanedContent: 'Test',
        metadata: { title: 'TTL Test' },
        research: mockResearch,
        platform: 'website',
      });

      const scrape = await getTemporaryScrape(result.tempScrapeId);
      expect(scrape).not.toBeNull();

      const expiresAt = scrape!.expiresAt;
      const createdAt = scrape!.createdAt;

      const diffMs = expiresAt.getTime() - createdAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeCloseTo(7, 1); // Allow small time difference
    }, 30000);

    it('should delete flagged scrapes', async () => {
      const result = await distillScrape({
        organizationId: TEST_ORG_ID,
        url: 'https://flagged-test.example.com',
        rawHtml: '<html><body>Test</body></html>',
        cleanedContent: 'Test',
        metadata: { title: 'Flagged Test' },
        research: mockResearch,
        platform: 'website',
      });

      // Flag for deletion
      await db
        .collection(TEMPORARY_SCRAPES_COLLECTION)
        .doc(result.tempScrapeId)
        .update({
          flaggedForDeletion: true,
        });

      // Run cleanup
      const deletedCount = await deleteFlaggedScrapes(TEST_ORG_ID);
      expect(deletedCount).toBeGreaterThan(0);

      // Verify scrape deleted
      const scrape = await getTemporaryScrape(result.tempScrapeId);
      expect(scrape).toBeNull();
    }, 30000);

    it('should delete expired scrapes', async () => {
      const result = await distillScrape({
        organizationId: TEST_ORG_ID,
        url: 'https://expired-test.example.com',
        rawHtml: '<html><body>Test</body></html>',
        cleanedContent: 'Test',
        metadata: { title: 'Expired Test' },
        research: mockResearch,
        platform: 'website',
      });

      // Manually set expiration to past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      await db
        .collection(TEMPORARY_SCRAPES_COLLECTION)
        .doc(result.tempScrapeId)
        .update({
          expiresAt: pastDate,
        });

      // Run cleanup
      const deletedCount = await deleteExpiredScrapes(TEST_ORG_ID);
      expect(deletedCount).toBeGreaterThan(0);

      // Verify scrape deleted
      const scrape = await getTemporaryScrape(result.tempScrapeId);
      expect(scrape).toBeNull();
    }, 30000);
  });

  describe('Storage Optimization', () => {
    it('should achieve >90% storage reduction', async () => {
      // Large HTML content
      const largeHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Large Company Website</title>
            <style>${'/* CSS content */'.repeat(100)}</style>
          </head>
          <body>
            <h1>We offer 24/7 emergency service</h1>
            ${'<p>Filler content</p>'.repeat(200)}
            <footer>© 2025 Company. All rights reserved.</footer>
          </body>
        </html>
      `;

      const result = await distillScrape({
        organizationId: TEST_ORG_ID,
        url: 'https://large-site.example.com',
        rawHtml: largeHtml,
        cleanedContent: 'We offer 24/7 emergency service',
        metadata: { title: 'Large Site' },
        research: mockResearch,
        platform: 'website',
      });

      expect(result.storageReduction.reductionPercent).toBeGreaterThan(90);
      
      const signalsSizeKB = result.storageReduction.signalsSizeBytes / 1024;
      expect(signalsSizeKB).toBeLessThan(5); // Signals should be < 5KB
    }, 30000);
  });
});
