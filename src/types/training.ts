/**
 * Training System Types
 * Complete type definitions for the training and improvement system
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Training Session
 * A single training conversation with feedback
 */
export interface TrainingSession {
  id: string;
  organizationId: string;
  workspaceId?: string;
  goldenMasterId: string;
  
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
  organizationId: string;
  goldenMasterId: string;
  
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
  currentValue: any;
  
  // Proposed value
  proposedValue: any;
  
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
  organizationId: string;
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
  organizationId: string;
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
  organizationId: string;
  
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













