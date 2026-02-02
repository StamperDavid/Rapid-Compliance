/**
 * Advanced Analytics Dashboard Validation
 * 
 * Zod schemas for validating analytics requests and responses
 */

import { z } from 'zod';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

/**
 * Time period schema
 */
export const TimePeriodSchema = z.enum([
  '24h',
  '7d',
  '30d',
  '90d',
  'month',
  'quarter',
  'year',
  'custom',
]);

/**
 * Metrics selection schema
 */
export const MetricsSchema = z.array(
  z.enum(['workflows', 'emails', 'deals', 'revenue', 'team'])
).optional();

/**
 * Analytics request schema
 */
export const AnalyticsRequestSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  period: TimePeriodSchema,
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  metrics: MetricsSchema,
}).refine(
  (data) => {
    // If period is custom, startDate and endDate are required
    if (data.period === 'custom') {
      return data.startDate && data.endDate;
    }
    return true;
  },
  {
    message: 'Start date and end date are required for custom period',
    path: ['period'],
  }
).refine(
  (data) => {
    // End date must be after start date
    if (data.startDate && data.endDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// ============================================================================
// TIME SERIES VALIDATION
// ============================================================================

/**
 * Time series data point schema
 */
export const TimeSeriesDataPointSchema = z.object({
  date: z.date(),
  value: z.number(),
  secondaryValue: z.number().optional(),
  label: z.string().optional(),
});

// ============================================================================
// WORKFLOW ANALYTICS VALIDATION
// ============================================================================

/**
 * Action type metrics schema
 */
export const ActionTypeMetricsSchema = z.object({
  actionType: z.string(),
  count: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(100),
  averageTime: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
});

/**
 * Workflow performance summary schema
 */
export const WorkflowPerformanceSummarySchema = z.object({
  workflowId: z.string(),
  name: z.string(),
  executions: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(100),
  averageTime: z.number().nonnegative(),
  timeSaved: z.number().nonnegative(),
});

/**
 * Workflow overview metrics schema
 */
export const WorkflowOverviewMetricsSchema = z.object({
  totalActiveWorkflows: z.number().int().nonnegative(),
  totalExecutions: z.number().int().nonnegative(),
  successfulExecutions: z.number().int().nonnegative(),
  failedExecutions: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(100),
  averageExecutionTime: z.number().nonnegative(),
  totalActionsExecuted: z.number().int().nonnegative(),
  executionsTrend: z.number(),
  topWorkflows: z.array(WorkflowPerformanceSummarySchema),
  executionsByDay: z.array(TimeSeriesDataPointSchema),
  actionBreakdown: z.array(ActionTypeMetricsSchema),
});

// ============================================================================
// EMAIL ANALYTICS VALIDATION
// ============================================================================

/**
 * Email type metrics schema
 */
export const EmailTypeMetricsSchema = z.object({
  type: z.string(),
  count: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
  averageTime: z.number().nonnegative(),
});

/**
 * Tier distribution schema
 */
export const TierDistributionSchema = z.object({
  tier: z.string(),
  count: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
});

/**
 * Email overview metrics schema
 */
export const EmailOverviewMetricsSchema = z.object({
  totalGenerated: z.number().int().nonnegative(),
  totalSent: z.number().int().nonnegative(),
  averageGenerationTime: z.number().nonnegative(),
  mostUsedType: z.string(),
  generationTrend: z.number(),
  byType: z.array(EmailTypeMetricsSchema),
  emailsByDay: z.array(TimeSeriesDataPointSchema),
  byTier: z.array(TierDistributionSchema),
});

// ============================================================================
// DEAL ANALYTICS VALIDATION
// ============================================================================

/**
 * Stage metrics schema
 */
export const StageMetricsSchema = z.object({
  stage: z.string(),
  count: z.number().int().nonnegative(),
  value: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
  averageTimeInStage: z.number().nonnegative(),
});

/**
 * Tier metrics schema
 */
export const TierMetricsSchema = z.object({
  tier: z.string(),
  count: z.number().int().nonnegative(),
  value: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
  averageScore: z.number().min(0).max(100),
});

/**
 * Deal overview metrics schema
 */
export const DealOverviewMetricsSchema = z.object({
  totalActiveDeals: z.number().int().nonnegative(),
  totalValue: z.number().nonnegative(),
  averageValue: z.number().nonnegative(),
  hotDeals: z.number().int().nonnegative(),
  atRiskDeals: z.number().int().nonnegative(),
  dealsTrend: z.number(),
  byStage: z.array(StageMetricsSchema),
  byTier: z.array(TierMetricsSchema),
  averageVelocity: z.number().nonnegative(),
  pipelineByDay: z.array(TimeSeriesDataPointSchema),
});

// ============================================================================
// REVENUE ANALYTICS VALIDATION
// ============================================================================

/**
 * Revenue overview metrics schema
 */
export const RevenueOverviewMetricsSchema = z.object({
  totalRevenue: z.number().nonnegative(),
  quota: z.number().nonnegative(),
  quotaAttainment: z.number().min(0),
  forecastOptimistic: z.number().nonnegative(),
  forecastRealistic: z.number().nonnegative(),
  forecastPessimistic: z.number().nonnegative(),
  revenueTrend: z.number(),
  revenueByDay: z.array(TimeSeriesDataPointSchema),
  winRate: z.number().min(0).max(100),
  averageDealSize: z.number().nonnegative(),
});

// ============================================================================
// TEAM ANALYTICS VALIDATION
// ============================================================================

/**
 * Rep performance summary schema
 */
export const RepPerformanceSummarySchema = z.object({
  repId: z.string(),
  repName: z.string(),
  deals: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
  quotaAttainment: z.number().min(0),
  winRate: z.number().min(0).max(100),
  averageDealSize: z.number().nonnegative(),
});

/**
 * Team overview metrics schema
 */
export const TeamOverviewMetricsSchema = z.object({
  totalReps: z.number().int().nonnegative(),
  topPerformers: z.array(RepPerformanceSummarySchema),
  averageDealsPerRep: z.number().nonnegative(),
  averageQuotaAttainment: z.number().min(0),
  teamVelocity: z.number().nonnegative(),
});

// ============================================================================
// DASHBOARD OVERVIEW VALIDATION
// ============================================================================

/**
 * Dashboard overview schema
 */
export const DashboardOverviewSchema = z.object({
  period: TimePeriodSchema,
  startDate: z.date(),
  endDate: z.date(),
  workflows: WorkflowOverviewMetricsSchema,
  emails: EmailOverviewMetricsSchema,
  deals: DealOverviewMetricsSchema,
  revenue: RevenueOverviewMetricsSchema,
  team: TeamOverviewMetricsSchema,
});

// ============================================================================
// RESPONSE VALIDATION
// ============================================================================

/**
 * Analytics response schema
 */
export const AnalyticsResponseSchema = z.object({
  success: z.literal(true),
  data: DashboardOverviewSchema,
  cache: z.object({
    cached: z.boolean(),
    timestamp: z.date(),
    ttl: z.number().int().positive(),
  }),
  generationTime: z.number().nonnegative(),
});

/**
 * Analytics error response schema
 */
export const AnalyticsErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string(),
  details: z.record(z.unknown()).optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AnalyticsRequest = z.infer<typeof AnalyticsRequestSchema>;
export type TimePeriod = z.infer<typeof TimePeriodSchema>;
