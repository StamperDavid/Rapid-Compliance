/**
 * Deal Risk Predictor - Type System
 * 
 * AI-powered deal slippage prediction and intervention recommendations.
 * Integrates with deal scoring, deal health, and Signal Bus.
 * 
 * BUSINESS IMPACT:
 * - Predict deal slippage 30/60/90 days in advance
 * - 15-20% improvement in forecast accuracy
 * - Proactive interventions to save at-risk deals
 * - Data-driven resource allocation
 * 
 * @module lib/risk
 */

import type { DealScore } from '@/lib/templates/deal-scoring-engine';
import type { DealHealthScore } from '@/lib/crm/deal-health';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Complete risk prediction for a deal
 */
export interface DealRiskPrediction {
  /** Deal ID */
  dealId: string;

  /** Workspace ID */
  workspaceId: string;
  
  /** Overall risk level */
  riskLevel: RiskLevel;
  
  /** Slippage probability (0-100%) */
  slippageProbability: number;
  
  /** Loss probability (0-100%) */
  lossProbability: number;
  
  /** Days until predicted slippage */
  daysUntilSlippage: number | null;
  
  /** Predicted new close date if slippage occurs */
  predictedSlippageDate: Date | null;
  
  /** Risk factors contributing to prediction */
  riskFactors: RiskFactor[];
  
  /** Protective factors (positive signals) */
  protectiveFactors: ProtectiveFactor[];
  
  /** AI-generated intervention recommendations */
  interventions: Intervention[];
  
  /** Historical pattern match */
  historicalPattern: HistoricalPattern | null;
  
  /** Confidence in prediction (0-100%) */
  confidence: number;
  
  /** Risk trend over time */
  trend: RiskTrend;
  
  /** When prediction was calculated */
  calculatedAt: Date;
  
  /** Metadata for debugging/analysis */
  metadata: RiskMetadata;
}

/**
 * Risk level classification
 */
export type RiskLevel = 
  | 'critical'   // 80-100% slippage probability - immediate action required
  | 'high'       // 60-79% - urgent attention needed
  | 'medium'     // 40-59% - monitor closely
  | 'low'        // 20-39% - normal monitoring
  | 'minimal';   // 0-19% - healthy deal

/**
 * Individual risk factor
 */
export interface RiskFactor {
  /** Unique identifier */
  id: string;
  
  /** Risk category */
  category: RiskCategory;
  
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  
  /** Human-readable description */
  description: string;
  
  /** Impact on slippage probability */
  impact: number; // 0-100
  
  /** Weight in overall calculation */
  weight: number; // 0-1
  
  /** Current value */
  currentValue: string | number;
  
  /** Expected/benchmark value */
  expectedValue: string | number;
  
  /** How this increases risk */
  reasoning: string;
  
  /** Detection timestamp */
  detectedAt: Date;
}

/**
 * Risk categories
 */
export type RiskCategory =
  | 'timing'           // Deal age, stage duration, close date issues
  | 'engagement'       // Low activity, unresponsive contacts
  | 'stakeholder'      // Missing decision makers, champion left
  | 'competition'      // Competitor activity, price pressure
  | 'budget'           // Budget concerns, approval delays
  | 'value_alignment'  // Mismatched expectations, scope creep
  | 'technical'        // Technical blockers, integration issues
  | 'external';        // Market conditions, seasonality

/**
 * Protective factors (positive signals)
 */
export interface ProtectiveFactor {
  /** Unique identifier */
  id: string;
  
  /** Category */
  category: ProtectiveCategory;
  
  /** Strength (0-100) */
  strength: number;
  
  /** Description */
  description: string;
  
  /** How this reduces risk */
  reasoning: string;
  
  /** Weight in calculation */
  weight: number; // 0-1
}

/**
 * Protective factor categories
 */
