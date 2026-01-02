/**
 * Sales Coaching Validation Schemas
 * 
 * SOVEREIGN CORPORATE BRAIN - COACHING MODULE
 * 
 * Comprehensive Zod validation schemas for all coaching-related types.
 * Ensures data integrity and type safety across API boundaries.
 * 
 * VALIDATION STRATEGY:
 * - Strict input validation for all API requests
 * - Runtime type checking for external data
 * - Graceful error messages for debugging
 * - Performance-optimized schemas
 */

import { z } from 'zod';

// ============================================================================
// ENUMS & PRIMITIVES
// ============================================================================

export const TimePeriodSchema = z.enum([
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'last_6_months',
  'last_12_months',
  'this_quarter',
  'this_year',
  'custom'
]);

export const PerformanceTierSchema = z.enum([
  'top_performer',
  'high_performer',
  'average',
  'needs_improvement',
  'at_risk'
]);

export const SkillCategorySchema = z.enum([
  'prospecting',
  'discovery',
  'presentation',
  'objection_handling',
  'negotiation',
  'closing',
  'relationship_building',
  'product_knowledge',
  'crm_hygiene',
  'time_management',
  'ai_tool_usage',
  'communication',
  'pipeline_management',
  'forecasting'
]);

export const RiskCategorySchema = z.enum([
  'performance',
  'quota_attainment',
  'pipeline_health',
  'activity_level',
  'skill_gap',
  'engagement',
  'retention',
  'compliance'
]);

export const TrendDirectionSchema = z.enum(['improving', 'stable', 'declining']);
export const MetricTrendSchema = z.enum(['up', 'down', 'stable']);
export const ImpactLevelSchema = z.enum(['high', 'medium', 'low']);
export const UrgencySchema = z.enum(['immediate', 'near_term', 'long_term']);
export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);
export const TimeToImpactSchema = z.enum(['immediate', 'short_term', 'long_term']);
export const PrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const LikelihoodSchema = z.enum(['very_likely', 'likely', 'possible', 'unlikely']);
export const OwnerSchema = z.enum(['rep', 'manager', 'both']);
export const TrainingTypeSchema = z.enum(['course', 'workshop', 'mentorship', 'shadowing', 'self_study', 'certification']);

// ============================================================================
// PERFORMANCE METRICS SCHEMAS
// ============================================================================

export const DealPerformanceMetricsSchema = z.object({
  totalDeals: z.number().int().min(0),
  activeDeals: z.number().int().min(0),
  dealsWon: z.number().int().min(0),
  dealsLost: z.number().int().min(0),
  winRate: z.number().min(0).max(1),
  averageDealSize: z.number().min(0),
  averageCycleDays: z.number().min(0),
  dealVelocity: z.number().min(0),
  atRiskDeals: z.number().int().min(0),
  healthDistribution: z.object({
    healthy: z.number().int().min(0),
    warning: z.number().int().min(0),
    critical: z.number().int().min(0)
  })
});

export const CommunicationMetricsSchema = z.object({
  emailsGenerated: z.number().int().min(0),
  emailsSent: z.number().int().min(0),
  emailResponseRate: z.number().min(0).max(1),
  averageResponseTime: z.number().min(0),
  aiEmailUsageRate: z.number().min(0).max(1),
  personalizationScore: z.number().min(0).max(100),
  followUpConsistency: z.number().min(0).max(100)
});

export const ActivityMetricsSchema = z.object({
  totalActivities: z.number().int().min(0),
  activitiesPerDay: z.number().min(0),
  callsMade: z.number().int().min(0),
  meetingsHeld: z.number().int().min(0),
  tasksCompleted: z.number().int().min(0),
  taskCompletionRate: z.number().min(0).max(1),
  workflowsTriggered: z.number().int().min(0),
  crmUpdates: z.number().int().min(0)
});

export const ConversionMetricsSchema = z.object({
  leadToOpportunity: z.number().min(0).max(1),
  opportunityToProposal: z.number().min(0).max(1),
  proposalToClose: z.number().min(0).max(1),
  overallConversion: z.number().min(0).max(1),
  dropOffPoints: z.array(z.object({
    stage: z.string(),
    dropOffRate: z.number().min(0).max(1)
  }))
});

