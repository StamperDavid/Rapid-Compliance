/**
 * Email Sequence Intelligence - Validation Layer
 * 
 * Comprehensive Zod schemas for runtime validation of all sequence
 * intelligence operations, ensuring type safety and data integrity.
 * 
 * @module sequence/validation
 */

import { z } from 'zod';

// ============================================================================
// CORE SEQUENCE SCHEMAS
// ============================================================================

/**
 * Sequence status validation
 */
export const sequenceStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
]);

/**
 * Sequence step type validation
 */
export const sequenceStepTypeSchema = z.enum([
  'initial_outreach',
  'follow_up',
  'value_reminder',
  'case_study',
  'breakup',
  'reengagement',
]);

/**
 * Timing strategy validation
 */
export const timingStrategySchema = z.enum([
  'fixed_delay',
  'business_hours',
  'engagement_based',
  'ai_optimized',
]);

/**
 * Sequence step validation
 */
export const sequenceStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  stepType: sequenceStepTypeSchema,
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  delayHours: z.number().int().min(0).max(720), // Max 30 days
  timingStrategy: timingStrategySchema,
  includeAttachment: z.boolean().optional(),
  attachmentType: z.string().optional(),
});

/**
 * Email sequence validation
 */
export const emailSequenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: sequenceStatusSchema,
  steps: z.array(sequenceStepSchema).min(1).max(10),
  targetAudience: z.string().min(1).max(500),
  useCase: z.string().min(1).max(500),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

// ============================================================================
// EXECUTION & TRACKING SCHEMAS
// ============================================================================

/**
 * Execution status validation
 */
export const executionStatusSchema = z.enum([
  'scheduled',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'replied',
  'bounced',
  'unsubscribed',
  'failed',
]);

/**
 * Email execution validation
 */
export const emailExecutionSchema = z.object({
  executionId: z.string().min(1),
  sequenceId: z.string().min(1),
  stepNumber: z.number().int().positive(),
  recipientId: z.string().min(1),
  recipientEmail: z.string().email(),
  status: executionStatusSchema,
  sentAt: z.date().optional(),
  deliveredAt: z.date().optional(),
  openedAt: z.date().optional(),
  clickedAt: z.date().optional(),
  repliedAt: z.date().optional(),
  bouncedAt: z.date().optional(),
  unsubscribedAt: z.date().optional(),
  failedAt: z.date().optional(),
  failureReason: z.string().optional(),
  openCount: z.number().int().min(0),
  clickCount: z.number().int().min(0),
  linkClicked: z.array(z.string().url()).optional(),
});

/**
 * Sequence execution validation
 */
