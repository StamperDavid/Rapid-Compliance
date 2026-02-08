/**
 * Intelligent Lead Routing Types
 * 
 * SOVEREIGN CORPORATE BRAIN - LEAD ROUTING MODULE
 * 
 * This module defines the comprehensive type system for AI-powered lead routing
 * that optimizes lead assignment based on rep performance, workload, and deal scoring.
 * 
 * CORE CONCEPTS:
 * - Lead Scoring: AI-based evaluation of lead quality and fit
 * - Rep Matching: Intelligent pairing of leads with best-suited reps
 * - Workload Balancing: Fair distribution based on capacity and performance
 * - Territory Rules: Geographic and vertical-based assignment logic
 * - Priority Routing: Hot leads routed to top performers
 * 
 * INTEGRATION:
 * - Deal Scoring for lead quality assessment
 * - Coaching insights for rep performance metrics
 * - Signal Bus for routing events
 * - Workflow Automation for post-assignment actions
 */

import type { PerformanceTier, SkillScores } from '../coaching/types';

// ============================================================================
// LEAD INFORMATION
// ============================================================================

/**
 * Lead entity for routing decisions
 */
export interface Lead {
  /** Lead identifier */
  id: string;

  /** Lead company information */
  companyName: string;
  companyDomain?: string;
  companySize?: CompanySize;
  industry?: string;
  
  /** Lead contact information */
  contactName: string;
  contactEmail: string;
  contactTitle?: string;
  contactPhone?: string;
  
  /** Geographic information */
  country?: string;
  state?: string;
  city?: string;
  timezone?: string;
  
  /** Lead source */
  source: LeadSource;
  sourceDetails?: string;
  
  /** Lead quality scores */
  qualityScore: number; // 0-100
  intentScore?: number; // 0-100
  fitScore?: number; // 0-100
  
  /** Lead priority */
  priority: LeadPriority;
  
  /** Deal value (estimated or actual) */
  estimatedValue?: number;
  
  /** Current status */
  status: LeadStatus;
  
  /** Tags/labels */
  tags?: string[];
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Company size categories
 */
export type CompanySize = 
  | 'enterprise' // 1000+ employees
  | 'mid_market' // 100-999 employees
  | 'smb' // 10-99 employees
  | 'startup'; // 1-9 employees

/**
 * Lead source channels
 */
export type LeadSource =
  | 'inbound_website'
  | 'inbound_form'
  | 'outbound_cold'
  | 'outbound_warm'
  | 'referral'
  | 'partner'
  | 'event'
  | 'social'
  | 'content'
  | 'paid_ads'
  | 'other';

/**
 * Lead priority levels
 */
export type LeadPriority = 'hot' | 'warm' | 'cold';

/**
 * Lead status
 */
export type LeadStatus =
  | 'new' // Just created, not yet routed
  | 'routing' // Currently being routed
  | 'assigned' // Assigned to a rep
  | 'contacted' // Rep has made contact
  | 'qualified' // Qualified as opportunity
  | 'disqualified' // Not a fit
  | 'nurture' // Not ready yet
  | 'converted' // Became a customer
  | 'lost'; // Chose competitor or no decision

// ============================================================================
// REP INFORMATION
// ============================================================================

/**
 * Sales rep entity for routing decisions
 */
export interface SalesRep {
  /** Rep identifier */
  id: string;

  /** Rep details */
  name: string;
  email: string;
  
  /** Performance metrics */
  performanceTier: PerformanceTier;
  overallScore: number; // 0-100
  skillScores: SkillScores;
  
  /** Capacity & workload */
  capacity: RepCapacity;
  currentWorkload: RepWorkload;
  
  /** Specializations */
  specializations: RepSpecializations;
  
  /** Territory assignments */
  territories: Territory[];
  
  /** Availability */
  isAvailable: boolean;
  availabilityStatus?: AvailabilityStatus;
  
  /** Routing preferences */
  routingPreferences: RoutingPreferences;
  
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Rep capacity limits
 */
export interface RepCapacity {
  /** Maximum active leads */
  maxActiveLeads: number;
  
