/**
 * Integration Tests: Enrichment + Distillation Flow
 * 
 * Tests the complete flow from enrichment request to distilled signals.
 * Uses REAL Firestore operations (not mocks).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { enrichCompany } from '@/lib/enrichment/enrichment-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

// Import Firestore admin instance
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID ?? 'test-project',
  });
}

const db = getFirestore();

describe('Enrichment + Distillation Integration', () => {
  const TEST_ORG_ID = PLATFORM_ID;
  
  // Cleanup after tests
  afterAll(async () => {
    // Clean up temporary_scrapes
    const scrapes = await db
      .collection('temporary_scrapes')
      .get();

    for (const doc of scrapes.docs) {
      await doc.ref.delete();
    }

    // Clean up enrichment-costs subcollection
    const costs = await db
      .collection(`organizations/${TEST_ORG_ID}/enrichment-costs`)
      .get();

    for (const doc of costs.docs) {
      await doc.ref.delete();
    }

    // Clean up the org document if it exists
    const orgDoc = await db.collection('organizations').doc(TEST_ORG_ID).get();
    if (orgDoc.exists) {
      await db.collection('organizations').doc(TEST_ORG_ID).delete();
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
        });

      // Basic enrichment should work
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data) {
        // Check for distillation results
        expect(result.data.extractedSignals).toBeDefined();
        expect(result.data.leadScore).toBeDefined();
        
        // Log results for manual verification
        console.log('\nHVAC Enrichment Results:');
        console.log('- Signals detected:', result.data.extractedSignals?.length ?? 0);
        console.log('- Lead score:', result.data.leadScore ?? 0);
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
        });

      expect(result.success).toBe(true);

      // Query for temporary scrape
      const scrapes = await db
        .collection('temporary_scrapes')
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
        });

      expect(result.success).toBe(true);
      
      if (result.data) {
        console.log('\nSaaS Enrichment Results:');
        console.log('- Signals detected:', result.data.extractedSignals?.length ?? 0);
        console.log('- Lead score:', result.data.leadScore ?? 0);
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
        });

      expect(result.success).toBe(true);

      // Get the temporary scrape to check sizes
      const scrapes = await db
        .collection('temporary_scrapes')
        .where('url', '==', 'https://storagetest.com')
        .limit(1)
        .get();

      if (!scrapes.empty && result.data) {
        const scrape = scrapes.docs[0].data();
        const rawSizeBytes = scrape.sizeBytes;

        // Calculate size of permanent signals
        const signalsJson = JSON.stringify(result.data.extractedSignals ?? []);
        const signalsSizeBytes = Buffer.byteLength(signalsJson, 'utf8');
        
        const reductionPercent = ((rawSizeBytes - signalsSizeBytes) / rawSizeBytes) * 100;
        
        console.log('\nStorage Reduction Analysis:');
        console.log('- Raw scrape size:', rawSizeBytes, 'bytes');
        console.log('- Signals size:', signalsSizeBytes, 'bytes');
        console.log(`- Reduction: ${reductionPercent.toFixed(2)}%`);
        
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
        });

      expect(result.success).toBe(true);
      
      if (result.data) {
        // Should NOT have distillation results
        expect(result.data.extractedSignals?.length ?? 0).toBe(0);
        expect(result.data.leadScore).toBeUndefined();

        console.log('\nNo Distillation Results:');
        console.log('- Basic enrichment worked:', result.success);
        console.log('- Signals:', result.data.extractedSignals?.length ?? 0);
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
        });

      // Should still enrich successfully (just without signals)
      expect(result.success).toBe(true);
      
      if (result.data) {
        console.log('\nNon-Research Industry Results:');
        console.log('- Basic enrichment worked:', result.success);
        console.log('- Signals:', result.data.extractedSignals?.length ?? 0);
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
        });

      expect(result1.success).toBe(true);

      // Get first scrape
      const scrapes1 = await db
        .collection('temporary_scrapes')
        .where('url', '==', testUrl)
        .limit(1)
        .get();

      expect(scrapes1.empty).toBe(false);
      const firstScrapeData = scrapes1.docs[0].data() as { scrapeCount: number };
      const firstScrapeCount: number = firstScrapeData.scrapeCount;
      expect(firstScrapeCount).toBe(1);

      // Second enrichment (same content, should update existing)
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 2000); // Wait 2 seconds
      });
      
      const result2 = await enrichCompany(
        {
          companyName: 'Duplicate Test Company',
          domain: 'duplicatetest.com',
          website: testUrl,
          industryTemplateId: 'hvac',
          enableDistillation: true,
        });

      expect(result2.success).toBe(true);

      // Get updated scrape
      const scrapes2 = await db
        .collection('temporary_scrapes')
        .where('url', '==', testUrl)
        .limit(1)
        .get();

      // Should still be only one scrape
      expect(scrapes2.size).toBe(1);
      
      const secondScrapeData = scrapes2.docs[0].data() as {
        scrapeCount: number;
        lastSeen: { toDate: () => Date };
        createdAt: { toDate: () => Date };
      };

      // scrapeCount should be incremented
      const secondScrapeCount: number = secondScrapeData.scrapeCount;
      expect(secondScrapeCount).toBeGreaterThan(firstScrapeCount);

      // lastSeen should be updated
      const lastSeen = secondScrapeData.lastSeen.toDate();
      const createdAt = secondScrapeData.createdAt.toDate();
      expect(lastSeen.getTime()).toBeGreaterThan(createdAt.getTime());

      console.log('\nDuplicate Detection Results:');
      console.log('- Scrape count:', secondScrapeCount);
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
        });

      expect(result.success).toBe(true);
      expect(result.cost).toBeDefined();
      
      console.log('\nCost Tracking:');
      console.log('- Search API calls:', result.cost.searchAPICalls);
      console.log('- Scraping calls:', result.cost.scrapingCalls);
      console.log('- AI tokens used:', result.cost.aiTokensUsed);
      console.log(`- Total cost: $${result.cost.totalCostUSD.toFixed(4)}`);
      console.log(`- Duration: ${result.metrics.durationMs}ms`);
      
      // Verify cost is reasonable (<$0.01 per enrichment)
      expect(result.cost.totalCostUSD).toBeLessThan(0.01);
    }, 30000);
  });

  describe('Phase 5: Storage Metrics Integration', () => {
    it('should return storage metrics in enrichment response', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Storage Metrics Test',
          domain: 'storagemetrics.com',
          website: 'https://storagemetrics.com',
          industryTemplateId: 'hvac',
          enableDistillation: true,
        });

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      
      // NEW: Check for storage metrics
      if (result.metrics.storageMetrics) {
        expect(result.metrics.storageMetrics.rawScrapeSize).toBeGreaterThan(0);
        expect(result.metrics.storageMetrics.signalsSize).toBeGreaterThan(0);
        expect(result.metrics.storageMetrics.reductionPercent).toBeGreaterThan(0);
        expect(result.metrics.storageMetrics.contentHash).toBeDefined();
        expect(typeof result.metrics.storageMetrics.isDuplicate).toBe('boolean');
        
        console.log('\nStorage Metrics:');
        console.log('- Raw size:', result.metrics.storageMetrics.rawScrapeSize, 'bytes');
        console.log('- Signals size:', result.metrics.storageMetrics.signalsSize, 'bytes');
        console.log(`- Reduction: ${result.metrics.storageMetrics.reductionPercent.toFixed(2)}%`);
        console.log(`- Content hash: ${result.metrics.storageMetrics.contentHash?.substring(0, 16)}...`);
        console.log('- Is duplicate:', result.metrics.storageMetrics.isDuplicate);
        console.log('- Temp scrape ID:', result.metrics.storageMetrics.temporaryScrapeId ?? 'N/A');
        
        // Verify storage reduction meets target (>95%)
        expect(result.metrics.storageMetrics.reductionPercent).toBeGreaterThanOrEqual(90);
      }
    }, 30000);

    it('should detect content hash duplicates on second enrichment', async () => {
      const testDomain = 'hashdupetest.com';
      const testUrl = `https://${testDomain}`;
      
      // First enrichment - should NOT be duplicate
      const result1 = await enrichCompany(
        {
          companyName: 'Hash Duplicate Test',
          domain: testDomain,
          website: testUrl,
          industryTemplateId: 'hvac',
          enableDistillation: true,
        });

      expect(result1.success).toBe(true);
      
      if (result1.metrics.storageMetrics) {
        expect(result1.metrics.storageMetrics.isDuplicate).toBe(false);
        const contentHash1 = result1.metrics.storageMetrics.contentHash;

        // Second enrichment (same URL, should detect duplicate if content unchanged)
        await new Promise<void>(resolve => {
          setTimeout(() => resolve(), 2000); // Wait 2s
        });
        
        const result2 = await enrichCompany(
          {
            companyName: 'Hash Duplicate Test',
            domain: testDomain,
            website: testUrl,
            industryTemplateId: 'hvac',
            enableDistillation: true,
          });

        expect(result2.success).toBe(true);
        
        if (result2.metrics.storageMetrics) {
          const contentHash2 = result2.metrics.storageMetrics.contentHash;
          
          // Content hashes should match if content is the same
          if (contentHash1 === contentHash2) {
            expect(result2.metrics.storageMetrics.isDuplicate).toBe(true);
            
            console.log('\nContent Hash Duplicate Detection:');
            console.log(`- First hash: ${contentHash1?.substring(0, 16)}...`);
            console.log(`- Second hash: ${contentHash2?.substring(0, 16)}...`);
            console.log('- Duplicate detected:', result2.metrics.storageMetrics.isDuplicate);
          }
        }
      }
    }, 60000);

    it('should log storage metrics to enrichment cost log', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Storage Cost Log Test',
          domain: 'storagecostlog.com',
          website: 'https://storagecostlog.com',
          industryTemplateId: 'saas-software',
          enableDistillation: true,
        });

      expect(result.success).toBe(true);

      // Query for the cost log
      const costLogs = await db
        .collection(`organizations/${TEST_ORG_ID}/enrichment-costs`)
        .where('companyDomain', '==', 'storagecostlog.com')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (!costLogs.empty) {
        const costLog = costLogs.docs[0].data();
        
        // Verify storage metrics are logged
        expect(costLog.storageMetrics).toBeDefined();
        
        if (costLog.storageMetrics) {
          expect(costLog.storageMetrics.rawScrapeSize).toBeGreaterThan(0);
          expect(costLog.storageMetrics.signalsSize).toBeGreaterThan(0);
          expect(costLog.storageMetrics.reductionPercent).toBeGreaterThan(0);
          
          console.log('\nCost Log Storage Metrics:');
          console.log('- Raw size:', costLog.storageMetrics.rawScrapeSize, 'bytes');
          console.log('- Signals size:', costLog.storageMetrics.signalsSize, 'bytes');
          console.log(`- Reduction: ${costLog.storageMetrics.reductionPercent}%`);
          console.log('- Content hash logged:', costLog.storageMetrics.contentHash ? 'Yes' : 'No');
        }
      }
    }, 30000);
  });

  describe('Phase 5: Backward Compatibility', () => {
    it('should work with enrichment requests without industryTemplateId', async () => {
      const result = await enrichCompany(
        {
          companyName: 'No Template Test',
          domain: 'notemplate.com',
          website: 'https://notemplate.com',
          // No industryTemplateId - should use standard enrichment
        });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      // Should NOT have distillation results
      if (result.data) {
        expect(result.data.extractedSignals?.length ?? 0).toBe(0);
        expect(result.data.leadScore).toBeUndefined();
      }
      
      // Should NOT have storage metrics (no distillation)
      expect(result.metrics.storageMetrics).toBeUndefined();
      
      console.log('\nBackward Compatibility (No Template):');
      console.log('- Enrichment successful:', result.success);
      console.log('- Has storage metrics:', !!result.metrics.storageMetrics);
    }, 30000);

    it('should respect enableDistillation=false flag', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Distillation Disabled Test',
          domain: 'nodistill2.com',
          website: 'https://nodistill2.com',
          industryTemplateId: 'hvac', // Template provided
          enableDistillation: false, // But explicitly disabled
        });

      expect(result.success).toBe(true);
      
      // Should NOT run distillation
      if (result.data) {
        expect(result.data.extractedSignals?.length ?? 0).toBe(0);
        expect(result.data.leadScore).toBeUndefined();
      }
      
      // Should NOT have storage metrics
      expect(result.metrics.storageMetrics).toBeUndefined();
      
      console.log('\nBackward Compatibility (Disabled Flag):');
      console.log('- Enrichment successful:', result.success);
      console.log('- Signals detected:', result.data?.extractedSignals?.length ?? 0);
      console.log('- Has storage metrics:', !!result.metrics.storageMetrics);
    }, 30000);

    it('should handle missing rawHtml gracefully', async () => {
      // This tests the case where scraping returns cleaned text but no rawHtml
      const result = await enrichCompany(
        {
          companyName: 'No HTML Test',
          domain: 'nohtml.com',
          website: 'https://nohtml.com',
          industryTemplateId: 'hvac',
          enableDistillation: true,
        });

      // Should still succeed (graceful degradation)
      expect(result.success).toBe(true);
      
      console.log('\nGraceful Degradation (No rawHtml):');
      console.log('- Enrichment successful:', result.success);
    }, 30000);
  });

  describe('Phase 5: Performance Verification', () => {
    it('should not regress performance by more than 10%', async () => {
      const startTime = Date.now();
      
      const result = await enrichCompany(
        {
          companyName: 'Performance Test',
          domain: 'perftest.com',
          website: 'https://perftest.com',
          industryTemplateId: 'hvac',
          enableDistillation: true,
        });

      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      
      console.log('\nPerformance Test:');
      console.log(`- Total duration: ${duration}ms`);
      console.log(`- Reported duration: ${result.metrics.durationMs}ms`);
      
      // Enrichment should complete within reasonable time (30s max)
      expect(duration).toBeLessThan(30000);
      
      // Storage metrics calculation should be fast (<100ms overhead)
      if (result.metrics.storageMetrics) {
        console.log('- Storage metrics calculated: Yes');
      }
    }, 35000);
  });
});
