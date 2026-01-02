/**
 * Sales Coaching & Insights Types
 * 
 * SOVEREIGN CORPORATE BRAIN - COACHING MODULE
 * 
 * This module defines the comprehensive type system for AI-powered sales coaching
 * that analyzes rep performance and provides personalized recommendations.
 * 
 * CORE CONCEPTS:
 * - Performance Analysis: Metrics-based evaluation of rep effectiveness
 * - Coaching Insights: AI-identified patterns and opportunities
 * - Recommendations: Personalized, actionable coaching suggestions
 * - Best Practices: Successful patterns identified across top performers
 * - Skills Assessment: Granular evaluation of sales competencies
 * 
 * INTEGRATION:
 * - Deal Scoring for conversion metrics
 * - Email Writer for communication quality
 * - Workflow Automation for efficiency metrics
 * - Revenue Forecasting for quota attainment
 * - Signal Bus for behavioral tracking
 */

// ============================================================================
// REP PERFORMANCE ANALYSIS
// ============================================================================

/**
 * Comprehensive performance metrics for a sales rep
 */
export interface RepPerformanceMetrics {
  /** Rep identifier */
  repId: string;
  repName: string;
  repEmail: string;
  
  /** Time period for analysis */
  period: TimePeriod;
  startDate: Date;
  endDate: Date;
  
  /** Deal metrics */
  deals: DealPerformanceMetrics;
  
  /** Email/communication metrics */
  communication: CommunicationMetrics;
  
  /** Activity metrics */
  activity: ActivityMetrics;
  
  /** Conversion metrics */
  conversion: ConversionMetrics;
  
  /** Revenue metrics */
  revenue: RevenueMetrics;
  
  /** Efficiency metrics */
  efficiency: EfficiencyMetrics;
  
  /** Skill scores (0-100) */
  skills: SkillScores;
  
  /** Overall performance score (0-100) */
  overallScore: number;
  
  /** Performance tier */
  tier: PerformanceTier;
  
  /** Comparison to team average */
  vsTeamAverage: PerformanceComparison;
}

/**
 * Deal-related performance metrics
 */
export interface DealPerformanceMetrics {
  /** Total deals owned */
  totalDeals: number;
  
  /** Active deals */
  activeDeals: number;
  
  /** Deals won */
  dealsWon: number;
  
  /** Deals lost */
  dealsLost: number;
  
  /** Win rate (0-1) */
  winRate: number;
  
  /** Average deal size */
  averageDealSize: number;
  
  /** Average deal cycle (days) */
  averageCycleDays: number;
  
  /** Deal velocity (deals/week) */
  dealVelocity: number;
  
  /** At-risk deals */
  atRiskDeals: number;
  
  /** Deal health distribution */
  healthDistribution: {
    healthy: number;
    warning: number;
    critical: number;
  };
}

/**
 * Communication quality metrics
 */
export interface CommunicationMetrics {
  /** Emails generated */
  emailsGenerated: number;
  
  /** Emails sent */
  emailsSent: number;
  
  /** Email response rate (0-1) */
  emailResponseRate: number;
  
  /** Average response time (hours) */
  averageResponseTime: number;
  
  /** AI email usage rate (0-1) */
  aiEmailUsageRate: number;
  
  /** Email personalization score (0-100) */
  personalizationScore: number;
  
  /** Follow-up consistency (0-100) */
  followUpConsistency: number;
}

/**
 * Activity level metrics
 */
export interface ActivityMetrics {
  /** Total activities logged */
  totalActivities: number;
  
  /** Activities per day */
  activitiesPerDay: number;
  
  /** Calls made */
  callsMade: number;
  
  /** Meetings held */
  meetingsHeld: number;
  
  /** Tasks completed */
  tasksCompleted: number;
  
  /** Task completion rate (0-1) */
  taskCompletionRate: number;
  
  /** Workflow automations triggered */
  workflowsTriggered: number;
  
  /** CRM updates */
  crmUpdates: number;
}

/**
 * Conversion funnel metrics
 */
export interface ConversionMetrics {
  /** Lead to opportunity rate (0-1) */
  leadToOpportunity: number;
  
  /** Opportunity to proposal rate (0-1) */
  opportunityToProposal: number;
  
  /** Proposal to close rate (0-1) */
  proposalToClose: number;
  
  /** Overall conversion rate (0-1) */
  overallConversion: number;
  
  /** Funnel drop-off points */
  dropOffPoints: {
    stage: string;
    dropOffRate: number;
  }[];
}

