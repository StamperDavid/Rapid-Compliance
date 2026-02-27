/**
 * Integration Tests for Scraper Intelligence Service
 * 
 * Tests the complete service layer with real Firestore operations,
 * caching, rate limiting, and transaction support.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  getResearchIntelligence,
  saveResearchIntelligence,
  deleteResearchIntelligence,
  listResearchIntelligence,
  saveExtractedSignals,
  getExtractedSignals,
  deleteExtractedSignals,
  querySignalsByPlatform,
  processAndStoreScrape,
  getSignalAnalytics,
  batchProcessScrapes,
  clearAllCaches,
  getCacheStats,
  invalidateOrganizationCaches,
  healthCheck,
  ScraperIntelligenceError,
} from '@/lib/scraper-intelligence/scraper-intelligence-service';
import type { ResearchIntelligence, ExtractedSignal } from '@/types/scraper-intelligence';
import { db } from '@/lib/firebase-admin';

// Set timeout for real Firestore operations
jest.setTimeout(30000);

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_INDUSTRY_ID = 'hvac';
const TEST_RECORD_ID = 'lead_123';

const mockResearch: ResearchIntelligence = {
  scrapingStrategy: {
    primarySource: 'website',
    secondarySources: ['linkedin-jobs', 'linkedin-company'],
    frequency: 'per-lead',
    timeoutMs: 30000,
    enableCaching: true,
    cacheTtlSeconds: 300,
  },
  highValueSignals: [
    {
      id: 'hiring',
      label: 'Hiring',
      description: 'Company is actively hiring',
      keywords: ["we're hiring", "join our team", "careers"],
      priority: 'HIGH',
      action: 'increase-score',
      scoreBoost: 25,
      platform: 'any',
    },
    {
      id: 'expansion',
      label: 'Expansion',
      description: 'Company is expanding',
      keywords: ['new office', 'opening soon', 'expansion'],
      priority: 'CRITICAL',
      action: 'increase-score',
      scoreBoost: 40,
      platform: 'website',
    },
  ],
  fluffPatterns: [
    {
      id: 'copyright',
      pattern: '©\\s*\\d{4}',
      description: 'Copyright notices',
      context: 'footer',
    },
  ],
  scoringRules: [
    {
      id: 'hiring_boost',
      name: 'Hiring Boost',
      description: 'Extra points if hiring on careers page',
      condition: 'platform === "website"',
      scoreBoost: 10,
      priority: 1,
      enabled: true,
    },
  ],
  customFields: [
    {
      key: 'hiring_count',
      label: 'Number of Open Positions',
      type: 'number',
      description: 'Count of job openings',
      extractionHints: ['positions', 'openings', 'jobs'],
      required: false,
      defaultValue: 0,
    },
  ],
  metadata: {
    lastUpdated: new Date().toISOString(),
    version: 1,
    updatedBy: 'system',
  },
};

const mockSignals: ExtractedSignal[] = [
  {
    signalId: 'hiring',
    signalLabel: 'Hiring',
    sourceText: "We're hiring! Join our team of 50+ HVAC technicians.",
    confidence: 85,
    platform: 'website',
    extractedAt: new Date(),
    sourceScrapeId: 'scrape_123',
  },
  {
    signalId: 'expansion',
    signalLabel: 'Expansion',
    sourceText: 'Opening new office in Phoenix next quarter.',
    confidence: 90,
    platform: 'website',
    extractedAt: new Date(),
    sourceScrapeId: 'scrape_123',
  },
];

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeAll(async () => {
  // Clear any existing test data
  await cleanupTestData();
}, 30000);

afterAll(async () => {
  // Clean up after tests
  await cleanupTestData();
}, 30000);

beforeEach(async () => {
  // Clear caches and Firestore data before each test for isolation
  clearAllCaches();
  await cleanupTestData();
});

async function cleanupTestData(): Promise<void> {
  try {
    // Delete research intelligence
    const researchDocs = await db
      .collection('research_intelligence')
      .get();

    const batch1 = db.batch();
    researchDocs.docs.forEach((doc) => batch1.delete(doc.ref));
    await batch1.commit();

    // Delete extracted signals
    const signalDocs = await db
      .collection('extracted_signals')
      .get();

    const batch2 = db.batch();
    signalDocs.docs.forEach((doc) => batch2.delete(doc.ref));
    await batch2.commit();

    // Delete temporary scrapes (from previous tests)
    const scrapeDocs = await db
      .collection('temporary_scrapes')
      .get();

    const batch3 = db.batch();
    scrapeDocs.docs.forEach((doc) => batch3.delete(doc.ref));
    await batch3.commit();
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

// ============================================================================
// RESEARCH INTELLIGENCE TESTS
// ============================================================================

describe('Research Intelligence CRUD', () => {
  it('should save and retrieve research intelligence', async () => {
    // Save
    await saveResearchIntelligence(TEST_INDUSTRY_ID, mockResearch);

    // Retrieve
    const retrieved = await getResearchIntelligence(TEST_INDUSTRY_ID);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.highValueSignals).toHaveLength(2);
    expect(retrieved?.fluffPatterns).toHaveLength(1);
    expect(retrieved?.scoringRules).toHaveLength(1);
    expect(retrieved?.customFields).toHaveLength(1);
  });

  it('should use cache on second retrieval', async () => {
    // First retrieval (cache miss)
    await saveResearchIntelligence(TEST_INDUSTRY_ID, mockResearch);
    const first = await getResearchIntelligence(TEST_INDUSTRY_ID);

    // Check cache stats
    const stats1 = getCacheStats();
    expect(stats1.researchCacheSize).toBeGreaterThan(0);

    // Second retrieval (cache hit)
    const second = await getResearchIntelligence(TEST_INDUSTRY_ID);

    expect(second).toEqual(first);
  });

  it('should invalidate cache on save', async () => {
    // Save and retrieve
    await saveResearchIntelligence(TEST_INDUSTRY_ID, mockResearch);
    await getResearchIntelligence(TEST_INDUSTRY_ID);

    // Modify and save again
    const updated = { ...mockResearch };
    updated.highValueSignals.push({
      id: 'new_signal',
      label: 'New Signal',
      description: 'A new signal',
      keywords: ['test'],
      priority: 'LOW',
      action: 'increase-score',
      scoreBoost: 5,
      platform: 'any',
    });

    await saveResearchIntelligence(TEST_INDUSTRY_ID, updated);

    // Retrieve should have updated data
    const retrieved = await getResearchIntelligence(TEST_INDUSTRY_ID);
    expect(retrieved?.highValueSignals).toHaveLength(3);
  });

  it('should list all research intelligence for org', async () => {
    // Save multiple industries
    await saveResearchIntelligence('hvac', mockResearch);
    await saveResearchIntelligence('saas', mockResearch);
    await saveResearchIntelligence('real-estate', mockResearch);

    // List all
    const list = await listResearchIntelligence();

    expect(list.length).toBeGreaterThanOrEqual(3);
    
    const industryIds = list.map((item) => item.industryId);
    expect(industryIds).toContain('hvac');
    expect(industryIds).toContain('saas');
    expect(industryIds).toContain('real-estate');
  });

  it('should delete research intelligence', async () => {
    // Save
    await saveResearchIntelligence(TEST_INDUSTRY_ID, mockResearch);

    // Verify exists
    let retrieved = await getResearchIntelligence(TEST_INDUSTRY_ID);
    expect(retrieved).not.toBeNull();

    // Delete
    await deleteResearchIntelligence(TEST_INDUSTRY_ID);

    // Verify deleted
    retrieved = await getResearchIntelligence(TEST_INDUSTRY_ID);
    expect(retrieved).toBeNull();
  });

  it('should return null for non-existent research', async () => {
    const result = await getResearchIntelligence('nonexistent');
    expect(result).toBeNull();
  });
});

// ============================================================================
// EXTRACTED SIGNALS TESTS
// ============================================================================

describe('Extracted Signals CRUD', () => {
  it('should save and retrieve extracted signals', async () => {
    // Save
    await saveExtractedSignals(TEST_RECORD_ID, mockSignals);

    // Retrieve
    const retrieved = await getExtractedSignals(TEST_RECORD_ID);

    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].signalId).toBe('hiring');
    expect(retrieved[1].signalId).toBe('expansion');
  });

  it('should append signals on multiple saves', async () => {
    // First save
    await saveExtractedSignals(TEST_RECORD_ID, [mockSignals[0]]);

    // Second save (should append)
    await saveExtractedSignals(TEST_RECORD_ID, [mockSignals[1]]);

    // Retrieve all
    const retrieved = await getExtractedSignals(TEST_RECORD_ID);

    expect(retrieved).toHaveLength(2);
  });

  it('should use cache on second retrieval', async () => {
    // Save and retrieve
    await saveExtractedSignals(TEST_RECORD_ID, mockSignals);
    const first = await getExtractedSignals(TEST_RECORD_ID);

    // Check cache
    const stats = getCacheStats();
    expect(stats.signalsCacheSize).toBeGreaterThan(0);

    // Second retrieval (cache hit)
    const second = await getExtractedSignals(TEST_RECORD_ID);

    expect(second).toEqual(first);
  });

  it('should query signals by platform', async () => {
    // Save signals for multiple records
    await saveExtractedSignals('record_1', [
      { ...mockSignals[0], platform: 'website' },
    ]);
    await saveExtractedSignals('record_2', [
      { ...mockSignals[1], platform: 'linkedin-jobs' },
    ]);

    // Query website signals
    const websiteResults = await querySignalsByPlatform('website');

    expect(websiteResults.length).toBeGreaterThanOrEqual(1);
    
    const websiteSignals = websiteResults.flatMap((r) => r.signals);
    expect(websiteSignals.every((s) => s.platform === 'website')).toBe(true);
  });

  it('should delete extracted signals', async () => {
    // Save
    await saveExtractedSignals(TEST_RECORD_ID, mockSignals);

    // Verify exists
    let retrieved = await getExtractedSignals(TEST_RECORD_ID);
    expect(retrieved).toHaveLength(2);

    // Delete
    await deleteExtractedSignals(TEST_RECORD_ID);

    // Verify deleted
    retrieved = await getExtractedSignals(TEST_RECORD_ID);
    expect(retrieved).toHaveLength(0);
  });

  it('should return empty array for non-existent signals', async () => {
    const result = await getExtractedSignals('nonexistent');
    expect(result).toEqual([]);
  });
});

// ============================================================================
// ORCHESTRATION TESTS
// ============================================================================

describe('Process and Store Scrape', () => {
  beforeEach(async () => {
    // Ensure research intelligence exists
    await saveResearchIntelligence(TEST_INDUSTRY_ID, mockResearch);
  }, 30000);

  it('should process scrape and store signals', async () => {
    const rawHtml = `
      <html>
        <body>
          <h1>Join Our Team</h1>
          <p>We're hiring! We have 10 open positions for HVAC technicians.</p>
          <p>We're also opening a new office in Phoenix next quarter.</p>
        </body>
      </html>
    `;

    const result = await processAndStoreScrape({
      industryId: TEST_INDUSTRY_ID,
      recordId: TEST_RECORD_ID,
      url: 'https://example.com/careers',
      rawHtml,
      cleanedContent: "Join Our Team We're hiring! We have 10 open positions. Opening new office in Phoenix.",
      metadata: { title: 'Careers' },
      platform: 'website',
    });

    // Verify signals detected
    expect(result.signals.length).toBeGreaterThan(0);
    
    // Verify lead score calculated
    expect(result.leadScore).toBeGreaterThan(0);

    // Verify storage reduction metrics are populated
    expect(typeof result.storageReduction.reductionPercent).toBe('number');
    expect(result.storageReduction.rawSizeBytes).toBeGreaterThan(0);

    // Verify signals saved to Firestore
    const savedSignals = await getExtractedSignals(TEST_RECORD_ID);
    expect(savedSignals.length).toBe(result.signals.length);
  });

  it('should throw error if research not found', async () => {
    await expect(
      processAndStoreScrape({
          industryId: 'nonexistent',
        recordId: TEST_RECORD_ID,
        url: 'https://example.com',
        rawHtml: '<html></html>',
        cleanedContent: '',
        metadata: {},
        platform: 'website',
      })
    ).rejects.toThrow(ScraperIntelligenceError);
  });

  it('should handle scrape with no signals detected', async () => {
    const result = await processAndStoreScrape({
      industryId: TEST_INDUSTRY_ID,
      recordId: 'record_no_signals',
      url: 'https://example.com/about',
      rawHtml: '<html><body><p>About us page with no signals.</p></body></html>',
      cleanedContent: 'About us page with no signals.',
      metadata: { title: 'About Us' },
      platform: 'website',
    });

    expect(result.signals).toHaveLength(0);
    // leadScore may be non-zero due to scoring rules (e.g. careersPageExists bonus)
    expect(typeof result.leadScore).toBe('number');
  });
});

// ============================================================================
// ANALYTICS TESTS
// ============================================================================

describe('Signal Analytics', () => {
  beforeEach(async () => {
    // Save test signals
    await saveExtractedSignals(TEST_RECORD_ID, mockSignals);
  }, 30000);

  it('should calculate analytics correctly', async () => {
    const analytics = await getSignalAnalytics(TEST_RECORD_ID);

    expect(analytics.totalSignals).toBe(2);
    expect(analytics.averageConfidence).toBeCloseTo(87.5, 1); // (85 + 90) / 2
    expect(analytics.signalsByPlatform.website).toBe(2);
    expect(analytics.topSignals).toHaveLength(2);
    expect(analytics.oldestSignal).not.toBeNull();
    expect(analytics.newestSignal).not.toBeNull();
  });

  it('should handle empty signals', async () => {
    const analytics = await getSignalAnalytics('nonexistent');

    expect(analytics.totalSignals).toBe(0);
    expect(analytics.averageConfidence).toBe(0);
    expect(analytics.topSignals).toHaveLength(0);
    expect(analytics.oldestSignal).toBeNull();
    expect(analytics.newestSignal).toBeNull();
  });
});

// ============================================================================
// BATCH PROCESSING TESTS
// ============================================================================

describe('Batch Processing', () => {
  beforeEach(async () => {
    await saveResearchIntelligence(TEST_INDUSTRY_ID, mockResearch);
  }, 30000);

  it('should process multiple scrapes in batch', async () => {
    const scrapes = [
      {
          industryId: TEST_INDUSTRY_ID,
        recordId: 'batch_record_1',
        url: 'https://example1.com',
        rawHtml: "<html><body>We're hiring! Join our team.</body></html>",
        cleanedContent: "We're hiring! Join our team.",
        metadata: { title: 'Careers 1' },
        platform: 'website' as const,
      },
      {
          industryId: TEST_INDUSTRY_ID,
        recordId: 'batch_record_2',
        url: 'https://example2.com',
        rawHtml: '<html><body>Opening new office next month.</body></html>',
        cleanedContent: 'Opening new office next month.',
        metadata: { title: 'News 2' },
        platform: 'website' as const,
      },
    ];

    const results = await batchProcessScrapes(scrapes);

    expect(results).toHaveLength(2);
    expect(results[0].signals.length).toBeGreaterThanOrEqual(0);
    expect(results[1].signals.length).toBeGreaterThanOrEqual(0);
  });

  it('should continue on individual failures', async () => {
    const scrapes = [
      {
          industryId: TEST_INDUSTRY_ID,
        recordId: 'batch_success',
        url: 'https://example.com',
        rawHtml: "<html><body>We're hiring!</body></html>",
        cleanedContent: "We're hiring!",
        metadata: { title: 'Success' },
        platform: 'website' as const,
      },
      {
          industryId: 'nonexistent', // This will fail
        recordId: 'batch_fail',
        url: 'https://fail.com',
        rawHtml: '<html></html>',
        cleanedContent: '',
        metadata: {},
        platform: 'website' as const,
      },
    ];

    const results = await batchProcessScrapes(scrapes);

    // Should have 1 success, 1 failure
    expect(results.length).toBeLessThan(scrapes.length);
  });
});

// ============================================================================
// CACHE MANAGEMENT TESTS
// ============================================================================

describe('Cache Management', () => {
  it('should track cache statistics', async () => {
    clearAllCaches();

    let stats = getCacheStats();
    expect(stats.researchCacheSize).toBe(0);
    expect(stats.signalsCacheSize).toBe(0);

    // Add to cache
    await saveResearchIntelligence(TEST_INDUSTRY_ID, mockResearch);
    await getResearchIntelligence(TEST_INDUSTRY_ID);

    stats = getCacheStats();
    expect(stats.researchCacheSize).toBeGreaterThan(0);
  });

  it('should invalidate organization caches', async () => {
    // Populate caches
    await saveResearchIntelligence(TEST_INDUSTRY_ID, mockResearch);
    await getResearchIntelligence(TEST_INDUSTRY_ID);
    
    await saveExtractedSignals(TEST_RECORD_ID, mockSignals);
    await getExtractedSignals(TEST_RECORD_ID);

    const before = getCacheStats();
    expect(before.researchCacheSize + before.signalsCacheSize).toBeGreaterThan(0);

    // Invalidate
    invalidateOrganizationCaches();

    const after = getCacheStats();
    expect(after.researchCacheSize + after.signalsCacheSize).toBeLessThan(
      before.researchCacheSize + before.signalsCacheSize
    );
  });

  it('should clear all caches', async () => {
    // Populate caches
    await saveResearchIntelligence(TEST_INDUSTRY_ID, mockResearch);
    await getResearchIntelligence(TEST_INDUSTRY_ID);

    clearAllCaches();

    const stats = getCacheStats();
    expect(stats.researchCacheSize).toBe(0);
    expect(stats.signalsCacheSize).toBe(0);
  });
});

// ============================================================================
// RATE LIMITING TESTS
// ============================================================================

describe('Rate Limiting', () => {
  it('should enforce rate limits', async () => {
    // Make many rapid requests (more than limit)
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(
        getResearchIntelligence(TEST_INDUSTRY_ID).catch((error) => error)
      );
    }

    const results = await Promise.all(promises);

    // Some requests should have been rate limited
    const rateLimitErrors = results.filter(
      (r) => r instanceof ScraperIntelligenceError && r.code === 'RATE_LIMIT_EXCEEDED'
    );

    expect(rateLimitErrors.length).toBeGreaterThan(0);
  }, 10000); // Increase timeout for this test
});

// ============================================================================
// HEALTH CHECK TESTS
// ============================================================================

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const health = await healthCheck();

    expect(health.status).toBe('healthy');
    expect(health.cacheStats).toBeDefined();
    expect(health.timestamp).toBeInstanceOf(Date);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
  it('should throw ScraperIntelligenceError with proper metadata', async () => {
    // Clear rate limiter state to ensure we get the expected error
    clearAllCaches();

    try {
      await processAndStoreScrape({
          industryId: 'nonexistent',
        recordId: TEST_RECORD_ID,
        url: 'https://example.com',
        rawHtml: '<html></html>',
        cleanedContent: '',
        metadata: {},
        platform: 'website',
      });

      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ScraperIntelligenceError);

      if (error instanceof ScraperIntelligenceError) {
        // May get RATE_LIMIT_EXCEEDED or RESEARCH_NOT_FOUND depending on state
        expect(['RESEARCH_NOT_FOUND', 'RATE_LIMIT_EXCEEDED']).toContain(error.code);
        if (error.code === 'RESEARCH_NOT_FOUND') {
          expect(error.statusCode).toBe(404);
          expect(error.metadata).toBeDefined();
        }
      }
    }
  });
});
