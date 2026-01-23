/**
 * Mutation Engine Tests (TDD)
 * 
 * Tests the core mutation engine that compiles IndustryTemplates + OnboardingData → BaseModel
 * 
 * Test Strategy:
 * 1. Deep merge verification
 * 2. Weight calculations (mathematical correctness)
 * 3. Conditional mutations based on onboarding data
 * 4. Persona adjustments
 * 5. Edge cases and error handling
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MutationEngine } from '../mutation-engine';
import type { IndustryTemplate } from '@/lib/persona/templates/types';
import type { OnboardingData } from '@/types/agent-memory';

describe('MutationEngine', () => {
  let engine: MutationEngine;

  beforeEach(() => {
    engine = new MutationEngine();
  });

  describe('Weight Calculations', () => {
    it('should increase signal weight by +3 for Enterprise focus', () => {
      const template: IndustryTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test',
        category: 'Test',
        coreIdentity: {
          title: 'Test',
          positioning: 'Test',
          tone: 'professional'
        },
        cognitiveLogic: {
          framework: 'Test',
          reasoning: 'Test',
          decisionProcess: 'Test'
        },
        knowledgeRAG: {
          static: [],
          dynamic: []
        },
        learningLoops: {
          patternRecognition: 'Test',
          adaptation: 'Test',
          feedbackIntegration: 'Test'
        },
        tacticalExecution: {
          primaryAction: 'Test',
          conversionRhythm: 'Test',
          secondaryActions: []
        },
        research: {
          scrapingStrategy: {
            primarySource: 'website',
            secondarySources: [],
            frequency: 'per-lead',
            enableCaching: false
          },
          highValueSignals: [
            {
              id: 'funding',
              label: 'Funding',
              description: 'Test',
              keywords: ['funding'],
              priority: 'HIGH',
              action: 'increase-score',
              scoreBoost: 20,
              platform: 'any'
            }
          ],
          fluffPatterns: [],
          scoringRules: [],
          customFields: [],
          metadata: {
            lastUpdated: new Date().toISOString(),
            version: 1,
            updatedBy: 'system'
          }
        }
      };

      const onboarding: Partial<OnboardingData> = {
        businessName: 'Test Corp',
        industry: 'saas',
        targetCustomer: 'Enterprise customers with 500+ employees'
      };

      const result = engine.compile(template, onboarding as OnboardingData);

      // Verify weight increased by exactly 3
      const fundingSignal = result.research?.highValueSignals.find(s => s.id === 'funding');
      expect(fundingSignal?.scoreBoost).toBe(23); // 20 + 3
    });

    it('should NOT modify weights when focus is not Enterprise', () => {
      const template: IndustryTemplate = {
        id: 'test-template',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: 'Test', positioning: 'Test', tone: 'professional' },
        cognitiveLogic: { framework: 'Test', reasoning: 'Test', decisionProcess: 'Test' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: { patternRecognition: 'Test', adaptation: 'Test', feedbackIntegration: 'Test' },
        tacticalExecution: { primaryAction: 'Test', conversionRhythm: 'Test', secondaryActions: [] },
        research: {
          scrapingStrategy: {
            primarySource: 'website',
            secondarySources: [],
            frequency: 'per-lead',
            enableCaching: false
          },
          highValueSignals: [
            {
              id: 'funding',
              label: 'Funding',
              description: 'Test',
              keywords: ['funding'],
              priority: 'HIGH',
              action: 'increase-score',
              scoreBoost: 20,
              platform: 'any'
            }
          ],
          fluffPatterns: [],
          scoringRules: [],
          customFields: [],
          metadata: {
            lastUpdated: new Date().toISOString(),
            version: 1,
            updatedBy: 'system'
          }
        }
      };

      const onboarding: Partial<OnboardingData> = {
        businessName: 'Test Corp',
        industry: 'saas',
        targetCustomer: 'Small businesses with 10-50 employees'
      };

      const result = engine.compile(template, onboarding as OnboardingData);

      // Weight should remain unchanged
      const fundingSignal = result.research?.highValueSignals.find(s => s.id === 'funding');
      expect(fundingSignal?.scoreBoost).toBe(20); // Original value
    });

    it('should apply multiple weight adjustments additively', () => {
      const template: IndustryTemplate = {
        id: 'test-template',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: 'Test', positioning: 'Test', tone: 'professional' },
        cognitiveLogic: { framework: 'Test', reasoning: 'Test', decisionProcess: 'Test' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: { patternRecognition: 'Test', adaptation: 'Test', feedbackIntegration: 'Test' },
        tacticalExecution: { primaryAction: 'Test', conversionRhythm: 'Test', secondaryActions: [] },
        research: {
          scrapingStrategy: {
            primarySource: 'website',
            secondarySources: [],
            frequency: 'per-lead',
            enableCaching: false
          },
          highValueSignals: [
            {
              id: 'hiring',
              label: 'Hiring',
              description: 'Test',
              keywords: ['hiring'],
              priority: 'HIGH',
              action: 'increase-score',
              scoreBoost: 15,
              platform: 'any'
            }
          ],
          fluffPatterns: [],
          scoringRules: [],
          customFields: [],
          metadata: {
            lastUpdated: new Date().toISOString(),
            version: 1,
            updatedBy: 'system'
          }
        }
      };

      const onboarding: Partial<OnboardingData> = {
        businessName: 'Test Corp',
        industry: 'saas',
        targetCustomer: 'Enterprise customers',
        closingStyle: 8 // Aggressive closing
      };

      const result = engine.compile(template, onboarding as OnboardingData);

      // Should apply Enterprise boost (+3) AND aggressive closing boost (+2) = +5 total
      const hiringSignal = result.research?.highValueSignals.find(s => s.id === 'hiring');
      expect(hiringSignal?.scoreBoost).toBe(20); // 15 + 3 + 2
    });
  });

  describe('Persona Adjustments', () => {
    it('should adjust tone to "Direct, urgent" for aggressive closing style', () => {
      const template: IndustryTemplate = {
        id: 'test-template',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { 
          title: 'Test', 
          positioning: 'Test', 
          tone: 'Warm, reassuring, professional' 
        },
        cognitiveLogic: { framework: 'Test', reasoning: 'Test', decisionProcess: 'Test' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: { patternRecognition: 'Test', adaptation: 'Test', feedbackIntegration: 'Test' },
        tacticalExecution: { 
          primaryAction: 'Test', 
          conversionRhythm: 'Every interaction ends with a soft suggestion', 
          secondaryActions: [] 
        }
      };

      const onboarding: Partial<OnboardingData> = {
        businessName: 'Test Corp',
        industry: 'saas',
        closingStyle: 9 // Very aggressive
      };

      const result = engine.compile(template, onboarding as OnboardingData);

      expect(result.coreIdentity.tone).toContain('Direct');
      expect(result.coreIdentity.tone).toContain('urgent');
    });

    it('should preserve original tone for moderate closing style', () => {
      const template: IndustryTemplate = {
        id: 'test-template',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { 
          title: 'Test', 
          positioning: 'Test', 
          tone: 'Warm, reassuring, professional' 
        },
        cognitiveLogic: { framework: 'Test', reasoning: 'Test', decisionProcess: 'Test' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: { patternRecognition: 'Test', adaptation: 'Test', feedbackIntegration: 'Test' },
        tacticalExecution: { 
          primaryAction: 'Test', 
          conversionRhythm: 'Test', 
          secondaryActions: [] 
        }
      };

      const onboarding: Partial<OnboardingData> = {
        businessName: 'Test Corp',
        industry: 'saas',
        closingStyle: 5 // Moderate
      };

      const result = engine.compile(template, onboarding as OnboardingData);

      expect(result.coreIdentity.tone).toBe('Warm, reassuring, professional');
    });
  });

  describe('Deep Merge', () => {
    it('should deep merge nested objects without losing data', () => {
      const template: IndustryTemplate = {
        id: 'test-template',
        name: 'Original Name',
        description: 'Test',
        category: 'Test',
        coreIdentity: { 
          title: 'Original Title', 
          positioning: 'Original Positioning', 
          tone: 'professional' 
        },
        cognitiveLogic: { framework: 'Test', reasoning: 'Test', decisionProcess: 'Test' },
        knowledgeRAG: { 
          static: ['original-doc-1', 'original-doc-2'], 
          dynamic: ['original-api-1'] 
        },
        learningLoops: { patternRecognition: 'Test', adaptation: 'Test', feedbackIntegration: 'Test' },
        tacticalExecution: { primaryAction: 'Test', conversionRhythm: 'Test', secondaryActions: [] }
      };

      const onboarding: Partial<OnboardingData> = {
        businessName: 'Test Corp',
        industry: 'saas'
      };

      const result = engine.compile(template, onboarding as OnboardingData);

      // Original data should be preserved
      expect(result.name).toBe('Original Name');
      expect(result.coreIdentity.title).toBe('Original Title');
      expect(result.knowledgeRAG.static).toContain('original-doc-1');
      expect(result.knowledgeRAG.dynamic).toContain('original-api-1');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid onboarding data', () => {
      const template: IndustryTemplate = {
        id: 'test-template',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: 'Test', positioning: 'Test', tone: 'professional' },
        cognitiveLogic: { framework: 'Test', reasoning: 'Test', decisionProcess: 'Test' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: { patternRecognition: 'Test', adaptation: 'Test', feedbackIntegration: 'Test' },
        tacticalExecution: { primaryAction: 'Test', conversionRhythm: 'Test', secondaryActions: [] }
      };

      expect(() => {
        engine.compile(template, null as unknown as OnboardingData);
      }).toThrow();
    });

    it('should handle missing research intelligence gracefully', () => {
      const template: IndustryTemplate = {
        id: 'test-template',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: 'Test', positioning: 'Test', tone: 'professional' },
        cognitiveLogic: { framework: 'Test', reasoning: 'Test', decisionProcess: 'Test' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: { patternRecognition: 'Test', adaptation: 'Test', feedbackIntegration: 'Test' },
        tacticalExecution: { primaryAction: 'Test', conversionRhythm: 'Test', secondaryActions: [] }
        // No research field
      };

      const onboarding: Partial<OnboardingData> = {
        businessName: 'Test Corp',
        industry: 'saas'
      };

      const result = engine.compile(template, onboarding as OnboardingData);

      expect(result).toBeDefined();
      expect(result.research).toBeUndefined();
    });
  });

  describe('Conditional Mutations', () => {
    it('should apply B2B-specific mutations for business target customers', () => {
      const template: IndustryTemplate = {
        id: 'test-template',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: 'Test', positioning: 'Test', tone: 'friendly' },
        cognitiveLogic: { 
          framework: 'Basic Sales',
          reasoning: 'Simple logic', 
          decisionProcess: 'Quick close' 
        },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: { patternRecognition: 'Test', adaptation: 'Test', feedbackIntegration: 'Test' },
        tacticalExecution: { primaryAction: 'Test', conversionRhythm: 'Test', secondaryActions: [] }
      };

      const onboarding: Partial<OnboardingData> = {
        businessName: 'Test Corp',
        industry: 'saas',
        targetCustomer: 'B2B companies with complex procurement processes'
      };

      const result = engine.compile(template, onboarding as OnboardingData);

      // Should adjust framework for B2B complexity
      expect(result.cognitiveLogic.framework).toContain('B2B');
    });
  });
});