export const RevenueMetricsSchema = z.object({
  totalRevenue: z.number().min(0),
  quota: z.number().min(0),
  quotaAttainment: z.number().min(0),
  pipelineValue: z.number().min(0),
  weightedPipeline: z.number().min(0),
  forecastAccuracy: z.number().min(0).max(1),
  acv: z.number().min(0),
  growthRate: z.number()
});

export const EfficiencyMetricsSchema = z.object({
  timeToFirstContact: z.number().min(0),
  timeToProposal: z.number().min(0),
  timeToClose: z.number().min(0),
  meetingsPerDeal: z.number().min(0),
  emailsPerDeal: z.number().min(0),
  touchPointsPerDeal: z.number().min(0),
  automationUsage: z.number().min(0).max(1),
  hoursSaved: z.number().min(0)
});

export const SkillScoresSchema = z.object({
  prospecting: z.number().min(0).max(100),
  discovery: z.number().min(0).max(100),
  needsAnalysis: z.number().min(0).max(100),
  presentation: z.number().min(0).max(100),
  objectionHandling: z.number().min(0).max(100),
  negotiation: z.number().min(0).max(100),
  closing: z.number().min(0).max(100),
  relationshipBuilding: z.number().min(0).max(100),
  productKnowledge: z.number().min(0).max(100),
  crmHygiene: z.number().min(0).max(100),
  timeManagement: z.number().min(0).max(100),
  aiToolAdoption: z.number().min(0).max(100)
});

export const PerformanceComparisonSchema = z.object({
  overallScoreDelta: z.number(),
  winRateDelta: z.number(),
  revenueDelta: z.number(),
  activityDelta: z.number(),
  efficiencyDelta: z.number(),
  percentileRank: z.number().min(0).max(100)
});

export const RepPerformanceMetricsSchema = z.object({
  repId: z.string().min(1),
  repName: z.string().min(1),
  repEmail: z.string().email(),
  period: TimePeriodSchema,
  startDate: z.date(),
  endDate: z.date(),
  deals: DealPerformanceMetricsSchema,
  communication: CommunicationMetricsSchema,
  activity: ActivityMetricsSchema,
  conversion: ConversionMetricsSchema,
  revenue: RevenueMetricsSchema,
  efficiency: EfficiencyMetricsSchema,
  skills: SkillScoresSchema,
  overallScore: z.number().min(0).max(100),
  tier: PerformanceTierSchema,
  vsTeamAverage: PerformanceComparisonSchema
});

// ============================================================================
// COACHING INSIGHTS SCHEMAS
// ============================================================================

export const PerformanceSummarySchema = z.object({
  assessment: z.string().min(10).max(1000),
  currentTier: PerformanceTierSchema,
  trend: TrendDirectionSchema,
  keyMetrics: z.array(z.object({
    metric: z.string(),
    value: z.number(),
    vsTeamAverage: z.number(),
    trend: MetricTrendSchema
  })),
  focusAreas: z.array(z.string()).min(1).max(5)
});

export const StrengthSchema = z.object({
  category: SkillCategorySchema,
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(1000),
  metrics: z.array(z.object({
    metric: z.string(),
    value: z.number(),
    benchmark: z.number()
  })),
  leverageStrategy: z.string().min(10).max(500),
  impact: ImpactLevelSchema
});

export const WeaknessSchema = z.object({
  category: SkillCategorySchema,
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(1000),
  metrics: z.array(z.object({
    metric: z.string(),
    value: z.number(),
    benchmark: z.number(),
    gap: z.number()
  })),
  rootCauses: z.array(z.string()).min(1).max(5),
  impact: ImpactLevelSchema,
  urgency: UrgencySchema
});

export const OpportunitySchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(1000),
  category: SkillCategorySchema,
  potentialImpact: z.array(z.object({
    metric: z.string(),
    currentValue: z.number(),
    projectedValue: z.number(),
    improvement: z.number()
  })),
  actions: z.array(z.string()).min(1).max(10),
  difficulty: DifficultySchema,
  timeToImpact: TimeToImpactSchema,
  priority: PrioritySchema
});

