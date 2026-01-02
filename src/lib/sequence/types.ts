/**
 * Email Sequence Intelligence - Type System
 * 
 * Comprehensive TypeScript type definitions for email sequence analysis,
 * pattern detection, optimization, and performance tracking.
 * 
 * @module sequence/types
 */

import { z } from 'zod';

// ============================================================================
// CORE SEQUENCE TYPES
// ============================================================================

/**
 * Email sequence status
 */
export type SequenceStatus = 
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

/**
 * Email sequence step type
 */
export type SequenceStepType =
  | 'initial_outreach'
  | 'follow_up'
  | 'value_reminder'
  | 'case_study'
  | 'breakup'
  | 'reengagement';

/**
 * Email send timing strategy
 */
export type TimingStrategy =
  | 'fixed_delay'      // Fixed hours after previous email
  | 'business_hours'   // Next business day at optimal time
  | 'engagement_based' // Send when prospect is most active
  | 'ai_optimized';    // AI determines best time

/**
 * Individual email in a sequence
 */
export interface SequenceStep {
  stepNumber: number;
  stepType: SequenceStepType;
  subject: string;
  body: string;
  delayHours: number;
  timingStrategy: TimingStrategy;
  includeAttachment?: boolean;
  attachmentType?: string;
}

/**
 * Email sequence definition
 */
export interface EmailSequence {
  id: string;
  name: string;
  description?: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  targetAudience: string;
  useCase: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags?: string[];
}

// ============================================================================
// SEQUENCE EXECUTION & TRACKING
// ============================================================================

/**
 * Sequence execution status
 */
export type ExecutionStatus =
  | 'scheduled'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'unsubscribed'
  | 'failed';

/**
 * Individual email execution
 */
export interface EmailExecution {
  executionId: string;
  sequenceId: string;
  stepNumber: number;
  recipientId: string;
  recipientEmail: string;
  status: ExecutionStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  repliedAt?: Date;
  bouncedAt?: Date;
  unsubscribedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  openCount: number;
  clickCount: number;
  linkClicked?: string[];
}

/**
 * Complete sequence execution for a recipient
 */
export interface SequenceExecution {
  id: string;
  sequenceId: string;
  recipientId: string;
  recipientEmail: string;
  startedAt: Date;
  completedAt?: Date;
  stoppedAt?: Date;
  stopReason?: 'replied' | 'unsubscribed' | 'manual' | 'bounced';
  currentStep: number;
  emailExecutions: EmailExecution[];
  totalSteps: number;
  status: 'active' | 'completed' | 'stopped';
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

/**
 * Email-level performance metrics
 */
export interface EmailMetrics {
  stepNumber: number;
  stepType: SequenceStepType;
  
  // Volume metrics
  sent: number;
  delivered: number;
  bounced: number;
  
  // Engagement metrics
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  
  // Rate metrics (0-100)
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  unsubscribeRate: number;
  
  // Timing metrics
  avgTimeToOpen?: number;      // Hours
  avgTimeToClick?: number;      // Hours
  avgTimeToReply?: number;      // Hours
  
  // Engagement quality
  avgOpenCount: number;         // Avg opens per recipient
  avgClickCount: number;        // Avg clicks per recipient
  
  // Content performance
  subjectLineVariants?: SubjectLinePerformance[];
  topClickedLinks?: LinkPerformance[];
}

/**
 * Subject line variant performance
 */
export interface SubjectLinePerformance {
  subjectLine: string;
  sent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

/**
 * Link click performance
 */
export interface LinkPerformance {
  url: string;
  linkText: string;
  clicks: number;
  uniqueClicks: number;
  clickThroughRate: number;
}

/**
 * Sequence-level performance metrics
 */
export interface SequenceMetrics {
  sequenceId: string;
  sequenceName: string;
  
  // Overall metrics
  totalRecipients: number;
  activeExecutions: number;
  completedExecutions: number;
  stoppedExecutions: number;
  
  // Aggregate engagement
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalUnsubscribed: number;
  
  // Overall rates (0-100)
  overallDeliveryRate: number;
  overallOpenRate: number;
  overallClickRate: number;
  overallReplyRate: number;
  overallUnsubscribeRate: number;
  
  // Conversion metrics
  conversationStarted: number;  // Replied before step 3
  meetingBooked: number;
  opportunityCreated: number;
  
  // Conversion rates (0-100)
  conversationRate: number;
  meetingRate: number;
  opportunityRate: number;
  
  // Step-by-step breakdown
  stepMetrics: EmailMetrics[];
  
  // Timing analysis
  avgSequenceDuration?: number; // Hours from start to reply
  optimalSendTimes?: HourOfDay[];
  optimalDayOfWeek?: DayOfWeek[];
  