/**
 * Revenue performance metrics
 */
export interface RevenueMetrics {
  /** Total revenue closed */
  totalRevenue: number;
  
  /** Revenue quota */
  quota: number;
  
  /** Quota attainment (0-1) */
  quotaAttainment: number;
  
  /** Pipeline value */
  pipelineValue: number;
  
  /** Weighted pipeline */
  weightedPipeline: number;
  
  /** Forecast accuracy (0-1) */
  forecastAccuracy: number;
  
  /** Average contract value (ACV) */
  acv: number;
  
  /** Revenue growth rate (vs previous period) */
  growthRate: number;
}

/**
 * Efficiency metrics
 */
export interface EfficiencyMetrics {
  /** Time to first contact (hours) */
  timeToFirstContact: number;
  
  /** Time to proposal (days) */
  timeToProposal: number;
  
  /** Time to close (days) */
  timeToClose: number;
  
  /** Meetings per deal */
  meetingsPerDeal: number;
  
  /** Emails per deal */
  emailsPerDeal: number;
  
  /** Touch points per deal */
  touchPointsPerDeal: number;
  
  /** AI automation usage (0-1) */
  automationUsage: number;
  
  /** Manual task hours saved */
  hoursSaved: number;
}

/**
 * Granular skill assessment (0-100 scores)
 */
export interface SkillScores {
  /** Prospecting ability */
  prospecting: number;
  
  /** Discovery & qualification */
  discovery: number;
  
  /** Needs analysis */
  needsAnalysis: number;
  
  /** Presentation & demo */
  presentation: number;
  
  /** Objection handling */
  objectionHandling: number;
  
  /** Negotiation */
  negotiation: number;
  
  /** Closing techniques */
  closing: number;
  
  /** Relationship building */
  relationshipBuilding: number;
  
  /** Product knowledge */
  productKnowledge: number;
  
  /** CRM hygiene */
  crmHygiene: number;
  
  /** Time management */
  timeManagement: number;
  
  /** AI tool adoption */
  aiToolAdoption: number;
}

/**
 * Performance tier classification
 */
export type PerformanceTier = 'top_performer' | 'high_performer' | 'average' | 'needs_improvement' | 'at_risk';

/**
 * Comparison to team average
 */
export interface PerformanceComparison {
  /** Overall score difference (+/- percentage points) */
  overallScoreDelta: number;
  
  /** Win rate difference */
  winRateDelta: number;
  
  /** Revenue difference */
  revenueDelta: number;
  
  /** Activity level difference */
  activityDelta: number;
  
  /** Efficiency difference */
  efficiencyDelta: number;
  
  /** Percentile rank (0-100) */
  percentileRank: number;
}

// ============================================================================
// COACHING INSIGHTS
// ============================================================================

/**
 * AI-generated coaching insights for a rep
 */
export interface CoachingInsights {
  /** Rep identifier */
  repId: string;
  repName: string;
  
  /** When insights were generated */
  generatedAt: Date;
  
  /** Performance summary */
  performanceSummary: PerformanceSummary;
  
  /** Identified strengths */
  strengths: Strength[];
  
  /** Identified weaknesses */
  weaknesses: Weakness[];
  
  /** Opportunities for improvement */
  opportunities: Opportunity[];
  
  /** Risks and concerns */
  risks: Risk[];
  
  /** Best practices to adopt */
  bestPractices: BestPractice[];
  
  /** Coaching recommendations */
  recommendations: CoachingRecommendation[];
  
  /** Suggested training */
  training: TrainingSuggestion[];
  
  /** Action items */
  actionItems: ActionItem[];
  
  /** Insights confidence score (0-1) */
  confidenceScore: number;
}

/**
 * High-level performance summary
 */
export interface PerformanceSummary {
  /** Overall assessment */
  assessment: string;
  
  /** Current tier */
  currentTier: PerformanceTier;
  
  /** Trend direction */
  trend: 'improving' | 'stable' | 'declining';
  
  /** Key metrics */
  keyMetrics: {
    metric: string;
    value: number;
    vsTeamAverage: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  
  /** Top 3 focus areas */
  focusAreas: string[];
}

/**
 * Identified strength
 */
export interface Strength {
  /** Strength category */
  category: SkillCategory;
  
  /** Strength title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Supporting metrics */
  metrics: {
    metric: string;
    value: number;
    benchmark: number;
  }[];
  
  /** How to leverage this strength */
  leverageStrategy: string;
  
