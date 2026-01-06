/**
 * Unit tests for Distillation Engine
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  detectHighValueSignals,
  removeFluffPatterns,
  calculateLeadScore,
  getDistillationStats,
} from '@/lib/scraper-intelligence/distillation-engine';
import type {
  ResearchIntelligence,
  HighValueSignal,
  ExtractedSignal,
} from '@/types/scraper-intelligence';

describe('Distillation Engine', () => {
  let mockResearch: ResearchIntelligence;

  beforeEach(() => {
    mockResearch = {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: [],
        frequency: 'per-lead',
        enableCaching: true,
      },
      highValueSignals: [
        {
          id: 'hiring',
          label: 'Hiring',
          description: 'Company is actively hiring',
          keywords: ['hiring', "we're hiring", 'open positions', 'careers'],
          platform: 'any',
          priority: 'HIGH',
          action: 'increase-score',
          scoreBoost: 20,
        },
        {
          id: 'emergency',
          label: 'Emergency Service',
          description: 'Offers 24/7 emergency service',
          keywords: ['24/7', 'emergency service', 'emergency', 'urgent'],
          platform: 'website',
          priority: 'CRITICAL',
          action: 'increase-score',
          scoreBoost: 30,
        },
        {
          id: 'expansion',
          label: 'Expansion',
          description: 'Recently expanded or opening new locations',
          keywords: ['new location', 'expansion', 'opening soon'],
          regexPattern: 'opening.{0,20}(new|location|office)',
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
          pattern: 'Privacy Policy',
          description: 'Privacy policy link',
        },
        {
          id: 'cookies',
          pattern: 'This website uses cookies',
          description: 'Cookie banner',
        },
      ],
      scoringRules: [
        {
          id: 'careers-page',
          name: 'Has Careers Page',
          description: 'Bonus if company has careers page',
          condition: 'careersPageExists == true',
          scoreBoost: 10,
          priority: 1,
          enabled: true,
        },
        {
          id: 'multiple-hirings',
          name: 'Multiple Open Positions',
          description: 'Bonus if 5+ open positions',
          condition: 'hiringCount >= 5',
          scoreBoost: 25,
          priority: 2,
          enabled: true,
        },
      ],
      customFields: [],
      metadata: {
        lastUpdated: new Date().toISOString(),
        version: 1,
        updatedBy: 'system',
      },
    };
  });

  describe('detectHighValueSignals', () => {
    it('should detect signals from keywords', () => {
      const content = `
        About Us
        We're a leading HVAC company providing 24/7 emergency service.
        We're hiring! Check out our open positions on the careers page.
      `;

      const signals = detectHighValueSignals(content, mockResearch, 'website');

      expect(signals.length).toBeGreaterThanOrEqual(2);
      
      const hiringSignal = signals.find((s) => s.signalId === 'hiring');
      expect(hiringSignal).toBeDefined();
      expect(hiringSignal?.signalLabel).toBe('Hiring');
      expect(hiringSignal?.confidence).toBeGreaterThan(0);
      expect(hiringSignal?.sourceText.toLowerCase()).toContain('hiring');

      const emergencySignal = signals.find((s) => s.signalId === 'emergency');
      expect(emergencySignal).toBeDefined();
      expect(emergencySignal?.confidence).toBeGreaterThan(hiringSignal!.confidence); // CRITICAL > HIGH
    });

    it('should detect signals from regex patterns', () => {
      const content = 'Exciting news! We are opening a new office in Seattle next month.';

      const signals = detectHighValueSignals(content, mockResearch, 'website');

      const expansionSignal = signals.find((s) => s.signalId === 'expansion');
      expect(expansionSignal).toBeDefined();
      expect(expansionSignal?.sourceText.toLowerCase()).toContain('opening');
    });

    it('should respect platform filtering', () => {
      const research: ResearchIntelligence = {
        ...mockResearch,
        highValueSignals: [
          {
            id: 'linkedin-only',
            label: 'LinkedIn Only Signal',
            description: 'Only detected on LinkedIn',
            keywords: ['linkedin keyword'],
            platform: 'linkedin-jobs',
            priority: 'HIGH',
            action: 'increase-score',
            scoreBoost: 20,
          },
        ],
      };

      const content = 'This page contains linkedin keyword';

      // Should NOT detect when platform is 'website'
      const websiteSignals = detectHighValueSignals(content, research, 'website');
      expect(websiteSignals.length).toBe(0);

      // Should detect when platform is 'linkedin-jobs'
      const linkedinSignals = detectHighValueSignals(
        content,
        research,
        'linkedin-jobs'
      );
      expect(linkedinSignals.length).toBe(1);
    });

    it('should calculate confidence based on priority', () => {
      const content = 'urgent emergency 24/7 hiring';

      const signals = detectHighValueSignals(content, mockResearch, 'website');

      const emergencySignal = signals.find((s) => s.signalId === 'emergency');
      const hiringSignal = signals.find((s) => s.signalId === 'hiring');

      expect(emergencySignal?.confidence).toBeGreaterThan(
        hiringSignal?.confidence || 0
      ); // CRITICAL > HIGH
    });

    it('should boost confidence for multiple occurrences', () => {
      const contentWithMultiple = 'hiring hiring hiring hiring hiring';
      const contentWithOne = 'hiring';

      const signalsMultiple = detectHighValueSignals(
        contentWithMultiple,
        mockResearch,
        'website'
      );
      const signalsOne = detectHighValueSignals(
        contentWithOne,
        mockResearch,
        'website'
      );

      expect(signalsMultiple[0]?.confidence).toBeGreaterThan(
        signalsOne[0]?.confidence || 0
      );
    });

    it('should limit sourceText to 500 chars', () => {
      const longContent = 'hiring ' + 'a'.repeat(1000);

      const signals = detectHighValueSignals(longContent, mockResearch, 'website');

      expect(signals[0]?.sourceText.length).toBeLessThanOrEqual(500);
    });

    it('should handle invalid regex patterns gracefully', () => {
      const research: ResearchIntelligence = {
        ...mockResearch,
        highValueSignals: [
          {
            id: 'invalid-regex',
            label: 'Invalid Regex',
            description: 'Has invalid regex',
            keywords: [],
            regexPattern: '[[[invalid', // Invalid regex
            platform: 'any',
            priority: 'HIGH',
            action: 'increase-score',
            scoreBoost: 10,
          },
        ],
      };

      const content = 'test content';

      // Should not throw error
      expect(() =>
        detectHighValueSignals(content, research, 'website')
      ).not.toThrow();
    });
  });

  describe('removeFluffPatterns', () => {
    it('should remove copyright notices', () => {
      const content = '© 2025 Company Inc. All rights reserved. About us...';

      const cleaned = removeFluffPatterns(content, mockResearch);

      expect(cleaned).not.toContain('© 2025');
      expect(cleaned).not.toContain('All rights reserved');
      expect(cleaned).toContain('About us');
    });

    it('should remove privacy policy links', () => {
      const content = 'Main content Privacy Policy footer';

      const cleaned = removeFluffPatterns(content, mockResearch);

      expect(cleaned).not.toContain('Privacy Policy');
      expect(cleaned).toContain('Main content');
    });

    it('should remove cookie banners', () => {
      const content = 'This website uses cookies to improve your experience. Main content.';

      const cleaned = removeFluffPatterns(content, mockResearch);

      expect(cleaned).not.toContain('This website uses cookies');
      expect(cleaned).toContain('Main content');
    });

    it('should normalize whitespace', () => {
      const content = 'Text   with    excessive     whitespace';

      const cleaned = removeFluffPatterns(content, mockResearch);

      expect(cleaned).toBe('Text with excessive whitespace');
    });

    it('should handle empty fluff patterns', () => {
      const research: ResearchIntelligence = {
        ...mockResearch,
        fluffPatterns: [],
      };

      const content = 'Test content';

      const cleaned = removeFluffPatterns(content, research);

      expect(cleaned).toBe('Test content');
    });
  });

  describe('calculateLeadScore', () => {
    let signals: ExtractedSignal[];

    beforeEach(() => {
      signals = [
        {
          signalId: 'hiring',
          signalLabel: 'Hiring',
          sourceText: "We're hiring!",
          confidence: 80,
          platform: 'website',
          extractedAt: new Date(),
          sourceScrapeId: 'scrape_123',
        },
        {
          signalId: 'emergency',
          signalLabel: 'Emergency Service',
          sourceText: '24/7 emergency service',
          confidence: 90,
          platform: 'website',
          extractedAt: new Date(),
          sourceScrapeId: 'scrape_123',
        },
      ];
    });

    it('should calculate score from detected signals', () => {
      const score = calculateLeadScore(signals, mockResearch, {});

      // hiring: 20 boost * 0.8 confidence = 16
      // emergency: 30 boost * 0.9 confidence = 27
      // Total: 43
      expect(score).toBeCloseTo(43, 0);
    });

    it('should apply scoring rules', () => {
      const score = calculateLeadScore(signals, mockResearch, {
        careersPageExists: true,
        hiringCount: 5,
      });

      // Signals: 43
      // careers-page rule: 10
      // multiple-hirings rule: 25
      // Total: 78
      expect(score).toBeCloseTo(78, 0);
    });

    it('should skip disabled scoring rules', () => {
      const research: ResearchIntelligence = {
        ...mockResearch,
        scoringRules: mockResearch.scoringRules.map((rule) => ({
          ...rule,
          enabled: false,
        })),
      };

      const scoreWithRules = calculateLeadScore(signals, mockResearch, {
        careersPageExists: true,
      });

      const scoreWithoutRules = calculateLeadScore(signals, research, {
        careersPageExists: true,
      });

      expect(scoreWithoutRules).toBeLessThan(scoreWithRules);
    });

    it('should cap score at 150', () => {
      // Create many high-scoring signals
      const manySignals: ExtractedSignal[] = Array(20)
        .fill(null)
        .map((_, i) => ({
          signalId: `signal_${i}`,
          signalLabel: `Signal ${i}`,
          sourceText: 'test',
          confidence: 100,
          platform: 'website' as const,
          extractedAt: new Date(),
          sourceScrapeId: 'scrape_123',
        }));

      const score = calculateLeadScore(manySignals, mockResearch, {});

      expect(score).toBeLessThanOrEqual(150);
    });

    it('should handle missing signal definitions gracefully', () => {
      const unknownSignals: ExtractedSignal[] = [
        {
          signalId: 'unknown_signal',
          signalLabel: 'Unknown',
          sourceText: 'test',
          confidence: 100,
          platform: 'website',
          extractedAt: new Date(),
          sourceScrapeId: 'scrape_123',
        },
      ];

      // Should not throw error
      expect(() =>
        calculateLeadScore(unknownSignals, mockResearch, {})
      ).not.toThrow();
    });
  });

  describe('getDistillationStats', () => {
    it('should calculate statistics correctly', () => {
      const signals: ExtractedSignal[] = [
        {
          signalId: 'hiring',
          signalLabel: 'Hiring',
          sourceText: 'test',
          confidence: 80,
          platform: 'website',
          extractedAt: new Date(),
          sourceScrapeId: 'scrape_1',
        },
        {
          signalId: 'hiring',
          signalLabel: 'Hiring',
          sourceText: 'test',
          confidence: 90,
          platform: 'linkedin-jobs',
          extractedAt: new Date(),
          sourceScrapeId: 'scrape_2',
        },
        {
          signalId: 'emergency',
          signalLabel: 'Emergency',
          sourceText: 'test',
          confidence: 95,
          platform: 'website',
          extractedAt: new Date(),
          sourceScrapeId: 'scrape_3',
        },
      ];

      const stats = getDistillationStats(signals);

      expect(stats.totalSignals).toBe(3);
      expect(stats.averageConfidence).toBeCloseTo(88.33, 1);
      expect(stats.signalsByPlatform.website).toBe(2);
      expect(stats.signalsByPlatform['linkedin-jobs']).toBe(1);
      expect(stats.topSignals[0]?.signalId).toBe('hiring');
      expect(stats.topSignals[0]?.count).toBe(2);
    });

    it('should handle empty signals array', () => {
      const stats = getDistillationStats([]);

      expect(stats.totalSignals).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.topSignals).toHaveLength(0);
    });

    it('should limit top signals to 10', () => {
      const signals: ExtractedSignal[] = Array(20)
        .fill(null)
        .map((_, i) => ({
          signalId: `signal_${i}`,
          signalLabel: `Signal ${i}`,
          sourceText: 'test',
          confidence: 80,
          platform: 'website' as const,
          extractedAt: new Date(),
          sourceScrapeId: 'scrape_1',
        }));

      const stats = getDistillationStats(signals);

      expect(stats.topSignals.length).toBeLessThanOrEqual(10);
    });
  });
});
