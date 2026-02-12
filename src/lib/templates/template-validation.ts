/**
 * Template Validation Schema
 * 
 * Zod schemas for validating industry template structure
 */

import { z } from 'zod';

/**
 * Core Identity Schema
 */
const CoreIdentitySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  positioning: z.string().min(1, 'Positioning is required'),
  tone: z.string().min(1, 'Tone is required'),
});

/**
 * Cognitive Logic Schema
 */
const CognitiveLogicSchema = z.object({
  framework: z.string().min(1, 'Framework is required'),
  reasoning: z.string().min(1, 'Reasoning is required'),
  decisionProcess: z.string().min(1, 'Decision process is required'),
});

/**
 * Knowledge RAG Schema
 */
const KnowledgeRAGSchema = z.object({
  static: z.array(z.string()).min(1, 'At least one static knowledge item required'),
  dynamic: z.array(z.string()).min(1, 'At least one dynamic knowledge item required'),
});

/**
 * Learning Loops Schema
 */
const LearningLoopsSchema = z.object({
  patternRecognition: z.string().min(1, 'Pattern recognition is required'),
  adaptation: z.string().min(1, 'Adaptation is required'),
  feedbackIntegration: z.string().min(1, 'Feedback integration is required'),
});

/**
 * Tactical Execution Schema
 */
const TacticalExecutionSchema = z.object({
  primaryAction: z.string().min(1, 'Primary action is required'),
  conversionRhythm: z.string().min(1, 'Conversion rhythm is required'),
  secondaryActions: z.array(z.string()).min(1, 'At least one secondary action required'),
});

/**
 * Research Intelligence Schemas
 */
const ScrapingStrategySchema = z.object({
  primarySource: z.string(),
  secondarySources: z.array(z.string()),
  frequency: z.enum(['per-lead', 'daily', 'weekly', 'monthly']),
  timeoutMs: z.number().min(1000).max(60000),
  enableCaching: z.boolean(),
  cacheTtlSeconds: z.number().min(0).max(3600),
});

const HighValueSignalSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  regexPattern: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  action: z.enum(['increase-score', 'decrease-score', 'add-to-segment', 'trigger-workflow']),
  scoreBoost: z.number().min(-100).max(100),
  platform: z.enum(['website', 'linkedin-company', 'linkedin-jobs', 'google-business', 'any']),
});

const FluffPatternSchema = z.object({
  id: z.string().min(1),
  pattern: z.string().min(1),
  description: z.string().min(1),
  context: z.enum(['header', 'footer', 'sidebar', 'body', 'all']),
});

const ScoringRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  condition: z.string().min(1),
  scoreBoost: z.number().min(-100).max(100),
  priority: z.number().min(1).max(100),
  enabled: z.boolean(),
});

const CustomFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object', 'date']),
  description: z.string().min(1),
  extractionHints: z.array(z.string()),
  required: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const ResearchIntelligenceMetadataSchema = z.object({
  lastUpdated: z.string(),
  version: z.number(),
  updatedBy: z.string(),
  notes: z.string(),
});

const ResearchIntelligenceSchema = z.object({
  scrapingStrategy: ScrapingStrategySchema,
  highValueSignals: z.array(HighValueSignalSchema).min(1, 'At least one high-value signal required'),
  fluffPatterns: z.array(FluffPatternSchema).min(1, 'At least one fluff pattern required'),
  scoringRules: z.array(ScoringRuleSchema).min(1, 'At least one scoring rule required'),
  customFields: z.array(CustomFieldSchema),
  metadata: ResearchIntelligenceMetadataSchema,
}).optional();

/**
 * Complete Industry Template Schema
 */
export const IndustryTemplateSchema = z.object({
  id: z
    .string()
    .min(1, 'Template ID is required')
    .regex(/^[a-z0-9-]+$/, 'ID must be lowercase with hyphens only'),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  coreIdentity: CoreIdentitySchema,
  cognitiveLogic: CognitiveLogicSchema,
  knowledgeRAG: KnowledgeRAGSchema,
  learningLoops: LearningLoopsSchema,
  tacticalExecution: TacticalExecutionSchema,
  research: ResearchIntelligenceSchema,
});

