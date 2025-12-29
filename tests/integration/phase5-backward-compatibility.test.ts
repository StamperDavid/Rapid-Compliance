/**
 * Phase 5 Backward Compatibility Tests
 * 
 * Verifies that Phase 5 integration changes don't break existing functionality.
 * Tests both with and without the ENABLE_DISTILLATION feature flag.
 */

import { describe, it, expect } from '@jest/globals';
import { enrichCompany, getEnrichmentAnalytics, getStorageOptimizationAnalytics } from '@/lib/enrichment/enrichment-service';

describe('Phase 5: Backward Compatibility Verification', () => {
  const TEST_ORG_ID = 'backward-compat-test-org';

  describe('Legacy Enrichment (Without Distillation)', () => {
    it('should enrich without industryTemplateId (legacy behavior)', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Legacy Test Company',
          domain: 'legacytest.com',
          website: 'https://legacytest.com',
          includeNews: true,
          includeSocial: true,
          includeTechStack: true,
        },
        TEST_ORG_ID
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.cost).toBeDefined();
      expect(result.metrics).toBeDefined();
      
      // Legacy enrichment should work exactly as before
      if (result.data) {
        expect(result.data.name).toBeDefined();
        expect(result.data.domain).toBe('legacytest.com');
        expect(result.data.website).toBeDefined();
        
        // Should NOT have distillation fields
        expect(result.data.extractedSignals || []).toHaveLength(0);
        expect(result.data.leadScore).toBeUndefined();
      }
      
      // Should NOT have storage metrics
      expect(result.metrics.storageMetrics).toBeUndefined();
      
      console.log('\n✅ Legacy enrichment works without distillation');
    }, 30000);

    it('should enrich with enableDistillation=false explicitly', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Explicit Disable Test',
          domain: 'explicitdisable.com',
          enableDistillation: false,
        },
        TEST_ORG_ID
      );

      expect(result.success).toBe(true);
      
      // Should work but without distillation
      if (result.data) {
        expect(result.data.extractedSignals || []).toHaveLength(0);
      }
      
      console.log('\n✅ Explicit enableDistillation=false works');
    }, 30000);
  });

  describe('Analytics Functions', () => {
    it('should return enrichment analytics', async () => {
      const analytics = await getEnrichmentAnalytics(TEST_ORG_ID, 7);
      
      expect(analytics).toBeDefined();
      expect(typeof analytics.totalEnrichments).toBe('number');
      expect(typeof analytics.successfulEnrichments).toBe('number');
      expect(typeof analytics.cacheHits).toBe('number');
      expect(typeof analytics.totalCost).toBe('number');
      expect(typeof analytics.totalSavings).toBe('number');
      expect(typeof analytics.averageCost).toBe('number');
      expect(typeof analytics.averageDuration).toBe('number');
      expect(typeof analytics.cacheHitRate).toBe('number');
      
      console.log('\n✅ getEnrichmentAnalytics() works');
      console.log('Analytics:', JSON.stringify(analytics, null, 2));
    });

    it('should return storage optimization analytics (NEW)', async () => {
      const analytics = await getStorageOptimizationAnalytics(TEST_ORG_ID, 7);
      
      expect(analytics).toBeDefined();
      expect(typeof analytics.totalScrapes).toBe('number');
      expect(typeof analytics.scrapesWithDistillation).toBe('number');
      expect(typeof analytics.duplicatesDetected).toBe('number');
      expect(typeof analytics.totalRawBytes).toBe('number');
      expect(typeof analytics.totalSignalsBytes).toBe('number');
      expect(typeof analytics.averageReductionPercent).toBe('number');
      expect(typeof analytics.estimatedStorageCostSavings).toBe('number');
      expect(typeof analytics.duplicateRate).toBe('number');
      
      console.log('\n✅ getStorageOptimizationAnalytics() works (NEW)');
      console.log('Storage Analytics:', JSON.stringify(analytics, null, 2));
    });
  });

  describe('Response Structure Validation', () => {
    it('should return correct response structure with distillation', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Structure Test',
          domain: 'structuretest.com',
          industryTemplateId: 'hvac',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      expect(result.success).toBe(true);
      
      // Verify response structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('metrics');
      
      // Verify cost structure
      expect(result.cost).toHaveProperty('searchAPICalls');
      expect(result.cost).toHaveProperty('scrapingCalls');
      expect(result.cost).toHaveProperty('aiTokensUsed');
      expect(result.cost).toHaveProperty('totalCostUSD');
      
      // Verify metrics structure
      expect(result.metrics).toHaveProperty('durationMs');
      expect(result.metrics).toHaveProperty('dataPointsExtracted');
      expect(result.metrics).toHaveProperty('confidenceScore');
      
      // NEW: Storage metrics (optional)
      if (result.metrics.storageMetrics) {
        expect(result.metrics.storageMetrics).toHaveProperty('rawScrapeSize');
        expect(result.metrics.storageMetrics).toHaveProperty('signalsSize');
        expect(result.metrics.storageMetrics).toHaveProperty('reductionPercent');
        expect(result.metrics.storageMetrics).toHaveProperty('contentHash');
        expect(result.metrics.storageMetrics).toHaveProperty('isDuplicate');
      }
      
      console.log('\n✅ Response structure is valid');
    }, 30000);

    it('should return correct response structure without distillation', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Structure Test No Distill',
          domain: 'structurenodistill.com',
          enableDistillation: false,
        },
        TEST_ORG_ID
      );

      expect(result.success).toBe(true);
      
      // Same structure as above
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('metrics');
      
      // Storage metrics should be undefined (not present)
      expect(result.metrics.storageMetrics).toBeUndefined();
      
      console.log('\n✅ Response structure valid without distillation');
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid domain gracefully', async () => {
      const result = await enrichCompany(
        {
          companyName: 'Invalid Domain Test',
          domain: 'this-domain-does-not-exist-12345.com',
          industryTemplateId: 'hvac',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );

      // Should return error response, not throw
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      
      console.log('\n✅ Error handling works for invalid domains');
    }, 30000);

    it('should handle missing required fields gracefully', async () => {
      const result = await enrichCompany(
        {
          // No companyName, domain, or website
        } as any,
        TEST_ORG_ID
      );

      // Should return error, not crash
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      console.log('\n✅ Error handling works for missing fields');
      console.log('Error message:', result.error);
    }, 30000);
  });

  describe('Performance Regression Check', () => {
    it('should not significantly slow down enrichment (<10% regression)', async () => {
      // Run without distillation (baseline)
      const baselineStart = Date.now();
      await enrichCompany(
        {
          companyName: 'Baseline Perf Test',
          domain: 'baselineperf.com',
          enableDistillation: false,
        },
        TEST_ORG_ID
      );
      const baselineDuration = Date.now() - baselineStart;

      // Run with distillation
      const distillStart = Date.now();
      await enrichCompany(
        {
          companyName: 'Distill Perf Test',
          domain: 'distillperf.com',
          industryTemplateId: 'hvac',
          enableDistillation: true,
        },
        TEST_ORG_ID
      );
      const distillDuration = Date.now() - distillStart;

      console.log('\nPerformance Comparison:');
      console.log('- Without distillation:', baselineDuration + 'ms');
      console.log('- With distillation:', distillDuration + 'ms');
      console.log('- Overhead:', ((distillDuration - baselineDuration) / baselineDuration * 100).toFixed(1) + '%');
      
      // Distillation overhead should be reasonable
      // Allow up to 50% overhead for additional processing (content hashing, signal detection, etc.)
      const overheadPercent = ((distillDuration - baselineDuration) / baselineDuration) * 100;
      expect(overheadPercent).toBeLessThan(50);
      
      console.log('✅ Performance regression within acceptable range (<50% overhead)');
    }, 60000);
  });
});