  /** Maximum new leads per day */
  maxNewLeadsPerDay: number;
  
  /** Maximum new leads per week */
  maxNewLeadsPerWeek: number;
  
  /** Maximum total deal value */
  maxTotalDealValue?: number;
  
  /** Custom capacity rules */
  customRules?: CapacityRule[];
}

/**
 * Custom capacity rule
 */
export interface CapacityRule {
  /** Rule identifier */
  id: string;
  
  /** Rule name */
  name: string;
  
  /** Rule condition */
  condition: string;
  
  /** Limit value */
  limit: number;
  
  /** Current usage */
  current: number;
  
  /** Is limit exceeded */
  isExceeded: boolean;
}

/**
 * Current workload metrics
 */
export interface RepWorkload {
  /** Current active leads */
  activeLeads: number;
  
  /** Leads assigned today */
  leadsAssignedToday: number;
  
  /** Leads assigned this week */
  leadsAssignedThisWeek: number;
  
  /** Total pipeline value */
  totalPipelineValue: number;
  
  /** Utilization percentage (0-100) */
  utilizationPercentage: number;
  
  /** Is at capacity */
  isAtCapacity: boolean;
  
  /** Remaining capacity */
  remainingCapacity: {
    leads: number;
    dailyLeads: number;
    weeklyLeads: number;
  };
}

/**
 * Rep specializations
 */
export interface RepSpecializations {
  /** Industry expertise */
  industries?: string[];
  
  /** Company size expertise */
  companySizes?: CompanySize[];
  
  /** Product expertise */
  products?: string[];
  
  /** Use case expertise */
  useCases?: string[];
  
  /** Language proficiency */
  languages?: string[];
  
  /** Certifications */
  certifications?: string[];
}

/**
 * Territory definition
 */
export interface Territory {
  /** Territory identifier */
  id: string;
  
  /** Territory name */
  name: string;
  
  /** Territory type */
  type: TerritoryType;
  
  /** Geographic rules */
  geographic?: {
    countries?: string[];
    states?: string[];
    cities?: string[];
    zipcodes?: string[];
  };
  
  /** Vertical rules */
  vertical?: {
    industries?: string[];
    companySizes?: CompanySize[];
  };
  
  /** Priority */
  priority: number; // Higher = more important
}

/**
 * Territory type
 */
export type TerritoryType = 'geographic' | 'vertical' | 'named_accounts' | 'hybrid';

/**
 * Availability status
 */
export type AvailabilityStatus =
  | 'available'
  | 'busy'
  | 'meeting'
  | 'out_of_office'
  | 'vacation'
  | 'training';

/**
 * Routing preferences
 */
export interface RoutingPreferences {
  /** Prefer inbound vs outbound */
  preferredSources?: LeadSource[];
  
  /** Preferred lead priorities */
  preferredPriorities?: LeadPriority[];
  
  /** Auto-accept assignments */
  autoAccept: boolean;
  
  /** Notification preferences */
  notifyOnAssignment: boolean;
  notifyOnHotLead: boolean;
  
  /** Working hours */
  workingHours?: WorkingHours;
}

/**
 * Working hours definition
 */
export interface WorkingHours {
  /** Timezone */
  timezone: string;
  
  /** Daily schedule */
  schedule: {
    monday?: TimeRange;
    tuesday?: TimeRange;
    wednesday?: TimeRange;
    thursday?: TimeRange;
    friday?: TimeRange;
    saturday?: TimeRange;
    sunday?: TimeRange;
  };
}

/**
 * Time range
 */
export interface TimeRange {
  /** Start time (HH:MM format) */
  start: string;
  
  /** End time (HH:MM format) */
  end: string;
}

// ============================================================================
// ROUTING RULES & STRATEGY
// ============================================================================

/**
 * Routing rule definition
 */
export interface RoutingRule {
  /** Rule identifier */
  id: string;

  /** Rule name */
  name: string;
  
  /** Rule description */
  description?: string;
  
  /** Rule type */
  type: RoutingRuleType;
  