export type ProtectiveCategory =
  | 'strong_engagement'    // High activity, responsive contacts
  | 'executive_buy_in'     // C-level champions
  | 'proven_value'         // Successful POC, clear ROI
  | 'competitive_edge'     // No competitors, sole vendor
  | 'budget_approved'      // Funding secured
  | 'technical_fit'        // Easy integration, no blockers
  | 'urgency'              // Time-sensitive need
  | 'past_success';        // Previous wins with this account

/**
 * AI-generated intervention recommendation
 */
export interface Intervention {
  /** Unique identifier */
  id: string;
  
  /** Intervention type */
  type: InterventionType;
  
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  /** Title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Expected impact on risk (% reduction) */
  expectedImpact: number; // 0-100
  
  /** Estimated effort (hours) */
  estimatedEffort: number;
  
  /** ROI score (impact/effort) */
  roiScore: number;
  
  /** Specific action steps */
  actionSteps: string[];
  
  /** Success metrics */
  successMetrics: string[];
  
  /** Suggested owner (role) */
  suggestedOwner: string;
  
  /** Deadline for action (days from now) */
  deadlineDays: number;
  
  /** AI reasoning */
  reasoning: string;
}

/**
 * Intervention types
 */
export type InterventionType =
  | 'executive_engagement'  // Bring in executive sponsor
  | 'accelerate_timeline'   // Speed up decision process
  | 'address_competition'   // Counter competitive threat
  | 'demonstrate_value'     // Additional POC/demo
  | 'stakeholder_mapping'   // Identify missing decision makers
  | 'budget_justification'  // Build business case
  | 'risk_mitigation'       // Address technical/external risks
  | 'relationship_building' // Strengthen champion relationship
  | 'multi_threading'       // Engage additional contacts
  | 'negotiate_terms';      // Adjust deal structure

/**
 * Historical pattern match
 */
export interface HistoricalPattern {
  /** Pattern description */
  description: string;
  
  /** Number of similar historical deals */
  matchCount: number;
  
  /** Win rate of similar deals */
  historicalWinRate: number; // 0-100%
  
  /** Average slippage days */
  avgSlippageDays: number;
  
  /** Common success factors */
  successFactors: string[];
  
  /** Common failure factors */
  failureFactors: string[];
  
  /** Match confidence */
  confidence: number; // 0-100
}

/**
 * Risk trend
 */
export interface RiskTrend {
  /** Direction of risk */
  direction: 'increasing' | 'stable' | 'decreasing';
  
  /** Change rate (% per week) */
  changeRate: number;
  
  /** Previous risk level */
  previousLevel: RiskLevel | null;
  
  /** Days since last assessment */
  daysSinceLastCheck: number | null;
  
  /** Trend description */
  description: string;
}

/**
 * Risk metadata for analysis
 */
export interface RiskMetadata {
  /** Model version */
  modelVersion: string;
  
  /** Data sources used */
  dataSources: string[];
  
  /** Factors considered */
  factorsConsidered: number;
  
  /** AI model used */
  aiModel: 'gpt-4o' | 'gpt-4o-mini';
  
  /** Tokens used */
  tokensUsed: number;
  
  /** Calculation duration (ms) */
  calculationDuration: number;
  
  /** Deal score at time of prediction */
  dealScore?: DealScore;
  
  /** Deal health at time of prediction */
  dealHealth?: DealHealthScore;
}

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

/**
 * Risk prediction request
 */
export interface RiskPredictionRequest {
  /** Deal ID */
  dealId: string;

  /** Workspace ID */
  workspaceId?: string;
  
  /** Include AI-generated interventions */
  includeInterventions?: boolean;
  
  /** Force recalculation (skip cache) */
  forceRefresh?: boolean;
  
  /** Custom context for AI analysis */
  customContext?: string;
}

/**
 * Batch risk prediction request
 */
export interface BatchRiskPredictionRequest {
  /** Deal IDs */
  dealIds: string[];

  /** Workspace ID */
  workspaceId?: string;
  
  /** Include interventions */
  includeInterventions?: boolean;
  
  /** Only return high/critical risks */
  highRiskOnly?: boolean;
}

/**
 * Batch risk prediction response
 */