  /** Impact level */
  impact: 'high' | 'medium' | 'low';
}

/**
 * Identified weakness
 */
export interface Weakness {
  /** Weakness category */
  category: SkillCategory;
  
  /** Weakness title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Supporting metrics */
  metrics: {
    metric: string;
    value: number;
    benchmark: number;
    gap: number;
  }[];
  
  /** Root causes */
  rootCauses: string[];
  
  /** Impact on performance */
  impact: 'high' | 'medium' | 'low';
  
  /** Urgency */
  urgency: 'immediate' | 'near_term' | 'long_term';
}

/**
 * Opportunity for improvement
 */
export interface Opportunity {
  /** Opportunity title */
  title: string;
  
  /** Description */
  description: string;
  
  /** Category */
  category: SkillCategory;
  
  /** Potential impact */
  potentialImpact: {
    metric: string;
    currentValue: number;
    projectedValue: number;
    improvement: number;
  }[];
  
  /** Recommended actions */
  actions: string[];
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard';
  
  /** Time to impact */
  timeToImpact: 'immediate' | 'short_term' | 'long_term';
  
  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Risk or concern
 */
export interface Risk {
  /** Risk title */
  title: string;
  
  /** Description */
  description: string;
  
  /** Category */
  category: RiskCategory;
  
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  
  /** Likelihood */
  likelihood: 'very_likely' | 'likely' | 'possible' | 'unlikely';
  
  /** Indicators */
  indicators: string[];
  
  /** Mitigation strategies */
  mitigationStrategies: string[];
  
  /** Escalation threshold */
  escalationThreshold?: string;
}

/**
 * Best practice to adopt
 */
export interface BestPractice {
  /** Practice title */
  title: string;
  
  /** Description */
  description: string;
  
  /** Category */
  category: SkillCategory;
  
  /** Who does this well */
  topPerformers: string[];
  
  /** Success metrics */
  successMetrics: {
    metric: string;
    topPerformerAverage: number;
    repCurrent: number;
    gap: number;
  }[];
  
  /** Implementation guide */
  implementationSteps: string[];
  
  /** Expected impact */
  expectedImpact: string;
}

/**
 * Coaching recommendation
 */
export interface CoachingRecommendation {
  /** Unique ID */
  id: string;
  
  /** Recommendation title */
  title: string;
  
  /** Detailed recommendation */
  recommendation: string;
  
  /** Category */
  category: SkillCategory;
  
  /** Rationale */
  rationale: string;
  
  /** Specific actions */
  actions: {
    action: string;
    timeline: string;
    owner: 'rep' | 'manager' | 'both';
  }[];
  
  /** Success criteria */
  successCriteria: string[];
  
  /** Expected outcomes */
  expectedOutcomes: {
    metric: string;
    baseline: number;
    target: number;
    timeframe: string;
  }[];
  
  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  /** Effort required */
  effort: 'high' | 'medium' | 'low';
  
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Training suggestion
 */
export interface TrainingSuggestion {
  /** Training title */
  title: string;
  
  /** Description */
  description: string;
  
  /** Skill category */
  category: SkillCategory;
  
  /** Training type */
  type: 'course' | 'workshop' | 'mentorship' | 'shadowing' | 'self_study' | 'certification';
  
  /** Recommended resources */
  resources: {
    name: string;
    type: string;
    url?: string;
    duration?: string;
  }[];
  
  /** Expected skill improvement */
  skillImprovement: {
    skill: string;
    currentLevel: number;
    targetLevel: number;
  }[];
  
  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Actionable item
 */
export interface ActionItem {
  /** Action ID */
  id: string;
  
  /** Action title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Category */
  category: SkillCategory;
  
  /** Owner */
  owner: 'rep' | 'manager' | 'both';
  
  /** Due date */
  dueDate: Date;
  
  /** Estimated effort (hours) */
  estimatedEffort: number;
  
  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  /** Success metrics */
  successMetrics: string[];
  
  /** Related recommendations */
  relatedRecommendations: string[];
}

// ============================================================================
// SKILL CATEGORIES & RISK CATEGORIES
// ============================================================================

/**
 * Sales skill categories
 */
export type SkillCategory =
  | 'prospecting'
  | 'discovery'
  | 'presentation'
  | 'objection_handling'
  | 'negotiation'
  | 'closing'
  | 'relationship_building'
  | 'product_knowledge'
  | 'crm_hygiene'
  | 'time_management'
  | 'ai_tool_usage'
  | 'communication'
  | 'pipeline_management'
  | 'forecasting';

/**
 * Risk categories
 */
export type RiskCategory =
  | 'performance'
  | 'quota_attainment'
  | 'pipeline_health'
  | 'activity_level'
  | 'skill_gap'
  | 'engagement'
  | 'retention'
  | 'compliance';

// ============================================================================
// TEAM INSIGHTS
// ============================================================================

/**
 * Team-wide coaching insights
 */
export interface TeamCoachingInsights {
  /** Team identifier */
  teamId: string;
  teamName: string;
  