  /** Rule priority (higher = evaluated first) */
  priority: number;
  
  /** Is rule enabled */
  enabled: boolean;
  
  /** Conditions to match */
  conditions: RoutingCondition[];
  
  /** Actions to take when matched */
  actions: RoutingAction[];
  
  /** Created/updated metadata */
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Routing rule types
 */
export type RoutingRuleType =
  | 'territory' // Territory-based routing
  | 'performance' // Route hot leads to top performers
  | 'workload' // Balance workload across team
  | 'specialization' // Match to rep expertise
  | 'round_robin' // Simple round-robin
  | 'custom'; // Custom logic

/**
 * Routing condition
 */
export interface RoutingCondition {
  /** Field to evaluate */
  field: string;
  
  /** Operator */
  operator: ConditionOperator;
  
  /** Value to compare */
  value: unknown;
  
  /** Logical connector (for multiple conditions) */
  connector?: 'AND' | 'OR';
}

/**
 * Condition operators
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'matches_regex';

/**
 * Routing action
 */
export interface RoutingAction {
  /** Action type */
  type: RoutingActionType;
  
  /** Action parameters */
  params: Record<string, unknown>;
}

/**
 * Routing action types
 */
export type RoutingActionType =
  | 'assign_to_rep' // Assign to specific rep
  | 'assign_to_team' // Assign to team (will pick best rep)
  | 'assign_round_robin' // Round-robin within team
  | 'assign_by_performance' // Assign to highest performer
  | 'assign_by_availability' // Assign to most available
  | 'assign_by_workload' // Assign to least busy
  | 'assign_by_specialization' // Match to expertise
  | 'route_to_queue' // Send to holding queue
  | 'notify_manager' // Notify manager for manual assignment
  | 'reject'; // Reject/disqualify lead

/**
 * Routing strategy
 */
export type RoutingStrategy =
  | 'performance_weighted' // Prioritize top performers
  | 'workload_balanced' // Balance across team
  | 'territory_based' // Follow territory rules
  | 'skill_matched' // Match to expertise
  | 'round_robin' // Simple rotation
  | 'hybrid'; // Combination of strategies

// ============================================================================
// ROUTING ASSIGNMENT
// ============================================================================

/**
 * Lead assignment record
 */
export interface LeadAssignment {
  /** Assignment identifier */
  id: string;

  /** Lead ID */
  leadId: string;

  /** Rep ID */
  repId: string;

  /** Assignment method */
  assignmentMethod: AssignmentMethod;
  
  /** Routing strategy used */
  strategy: RoutingStrategy;
  
  /** Rules that matched */
  matchedRules: string[];
  
  /** Assignment score (0-100) - quality of match */
  matchScore: number;
  
  /** Confidence (0-1) */
  confidence: number;
  
  /** Assignment reason */
  reason: string;
  
  /** Alternative options considered */
  alternatives?: AssignmentAlternative[];
  
  /** Assignment status */
  status: AssignmentStatus;
  
  /** Acceptance status */
  accepted?: boolean;
  acceptedAt?: Date;
  rejectedReason?: string;
  
  /** Timestamps */
  assignedAt: Date;
  expiresAt?: Date; // If auto-reassignment is needed
  
  /** Reassignment tracking */
  isReassignment?: boolean;
  previousRepId?: string;
  reassignmentReason?: string;
  reassignmentCount?: number;
  
  /** Performance tracking */
  firstContactAt?: Date;
  qualifiedAt?: Date;
  convertedAt?: Date;
  
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Assignment method
 */
export type AssignmentMethod =
  | 'automatic' // Automatically routed by rules
  | 'manual' // Manually assigned by manager
  | 'round_robin' // Round-robin assignment
  | 'claimed' // Rep claimed from queue
  | 'reassignment'; // Reassigned from another rep

/**
 * Assignment status
 */
export type AssignmentStatus =
  | 'pending' // Assignment created, awaiting acceptance
  | 'active' // Rep has accepted/acknowledged
  | 'completed' // Lead qualified or converted
  | 'expired' // Assignment expired without action
  | 'rejected' // Rep rejected assignment
  | 'reassigned'; // Reassigned to different rep

/**
 * Alternative assignment option
 */
export interface AssignmentAlternative {
  /** Rep ID */
  repId: string;
  
