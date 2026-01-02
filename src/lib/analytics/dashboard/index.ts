/**
 * Advanced Analytics Dashboard Module
 * 
 * Central export point for the analytics dashboard system
 */

// Core engine
export { getDashboardAnalytics, clearAnalyticsCache } from './analytics-engine';

// Types
export type {
  DashboardOverview,
  TimePeriod,
  WorkflowOverviewMetrics,
  EmailOverviewMetrics,
  DealOverviewMetrics,
  RevenueOverviewMetrics,
  TeamOverviewMetrics,
  WorkflowPerformanceSummary,
  ActionTypeMetrics,
  EmailTypeMetrics,
  TierDistribution,
  StageMetrics,
  TierMetrics,
  RepPerformanceSummary,
  TimeSeriesDataPoint,
  AnalyticsRequest,
  AnalyticsResponse,
  AnalyticsErrorResponse,
  DetailedWorkflowAnalytics,
  WorkflowDetailMetrics,
  TriggerTypeMetrics,
  ErrorMetrics,
} from './types';

// Validation schemas
export {
  AnalyticsRequestSchema,
  AnalyticsResponseSchema,
  AnalyticsErrorResponseSchema,
  DashboardOverviewSchema,
  TimePeriodSchema,
} from './validation';