export const sequenceExecutionSchema = z.object({
  id: z.string().min(1),
  sequenceId: z.string().min(1),
  recipientId: z.string().min(1),
  recipientEmail: z.string().email(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  stoppedAt: z.date().optional(),
  stopReason: z.enum(['replied', 'unsubscribed', 'manual', 'bounced']).optional(),
  currentStep: z.number().int().positive(),
  emailExecutions: z.array(emailExecutionSchema),
  totalSteps: z.number().int().positive(),
  status: z.enum(['active', 'completed', 'stopped']),
});

// ============================================================================
// METRICS SCHEMAS
// ============================================================================

/**
 * Rate validation (0-100 percentage)
 */
const rateSchema = z.number().min(0).max(100);

/**
 * Subject line performance validation
 */
export const subjectLinePerformanceSchema = z.object({
  subjectLine: z.string().min(1).max(200),
  sent: z.number().int().min(0),
  openRate: rateSchema,
  clickRate: rateSchema,
  replyRate: rateSchema,
});

/**
 * Link performance validation
 */
export const linkPerformanceSchema = z.object({
  url: z.string().url(),
  linkText: z.string().min(1).max(200),
  clicks: z.number().int().min(0),
  uniqueClicks: z.number().int().min(0),
  clickThroughRate: rateSchema,
});

/**
 * Email metrics validation
 */
export const emailMetricsSchema = z.object({
  stepNumber: z.number().int().positive(),
  stepType: sequenceStepTypeSchema,
  
  // Volume metrics
  sent: z.number().int().min(0),
  delivered: z.number().int().min(0),
  bounced: z.number().int().min(0),
  
  // Engagement metrics
  opened: z.number().int().min(0),
  clicked: z.number().int().min(0),
  replied: z.number().int().min(0),
  unsubscribed: z.number().int().min(0),
  
  // Rate metrics
  deliveryRate: rateSchema,
  openRate: rateSchema,
  clickRate: rateSchema,
  replyRate: rateSchema,
  unsubscribeRate: rateSchema,
  
  // Timing metrics
  avgTimeToOpen: z.number().min(0).optional(),
  avgTimeToClick: z.number().min(0).optional(),
  avgTimeToReply: z.number().min(0).optional(),
  
  // Engagement quality
  avgOpenCount: z.number().min(0),
  avgClickCount: z.number().min(0),
  
  // Content performance
  subjectLineVariants: z.array(subjectLinePerformanceSchema).optional(),
  topClickedLinks: z.array(linkPerformanceSchema).optional(),
});

/**
 * Hour of day validation
 */
export const hourOfDaySchema = z.object({
  hour: z.number().int().min(0).max(23),
  openRate: rateSchema,
  clickRate: rateSchema,
  replyRate: rateSchema,
  sampleSize: z.number().int().min(0),
});

/**
 * Day of week validation
 */
export const dayOfWeekSchema = z.object({
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  openRate: rateSchema,
  clickRate: rateSchema,
  replyRate: rateSchema,
  sampleSize: z.number().int().min(0),
});

/**
 * Sequence metrics validation
 */
export const sequenceMetricsSchema = z.object({
  sequenceId: z.string().min(1),
  sequenceName: z.string().min(1),
  
  // Overall metrics
  totalRecipients: z.number().int().min(0),
  activeExecutions: z.number().int().min(0),
  completedExecutions: z.number().int().min(0),
  stoppedExecutions: z.number().int().min(0),
  
  // Aggregate engagement
  totalSent: z.number().int().min(0),
  totalDelivered: z.number().int().min(0),
  totalOpened: z.number().int().min(0),
  totalClicked: z.number().int().min(0),
  totalReplied: z.number().int().min(0),
  totalUnsubscribed: z.number().int().min(0),
  
  // Overall rates
  overallDeliveryRate: rateSchema,
  overallOpenRate: rateSchema,
  overallClickRate: rateSchema,
  overallReplyRate: rateSchema,
  overallUnsubscribeRate: rateSchema,
  
  // Conversion metrics
  conversationStarted: z.number().int().min(0),
  meetingBooked: z.number().int().min(0),
  opportunityCreated: z.number().int().min(0),
  
  // Conversion rates
  conversationRate: rateSchema,
  meetingRate: rateSchema,
  opportunityRate: rateSchema,
  
  // Step breakdown
  stepMetrics: z.array(emailMetricsSchema),
  
  // Timing analysis
  avgSequenceDuration: z.number().min(0).optional(),
  optimalSendTimes: z.array(hourOfDaySchema).optional(),
  optimalDayOfWeek: z.array(dayOfWeekSchema).optional(),
  
  // Time period
  startDate: z.date(),
  endDate: z.date(),
  dataPoints: z.number().int().min(0),
});

// ============================================================================
// PATTERN DETECTION SCHEMAS
// ============================================================================

/**
 * Pattern type validation
 */
export const patternTypeSchema = z.enum([
  'high_performing_sequence',
  'optimal_timing',
  'subject_line_formula',
  'content_structure',
  'call_to_action',
  'personalization_approach',
  'step_count_optimization',
  'delay_optimization',
]);

/**
 * Pattern confidence validation
 */
export const patternConfidenceSchema = z.enum(['high', 'medium', 'low']);

/**
 * Pattern characteristic validation
 */
export const patternCharacteristicSchema = z.object({
  attribute: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  importance: z.enum(['critical', 'important', 'moderate']),
  description: z.string().min(1),
});

/**
 * Sequence pattern validation
 */
export const sequencePatternSchema = z.object({
  id: z.string().min(1),
  type: patternTypeSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  
  // Evidence
  sampleSize: z.number().int().min(10),
  occurrences: z.number().int().min(1),
  
  // Performance
  patternPerformance: z.object({
    replyRate: rateSchema,
    meetingRate: rateSchema,
    opportunityRate: rateSchema,
  }),
  baselinePerformance: z.object({
    replyRate: rateSchema,
    meetingRate: rateSchema,
    opportunityRate: rateSchema,
  }),
  
  // Lift
  replyLift: z.number(),
  meetingLift: z.number(),
  opportunityLift: z.number(),
  
  // Statistical validation
  confidence: patternConfidenceSchema,
  pValue: z.number().min(0).max(1).optional(),
  
  // Details
  characteristics: z.array(patternCharacteristicSchema),
  exampleSequences: z.array(z.string()),
  
  // Recommendations
  recommendation: z.string().min(1),
  implementationSteps: z.array(z.string().min(1)),
  
  // Metadata
  identifiedAt: z.date(),
  lastValidated: z.date(),
});

// ============================================================================
// OPTIMIZATION SCHEMAS
// ============================================================================

/**
 * Optimization area validation
 */
export const optimizationAreaSchema = z.enum([
  'timing',
  'subject_lines',
  'content',
  'call_to_action',
  'sequence_length',
  'step_delays',
  'personalization',
  'targeting',
]);

/**
 * Recommendation priority validation
 */
export const recommendationPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

/**
 * Action item validation
 */
export const actionItemSchema = z.object({
  step: z.number().int().positive(),
  action: z.string().min(1),
  details: z.string().optional(),
  estimatedTime: z.number().int().min(0).optional(),
});

/**
 * Optimization recommendation validation
 */
export const optimizationRecommendationSchema = z.object({
  id: z.string().min(1),
  area: optimizationAreaSchema,
  priority: recommendationPrioritySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  
  // Metrics
  currentMetric: z.object({
    name: z.string().min(1),
    value: z.number(),
    unit: z.string().min(1),
  }),
  projectedMetric: z.object({
    name: z.string().min(1),
    value: z.number(),
    unit: z.string().min(1),
  }),
  expectedLift: z.number(),
  
  // Details
  issue: z.string().min(1),
  solution: z.string().min(1),
  rationale: z.string().min(1),
  
  // Implementation
  actionItems: z.array(actionItemSchema),
  estimatedEffort: z.enum(['low', 'medium', 'high']),
  estimatedImpact: z.enum(['low', 'medium', 'high']),
  
  // Evidence
  basedOnPatterns: z.array(z.string()),
  sampleSize: z.number().int().min(0),
  confidence: patternConfidenceSchema,
  
  // A/B test suggestion
  suggestedTest: z.object({
    control: z.string().min(1),
    variant: z.string().min(1),
    successMetric: z.string().min(1),
    minimumSampleSize: z.number().int().min(30),
    expectedDuration: z.number().int().min(1),
  }).optional(),
  
  createdAt: z.date(),
});

// ============================================================================
// A/B TESTING SCHEMAS
// ============================================================================

/**
 * A/B test status validation
 */
export const abTestStatusSchema = z.enum([
  'draft',
  'running',
  'completed',
  'paused',
  'cancelled',
]);

/**
 * A/B test result validation
 */
export const abTestResultSchema = z.enum([
  'variant_a_wins',
  'variant_b_wins',
  'no_significant_difference',
  'inconclusive',
]);

/**
 * A/B test validation
 */
export const abTestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  
  // Variants
  variantA: z.object({
    name: z.string().min(1).max(100),
    sequenceId: z.string().min(1),
    description: z.string().max(500).optional(),
  }),
  variantB: z.object({
    name: z.string().min(1).max(100),
    sequenceId: z.string().min(1),
    description: z.string().max(500).optional(),
  }),
  
  // Configuration
  hypothesis: z.string().min(1).max(1000),
  successMetric: z.enum(['reply_rate', 'meeting_rate', 'opportunity_rate']),
  trafficSplit: z.number().min(0).max(100),
  minimumSampleSize: z.number().int().min(30),
  minimumDuration: z.number().int().min(1),
  
  // Execution
  status: abTestStatusSchema,
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  pausedAt: z.date().optional(),
  
  // Results
  variantAMetrics: z.object({
    recipients: z.number().int().min(0),
    metric: z.number().min(0).max(100),
    confidence: z.number().min(0).max(100),
  }).optional(),
  variantBMetrics: z.object({
    recipients: z.number().int().min(0),
    metric: z.number().min(0).max(100),
    confidence: z.number().min(0).max(100),
  }).optional(),
  
  result: abTestResultSchema.optional(),
  statisticalSignificance: z.number().min(0).max(100).optional(),
  pValue: z.number().min(0).max(1).optional(),
  
  // Winner
  winningVariant: z.enum(['A', 'B']).optional(),
  lift: z.number().optional(),
  
  // Metadata
  createdAt: z.date(),
  createdBy: z.string().min(1),
});