export const RiskSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(1000),
  category: RiskCategorySchema,
  severity: SeveritySchema,
  likelihood: LikelihoodSchema,
  indicators: z.array(z.string()).min(1).max(10),
  mitigationStrategies: z.array(z.string()).min(1).max(10),
  escalationThreshold: z.string().optional()
});

export const BestPracticeSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(1000),
  category: SkillCategorySchema,
  topPerformers: z.array(z.string()).min(1).max(10),
  successMetrics: z.array(z.object({
    metric: z.string(),
    topPerformerAverage: z.number(),
    repCurrent: z.number(),
    gap: z.number()
  })),
  implementationSteps: z.array(z.string()).min(1).max(10),
  expectedImpact: z.string().min(10).max(500)
});

export const CoachingRecommendationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(5).max(200),
  recommendation: z.string().min(10).max(2000),
  category: SkillCategorySchema,
  rationale: z.string().min(10).max(1000),
  actions: z.array(z.object({
    action: z.string(),
    timeline: z.string(),
    owner: OwnerSchema
  })).min(1).max(10),
  successCriteria: z.array(z.string()).min(1).max(10),
  expectedOutcomes: z.array(z.object({
    metric: z.string(),
    baseline: z.number(),
    target: z.number(),
    timeframe: z.string()
  })),
  priority: PrioritySchema,
  effort: ImpactLevelSchema,
  confidence: z.number().min(0).max(1)
});

export const TrainingSuggestionSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(1000),
  category: SkillCategorySchema,
  type: TrainingTypeSchema,
  resources: z.array(z.object({
    name: z.string(),
    type: z.string(),
    url: z.string().url().optional(),
    duration: z.string().optional()
  })),
  skillImprovement: z.array(z.object({
    skill: z.string(),
    currentLevel: z.number().min(0).max(100),
    targetLevel: z.number().min(0).max(100)
  })),
  priority: PrioritySchema
});

export const ActionItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(1000),
  category: SkillCategorySchema,
  owner: OwnerSchema,
  dueDate: z.date(),
  estimatedEffort: z.number().min(0).max(100),
  priority: PrioritySchema,
  successMetrics: z.array(z.string()).min(1).max(5),
  relatedRecommendations: z.array(z.string())
});

export const CoachingInsightsSchema = z.object({
  repId: z.string().min(1),
  repName: z.string().min(1),
  generatedAt: z.date(),
  performanceSummary: PerformanceSummarySchema,
  strengths: z.array(StrengthSchema),
  weaknesses: z.array(WeaknessSchema),
  opportunities: z.array(OpportunitySchema),
  risks: z.array(RiskSchema),
  bestPractices: z.array(BestPracticeSchema),
  recommendations: z.array(CoachingRecommendationSchema),
  training: z.array(TrainingSuggestionSchema),
  actionItems: z.array(ActionItemSchema),
  confidenceScore: z.number().min(0).max(1)
});

// ============================================================================
// TEAM INSIGHTS SCHEMAS
// ============================================================================

export const TeamPerformanceSummarySchema = z.object({
  totalReps: z.number().int().min(0),
  performanceDistribution: z.array(z.object({
    tier: PerformanceTierSchema,
    count: z.number().int().min(0),
    percentage: z.number().min(0).max(100)
  })),
  teamAverages: z.object({
    overallScore: z.number().min(0).max(100),
    winRate: z.number().min(0).max(1),
    quotaAttainment: z.number().min(0),
    dealVelocity: z.number().min(0),
    emailResponseRate: z.number().min(0).max(1)
  }),
  trends: z.array(z.object({
    metric: z.string(),
    direction: MetricTrendSchema,
    change: z.number()
  })),
  atRiskCount: z.number().int().min(0),
  topPerformerBenchmarks: z.array(z.object({
    metric: z.string(),
    value: z.number()
  }))
});