  /** Rep name */
  repName: string;
  
  /** Match score */
  matchScore: number;
  
  /** Reasons why this rep was not chosen */
  reasons: string[];
}

// ============================================================================
// ROUTING ANALYSIS & SCORING
// ============================================================================

/**
 * Routing analysis result
 */
export interface RoutingAnalysis {
  /** Lead being analyzed */
  leadId: string;
  
  /** Analysis timestamp */
  analyzedAt: Date;
  
  /** Lead quality assessment */
  leadQuality: LeadQualityAssessment;
  
  /** Available reps */
  availableReps: RepRoutingScore[];
  
  /** Recommended assignment */
  recommendation: AssignmentRecommendation;
  
  /** Alternative options */
  alternatives: AssignmentRecommendation[];
  
  /** Analysis metadata */
  metadata: {
    rulesEvaluated: number;
    repsConsidered: number;
    processingTimeMs: number;
    strategyUsed: RoutingStrategy;
  };
}

/**
 * Lead quality assessment
 */
export interface LeadQualityAssessment {
  /** Overall quality score (0-100) */
  overallScore: number;
  
  /** Quality tier */
  tier: 'premium' | 'standard' | 'basic';
  
  /** Component scores */
  scores: {
    intent: number;
    fit: number;
    engagement: number;
    potential: number;
  };
  
  /** Quality indicators */
  indicators: {
    indicator: string;
    value: number;
    weight: number;
  }[];
  
  /** Routing priority */
  routingPriority: number; // 1-10, 10 = highest
}

/**
 * Rep routing score
 */
export interface RepRoutingScore {
  /** Rep ID */
  repId: string;
  
  /** Rep name */
  repName: string;
  
  /** Overall match score (0-100) */
  matchScore: number;
  
  /** Component scores */
  scores: {
    performance: number; // Rep's performance score
    capacity: number; // Remaining capacity score
    specialization: number; // Expertise match score
    territory: number; // Territory match score
    availability: number; // Current availability score
  };
  
  /** Weights applied */
  weights: {
    performance: number;
    capacity: number;
    specialization: number;
    territory: number;
    availability: number;
  };
  
  /** Match details */
  matchDetails: {
    territoryMatch: boolean;
    specializationMatch: string[];
    capacityAvailable: number;
    performanceTier: PerformanceTier;
    currentWorkload: number;
  };
  
  /** Eligibility */
  isEligible: boolean;
  ineligibilityReasons?: string[];
}

/**
 * Assignment recommendation
 */
export interface AssignmentRecommendation {
  /** Recommended rep */
  repId: string;
  repName: string;
  
  /** Confidence in recommendation (0-1) */
  confidence: number;
  
  /** Match score (0-100) */
  matchScore: number;
  
  /** Reasons for recommendation */
  reasons: string[];
  
  /** Expected outcomes */
  expectedOutcomes: {
    conversionProbability: number; // 0-1
    expectedTimeToContact: number; // hours
    expectedTimeToQualify: number; // days
  };
  
  /** Warnings/considerations */
  warnings?: string[];
}

// ============================================================================
// ROUTING CONFIGURATION
// ============================================================================

/**
 * Organization routing configuration
 */
export interface RoutingConfiguration {
  /** Default routing strategy */
  defaultStrategy: RoutingStrategy;
  
  /** Strategy weights */
  strategyWeights: {
    performance: number; // 0-1
    capacity: number; // 0-1
    specialization: number; // 0-1
    territory: number; // 0-1
    availability: number; // 0-1
  };
  
  /** Hot lead routing */
  hotLeadRouting: {
    enabled: boolean;
    threshold: number; // Quality score threshold
    routeToTopPerformers: boolean;
    topPerformerPercentile: number; // e.g., top 20%
  };
  