  // Time period
  startDate: Date;
  endDate: Date;
  dataPoints: number;
}

/**
 * Hour of day performance
 */
export interface HourOfDay {
  hour: number;              // 0-23
  openRate: number;
  clickRate: number;
  replyRate: number;
  sampleSize: number;
}

/**
 * Day of week performance
 */
export interface DayOfWeek {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  openRate: number;
  clickRate: number;
  replyRate: number;
  sampleSize: number;
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

/**
 * Pattern type classification
 */
export type PatternType =
  | 'high_performing_sequence'
  | 'optimal_timing'
  | 'subject_line_formula'
  | 'content_structure'
  | 'call_to_action'
  | 'personalization_approach'
  | 'step_count_optimization'
  | 'delay_optimization';

/**
 * Pattern confidence level
 */
export type PatternConfidence = 'high' | 'medium' | 'low';

/**
 * Identified sequence pattern
 */
export interface SequencePattern {
  id: string;
  type: PatternType;
  name: string;
  description: string;
  
  // Pattern evidence
  sampleSize: number;
  occurrences: number;
  
  // Performance comparison
  patternPerformance: {
    replyRate: number;
    meetingRate: number;
    opportunityRate: number;
  };
  baselinePerformance: {
    replyRate: number;
    meetingRate: number;
    opportunityRate: number;
  };
  
  // Lift metrics (percentage improvement)
  replyLift: number;
  meetingLift: number;
  opportunityLift: number;
  
  // Statistical validation
  confidence: PatternConfidence;
  pValue?: number;
  
  // Pattern details
  characteristics: PatternCharacteristic[];
  exampleSequences: string[];
  
  // Recommendations
  recommendation: string;
  implementationSteps: string[];
  
  // Metadata
  identifiedAt: Date;
  lastValidated: Date;
}

/**
 * Individual pattern characteristic
 */
export interface PatternCharacteristic {
  attribute: string;
  value: string | number | boolean;
  importance: 'critical' | 'important' | 'moderate';
  description: string;
}

// ============================================================================
// OPTIMIZATION RECOMMENDATIONS
// ============================================================================

/**
 * Optimization area
 */
export type OptimizationArea =
  | 'timing'
  | 'subject_lines'
  | 'content'
  | 'call_to_action'
  | 'sequence_length'
  | 'step_delays'
  | 'personalization'
  | 'targeting';

/**
 * Recommendation priority
 */
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  id: string;
  area: OptimizationArea;
  priority: RecommendationPriority;
  title: string;
  description: string;
  
  // Current state
  currentMetric: {
    name: string;
    value: number;
    unit: string;
  };
  
  // Expected improvement
  projectedMetric: {
    name: string;
    value: number;
    unit: string;
  };
  expectedLift: number;       // Percentage improvement
  
  // Recommendation details
  issue: string;
  solution: string;
  rationale: string;
  
  // Implementation
  actionItems: ActionItem[];
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedImpact: 'low' | 'medium' | 'high';
  
  // Evidence
  basedOnPatterns: string[];
  sampleSize: number;
  confidence: PatternConfidence;
  
  // A/B test suggestion
  suggestedTest?: {
    control: string;
    variant: string;
    successMetric: string;
    minimumSampleSize: number;
    expectedDuration: number; // Days
  };
  
  createdAt: Date;
}

/**
 * Action item for implementing recommendation
 */
export interface ActionItem {
  step: number;
  action: string;
  details?: string;
  estimatedTime?: number; // Minutes
}

// ============================================================================
// A/B TESTING
// ============================================================================

/**
 * A/B test status
 */
export type ABTestStatus =
  | 'draft'
  | 'running'
  | 'completed'
  | 'paused'
  | 'cancelled';

/**
 * A/B test result
 */
export type ABTestResult =
  | 'variant_a_wins'
  | 'variant_b_wins'
  | 'no_significant_difference'
  | 'inconclusive';

/**
 * A/B test definition
 */
export interface ABTest {
  id: string;
  name: string;
  description: string;
  
  // Test variants
  variantA: {
    name: string;
    sequenceId: string;
    description?: string;
  };
  variantB: {
    name: string;
    sequenceId: string;
    description?: string;
  };
  
  // Test configuration
  hypothesis: string;
  successMetric: 'reply_rate' | 'meeting_rate' | 'opportunity_rate';
  trafficSplit: number;       // 0-100, percentage to variant B
  minimumSampleSize: number;
  minimumDuration: number;     // Days
  
  // Test execution
  status: ABTestStatus;
  startedAt?: Date;
  completedAt?: Date;
  pausedAt?: Date;
  
  // Results
  variantAMetrics?: {
    recipients: number;
    metric: number;
    confidence: number;
  };
  variantBMetrics?: {
    recipients: number;
    metric: number;
    confidence: number;
  };
  
  result?: ABTestResult;
  statisticalSignificance?: number;
  pValue?: number;
  
  // Winner
  winningVariant?: 'A' | 'B';
  lift?: number;              // Percentage improvement
  
