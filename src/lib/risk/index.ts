/**
 * Deal Risk Predictor - Module Exports
 * 
 * Centralized exports for the risk prediction system.
 * 
 * @module lib/risk
 */

// Core Engine
export {
  predictDealRisk,
  predictBatchDealRisk,
} from './risk-engine';

// Types
export type {
  // Core Types
  DealRiskPrediction,
  RiskLevel,
  RiskFactor,
  ProtectiveFactor,
  Intervention,
  HistoricalPattern,
  RiskTrend,
  RiskMetadata,
  
  // Categories
  RiskCategory,
  ProtectiveCategory,
  InterventionType,
  
  // Requests/Responses
  RiskPredictionRequest,
  BatchRiskPredictionRequest,
  BatchRiskPredictionResponse,
  RiskSummary,
  
  // Configuration
  RiskEngineConfig,
  RiskThresholds,
  
  // Time Horizons
  TimeHorizon,
  TimeHorizonPrediction,
  
  // Monitoring
  RiskHistory,
  RiskAlertConfig,
} from './types';

// Validation
export {
  // Schemas
  RiskLevelSchema,
  RiskCategorySchema,
  ProtectiveCategorySchema,
  InterventionTypeSchema,
  SeveritySchema,
  PrioritySchema,
  TrendDirectionSchema,
  TimeHorizonSchema,
  AlertChannelSchema,
  OutcomeSchema,
  AIModelSchema,
  
  RiskFactorSchema,
  ProtectiveFactorSchema,
  InterventionSchema,
  HistoricalPatternSchema,
  RiskTrendSchema,
  RiskMetadataSchema,
  DealRiskPredictionSchema,
  
  RiskPredictionRequestSchema,
  BatchRiskPredictionRequestSchema,
  RiskSummarySchema,
  BatchRiskPredictionResponseSchema,
  
  RiskThresholdsSchema,
  RiskEngineConfigSchema,
  TimeHorizonPredictionSchema,
  RiskHistorySchema,
  RiskAlertConfigSchema,
  
  // Validation Functions
  validateRiskPredictionRequest,
  validateBatchRiskPredictionRequest,
  validateDealRiskPrediction,
  validateRiskEngineConfig,
  validateRiskAlertConfig,
  safeValidate,
} from './validation';

// Events
export type {
  RiskSignalType,
  RiskAssessedMetadata,
  RiskDetectedMetadata,
  RiskLevelChangedMetadata,
  CriticalRiskMetadata,
  InterventionRecommendedMetadata,
  InterventionStartedMetadata,
  InterventionCompletedMetadata,
  SlippagePredictedMetadata,
  RiskMitigatedMetadata,
} from './events';

export {
  emitRiskAssessed,
  emitRiskDetected,
  emitRiskLevelChanged,
  emitCriticalRisk,
  emitInterventionRecommended,
  emitInterventionStarted,
  emitInterventionCompleted,
  emitSlippagePredicted,
  emitRiskMitigated,
  emitRiskPredictionSignals,
} from './events';

// Constants
export { DEFAULT_RISK_CONFIG } from './types';