  /** Workload balancing */
  workloadBalancing: {
    enabled: boolean;
    balanceThreshold: number; // Max % difference between reps
    rebalanceInterval: number; // hours
  };
  
  /** Round-robin settings */
  roundRobin: {
    enabled: boolean;
    resetInterval: 'daily' | 'weekly' | 'monthly' | 'never';
    skipAtCapacity: boolean;
  };
  
  /** Reassignment rules */
  reassignment: {
    allowReassignment: boolean;
    maxReassignments: number;
    reassignAfterDays: number;
    reassignIfNoContact: boolean;
  };
  
  /** Queue settings */
  queue: {
    enabled: boolean;
    maxQueueTime: number; // hours
    escalateAfter: number; // hours
  };
  
  /** Notifications */
  notifications: {
    notifyRepOnAssignment: boolean;
    notifyManagerOnHotLead: boolean;
    notifyOnQueueEscalation: boolean;
  };
  
  /** Business hours */
  businessHours?: WorkingHours;
  
  /** Created/updated */
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ROUTING METRICS & ANALYTICS
// ============================================================================

/**
 * Routing performance metrics
 */
export interface RoutingMetrics {
  /** Time period */
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  /** Volume metrics */
  volume: {
    totalLeadsRouted: number;
    automaticAssignments: number;
    manualAssignments: number;
    reassignments: number;
    queuedLeads: number;
  };
  
  /** Efficiency metrics */
  efficiency: {
    averageRoutingTimeMs: number;
    averageTimeToAcceptance: number; // hours
    averageTimeToFirstContact: number; // hours
    routingSuccessRate: number; // 0-1
  };
  
  /** Quality metrics */
  quality: {
    averageMatchScore: number;
    averageConfidence: number;
    conversionRate: number; // 0-1
    rejectionRate: number; // 0-1
  };
  
  /** Workload distribution */
  workloadDistribution: {
    repId: string;
    repName: string;
    leadsAssigned: number;
    acceptanceRate: number;
    conversionRate: number;
    utilizationPercentage: number;
  }[];
  
  /** Strategy performance */
  strategyPerformance: {
    strategy: RoutingStrategy;
    usageCount: number;
    conversionRate: number;
    averageMatchScore: number;
  }[];
  
  /** Top performers */
  topPerformers: {
    repId: string;
    repName: string;
    metric: string;
    value: number;
  }[];
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to route a lead
 */
export interface RouteLeadRequest {
  /** Lead to route */
  leadId: string;
  
  /** Override default strategy */
  strategy?: RoutingStrategy;
  
  /** Force assignment to specific rep (admin override) */
  forceRepId?: string;
  
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Response with routing assignment
 */
export interface RouteLeadResponse {
  /** Success status */
  success: boolean;
  
  /** Assignment details */
  assignment?: LeadAssignment;
  
  /** Routing analysis */
  analysis?: RoutingAnalysis;
  
  /** Error message */
  error?: string;
  
  /** Metadata */
  metadata: {
    processingTimeMs: number;
    strategyUsed: RoutingStrategy;
    rulesEvaluated: number;
  };
}

/**
 * Request for routing analytics
 */
export interface RoutingAnalyticsRequest {
  /** Time period */
  startDate: Date;
  endDate: Date;
  
  /** Optional filters */
  filters?: {
    repIds?: string[];
    strategies?: RoutingStrategy[];
    leadPriorities?: LeadPriority[];
  };
}

/**
 * Response with routing analytics
 */
export interface RoutingAnalyticsResponse {
  /** Success status */
  success: boolean;
  
  /** Metrics */
  metrics?: RoutingMetrics;
  
  /** Error message */
  error?: string;
}

/**
 * Request to update routing configuration
 */
export interface UpdateRoutingConfigRequest {
  /** Configuration updates */
  config: Partial<RoutingConfiguration>;
}

/**
 * Response with updated configuration
 */
export interface UpdateRoutingConfigResponse {
  /** Success status */
  success: boolean;
  
  /** Updated configuration */
  config?: RoutingConfiguration;
  
  /** Error message */
  error?: string;
}