export interface BatchRiskPredictionResponse {
  /** Risk predictions by deal ID */
  predictions: Map<string, DealRiskPrediction>;
  
  /** Summary statistics */
  summary: RiskSummary;
  
  /** Calculation timestamp */
  calculatedAt: Date;
}

/**
 * Risk summary statistics
 */
export interface RiskSummary {
  /** Total deals analyzed */
  totalDeals: number;
  
  /** Deals by risk level */
  byRiskLevel: Record<RiskLevel, number>;
  
  /** Average slippage probability */
  avgSlippageProbability: number;
  
  /** Deals requiring immediate attention */
  urgentActionRequired: number;
  
  /** Total predicted revenue at risk */
  revenueAtRisk: number;
  
  /** Top risk categories */
  topRiskCategories: Array<{
    category: RiskCategory;
    count: number;
    avgImpact: number;
  }>;
}

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

/**
 * Risk engine configuration
 */
export interface RiskEngineConfig {
  /** AI model to use */
  aiModel: 'gpt-4o' | 'gpt-4o-mini';
  
  /** Maximum interventions to generate */
  maxInterventions: number;
  
  /** Include historical pattern matching */
  includeHistoricalPatterns: boolean;
  
  /** Risk factor thresholds */
  thresholds: RiskThresholds;
  
  /** Enable verbose logging */
  verbose: boolean;
}

/**
 * Risk thresholds for classification
 */
export interface RiskThresholds {
  /** Critical risk threshold */
  critical: number; // 80+
  
  /** High risk threshold */
  high: number; // 60-79
  
  /** Medium risk threshold */
  medium: number; // 40-59
  
  /** Low risk threshold */
  low: number; // 20-39
  
  /** Minimal risk threshold */
  minimal: number; // 0-19
}

/**
 * Default risk engine configuration
 */
export const DEFAULT_RISK_CONFIG: RiskEngineConfig = {
  aiModel: 'gpt-4o',
  maxInterventions: 5,
  includeHistoricalPatterns: true,
  thresholds: {
    critical: 80,
    high: 60,
    medium: 40,
    low: 20,
    minimal: 0,
  },
  verbose: false,
};

// ============================================================================
// TIME HORIZONS
// ============================================================================

/**
 * Time horizon for risk analysis
 */
export type TimeHorizon = '30_days' | '60_days' | '90_days' | 'custom';

/**
 * Risk prediction by time horizon
 */
export interface TimeHorizonPrediction {
  /** Time horizon */
  horizon: TimeHorizon;
  
  /** Days in horizon */
  days: number;
  
  /** Slippage probability for this horizon */
  slippageProbability: number;
  
  /** Deals at risk in this horizon */
  dealsAtRisk: number;
  
  /** Revenue at risk in this horizon */
  revenueAtRisk: number;
}

// ============================================================================
// MONITORING & TRACKING
// ============================================================================

/**
 * Risk tracking history
 */
export interface RiskHistory {
  /** Deal ID */
  dealId: string;
  
  /** Historical predictions */
  predictions: Array<{
    timestamp: Date;
    riskLevel: RiskLevel;
    slippageProbability: number;
    interventionsRecommended: number;
  }>;
  
  /** Accuracy metrics (if deal closed) */
  accuracy?: {
    predictedOutcome: 'slip' | 'on-time' | 'loss';
    actualOutcome: 'slip' | 'on-time' | 'loss';
    predictionAccurate: boolean;
    daysOffPrediction: number;
  };
}

/**
 * Risk alert configuration
 */
export interface RiskAlertConfig {
  /** Alert on risk level change */
  onRiskLevelChange: boolean;
  
  /** Alert on new critical risk */
  onCriticalRisk: boolean;
  
  /** Alert on slippage probability threshold */
  slippageProbabilityThreshold: number;
  
  /** Alert channels */
  channels: Array<'email' | 'slack' | 'in_app' | 'webhook'>;
  
  /** Alert recipients (user IDs) */
  recipients: string[];
}
