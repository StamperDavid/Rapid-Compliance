/**
 * Templates Module
 * 
 * Industry templates, deal scoring, and revenue forecasting.
 * 
 * EXPORTS:
 * - Industry templates (SaaS, E-commerce, Healthcare, Fintech, Manufacturing)
 * - Template engine (apply, validate, preview)
 * - Deal scoring engine (predictive scoring with 7+ factors)
 * - Revenue forecasting engine (pipeline-based forecasting)
 * - Validation schemas (Zod schemas for API input validation)
 */

// Validation Schemas
export {
  ApplyTemplateSchema,
  ScoreDealSchema,
  ForecastPeriodSchema,
  RevenueForecastSchema,
  validateRequestBody,
  validateOrReturnError
} from './validation';

export type {
  ApplyTemplateInput,
  ScoreDealInput,
  RevenueForecastInput
} from './validation';

// Industry Templates
export {
  SAAS_TEMPLATE,
  ECOMMERCE_TEMPLATE,
  HEALTHCARE_TEMPLATE,
  FINTECH_TEMPLATE,
  MANUFACTURING_TEMPLATE,
  SALES_INDUSTRY_TEMPLATES,
  getTemplateById,
  getAllTemplates,
  getTemplatesByCategory,
  searchTemplates,
  getRecommendedTemplate
} from './industry-templates';

export type {
  SalesIndustryTemplate,
  SalesStage,
  CustomField,
  SalesWorkflow,
  WorkflowCondition,
  WorkflowAction,
  BestPractice,
  IndustryBenchmarks
} from './industry-templates';

// Template Engine
export {
  applyTemplate,
  validateTemplate,
  getRecommendedTemplateForOrg,
  previewTemplate,
  listTemplates,
  compareTemplates,
  cloneTemplate
} from './template-engine';

export type {
  TemplateApplicationOptions,
  TemplateCustomizations,
  TemplateApplicationResult,
  AppliedConfiguration,
  TemplateValidationResult,
  TemplateUsageStats
} from './template-engine';

// Deal Scoring Engine
export {
  calculateDealScore,
  batchScoreDeals
} from './deal-scoring-engine';

export type {
  DealScore,
  ScoringFactor,
  RiskFactor,
  DealScoringOptions,
  BatchScoringResult
} from './deal-scoring-engine';

// Revenue Forecasting Engine
export {
  generateRevenueForecast,
  calculateQuotaPerformance,
  compareForecastPeriods,
  getForecastHistory
} from './revenue-forecasting-engine';

export type {
  RevenueForecast,
  StageRevenue,
  ForecastPeriod,
  ForecastOptions,
  QuotaPerformance,
  ForecastTrend
} from './revenue-forecasting-engine';
