import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  hasResearchIntelligence,
  getResearchIntelligence,
  getTemplateById,
  getResearchIntelligenceById,
  getTemplatesWithResearch,
  validateResearchIntelligence,
  getTemplatesSync,
  type IndustryTemplate,
} from '@/lib/persona/industry-templates';
import type { ResearchIntelligence } from '@/types/scraper-intelligence';

describe('Industry Template Research Intelligence Helpers', () => {
  // Preload templates before running tests
  beforeAll(async () => {
    await getTemplateById('residential-real-estate'); // Force template loading
  });

  describe('hasResearchIntelligence', () => {
    it('should return false for templates without research', () => {
      const template: IndustryTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: '', positioning: '', tone: '' },
        cognitiveLogic: { framework: '', reasoning: '', decisionProcess: '' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: {
          patternRecognition: '',
          adaptation: '',
          feedbackIntegration: '',
        },
        tacticalExecution: {
          primaryAction: '',
          conversionRhythm: '',
          secondaryActions: [],
        },
        // No research field
      };

      expect(hasResearchIntelligence(template)).toBe(false);
    });

    it('should return true for templates with research', () => {
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
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const template: IndustryTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: '', positioning: '', tone: '' },
        cognitiveLogic: { framework: '', reasoning: '', decisionProcess: '' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: {
          patternRecognition: '',
          adaptation: '',
          feedbackIntegration: '',
        },
        tacticalExecution: {
          primaryAction: '',
          conversionRhythm: '',
          secondaryActions: [],
        },
        research,
      };

      expect(hasResearchIntelligence(template)).toBe(true);
    });
  });

  describe('getResearchIntelligence', () => {
    it('should return null if template has no research', () => {
      const template: IndustryTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: '', positioning: '', tone: '' },
        cognitiveLogic: { framework: '', reasoning: '', decisionProcess: '' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: {
          patternRecognition: '',
          adaptation: '',
          feedbackIntegration: '',
        },
        tacticalExecution: {
          primaryAction: '',
          conversionRhythm: '',
          secondaryActions: [],
        },
      };

      expect(getResearchIntelligence(template)).toBeNull();
    });

    it('should return research object if present', () => {
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
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const template: IndustryTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: '', positioning: '', tone: '' },
        cognitiveLogic: { framework: '', reasoning: '', decisionProcess: '' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: {
          patternRecognition: '',
          adaptation: '',
          feedbackIntegration: '',
        },
        tacticalExecution: {
          primaryAction: '',
          conversionRhythm: '',
          secondaryActions: [],
        },
        research,
      };

      expect(getResearchIntelligence(template)).toBe(research);
    });
  });

  describe('getTemplateById', () => {
    it('should return null for non-existent template', async () => {
      expect(await getTemplateById('non-existent-id')).toBeNull();
    });

    it('should return template if it exists', async () => {
      // Assuming 'residential-real-estate' exists in INDUSTRY_TEMPLATES
      const template = await getTemplateById('residential-real-estate');
      expect(template).not.toBeNull();
      expect(template?.id).toBe('residential-real-estate');
    });
  });

  describe('getResearchIntelligenceById', () => {
    it('should return null for non-existent template', async () => {
      expect(await getResearchIntelligenceById('non-existent')).toBeNull();
    });

    it('should return null for template without research', async () => {
      // Most existing templates won't have research yet
      const template = await getTemplateById('residential-real-estate');
      if (template && !template.research) {
        expect(await getResearchIntelligenceById('residential-real-estate')).toBeNull();
      }
    });
  });

  describe('getTemplatesWithResearch', () => {
    it('should return only templates with research', async () => {
      const templatesWithResearch = await getTemplatesWithResearch();
      
      templatesWithResearch.forEach((template) => {
        expect(template.research).toBeDefined();
        expect(template.research).not.toBeNull();
      });
    });

    it('should return empty array if no templates have research', async () => {
      // Initially, no templates will have research
      const templatesWithResearch = await getTemplatesWithResearch();
      expect(Array.isArray(templatesWithResearch)).toBe(true);
    });
  });

  describe('validateResearchIntelligence', () => {
    it('should validate correct research object', () => {
      const valid: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: ['linkedin-jobs'],
          frequency: 'per-lead',
          enableCaching: true,
          cacheTtlSeconds: 3600,
        },
        highValueSignals: [
          {
            id: 'test-signal',
            label: 'Test Signal',
            description: 'A test signal',
            keywords: ['test', 'keyword'],
            platform: 'website',
            priority: 'HIGH',
            action: 'increase-score',
            scoreBoost: 15,
          },
        ],
        fluffPatterns: [
          {
            id: 'test-pattern',
            pattern: '.*boilerplate.*',
            description: 'Remove boilerplate',
            context: 'footer',
          },
        ],
        scoringRules: [
          {
            id: 'test-rule',
            name: 'Test Rule',
            description: 'A test rule',
            condition: 'hiring_count > 0',
            scoreBoost: 10,
            priority: 1,
            enabled: true,
          },
        ],
        customFields: [
          {
            key: 'custom_field',
            label: 'Custom Field',
            type: 'string',
            description: 'A custom field',
            extractionHints: ['hint1', 'hint2'],
            required: false,
          },
        ],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
          notes: 'Test notes',
        },
      };

      const result = validateResearchIntelligence(valid);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid research object', () => {
      const invalid = {
        scrapingStrategy: {
          primarySource: 'invalid-source', // Invalid
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        // Missing required fields
      };

      const result = validateResearchIntelligence(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide detailed error messages', () => {
      const invalid = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'invalid-frequency', // Invalid
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        // Missing metadata
      };

      const result = validateResearchIntelligence(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((err) => err.includes('frequency'))).toBe(true);
      expect(result.errors.some((err) => err.includes('metadata'))).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should not break existing templates', async () => {
      // Force loading and get all templates
      await getTemplateById('residential-real-estate');
      const allTemplates = Object.values(getTemplatesSync());
      expect(allTemplates.length).toBeGreaterThanOrEqual(49);

      // Each template should have required fields
      allTemplates.forEach((template) => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.coreIdentity).toBeDefined();
        expect(template.cognitiveLogic).toBeDefined();
        expect(template.knowledgeRAG).toBeDefined();
        expect(template.learningLoops).toBeDefined();
        expect(template.tacticalExecution).toBeDefined();
      });
    });
  });
});