// ============================================================================
// ANALYSIS SCHEMAS
// ============================================================================

/**
 * Sequence analysis input validation
 */
export const sequenceAnalysisInputSchema = z.object({
  sequenceId: z.string().min(1).optional(),
  sequenceIds: z.array(z.string().min(1)).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  recipientSegment: z.string().optional(),
  includePatterns: z.boolean().optional(),
  includeOptimizations: z.boolean().optional(),
  includeTimingAnalysis: z.boolean().optional(),
  includeABTests: z.boolean().optional(),
}).refine(
  (data) => data.sequenceId || data.sequenceIds,
  {
    message: "Either sequenceId or sequenceIds must be provided",
  }
);

/**
 * Sequence analysis validation
 */
export const sequenceAnalysisSchema = z.object({
  // Metadata
  analysisId: z.string().min(1),
  generatedAt: z.date(),
  timeRange: z.object({
    start: z.date(),
    end: z.date(),
  }),
  
  // Data
  sequences: z.array(emailSequenceSchema),
  metrics: z.array(sequenceMetricsSchema),
  
  // Patterns
  patterns: z.object({
    total: z.number().int().min(0),
    highConfidence: z.number().int().min(0),
    mediumConfidence: z.number().int().min(0),
    lowConfidence: z.number().int().min(0),
    patterns: z.array(sequencePatternSchema),
    topPatterns: z.array(sequencePatternSchema),
  }).optional(),
  
  // Optimizations
  optimizations: z.object({
    total: z.number().int().min(0),
    critical: z.number().int().min(0),
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
    recommendations: z.array(optimizationRecommendationSchema),
    quickWins: z.array(optimizationRecommendationSchema),
    topPriority: z.array(optimizationRecommendationSchema),
  }).optional(),
  
  // Timing
  timingAnalysis: z.object({
    bestSendTimes: z.array(hourOfDaySchema),
    bestDaysOfWeek: z.array(dayOfWeekSchema),
    worstSendTimes: z.array(hourOfDaySchema),
    worstDaysOfWeek: z.array(dayOfWeekSchema),
    recommendation: z.string().min(1),
  }).optional(),
  
  // A/B tests
  abTests: z.object({
    active: z.number().int().min(0),
    completed: z.number().int().min(0),
    winningVariants: z.array(abTestSchema),
    ongoingTests: z.array(abTestSchema),
  }).optional(),
  
  // Summary
  summary: z.object({
    totalSequences: z.number().int().min(0),
    totalRecipients: z.number().int().min(0),
    totalEmails: z.number().int().min(0),
    avgReplyRate: rateSchema,
    avgMeetingRate: rateSchema,
    avgOpportunityRate: rateSchema,
    topPerformingSequence: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      replyRate: rateSchema,
    }),
    lowestPerformingSequence: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      replyRate: rateSchema,
    }),
  }),
  
  // AI insights
  aiInsights: z.object({
    keyFindings: z.array(z.string().min(1)),
    concerns: z.array(z.string().min(1)),
    opportunities: z.array(z.string().min(1)),
    nextSteps: z.array(z.string().min(1)),
  }).optional(),
});