  /** Time period */
  period: TimePeriod;
  startDate: Date;
  endDate: Date;
  
  /** When insights were generated */
  generatedAt: Date;
  
  /** Team performance summary */
  teamSummary: TeamPerformanceSummary;
  
  /** Individual rep insights */
  repInsights: RepPerformanceMetrics[];
  
  /** Top performers */
  topPerformers: {
    repId: string;
    repName: string;
    score: number;
    strengths: string[];
  }[];
  
  /** Reps needing support */
  needsSupport: {
    repId: string;
    repName: string;
    score: number;
    criticalAreas: string[];
  }[];
  
  /** Team strengths */
  teamStrengths: string[];
  
  /** Team weaknesses */
  teamWeaknesses: string[];
  
  /** Skill gaps */
  skillGaps: {
    skill: string;
    teamAverage: number;
    topPerformerAverage: number;
    gap: number;
    repsAffected: number;
  }[];
  
  /** Best practices to share */
  bestPracticesToShare: BestPractice[];
  
  /** Team coaching priorities */
  teamPriorities: {
    area: string;
    importance: number;
    repsAffected: number;
    potentialImpact: string;
  }[];
}

/**
 * Team performance summary
 */
export interface TeamPerformanceSummary {
  /** Total team members */
  totalReps: number;
  
  /** Performance distribution */
  performanceDistribution: {
    tier: PerformanceTier;
    count: number;
    percentage: number;
  }[];
  
  /** Team averages */
  teamAverages: {
    overallScore: number;
    winRate: number;
    quotaAttainment: number;
    dealVelocity: number;
    emailResponseRate: number;
  };
  
  /** Trends */
  trends: {
    metric: string;
    direction: 'up' | 'down' | 'stable';
    change: number;
  }[];
  
  /** At-risk reps */
  atRiskCount: number;
  
  /** Top performer benchmarks */
  topPerformerBenchmarks: {
    metric: string;
    value: number;
  }[];
}

// ============================================================================
// TIME PERIODS
// ============================================================================

/**
 * Time period for analysis
 */
export type TimePeriod = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_6_months' | 'last_12_months' | 'this_quarter' | 'this_year' | 'custom';

/**
 * Custom date range
 */
export interface CustomDateRange {
  startDate: Date;
  endDate: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to generate coaching insights for a rep
 */
export interface GenerateCoachingRequest {
  /** Rep ID */
  repId: string;
  
  /** Time period */
  period: TimePeriod;
  
  /** Custom date range (required if period is 'custom') */
  customRange?: CustomDateRange;
  
  /** Include detailed analysis */
  includeDetailed?: boolean;
  
  /** Include training suggestions */
  includeTraining?: boolean;
  
  /** Include action items */
  includeActionItems?: boolean;
}

/**
 * Response with coaching insights
 */
export interface GenerateCoachingResponse {
  /** Success status */
  success: boolean;
  
  /** Rep performance metrics */
  performance: RepPerformanceMetrics;
  
  /** Coaching insights */
  insights: CoachingInsights;
  
  /** Generation metadata */
  metadata: {
    generatedAt: Date;
    modelUsed: string;
    processingTimeMs: number;
    confidenceScore: number;
  };
  
  /** Error (if any) */
  error?: string;
}

/**
 * Request for team coaching insights
 */
export interface GenerateTeamCoachingRequest {
  /** Team ID */
  teamId: string;
  
  /** Time period */
  period: TimePeriod;
  
  /** Custom date range */
  customRange?: CustomDateRange;
  
  /** Include individual rep details */
  includeRepDetails?: boolean;
}

/**
 * Response with team coaching insights
 */
export interface GenerateTeamCoachingResponse {
  /** Success status */
  success: boolean;
  
  /** Team insights */
  teamInsights: TeamCoachingInsights;
  
  /** Generation metadata */
  metadata: {
    generatedAt: Date;
    modelUsed: string;
    processingTimeMs: number;
  };
  
  /** Error (if any) */
  error?: string;
}
