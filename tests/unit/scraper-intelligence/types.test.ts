import { describe, it, expect } from '@jest/globals';
import {
  isResearchIntelligence,
  isHighValueSignal,
  isFluffPattern,
  calculateMaxScore,
  getAllKeywords,
  getFluffRegexes,
  type ResearchIntelligence,
  type HighValueSignal,
  type FluffPattern,
} from '@/types/scraper-intelligence';

describe('Scraper Intelligence Types', () => {
  describe('Type Guards', () => {
    it('should validate valid ResearchIntelligence object', () => {
      const valid: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: ['linkedin-jobs'],
          frequency: 'per-lead',
          enableCaching: true,
          cacheTtlSeconds: 3600,
        },
        highValueSignals: [],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: 1,
          updatedBy: 'system',
        },
      };

      expect(isResearchIntelligence(valid)).toBe(true);
    });

    it('should reject invalid ResearchIntelligence object', () => {
      const invalid = {
        scrapingStrategy: {
          primarySource: 'invalid-source', // Invalid
        },
      };

      expect(isResearchIntelligence(invalid)).toBe(false);
    });

    it('should validate HighValueSignal', () => {
      const valid: HighValueSignal = {
        id: 'test-signal',
        label: 'Test Signal',
        description: 'A test signal',
        keywords: ['test'],
        platform: 'website',
        priority: 'HIGH',
        action: 'increase-score',
        scoreBoost: 10,
      };

      expect(isHighValueSignal(valid)).toBe(true);
    });

    it('should reject invalid HighValueSignal (missing required fields)', () => {
      const invalid = {
        label: 'Test',
        // Missing required fields
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });

    it('should reject HighValueSignal with invalid priority', () => {
      const invalid = {
        id: 'test',
        label: 'Test',
        description: 'Test',
        keywords: ['test'],
        platform: 'website',
        priority: 'INVALID', // Invalid priority
        action: 'increase-score',
        scoreBoost: 10,
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });

    it('should validate FluffPattern', () => {
      const valid: FluffPattern = {
        id: 'test-pattern',
        pattern: '.*boilerplate.*',
        description: 'Remove boilerplate',
      };

      expect(isFluffPattern(valid)).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    it('should calculate max score correctly', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [
          {
            id: 'signal-1',
            label: 'Signal 1',
            description: 'Test',
            keywords: ['test'],
            platform: 'website',
            priority: 'HIGH',
            action: 'increase-score',
            scoreBoost: 20,
          },
          {
            id: 'signal-2',
            label: 'Signal 2',
            description: 'Test',
            keywords: ['test'],
            platform: 'website',
            priority: 'MEDIUM',
            action: 'increase-score',
            scoreBoost: 10,
          },
        ],
        fluffPatterns: [],
        scoringRules: [
          {
            id: 'rule-1',
            name: 'Rule 1',
            description: 'Test rule',
            condition: 'true',
            scoreBoost: 15,
            priority: 1,
            enabled: true,
          },
          {
            id: 'rule-2',
            name: 'Rule 2',
            description: 'Disabled rule',
            condition: 'true',
            scoreBoost: 100, // Should be ignored (disabled)
            priority: 2,
            enabled: false,
          },
        ],
        customFields: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const maxScore = calculateMaxScore(research);
      expect(maxScore).toBe(45); // 20 + 10 + 15 (disabled rule ignored)
    });

    it('should extract all unique keywords', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [
          {
            id: '1',
            label: 'S1',
            description: 'D1',
            keywords: ['emergency', 'urgent', 'EMERGENCY'], // Duplicate (different case)
            platform: 'website',
            priority: 'HIGH',
            action: 'increase-score',
            scoreBoost: 10,
          },
          {
            id: '2',
            label: 'S2',
            description: 'D2',
            keywords: ['hiring', 'jobs'],
            platform: 'linkedin-jobs',
            priority: 'MEDIUM',
            action: 'increase-score',
            scoreBoost: 5,
          },
        ],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const keywords = getAllKeywords(research);
      expect(keywords).toHaveLength(4); // emergency, urgent, hiring, jobs (duplicates removed)
      expect(keywords).toContain('emergency');
      expect(keywords).toContain('urgent');
      expect(keywords).toContain('hiring');
      expect(keywords).toContain('jobs');
      expect(keywords.every((k) => k === k.toLowerCase())).toBe(true); // All lowercase
    });

    it('should compile fluff patterns to RegExp objects', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [
          {
            id: '1',
            pattern: 'All rights reserved',
            description: 'Copyright notice',
          },
          {
            id: '2',
            pattern: 'Privacy Policy',
            description: 'Privacy link',
          },
          {
            id: '3',
            pattern: '[invalid regex', // Invalid regex should be filtered
            description: 'Bad pattern',
          },
        ],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const regexes = getFluffRegexes(research);
      expect(regexes).toHaveLength(2); // Invalid regex excluded
      expect(regexes[0].test('All rights reserved 2025')).toBe(true);
      expect(regexes[1].test('Check our Privacy Policy')).toBe(true);
    });

    it('should handle invalid regex patterns gracefully', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [
          {
            id: '1',
            pattern: '[[[invalid',
            description: 'Bad pattern',
          },
        ],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: 1,
          updatedBy: 'system',
        },
      };

      // Should not throw, should return empty array
      expect(() => getFluffRegexes(research)).not.toThrow();
      expect(getFluffRegexes(research)).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty highValueSignals array', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: 1,
          updatedBy: 'system',
        },
      };

      expect(calculateMaxScore(research)).toBe(0);
      expect(getAllKeywords(research)).toEqual([]);
    });

    it('should handle null/undefined values', () => {
      expect(isResearchIntelligence(null)).toBe(false);
      expect(isResearchIntelligence(undefined)).toBe(false);
      expect(isHighValueSignal(null)).toBe(false);
      expect(isFluffPattern(undefined)).toBe(false);
    });

    it('should reject negative scoreBoost values', () => {
      const invalid = {
        id: 'test',
        label: 'Test',
        description: 'Test',
        keywords: ['test'],
        platform: 'website',
        priority: 'HIGH',
        action: 'increase-score',
        scoreBoost: -10, // Invalid: negative
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });

    it('should reject scoreBoost > 100', () => {
      const invalid = {
        id: 'test',
        label: 'Test',
        description: 'Test',
        keywords: ['test'],
        platform: 'website',
        priority: 'HIGH',
        action: 'increase-score',
        scoreBoost: 150, // Invalid: > 100
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });

    it('should require at least one keyword in HighValueSignal', () => {
      const invalid = {
        id: 'test',
        label: 'Test',
        description: 'Test',
        keywords: [], // Invalid: empty array
        platform: 'website',
        priority: 'HIGH',
        action: 'increase-score',
        scoreBoost: 10,
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });
  });
});