// ============================================================================
// AI REQUEST SCHEMAS
// ============================================================================

/**
 * Pattern detection request validation
 */
export const patternDetectionRequestSchema = z.object({
  sequenceMetrics: z.array(sequenceMetricsSchema).min(1),
  minimumSampleSize: z.number().int().min(10).optional(),
  minimumLift: z.number().min(0).optional(),
  confidenceThreshold: patternConfidenceSchema.optional(),
});

/**
 * Optimization request validation
 */
export const optimizationRequestSchema = z.object({
  sequenceMetrics: sequenceMetricsSchema,
  patterns: z.array(sequencePatternSchema),
  targetMetric: z.enum(['reply_rate', 'meeting_rate', 'opportunity_rate']),
  constraints: z.object({
    maxSequenceLength: z.number().int().min(1).max(20).optional(),
    maxDelay: z.number().int().min(1).optional(),
    preferredTiming: timingStrategySchema.optional(),
  }).optional(),
});

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

/**
 * Sequence analysis response validation
 */
export const sequenceAnalysisResponseSchema = z.object({
  success: z.boolean(),
  analysis: sequenceAnalysisSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional(),
  metadata: z.object({
    generatedAt: z.string(),
    processingTime: z.number().min(0),
    cached: z.boolean(),
    cacheExpiresAt: z.string().optional(),
  }),
});

