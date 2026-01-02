/**
 * Advanced Analytics Dashboard Types
 * 
 * SOVEREIGN CORPORATE BRAIN - ANALYTICS MODULE
 * 
 * This module defines the comprehensive type system for the analytics dashboard
 * that provides real-time insights across all platform features.
 * 
 * CORE CONCEPTS:
 * - Dashboard Metrics: Aggregated KPIs across all features
 * - Workflow Analytics: Performance metrics for automation workflows
 * - Deal Pipeline: Deal health, stages, and conversion metrics
 * - Email Analytics: Email writer usage and performance
 * - Revenue Forecasting: Revenue predictions and quota tracking
 * - Team Performance: Rep-level analytics
 * 
 * INTEGRATION:
 * - Workflow Engine for automation metrics
 * - Email Writer for email analytics
 * - Deal Scoring for pipeline insights
 * - Revenue Forecasting for revenue predictions
 * - Signal Bus for real-time event tracking
 */

// ============================================================================
// DASHBOARD OVERVIEW TYPES
// ============================================================================

/**
 * High-level dashboard metrics across all features
 */
export interface DashboardOverview {
  /** Period for this report */
  period: TimePeriod;
  
  /** Date range */
  startDate: Date;
  endDate: Date;
  
  /** Workflow automation metrics */
  workflows: WorkflowOverviewMetrics;
  
  /** Email writer metrics */
  emails: EmailOverviewMetrics;
  
  /** Deal pipeline metrics */
  deals: DealOverviewMetrics;
  
  /** Revenue metrics */
  revenue: RevenueOverviewMetrics;
  
  /** Team performance metrics */
  team: TeamOverviewMetrics;
}

/**
 * Time period options for analytics
 */
export type TimePeriod = 
  | '24h'      // Last 24 hours
  | '7d'       // Last 7 days
  | '30d'      // Last 30 days
  | '90d'      // Last 90 days
  | 'month'    // Current month
  | 'quarter'  // Current quarter
  | 'year'     // Current year
  | 'custom';  // Custom date range

// ============================================================================
// WORKFLOW ANALYTICS TYPES
// ============================================================================

/**
 * Workflow overview metrics for dashboard
 */
export interface WorkflowOverviewMetrics {
  /** Total active workflows */
  totalActiveWorkflows: number;
  
  /** Total executions in period */
  totalExecutions: number;
  
  /** Successful executions */
  successfulExecutions: number;
  
  /** Failed executions */
  failedExecutions: number;
  
  /** Overall success rate (0-100) */
  successRate: number;
  
  /** Average execution time (ms) */
  averageExecutionTime: number;
  
  /** Total actions executed */
  totalActionsExecuted: number;
  
  /** Change from previous period (%) */
  executionsTrend: number;
  
  /** Top performing workflows */
  topWorkflows: WorkflowPerformanceSummary[];
  
  /** Executions by day */
  executionsByDay: TimeSeriesDataPoint[];
  
  /** Action type breakdown */
  actionBreakdown: ActionTypeMetrics[];
}

/**
 * Performance summary for a single workflow
 */
export interface WorkflowPerformanceSummary {
  /** Workflow ID */
  workflowId: string;
  
  /** Workflow name */
  name: string;
  
  /** Number of executions */
  executions: number;
  
  /** Success rate (0-100) */
  successRate: number;
  
  /** Average execution time (ms) */
  averageTime: number;
  
  /** Total time saved (hours) */
  timeSaved: number;
}

/**
 * Metrics for a specific action type
 */
export interface ActionTypeMetrics {
  /** Action type (email, task, notification, etc.) */
  actionType: string;
  
  /** Number of executions */
  count: number;
  
  /** Success rate (0-100) */
  successRate: number;
  
  /** Average execution time (ms) */
  averageTime: number;
  
  /** Percentage of total actions */
  percentage: number;
}

// ============================================================================
// EMAIL ANALYTICS TYPES
// ============================================================================

/**
 * Email writer overview metrics
 */
export interface EmailOverviewMetrics {
  /** Total emails generated */
  totalGenerated: number;
  