export const TeamCoachingInsightsSchema = z.object({
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  period: TimePeriodSchema,
  startDate: z.date(),
  endDate: z.date(),
  generatedAt: z.date(),
  teamSummary: TeamPerformanceSummarySchema,
  repInsights: z.array(RepPerformanceMetricsSchema),
  topPerformers: z.array(z.object({
    repId: z.string(),
    repName: z.string(),
    score: z.number().min(0).max(100),
    strengths: z.array(z.string())
  })),
  needsSupport: z.array(z.object({
    repId: z.string(),
    repName: z.string(),
    score: z.number().min(0).max(100),
    criticalAreas: z.array(z.string())
  })),
  teamStrengths: z.array(z.string()),
  teamWeaknesses: z.array(z.string()),
  skillGaps: z.array(z.object({
    skill: z.string(),
    teamAverage: z.number().min(0).max(100),
    topPerformerAverage: z.number().min(0).max(100),
    gap: z.number(),
    repsAffected: z.number().int().min(0)
  })),
  bestPracticesToShare: z.array(BestPracticeSchema),
  teamPriorities: z.array(z.object({
    area: z.string(),
    importance: z.number().min(0).max(100),
    repsAffected: z.number().int().min(0),
    potentialImpact: z.string()
  }))
});

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

export const CustomDateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date()
}).refine(
  (data) => data.endDate > data.startDate,
  { message: "End date must be after start date" }
);

export const GenerateCoachingRequestSchema = z.object({
  repId: z.string().min(1, "Rep ID is required"),
  period: TimePeriodSchema,
  customRange: CustomDateRangeSchema.optional(),
  includeDetailed: z.boolean().optional().default(true),
  includeTraining: z.boolean().optional().default(true),
  includeActionItems: z.boolean().optional().default(true)
}).refine(
  (data) => {
    if (data.period === 'custom' && !data.customRange) {
      return false;
    }
    return true;
  },
  {
    message: "Custom range is required when period is 'custom'",
    path: ['customRange']
  }
);

export const GenerateCoachingResponseSchema = z.object({
  success: z.boolean(),
  performance: RepPerformanceMetricsSchema,
  insights: CoachingInsightsSchema,
  metadata: z.object({
    generatedAt: z.date(),
    modelUsed: z.string(),
    processingTimeMs: z.number().min(0),
    confidenceScore: z.number().min(0).max(1)
  }),
  error: z.string().optional()
});

export const GenerateTeamCoachingRequestSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  period: TimePeriodSchema,
  customRange: CustomDateRangeSchema.optional(),
  includeRepDetails: z.boolean().optional().default(true)
}).refine(
  (data) => {
    if (data.period === 'custom' && !data.customRange) {
      return false;
    }
    return true;
  },
  {
    message: "Custom range is required when period is 'custom'",
    path: ['customRange']
  }
);

export const GenerateTeamCoachingResponseSchema = z.object({
  success: z.boolean(),
  teamInsights: TeamCoachingInsightsSchema,
  metadata: z.object({
    generatedAt: z.date(),
    modelUsed: z.string(),
    processingTimeMs: z.number().min(0)
  }),
  error: z.string().optional()
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates a generate coaching request
 * @param data - Request data to validate
 * @returns Validated request or throws validation error
 */
export function validateGenerateCoachingRequest(data: unknown) {
  return GenerateCoachingRequestSchema.parse(data);
}

/**
 * Validates a generate team coaching request
 * @param data - Request data to validate
 * @returns Validated request or throws validation error
 */
export function validateGenerateTeamCoachingRequest(data: unknown) {
  return GenerateTeamCoachingRequestSchema.parse(data);
}

/**
 * Safely validates a generate coaching request
 * @param data - Request data to validate
 * @returns Success/error result
 */
export function safeValidateGenerateCoachingRequest(data: unknown) {
  return GenerateCoachingRequestSchema.safeParse(data);
}

/**
 * Safely validates a generate team coaching request
 * @param data - Request data to validate
 * @returns Success/error result
 */
export function safeValidateGenerateTeamCoachingRequest(data: unknown) {
  return GenerateTeamCoachingRequestSchema.safeParse(data);
}
