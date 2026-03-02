/**
 * Training System Types
 * Complete type definitions for the training and improvement system
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Training Session
 * A single training conversation with feedback
 */
export type AgentDomain = 'chat' | 'social' | 'email' | 'voice' | 'seo';

export interface TrainingSession {
  id: string;
  goldenMasterId: string;

  // Agent domain — which agent type this session trains
  agentType?: AgentDomain;

  // Session metadata
  topic: string;
  description?: string;
  customerPersona?: string;
  scenario?: string;
  
  // Conversation
  messages: TrainingMessage[];
  
  // Feedback
  trainerFeedback: string;
  score: number; // 0-100
  
  // Analysis (generated)
  analysis?: TrainingAnalysis;
  
  // Status
  status: 'pending' | 'analyzed' | 'applied' | 'rejected';
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp | string;
  analyzedAt?: Timestamp | string;
  appliedAt?: Timestamp | string;
}

export interface TrainingMessage {
  role: 'user' | 'agent';
  message: string;
  timestamp: string;
}

/**
 * Training Analysis
 * AI-generated analysis of the training session
 */
export interface TrainingAnalysis {
  // What went well
  strengths: string[];
  
  // What needs improvement
  weaknesses: string[];
  
  // Specific improvement suggestions
  suggestions: ImprovementSuggestion[];
  
  // Overall assessment
  overallAssessment: string;
  
  // Confidence in analysis (0-1)
  confidence: number;
  
  // Generated at
  generatedAt: string;
}

/**
 * Improvement Suggestion
 * A specific, actionable improvement
 */
export interface ImprovementSuggestion {
  id: string;
  
  // Type of improvement
  type: 'prompt_update' | 'behavior_change' | 'knowledge_gap' | 'tone_adjustment' | 'process_improvement';
  
  // What to improve
  area: string; // e.g., "greeting", "objection_handling", "product_knowledge"
  
  // Current behavior
  currentBehavior: string;
  
  // Suggested behavior
  suggestedBehavior: string;
  
  // How to implement (for prompt updates)
  implementation?: PromptUpdate;
  
  // Priority (1-10)
  priority: number;
  
  // Impact estimate (1-10)
  estimatedImpact: number;
  
  // Confidence (0-1)
  confidence: number;
}

/**
 * Prompt Update
 * Specific changes to the system prompt
 */
export interface PromptUpdate {
  section: 'greeting' | 'objectives' | 'tone' | 'behavior' | 'knowledge' | 'escalation' | 'closing' | 'custom';
  
  // What to add
  additions?: string[];
  
  // What to remove
  removals?: string[];
  
  // What to modify
  modifications?: Array<{
    from: string;
    to: string;
  }>;
}

/**
 * Golden Master Update Request
 * Request to update the Golden Master based on training
 */
export interface GoldenMasterUpdateRequest {
  id: string;
  goldenMasterId: string;

  // Agent domain — which agent type this update targets
  agentType?: AgentDomain;

  // Source training sessions
  sourceSessionIds: string[];
  
  // Aggregated improvements
  improvements: ImprovementSuggestion[];
  
  // Proposed changes
  proposedChanges: ProposedChange[];
  
  // Impact analysis
  impactAnalysis: ImpactAnalysis;
  
  // Status
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
  
  // Review
  reviewedBy?: string;
  reviewedAt?: Timestamp | string;
  reviewNotes?: string;
  
  // Metadata
  createdAt: Timestamp | string;
  appliedAt?: Timestamp | string;
}

/**
 * Proposed Change
 * A specific change to the Golden Master
 */
export interface ProposedChange {
  id: string;
  type: 'system_prompt' | 'behavior_config' | 'knowledge_base' | 'escalation_rules';
  
  // What's changing
  path: string; // e.g., "systemPrompt.greeting", "behaviorConfig.closingAggressiveness"
  
  // Current value
  currentValue: unknown;
  
  // Proposed value
  proposedValue: unknown;
  
  // Reason for change
  reason: string;
  
  // Supporting evidence (session IDs)
  evidence: string[];
  
  // Confidence (0-1)
  confidence: number;
}

/**
 * Impact Analysis
 * Analysis of how changes will affect the agent
 */
export interface ImpactAnalysis {
  // Expected improvement in score
  expectedScoreImprovement: number; // e.g., +5 points
  
  // Areas that will improve
  areasImproved: string[];
  
  // Potential risks
  risks: string[];
  
  // Recommended A/B test duration
  recommendedTestDuration: number; // days
  
  // Confidence in impact (0-1)
  confidence: number;
}

/**
 * Training Analytics
 * Aggregate analytics across training sessions
 */
export interface TrainingAnalytics {
  goldenMasterId: string;
  
  // Time range
  startDate: string;
  endDate: string;
  
  // Overall metrics
  totalSessions: number;
  averageScore: number;
  scoreImprovement: number; // change over time
  
  // Topic breakdown
  topicPerformance: Array<{
    topic: string;
    sessions: number;
    averageScore: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  
  // Common issues
  commonWeaknesses: Array<{
    area: string;
    frequency: number;
    averageScore: number;
  }>;
  
  // Improvement opportunities
  topOpportunities: ImprovementSuggestion[];
  
  // Version comparison
  versionComparison?: {
    currentVersion: string;
    previousVersion: string;
    scoreChange: number;
    improvementAreas: string[];
  };
  
  // Generated at
  generatedAt: string;
}

/**
 * Training Progress
 * Track progress toward Golden Master deployment
 */
export interface TrainingProgress {
  goldenMasterId: string;
  
