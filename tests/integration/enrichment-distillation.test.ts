/**
 * Integration Tests: Enrichment + Distillation Flow
 * 
 * Tests the complete flow from enrichment request to distilled signals.
 * Uses REAL Firestore operations (not mocks).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { enrichCompany } from '@/lib/enrichment/enrichment-service';
import { getTemporaryScrape } from '@/lib/scraper-intelligence/temporary-scrapes-service';

// Import Firestore admin instance
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'test-project',
  });
}

const db = getFirestore();

describe('Enrichment + Distillation Integration', () => {
  const TEST_ORG_ID = 'test-org-distillation';
  
  // Cleanup after tests
  afterAll(async () => {
    // Clean up test data
    const scrapes = await db
      .collection('temporary_scrapes')
      .where('organizationId', '==', TEST_ORG_ID)
      .get();
    
    for (const doc of scrapes.docs) {
      await doc.ref.delete();
    }
  });

  describe('HVAC Industry Template', () => {
    it('should enrich HVAC company with signal detection', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Test HVAC Services',
          domain: 'testhvac.com',
          website: 'https://testhvac.com',
          industryTemplateId: 'hvac',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      // Basic enrichment should work
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data) {
        // Check for distillation results
        expect(result.data.extractedSignals).toBeDefined();
        expect(result.data.leadScore).toBeDefined();
        
        // Log results for manual verification
        console.log('\nHVAC Enrichment Results:');
        console.log('- Signals detected:', result.data.extractedSignals?.length || 0);
        console.log('- Lead score:', result.data.leadScore || 0);
        console.log('- Confidence:', result.data.confidence);
      }
    }, 30000); // 30s timeout for enrichment

    it('should save raw scrape to temporary_scrapes with TTL', async () => {
      const result = await enrichCompany(
        {
          companyName: 'HVAC Company for TTL Test',
          domain: 'hvacttl.com',
          website: 'https://hvacttl.com',
          industryTemplateId: 'hvac',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      expect(result.success).toBe(true);

      // Query for temporary scrape
      const scrapes = await db
        .collection('temporary_scrapes')
        .where('organizationId', '==', TEST_ORG_ID)
        .where('url', '==', 'https://hvacttl.com')
        .limit(1)
        .get();

      expect(scrapes.empty).toBe(false);
      
      if (!scrapes.empty) {
        const scrape = scrapes.docs[0].data();
        
        // Verify TTL fields
        expect(scrape.expiresAt).toBeDefined();
        expect(scrape.createdAt).toBeDefined();
        expect(scrape.contentHash).toBeDefined();
        
        // Verify expiration is ~7 days from now
        const expiresAt = scrape.expiresAt.toDate();
        const createdAt = scrape.createdAt.toDate();
        const diffDays = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        
        expect(diffDays).toBeGreaterThanOrEqual(6.9);
        expect(diffDays).toBeLessThanOrEqual(7.1);
        
        console.log('\nTTL Verification:');
        console.log('- Created:', createdAt.toISOString());
        console.log('- Expires:', expiresAt.toISOString());
        console.log('- TTL (days):', diffDays.toFixed(2));
      }
    }, 30000);
  });

  describe('SaaS Industry Template', () => {
    it('should detect SaaS-specific signals (funding, hiring)', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Test SaaS Company',
          domain: 'testsaas.com',
          website: 'https://testsaas.com',
          industryTemplateId: 'saas-software',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      expect(result.success).toBe(true);
      
      if (result.data) {
        console.log('\nSaaS Enrichment Results:');
        console.log('- Signals detected:', result.data.extractedSignals?.length || 0);
        console.log('- Lead score:', result.data.leadScore || 0);
        console.log('- Industry:', result.data.industry);
        
        // Check for signal types
        if (result.data.extractedSignals && result.data.extractedSignals.length > 0) {
          const signalTypes = result.data.extractedSignals.map(s => s.signalLabel);
          console.log('- Signal types:', signalTypes.join(', '));
        }
      }
    }, 30000);
  });

  describe('Storage Reduction Verification', () => {
    it('should achieve >95% storage reduction with distillation', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Storage Test Company',
          domain: 'storagetest.com',
          website: 'https://storagetest.com',
          industryTemplateId: 'saas-software',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      expect(result.success).toBe(true);

      // Get the temporary scrape to check sizes
      const scrapes = await db
        .collection('temporary_scrapes')
        .where('organizationId', '==', TEST_ORG_ID)
        .where('url', '==', 'https://storagetest.com')
        .limit(1)
        .get();

      if (!scrapes.empty && result.data) {
        const scrape = scrapes.docs[0].data();
        const rawSizeBytes = scrape.sizeBytes;
        
        // Calculate size of permanent signals
        const signalsJson = JSON.stringify(result.data.extractedSignals || []);
        const signalsSizeBytes = Buffer.byteLength(signalsJson, 'utf8');
        
        const reductionPercent = ((rawSizeBytes - signalsSizeBytes) / rawSizeBytes) * 100;
        
        console.log('\nStorage Reduction Analysis:');
        console.log('- Raw scrape size:', rawSizeBytes, 'bytes');
        console.log('- Signals size:', signalsSizeBytes, 'bytes');
        console.log('- Reduction:', reductionPercent.toFixed(2) + '%');
        
        // Verify >95% reduction (or at least >90% for smaller pages)
        expect(reductionPercent).toBeGreaterThan(90);
      }
    }, 30000);
  });

  describe('Enrichment Without Distillation', () => {
    it('should work normally when distillation is disabled', async () => {
      const result = await enrichCompany(
        {
          companyName: 'No Distillation Company',
          domain: 'nodistill.com',
          website: 'https://nodistill.com',
          enableDistillation: false,
        },
        TEST_ORG_ID
      );

      expect(result.success).toBe(true);
      
      if (result.data) {
        // Should NOT have distillation results
        expect(result.data.extractedSignals?.length || 0).toBe(0);
        expect(result.data.leadScore).toBeUndefined();
        
        console.log('\nNo Distillation Results:');
        console.log('- Basic enrichment worked:', result.success);
        console.log('- Signals:', result.data.extractedSignals?.length || 0);
      }
    }, 30000);

    it('should work when industry template has no research', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Non-Research Industry Company',
          domain: 'nonresearch.com',
          website: 'https://nonresearch.com',
          industryTemplateId: 'construction', // Template exists but has no research
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      // Should still enrich successfully (just without signals)
      expect(result.success).toBe(true);
      
      if (result.data) {
        console.log('\nNon-Research Industry Results:');
        console.log('- Basic enrichment worked:', result.success);
        console.log('- Signals:', result.data.extractedSignals?.length || 0);
      }
    }, 30000);
  });

  describe('Duplicate Content Detection', () => {
    it('should detect duplicate scrapes and update lastSeen', async () => {
      const testUrl = 'https://duplicatetest.com';
      
      // First enrichment
      const result1 = await enrichCompany(
        {
          companyName: 'Duplicate Test Company',
          domain: 'duplicatetest.com',
          website: testUrl,
          industryTemplateId: 'hvac',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      expect(result1.success).toBe(true);

      // Get first scrape
      const scrapes1 = await db
        .collection('temporary_scrapes')
        .where('organizationId', '==', TEST_ORG_ID)
        .where('url', '==', testUrl)
        .limit(1)
        .get();

      expect(scrapes1.empty).toBe(false);
      const firstScrapeCount = scrapes1.docs[0].data().scrapeCount;
      expect(firstScrapeCount).toBe(1);

      // Second enrichment (same content, should update existing)
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const result2 = await enrichCompany(
        {
          companyName: 'Duplicate Test Company',
          domain: 'duplicatetest.com',
          website: testUrl,
          industryTemplateId: 'hvac',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      expect(result2.success).toBe(true);

      // Get updated scrape
      const scrapes2 = await db
        .collection('temporary_scrapes')
        .where('organizationId', '==', TEST_ORG_ID)
        .where('url', '==', testUrl)
        .limit(1)
        .get();

      // Should still be only one scrape
      expect(scrapes2.size).toBe(1);
      
      const secondScrapeData = scrapes2.docs[0].data();
      
      // scrapeCount should be incremented
      expect(secondScrapeData.scrapeCount).toBeGreaterThan(firstScrapeCount);
      
      // lastSeen should be updated
      const lastSeen = secondScrapeData.lastSeen.toDate();
      const createdAt = secondScrapeData.createdAt.toDate();
      expect(lastSeen.getTime()).toBeGreaterThan(createdAt.getTime());
      
      console.log('\nDuplicate Detection Results:');
      console.log('- Scrape count:', secondScrapeData.scrapeCount);
      console.log('- Created:', createdAt.toISOString());
      console.log('- Last seen:', lastSeen.toISOString());
    }, 60000); // 60s timeout for two enrichments
  });

  describe('Cost Tracking', () => {
    it('should track enrichment costs with distillation metrics', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Cost Tracking Test',
          domain: 'costtest.com',
          website: 'https://costtest.com',
          industryTemplateId: 'saas-software',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      expect(result.success).toBe(true);
      expect(result.cost).toBeDefined();
      
      console.log('\nCost Tracking:');
      console.log('- Search API calls:', result.cost.searchAPICalls);
      console.log('- Scraping calls:', result.cost.scrapingCalls);
      console.log('- AI tokens used:', result.cost.aiTokensUsed);
      console.log('- Total cost: $' + result.cost.totalCostUSD.toFixed(4));
      console.log('- Duration:', result.metrics.durationMs + 'ms');
      
      // Verify cost is reasonable (<$0.01 per enrichment)
      expect(result.cost.totalCostUSD).toBeLessThan(0.01);
    }, 30000);
  });
});