  // Metadata
  createdAt: Date;
  createdBy: string;
}

// ============================================================================
// ANALYSIS & INSIGHTS
// ============================================================================

/**
 * Sequence intelligence analysis input
 */
export interface SequenceAnalysisInput {
  sequenceId?: string;
  sequenceIds?: string[];
  startDate?: Date;
  endDate?: Date;
  recipientSegment?: string;
  includePatterns?: boolean;
  includeOptimizations?: boolean;
  includeTimingAnalysis?: boolean;
  includeABTests?: boolean;
}

/**
 * Complete sequence intelligence analysis
 */
export interface SequenceAnalysis {
  // Analysis metadata
  analysisId: string;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  
  // Sequences analyzed
  sequences: EmailSequence[];
  
  // Performance metrics
  metrics: SequenceMetrics[];
  
  // Pattern detection
  patterns?: {
    total: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    patterns: SequencePattern[];
    topPatterns: SequencePattern[]; // Top 5 by lift
  };
  
  // Optimization recommendations
  optimizations?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recommendations: OptimizationRecommendation[];
    quickWins: OptimizationRecommendation[];   // Low effort, high impact
    topPriority: OptimizationRecommendation[]; // Top 3 by priority
  };
  
  // Timing analysis
  timingAnalysis?: {
    bestSendTimes: HourOfDay[];
    bestDaysOfWeek: DayOfWeek[];
    worstSendTimes: HourOfDay[];
    worstDaysOfWeek: DayOfWeek[];
    recommendation: string;
  };
  
  // A/B tests
  abTests?: {
    active: number;
    completed: number;
    winningVariants: ABTest[];
    ongoingTests: ABTest[];
  };
  
  // Summary insights
  summary: {
    totalSequences: number;
    totalRecipients: number;
    totalEmails: number;
    avgReplyRate: number;
    avgMeetingRate: number;
    avgOpportunityRate: number;
    topPerformingSequence: {
      id: string;
      name: string;
      replyRate: number;
    };
    lowestPerformingSequence: {
      id: string;
      name: string;
      replyRate: number;
    };
  };
  
  // AI insights
  aiInsights?: {
    keyFindings: string[];
    concerns: string[];
    opportunities: string[];
    nextSteps: string[];
  };
}

// ============================================================================
// AI GENERATION
// ============================================================================

/**
 * AI pattern detection request
 */
export interface PatternDetectionRequest {
  sequenceMetrics: SequenceMetrics[];
  minimumSampleSize?: number;
  minimumLift?: number;        // Minimum percentage lift to report
  confidenceThreshold?: PatternConfidence;
}

/**
 * AI optimization request
 */
export interface OptimizationRequest {
  sequenceMetrics: SequenceMetrics;
  patterns: SequencePattern[];
  targetMetric: 'reply_rate' | 'meeting_rate' | 'opportunity_rate';
  constraints?: {
    maxSequenceLength?: number;
    maxDelay?: number;        // Hours
    preferredTiming?: TimingStrategy;
  };
}

// ============================================================================
// API RESPONSES
// ============================================================================

/**
 * Sequence analysis API response
 */
export interface SequenceAnalysisResponse {
  success: boolean;
  analysis?: SequenceAnalysis;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata: {
    generatedAt: string;
    processingTime: number;
    cached: boolean;
    cacheExpiresAt?: string;
  };
}

/**
 * Pattern detection API response
 */
export interface PatternDetectionResponse {
  success: boolean;
  patterns?: SequencePattern[];
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata: {
    generatedAt: string;
    processingTime: number;
    patternsFound: number;
  };
}

/**
 * Optimization API response
 */
export interface OptimizationResponse {
  success: boolean;
  recommendations?: OptimizationRecommendation[];
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata: {
    generatedAt: string;
    processingTime: number;
    recommendationsCount: number;
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  // Core types
  EmailSequence,
  SequenceStep,
  SequenceStatus,
  SequenceStepType,
  TimingStrategy,
  
  // Execution
  SequenceExecution,
  EmailExecution,
  ExecutionStatus,
  
  // Metrics
  SequenceMetrics,
  EmailMetrics,
  SubjectLinePerformance,
  LinkPerformance,
  HourOfDay,
  DayOfWeek,
  
  // Patterns
  SequencePattern,
  PatternType,
  PatternConfidence,
  PatternCharacteristic,
  
  // Optimization
  OptimizationRecommendation,
  OptimizationArea,
  RecommendationPriority,
  ActionItem,
  
  // A/B Testing
  ABTest,
  ABTestStatus,
  ABTestResult,
  
  // Analysis
  SequenceAnalysis,
  SequenceAnalysisInput,
  PatternDetectionRequest,
  OptimizationRequest,
  
  // API
  SequenceAnalysisResponse,
  PatternDetectionResponse,
  OptimizationResponse,
};