  /** Total emails sent */
  totalSent: number;
  
  /** Average generation time (ms) */
  averageGenerationTime: number;
  
  /** Most used email type */
  mostUsedType: string;
  
  /** Change from previous period (%) */
  generationTrend: number;
  
  /** Emails by type */
  byType: EmailTypeMetrics[];
  
  /** Emails by day */
  emailsByDay: TimeSeriesDataPoint[];
  
  /** Deal tier distribution */
  byTier: TierDistribution[];
}

/**
 * Metrics for a specific email type
 */
export interface EmailTypeMetrics {
  /** Email type (intro, followup, proposal, etc.) */
  type: string;
  
  /** Number generated */
  count: number;
  
  /** Percentage of total */
  percentage: number;
  
  /** Average generation time (ms) */
  averageTime: number;
}

/**
 * Distribution by deal tier
 */
export interface TierDistribution {
  /** Tier name (hot, warm, cold, at-risk) */
  tier: string;
  
  /** Count */
  count: number;
  
  /** Percentage */
  percentage: number;
}

// ============================================================================
// DEAL ANALYTICS TYPES
// ============================================================================

/**
 * Deal pipeline overview metrics
 */
export interface DealOverviewMetrics {
  /** Total active deals */
  totalActiveDeals: number;
  
  /** Total pipeline value */
  totalValue: number;
  
  /** Average deal value */
  averageValue: number;
  
  /** Number of hot deals */
  hotDeals: number;
  
  /** Number of at-risk deals */
  atRiskDeals: number;
  
  /** Change from previous period (%) */
  dealsTrend: number;
  
  /** Deals by stage */
  byStage: StageMetrics[];
  
  /** Deals by tier */
  byTier: TierMetrics[];
  
  /** Deal velocity (avg days to close) */
  averageVelocity: number;
  
  /** Pipeline by day */
  pipelineByDay: TimeSeriesDataPoint[];
}

/**
 * Metrics for a deal stage
 */
export interface StageMetrics {
  /** Stage name */
  stage: string;
  
  /** Number of deals */
  count: number;
  
  /** Total value */
  value: number;
  
  /** Percentage of total deals */
  percentage: number;
  
  /** Average time in stage (days) */
  averageTimeInStage: number;
}

/**
 * Metrics for a deal tier
 */
export interface TierMetrics {
  /** Tier name (hot, warm, cold, at-risk) */
  tier: string;
  
  /** Number of deals */
  count: number;
  
  /** Total value */
  value: number;
  
  /** Percentage */
  percentage: number;
  
  /** Average score */
  averageScore: number;
}

// ============================================================================
// REVENUE ANALYTICS TYPES
// ============================================================================

/**
 * Revenue overview metrics
 */
export interface RevenueOverviewMetrics {
  /** Total closed revenue in period */
  totalRevenue: number;
  
  /** Revenue target/quota */
  quota: number;
  
  /** Percentage of quota achieved */
  quotaAttainment: number;
  
  /** Forecasted revenue (optimistic) */
  forecastOptimistic: number;
  
  /** Forecasted revenue (realistic) */
  forecastRealistic: number;
  
  /** Forecasted revenue (pessimistic) */
  forecastPessimistic: number;
  
  /** Change from previous period (%) */
  revenueTrend: number;
  
  /** Revenue by day */
  revenueByDay: TimeSeriesDataPoint[];
  
  /** Win rate (%) */
  winRate: number;
  
  /** Average deal size */
  averageDealSize: number;
}

// ============================================================================
// TEAM ANALYTICS TYPES
// ============================================================================

/**
 * Team performance overview
 */
export interface TeamOverviewMetrics {
  /** Total active reps */
  totalReps: number;
  
  /** Top performers */
  topPerformers: RepPerformanceSummary[];
  
  /** Average deals per rep */
  averageDealsPerRep: number;
  
  /** Average quota attainment (%) */
  averageQuotaAttainment: number;
  
  /** Team velocity */
  teamVelocity: number;
}

/**
 * Performance summary for a sales rep
 */