  // Foundation topics (required)
  foundationTopics: Array<{
    id: string;
    title: string;
    required: boolean;
    sessions: number;
    averageScore: number;
    lastScore: number;
    status: 'not_started' | 'in_progress' | 'completed';
  }>;
  
  // Overall progress
  overallScore: number;
  totalSessions: number;
  foundationComplete: boolean;
  
  // Readiness
  readyForDeployment: boolean;
  missingRequirements: string[];
  
  // Next steps
  recommendedNextTopics: string[];
}

/**
 * A/B Test Configuration
 * For testing Golden Master versions
 */
export interface ABTestConfig {
  id: string;

  // Versions being tested
  versionA: {
    goldenMasterId: string;
    version: string;
    name: string;
  };
  
  versionB: {
    goldenMasterId: string;
    version: string;
    name: string;
  };
  
  // Test configuration
  trafficSplit: number; // 0-100, percentage to version A
  duration: number; // days
  
  // Metrics to track
  metrics: string[]; // e.g., ['score', 'conversionRate', 'escalationRate']
  
  // Status
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  
  // Results
  results?: ABTestResults;
  
  // Dates
  startDate?: Timestamp | string;
  endDate?: Timestamp | string;
  createdAt: Timestamp | string;
}

/**
 * A/B Test Results
 */
export interface ABTestResults {
  // Sample sizes
  versionAInteractions: number;
  versionBInteractions: number;
  
  // Metrics comparison
  metricsComparison: Array<{
    metric: string;
    versionA: number;
    versionB: number;
    improvement: number; // percentage
    statisticalSignificance: number; // p-value
  }>;
  
  // Winner
  winner: 'A' | 'B' | 'tie';
  confidence: number; // 0-1
  
  // Recommendation
  recommendation: string;
  
  // Generated at
  generatedAt: string;
}

// ============================================================================
// AGENT PERFORMANCE TRACKING
// ============================================================================

/**
 * Per-execution performance record for any agent (customer-facing or swarm specialist).
 * Written after each task execution for trend analysis and auto-flagging.
 */
export interface AgentPerformanceEntry {
  id: string;
  agentId: string;
  agentType: 'swarm_specialist' | AgentDomain;
  taskId: string;
  timestamp: string;
  qualityScore: number;        // 0-100
  approved: boolean;
  retryCount: number;
  responseTimeMs: number;
  reviewSeverity: 'PASS' | 'MINOR' | 'MAJOR' | 'BLOCK';
  feedback: string[];
  failureMode?: string;
  metadata: Record<string, unknown>;
}

/**
 * Rolling aggregation per agent over a time period.
 * Computed from AgentPerformanceEntry records.
 */
export interface AgentPerformanceAggregation {
  agentId: string;
  agentType: 'swarm_specialist' | AgentDomain;
  period: string;
  totalExecutions: number;
  successRate: number;
  averageQualityScore: number;
  retryRate: number;
  commonFailureModes: Array<{ mode: string; count: number }>;
  qualityTrend: 'improving' | 'declining' | 'stable';
  lastUpdated: string;
}

// ============================================================================
// SPECIALIST IMPROVEMENT PIPELINE
// ============================================================================

/**
 * A proposed change to a swarm specialist's configuration.
 */
export interface ProposedSpecialistChange {
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
  reason: string;
  confidence: number;
}

/**
 * Improvement request for swarm specialists, generated from performance data.
 * Requires human review before applying changes.
 */
export interface SpecialistImprovementRequest {
  id: string;
  specialistId: string;
  specialistName: string;
  sourcePerformanceEntries: string[];
  proposedChanges: ProposedSpecialistChange[];
  impactAnalysis: {
    expectedImprovement: number;
    areasImproved: string[];
    risks: string[];
    confidence: number;
  };
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  appliedAt?: string;
}

// ============================================================================
// SPECIALIST GOLDEN MASTERS
// ============================================================================

/**
 * Versioned Golden Master snapshot for a swarm specialist.
 * Created when an improvement request is applied. Supports deploy/rollback.
 */
export interface SpecialistGoldenMaster {
  id: string;                                      // "sgm_{specialistId}_v{version}"
  specialistId: string;                            // "SCRAPER_SPECIALIST"
  specialistName: string;
  version: number;                                 // 1, 2, 3...
  config: Record<string, unknown>;                 // Full config snapshot
  systemPromptSnapshot?: string;                   // Prompt if overridden
  sourceImprovementRequestId: string | null;       // null for v1 (seed)
  changesApplied: ProposedSpecialistChange[];
  isActive: boolean;
  deployedAt?: string;
  createdAt: string;
  createdBy: string;
  notes?: string;
  previousVersion?: number;
}

// ============================================================================
// AGENT-TYPE TRAINING CONFIGURATION
// ============================================================================

/**
 * Scoring criterion for a specific agent type's training evaluation.
 */
export interface AgentTypeScoringCriterion {
  id: string;
  label: string;
  description: string;
  weight: number;
}

/**
 * Scenario type for agent training sessions.
 */
export interface AgentTypeScenario {
  id: string;
  label: string;
  description: string;
  examples: string[];
}

/**
 * Per-agent-type training configuration.
 * Defines scoring criteria, scenario types, and performance thresholds.
 */
export interface AgentTypeTrainingConfig {
  agentType: AgentDomain;
  scoringCriteria: AgentTypeScoringCriterion[];
  scenarioTypes: AgentTypeScenario[];
  performanceThresholds: {
    flagForTrainingBelow: number;   // auto-flag threshold (0-100)
    excellentAbove: number;         // excellent performance threshold (0-100)
    minSamplesForTrend: number;     // minimum samples before computing trend
  };
}




















