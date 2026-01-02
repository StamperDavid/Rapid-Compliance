/**
 * Deal Risk Predictor - Validation Layer
 * 
 * Zod schemas for comprehensive input validation.
 * Ensures type safety and data integrity at API boundaries.
 * 
 * @module lib/risk/validation
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const RiskLevelSchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'minimal',
]);

export const RiskCategorySchema = z.enum([
  'timing',
  'engagement',
  'stakeholder',
  'competition',
  'budget',
  'value_alignment',
  'technical',
  'external',
]);

export const ProtectiveCategorySchema = z.enum([
  'strong_engagement',
  'executive_buy_in',
  'proven_value',
  'competitive_edge',
  'budget_approved',
  'technical_fit',
  'urgency',
  'past_success',
]);

export const InterventionTypeSchema = z.enum([
  'executive_engagement',
  'accelerate_timeline',
  'address_competition',
  'demonstrate_value',
  'stakeholder_mapping',
  'budget_justification',
  'risk_mitigation',
  'relationship_building',
  'multi_threading',
  'negotiate_terms',
]);

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export const PrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export const TrendDirectionSchema = z.enum(['increasing', 'stable', 'decreasing']);

export const TimeHorizonSchema = z.enum(['30_days', '60_days', '90_days', 'custom']);

export const AlertChannelSchema = z.enum(['email', 'slack', 'in_app', 'webhook']);

export const OutcomeSchema = z.enum(['slip', 'on-time', 'loss']);

export const AIModelSchema = z.enum(['gpt-4o', 'gpt-4o-mini']);

// ============================================================================
// CORE SCHEMAS
// ============================================================================

/**
 * Risk factor schema
 */
export const RiskFactorSchema = z.object({
  id: z.string().min(1),
  category: RiskCategorySchema,
  severity: SeveritySchema,
  description: z.string().min(1).max(500),
  impact: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  currentValue: z.union([z.string(), z.number()]),
  expectedValue: z.union([z.string(), z.number()]),
  reasoning: z.string().min(1).max(1000),
  detectedAt: z.date(),
});

/**
 * Protective factor schema
 */
export const ProtectiveFactorSchema = z.object({
  id: z.string().min(1),
  category: ProtectiveCategorySchema,
  strength: z.number().min(0).max(100),
  description: z.string().min(1).max(500),
  reasoning: z.string().min(1).max(1000),
  weight: z.number().min(0).max(1),
});

/**
 * Intervention schema
 */
export const InterventionSchema = z.object({
  id: z.string().min(1),
  type: InterventionTypeSchema,
  priority: PrioritySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  expectedImpact: z.number().min(0).max(100),
  estimatedEffort: z.number().min(0.1).max(100),
  roiScore: z.number().min(0),
  actionSteps: z.array(z.string().min(1).max(500)).min(1).max(10),
  successMetrics: z.array(z.string().min(1).max(300)).min(1).max(5),
  suggestedOwner: z.string().min(1).max(100),
  deadlineDays: z.number().min(1).max(90),
  reasoning: z.string().min(1).max(1000),
});

/**
 * Historical pattern schema
 */
export const HistoricalPatternSchema = z.object({
  description: z.string().min(1).max(500),
  matchCount: z.number().int().min(0),
  historicalWinRate: z.number().min(0).max(100),
  avgSlippageDays: z.number().min(0),
  successFactors: z.array(z.string().min(1).max(300)).max(10),
  failureFactors: z.array(z.string().min(1).max(300)).max(10),
  confidence: z.number().min(0).max(100),
});

/**
 * Risk trend schema
 */
export const RiskTrendSchema = z.object({
  direction: TrendDirectionSchema,
  changeRate: z.number(),
  previousLevel: RiskLevelSchema.nullable(),
  daysSinceLastCheck: z.number().int().min(0).nullable(),
  description: z.string().min(1).max(500),
});

/**
 * Risk metadata schema
 */
export const RiskMetadataSchema = z.object({
  modelVersion: z.string().min(1),
  dataSources: z.array(z.string()).min(1),
  factorsConsidered: z.number().int().min(0),
  aiModel: AIModelSchema,
  tokensUsed: z.number().int().min(0),
  calculationDuration: z.number().min(0),
  dealScore: z.any().optional(),
  dealHealth: z.any().optional(),
});

/**
 * Deal risk prediction schema
 */
export const DealRiskPredictionSchema = z.object({
  dealId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  riskLevel: RiskLevelSchema,
  slippageProbability: z.number().min(0).max(100),
  lossProbability: z.number().min(0).max(100),
  daysUntilSlippage: z.number().int().min(0).nullable(),
  predictedSlippageDate: z.date().nullable(),
  riskFactors: z.array(RiskFactorSchema).max(50),
  protectiveFactors: z.array(ProtectiveFactorSchema).max(30),
  interventions: z.array(InterventionSchema).max(10),
  historicalPattern: HistoricalPatternSchema.nullable(),
  confidence: z.number().min(0).max(100),
  trend: RiskTrendSchema,
  calculatedAt: z.date(),
  metadata: RiskMetadataSchema,
});