/**
 * Standard Base Template for new industries
 */
export const STANDARD_BASE_TEMPLATE = {
  name: 'New Industry',
  id: 'new-industry-id',
  description: 'Description for new industry',
  category: 'Uncategorized',
  coreIdentity: {
    title: 'Industry Professional',
    positioning: 'Professional and knowledgeable',
    tone: 'Professional',
  },
  cognitiveLogic: {
    framework: 'Standard Framework',
    reasoning: 'Logic-based reasoning approach',
    decisionProcess: 'Discovery → Solution → Action',
  },
  knowledgeRAG: {
    static: ['Industry standards', 'Best practices'],
    dynamic: ['Current offerings', 'Pricing', 'Availability'],
  },
  learningLoops: {
    patternRecognition: 'Detects customer pain points and objections',
    adaptation: 'Adjusts messaging based on customer responses',
    feedbackIntegration: 'Learns from successful conversions',
  },
  tacticalExecution: {
    primaryAction: 'Schedule Consultation',
    conversionRhythm: 'Every interaction focuses on understanding needs and booking next step',
    secondaryActions: [
      'Send information',
      'Answer questions',
      'Provide pricing',
      'Share testimonials',
    ],
  },
  research: {
    scrapingStrategy: {
      primarySource: 'website',
      secondarySources: ['linkedin-company', 'google-business'],
      frequency: 'per-lead' as const,
      timeoutMs: 30000,
      enableCaching: true,
      cacheTtlSeconds: 300,
    },
    highValueSignals: [
      {
        id: 'general_interest',
        label: 'General Interest',
        description: 'Shows general interest',
        keywords: ['contact', 'pricing', 'more info'],
        priority: 'MEDIUM' as const,
        action: 'increase-score' as const,
        scoreBoost: 10,
        platform: 'website' as const,
      },
    ],
    fluffPatterns: [
      {
        id: 'copyright',
        pattern: '©\\s*\\d{4}',
        description: 'Copyright notice',
        context: 'footer' as const,
      },
      {
        id: 'privacy',
        pattern: 'privacy policy',
        description: 'Privacy policy link',
        context: 'footer' as const,
      },
    ],
    scoringRules: [
      {
        id: 'basic_qualification',
        name: 'Basic Qualification',
        description: 'Basic lead qualification',
        condition: 'signals.length > 0',
        scoreBoost: 10,
        priority: 1,
        enabled: true,
      },
    ],
    customFields: [
      {
        key: 'company_size',
        label: 'Company Size',
        type: 'string' as const,
        description: 'Estimated company size',
        extractionHints: ['employees', 'team', 'staff'],
        required: false,
        defaultValue: 'unknown',
      },
    ],
    metadata: {
      lastUpdated: new Date().toISOString().split('T')[0],
      version: 1,
      updatedBy: 'system',
      notes: 'Standard base template',
    },
  },
} as const;

/**
 * Validate template data
 */
export function validateTemplate(data: unknown): {
  success: boolean;
  data?: z.infer<typeof IndustryTemplateSchema>;
  errors?: z.ZodError;
} {
  try {
    const validatedData = IndustryTemplateSchema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    return {
      success: false,
      errors: new z.ZodError([
        {
          code: 'custom',
          path: [],
          message: 'Unknown validation error',
        },
      ]),
    };
  }
}

/**
 * Get validation error messages as array
 */
export function getValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map(err => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

/**
 * Validate template field by field
 */
export function validateTemplatePartial(
  field: keyof z.infer<typeof IndustryTemplateSchema>,
  value: unknown
): { success: boolean; error?: string } {
  try {
    const fieldSchema = IndustryTemplateSchema.shape[field];
    fieldSchema.parse(value);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message };
    }
    return { success: false, error: 'Validation failed' };
  }
}