/**
 * Pattern detection response validation
 */
export const patternDetectionResponseSchema = z.object({
  success: z.boolean(),
  patterns: z.array(sequencePatternSchema).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional(),
  metadata: z.object({
    generatedAt: z.string(),
    processingTime: z.number().min(0),
    patternsFound: z.number().int().min(0),
  }),
});

/**
 * Optimization response validation
 */
export const optimizationResponseSchema = z.object({
  success: z.boolean(),
  recommendations: z.array(optimizationRecommendationSchema).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional(),
  metadata: z.object({
    generatedAt: z.string(),
    processingTime: z.number().min(0),
    recommendationsCount: z.number().int().min(0),
  }),
});

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Core schemas
  sequenceStatusSchema,
  sequenceStepTypeSchema,
  timingStrategySchema,
  sequenceStepSchema,
  emailSequenceSchema,
  
  // Execution schemas
  executionStatusSchema,
  emailExecutionSchema,
  sequenceExecutionSchema,
  
  // Metrics schemas
  subjectLinePerformanceSchema,
  linkPerformanceSchema,
  emailMetricsSchema,
  hourOfDaySchema,
  dayOfWeekSchema,
  sequenceMetricsSchema,
  
  // Pattern schemas
  patternTypeSchema,
  patternConfidenceSchema,
  patternCharacteristicSchema,
  sequencePatternSchema,
  
  // Optimization schemas
  optimizationAreaSchema,
  recommendationPrioritySchema,
  actionItemSchema,
  optimizationRecommendationSchema,
  
  // A/B test schemas
  abTestStatusSchema,
  abTestResultSchema,
  abTestSchema,
  
  // Analysis schemas
  sequenceAnalysisInputSchema,
  sequenceAnalysisSchema,
  patternDetectionRequestSchema,
  optimizationRequestSchema,
  
  // Response schemas
  sequenceAnalysisResponseSchema,
  patternDetectionResponseSchema,
  optimizationResponseSchema,
};