// ============================================================================
// REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Risk prediction request schema
 */
export const RiskPredictionRequestSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1).default('default'),
  includeInterventions: z.boolean().default(true),
  forceRefresh: z.boolean().default(false),
  customContext: z.string().max(2000).optional(),
});

/**
 * Batch risk prediction request schema
 */
export const BatchRiskPredictionRequestSchema = z.object({
  dealIds: z.array(z.string().min(1)).min(1).max(100),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1).default('default'),
  includeInterventions: z.boolean().default(true),
  highRiskOnly: z.boolean().default(false),
});

/**
 * Risk summary schema
 */
export const RiskSummarySchema = z.object({
  totalDeals: z.number().int().min(0),
  byRiskLevel: z.object({
    critical: z.number().int().min(0),
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
    minimal: z.number().int().min(0),
  }),
  avgSlippageProbability: z.number().min(0).max(100),
  urgentActionRequired: z.number().int().min(0),
  revenueAtRisk: z.number().min(0),
  topRiskCategories: z.array(
    z.object({
      category: RiskCategorySchema,
      count: z.number().int().min(0),
      avgImpact: z.number().min(0).max(100),
    })
  ).max(10),
});

/**
 * Batch risk prediction response schema
 */
export const BatchRiskPredictionResponseSchema = z.object({
  predictions: z.map(z.string(), DealRiskPredictionSchema),
  summary: RiskSummarySchema,
  calculatedAt: z.date(),
});

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Risk thresholds schema
 */
export const RiskThresholdsSchema = z.object({
  critical: z.number().min(0).max(100),
  high: z.number().min(0).max(100),
  medium: z.number().min(0).max(100),
  low: z.number().min(0).max(100),
  minimal: z.number().min(0).max(100),
});

/**
 * Risk engine configuration schema
 */
export const RiskEngineConfigSchema = z.object({
  aiModel: AIModelSchema,
  maxInterventions: z.number().int().min(1).max(10),
  includeHistoricalPatterns: z.boolean(),
  thresholds: RiskThresholdsSchema,
  verbose: z.boolean(),
});

/**
 * Time horizon prediction schema
 */
export const TimeHorizonPredictionSchema = z.object({
  horizon: TimeHorizonSchema,
  days: z.number().int().min(1),
  slippageProbability: z.number().min(0).max(100),
  dealsAtRisk: z.number().int().min(0),
  revenueAtRisk: z.number().min(0),
});

/**
 * Risk history schema
 */
export const RiskHistorySchema = z.object({
  dealId: z.string().min(1),
  predictions: z.array(
    z.object({
      timestamp: z.date(),
      riskLevel: RiskLevelSchema,
      slippageProbability: z.number().min(0).max(100),
      interventionsRecommended: z.number().int().min(0),
    })
  ).max(100),
  accuracy: z.object({
    predictedOutcome: OutcomeSchema,
    actualOutcome: OutcomeSchema,
    predictionAccurate: z.boolean(),
    daysOffPrediction: z.number(),
  }).optional(),
});

/**
 * Risk alert configuration schema
 */
export const RiskAlertConfigSchema = z.object({
  onRiskLevelChange: z.boolean(),
  onCriticalRisk: z.boolean(),
  slippageProbabilityThreshold: z.number().min(0).max(100),
  channels: z.array(AlertChannelSchema).min(1).max(4),
  recipients: z.array(z.string().min(1)).min(1).max(20),
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate risk prediction request
 */
export function validateRiskPredictionRequest(data: unknown) {
  return RiskPredictionRequestSchema.parse(data);
}

/**
 * Validate batch risk prediction request
 */
export function validateBatchRiskPredictionRequest(data: unknown) {
  return BatchRiskPredictionRequestSchema.parse(data);
}

/**
 * Validate deal risk prediction
 */
export function validateDealRiskPrediction(data: unknown) {
  return DealRiskPredictionSchema.parse(data);
}

/**
 * Validate risk engine configuration
 */
export function validateRiskEngineConfig(data: unknown) {
  return RiskEngineConfigSchema.parse(data);
}

/**
 * Validate risk alert configuration
 */
export function validateRiskAlertConfig(data: unknown) {
  return RiskAlertConfigSchema.parse(data);
}

/**
 * Safe validation with detailed error messages
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => {
        const path = err.path.join('.');
        const message = err.message;
        return context ? `${context}.${path}: ${message}` : `${path}: ${message}`;
      });
      return { success: false, errors };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}