export interface RepPerformanceSummary {
  /** Rep ID */
  repId: string;
  
  /** Rep name */
  repName: string;
  
  /** Number of deals */
  deals: number;
  
  /** Total revenue */
  revenue: number;
  
  /** Quota attainment (%) */
  quotaAttainment: number;
  
  /** Win rate (%) */
  winRate: number;
  
  /** Average deal size */
  averageDealSize: number;
}

// ============================================================================
// TIME SERIES TYPES
// ============================================================================

/**
 * Generic time series data point
 */
export interface TimeSeriesDataPoint {
  /** Date */
  date: Date;
  
  /** Value */
  value: number;
  
  /** Optional secondary value */
  secondaryValue?: number;
  
  /** Optional label */
  label?: string;
}

// ============================================================================
// DETAILED ANALYTICS TYPES
// ============================================================================

/**
 * Detailed workflow analytics
 */
export interface DetailedWorkflowAnalytics {
  /** Overview metrics */
  overview: WorkflowOverviewMetrics;
  
  /** Individual workflow details */
  workflows: WorkflowDetailMetrics[];
  
  /** Trigger type breakdown */
  triggerBreakdown: TriggerTypeMetrics[];
  
  /** Execution timeline */
  executionTimeline: TimeSeriesDataPoint[];
  
  /** Error analysis */
  errorAnalysis: ErrorMetrics[];
}

/**
 * Detailed metrics for a single workflow
 */
export interface WorkflowDetailMetrics {
  /** Workflow ID */
  workflowId: string;
  
  /** Workflow name */
  name: string;
  
  /** Status */
  status: 'active' | 'paused' | 'draft';
  
  /** Trigger type */
  triggerType: string;
  
  /** Total executions */
  executions: number;
  
  /** Success rate */
  successRate: number;
  
  /** Average execution time */
  averageTime: number;
  
  /** Actions per execution */
  averageActions: number;
  
  /** Last executed */
  lastExecuted: Date | null;
  
  /** Time saved (hours) */
  timeSaved: number;
  
  /** Execution trend (7 days) */
  executionTrend: TimeSeriesDataPoint[];
}

/**
 * Metrics for trigger types
 */
export interface TriggerTypeMetrics {
  /** Trigger type */
  triggerType: string;
  
  /** Count */
  count: number;
  
  /** Percentage */
  percentage: number;
  
  /** Success rate */
  successRate: number;
}

/**
 * Error metrics for analytics
 */
export interface ErrorMetrics {
  /** Error type/message */
  errorType: string;
  
  /** Occurrence count */
  count: number;
  
  /** Percentage of total errors */
  percentage: number;
  
  /** Affected workflows */
  affectedWorkflows: string[];
  
  /** First occurrence */
  firstOccurrence: Date;
  
  /** Last occurrence */
  lastOccurrence: Date;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request parameters for analytics API
 */
export interface AnalyticsRequest {
  /** Organization ID */
  organizationId: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Time period */
  period: TimePeriod;
  
  /** Custom start date (for custom period) */
  startDate?: Date;
  
  /** Custom end date (for custom period) */
  endDate?: Date;
  
  /** Specific metrics to include (optional, all by default) */
  metrics?: ('workflows' | 'emails' | 'deals' | 'revenue' | 'team')[];
}

/**
 * Response from analytics API
 */
export interface AnalyticsResponse {
  /** Success status */
  success: boolean;
  
  /** Dashboard data */
  data: DashboardOverview;
  
  /** Cache metadata */
  cache: {
    /** Whether this was served from cache */
    cached: boolean;
    
    /** Cache timestamp */
    timestamp: Date;
    
    /** Cache TTL (seconds) */
    ttl: number;
  };
  
  /** Generation time (ms) */
  generationTime: number;
}

/**
 * Error response
 */
export interface AnalyticsErrorResponse {
  /** Success status (false) */
  success: false;
  
  /** Error message */
  error: string;
  
  /** Error code */
  code: string;
  
  /** Additional details */
  details?: Record<string, unknown>;
}
