/**
 * Lead Routing Validation Schemas
 * 
 * SOVEREIGN CORPORATE BRAIN - LEAD ROUTING MODULE
 * 
 * Comprehensive Zod validation schemas for all lead routing operations.
 * Ensures type safety and data integrity for API endpoints and internal operations.
 * 
 * @module routing/validation
 */

import { z } from 'zod';

// ============================================================================
// BASIC TYPE SCHEMAS
// ============================================================================

/**
 * Company size validation
 */
export const companySizeSchema = z.enum([
  'enterprise',
  'mid_market',
  'smb',
  'startup',
]);

/**
 * Lead source validation
 */
export const leadSourceSchema = z.enum([
  'inbound_website',
  'inbound_form',
  'outbound_cold',
  'outbound_warm',
  'referral',
  'partner',
  'event',
  'social',
  'content',
  'paid_ads',
  'other',
]);

/**
 * Lead priority validation
 */
export const leadPrioritySchema = z.enum(['hot', 'warm', 'cold']);

/**
 * Lead status validation
 */
export const leadStatusSchema = z.enum([
  'new',
  'routing',
  'assigned',
  'contacted',
  'qualified',
  'disqualified',
  'nurture',
  'converted',
  'lost',
]);

/**
 * Performance tier validation
 */
export const performanceTierSchema = z.enum([
  'top_performer',
  'high_performer',
  'average',
  'needs_improvement',
  'at_risk',
]);

/**
 * Territory type validation
 */
export const territoryTypeSchema = z.enum([
  'geographic',
  'vertical',
  'named_accounts',
  'hybrid',
]);

/**
 * Availability status validation
 */
export const availabilityStatusSchema = z.enum([
  'available',
  'busy',
  'meeting',
  'out_of_office',
  'vacation',
  'training',
]);

/**
 * Routing strategy validation
 */
export const routingStrategySchema = z.enum([
  'performance_weighted',
  'workload_balanced',
  'territory_based',
  'skill_matched',
  'round_robin',
  'hybrid',
]);

/**
 * Assignment method validation
 */
export const assignmentMethodSchema = z.enum([
  'automatic',
  'manual',
  'round_robin',
  'claimed',
  'reassignment',
]);

/**
 * Assignment status validation
 */
export const assignmentStatusSchema = z.enum([
  'pending',
  'active',
  'completed',
  'expired',
  'rejected',
  'reassigned',
]);

/**
 * Routing rule type validation
 */
export const routingRuleTypeSchema = z.enum([
  'territory',
  'performance',
  'workload',
  'specialization',
  'round_robin',
  'custom',
]);

/**
 * Condition operator validation
 */
export const conditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'matches_regex',
]);

/**
 * Routing action type validation
 */
export const routingActionTypeSchema = z.enum([
  'assign_to_rep',
  'assign_to_team',
  'assign_round_robin',
  'assign_by_performance',
  'assign_by_availability',
  'assign_by_workload',
  'assign_by_specialization',
  'route_to_queue',
  'notify_manager',
  'reject',
]);

// ============================================================================
// COMPLEX SCHEMAS
// ============================================================================

/**
 * Time range validation
 */
export const timeRangeSchema = z.object({
  start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
});

/**
 * Working hours validation
 */
export const workingHoursSchema = z.object({
  timezone: z.string(),
  schedule: z.object({
    monday: timeRangeSchema.optional(),
    tuesday: timeRangeSchema.optional(),
    wednesday: timeRangeSchema.optional(),
    thursday: timeRangeSchema.optional(),
    friday: timeRangeSchema.optional(),
    saturday: timeRangeSchema.optional(),
    sunday: timeRangeSchema.optional(),
  }),
});

/**
 * Territory validation
 */
export const territorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  type: territoryTypeSchema,
  geographic: z.object({
    countries: z.array(z.string()).optional(),
    states: z.array(z.string()).optional(),
    cities: z.array(z.string()).optional(),
    zipcodes: z.array(z.string()).optional(),
  }).optional(),
  vertical: z.object({
    industries: z.array(z.string()).optional(),
    companySizes: z.array(companySizeSchema).optional(),
  }).optional(),
  priority: z.number().int().min(0).max(10),
});

/**
 * Capacity rule validation
 */
export const capacityRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  condition: z.string().min(1).max(500),
  limit: z.number().int().min(0),
  current: z.number().int().min(0),
  isExceeded: z.boolean(),
});

/**
 * Rep capacity validation
 */
export const repCapacitySchema = z.object({
  maxActiveLeads: z.number().int().min(1).max(1000),
  maxNewLeadsPerDay: z.number().int().min(0).max(100),
  maxNewLeadsPerWeek: z.number().int().min(0).max(500),
  maxTotalDealValue: z.number().min(0).optional(),
  customRules: z.array(capacityRuleSchema).optional(),
});

/**
 * Rep workload validation
 */
export const repWorkloadSchema = z.object({
  activeLeads: z.number().int().min(0),
  leadsAssignedToday: z.number().int().min(0),
  leadsAssignedThisWeek: z.number().int().min(0),
  totalPipelineValue: z.number().min(0),
  utilizationPercentage: z.number().min(0).max(100),
  isAtCapacity: z.boolean(),
  remainingCapacity: z.object({
    leads: z.number().int().min(0),
    dailyLeads: z.number().int().min(0),
    weeklyLeads: z.number().int().min(0),
  }),
});

/**
 * Skill scores validation
 */
export const skillScoresSchema = z.object({
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
  aiToolAdoption: z.number().min(0).max(100),
});

/**
 * Rep specializations validation
 */
export const repSpecializationsSchema = z.object({
  industries: z.array(z.string()).optional(),
  companySizes: z.array(companySizeSchema).optional(),
  products: z.array(z.string()).optional(),
  useCases: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
});

/**
 * Routing preferences validation
 */
export const routingPreferencesSchema = z.object({
  preferredSources: z.array(leadSourceSchema).optional(),
  preferredPriorities: z.array(leadPrioritySchema).optional(),
  autoAccept: z.boolean(),
  notifyOnAssignment: z.boolean(),
  notifyOnHotLead: z.boolean(),
  workingHours: workingHoursSchema.optional(),
});

/**
 * Lead validation
 */
export const leadSchema = z.object({
  id: z.string(),
  companyName: z.string().min(1).max(200),
  companyDomain: z.string().optional(),
  companySize: companySizeSchema.optional(),
  industry: z.string().optional(),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactTitle: z.string().optional(),
  contactPhone: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  source: leadSourceSchema,
  sourceDetails: z.string().optional(),
  qualityScore: z.number().min(0).max(100),
  intentScore: z.number().min(0).max(100).optional(),
  fitScore: z.number().min(0).max(100).optional(),
  priority: leadPrioritySchema,
  estimatedValue: z.number().min(0).optional(),
  status: leadStatusSchema,
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Sales rep validation
 */
export const salesRepSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  performanceTier: performanceTierSchema,
  overallScore: z.number().min(0).max(100),
  skillScores: skillScoresSchema,
  capacity: repCapacitySchema,
  currentWorkload: repWorkloadSchema,
  specializations: repSpecializationsSchema,
  territories: z.array(territorySchema),
  isAvailable: z.boolean(),
  availabilityStatus: availabilityStatusSchema.optional(),
  routingPreferences: routingPreferencesSchema,
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Routing condition validation
 */
export const routingConditionSchema = z.object({
  field: z.string().min(1).max(100),
  operator: conditionOperatorSchema,
  value: z.unknown(),
  connector: z.enum(['AND', 'OR']).optional(),
});

/**
 * Routing action validation
 */
export const routingActionSchema = z.object({
  type: routingActionTypeSchema,
  params: z.record(z.unknown()),
});

/**
 * Routing rule validation
 */
export const routingRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: routingRuleTypeSchema,
  priority: z.number().int().min(0).max(100),
  enabled: z.boolean(),
  conditions: z.array(routingConditionSchema),
  actions: z.array(routingActionSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
});

/**
 * Routing configuration validation
 */
export const routingConfigurationSchema = z.object({
  defaultStrategy: routingStrategySchema,
  strategyWeights: z.object({
    performance: z.number().min(0).max(1),
    capacity: z.number().min(0).max(1),
    specialization: z.number().min(0).max(1),
    territory: z.number().min(0).max(1),
    availability: z.number().min(0).max(1),
  }),
  hotLeadRouting: z.object({
    enabled: z.boolean(),
    threshold: z.number().min(0).max(100),
    routeToTopPerformers: z.boolean(),
    topPerformerPercentile: z.number().min(0).max(100),
  }),
  workloadBalancing: z.object({
    enabled: z.boolean(),
    balanceThreshold: z.number().min(0).max(100),
    rebalanceInterval: z.number().int().min(1),
  }),
  roundRobin: z.object({
    enabled: z.boolean(),
    resetInterval: z.enum(['daily', 'weekly', 'monthly', 'never']),
    skipAtCapacity: z.boolean(),
  }),
  reassignment: z.object({
    allowReassignment: z.boolean(),
    maxReassignments: z.number().int().min(0).max(10),
    reassignAfterDays: z.number().int().min(1).max(90),
    reassignIfNoContact: z.boolean(),
  }),
  queue: z.object({
    enabled: z.boolean(),
    maxQueueTime: z.number().int().min(1),
    escalateAfter: z.number().int().min(1),
  }),
  notifications: z.object({
    notifyRepOnAssignment: z.boolean(),
    notifyManagerOnHotLead: z.boolean(),
    notifyOnQueueEscalation: z.boolean(),
  }),
  businessHours: workingHoursSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Assignment alternative validation
 */
export const assignmentAlternativeSchema = z.object({
  repId: z.string(),
  repName: z.string(),
  matchScore: z.number().min(0).max(100),
  reasons: z.array(z.string()),
});

/**
 * Lead assignment validation
 */
export const leadAssignmentSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  repId: z.string(),
  assignmentMethod: assignmentMethodSchema,
  strategy: routingStrategySchema,
  matchedRules: z.array(z.string()),
  matchScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  alternatives: z.array(assignmentAlternativeSchema).optional(),
  status: assignmentStatusSchema,
  accepted: z.boolean().optional(),
  acceptedAt: z.date().optional(),
  rejectedReason: z.string().optional(),
  assignedAt: z.date(),
  expiresAt: z.date().optional(),
  isReassignment: z.boolean().optional(),
  previousRepId: z.string().optional(),
  reassignmentReason: z.string().optional(),
  reassignmentCount: z.number().int().min(0).optional(),
  firstContactAt: z.date().optional(),
  qualifiedAt: z.date().optional(),
  convertedAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Route lead request validation
 */
export const routeLeadRequestSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  strategy: routingStrategySchema.optional(),
  forceRepId: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

/**
 * Route lead response validation
 */
export const routeLeadResponseSchema = z.object({
  success: z.boolean(),
  assignment: leadAssignmentSchema.optional(),
  analysis: z.object({
    leadId: z.string(),
    analyzedAt: z.date(),
    leadQuality: z.object({
      overallScore: z.number().min(0).max(100),
      tier: z.enum(['premium', 'standard', 'basic']),
      scores: z.object({
        intent: z.number().min(0).max(100),
        fit: z.number().min(0).max(100),
        engagement: z.number().min(0).max(100),
        potential: z.number().min(0).max(100),
      }),
      indicators: z.array(z.object({
        indicator: z.string(),
        value: z.number(),
        weight: z.number(),
      })),
      routingPriority: z.number().int().min(1).max(10),
    }),
    availableReps: z.array(z.object({
      repId: z.string(),
      repName: z.string(),
      matchScore: z.number().min(0).max(100),
      scores: z.object({
        performance: z.number(),
        capacity: z.number(),
        specialization: z.number(),
        territory: z.number(),
        availability: z.number(),
      }),
      weights: z.object({
        performance: z.number(),
        capacity: z.number(),
        specialization: z.number(),
        territory: z.number(),
        availability: z.number(),
      }),
      matchDetails: z.object({
        territoryMatch: z.boolean(),
        specializationMatch: z.array(z.string()),
        capacityAvailable: z.number(),
        performanceTier: performanceTierSchema,
        currentWorkload: z.number(),
      }),
      isEligible: z.boolean(),
      ineligibilityReasons: z.array(z.string()).optional(),
    })),
    recommendation: z.object({
      repId: z.string(),
      repName: z.string(),
      confidence: z.number().min(0).max(1),
      matchScore: z.number().min(0).max(100),
      reasons: z.array(z.string()),
      expectedOutcomes: z.object({
        conversionProbability: z.number().min(0).max(1),
        expectedTimeToContact: z.number().min(0),
        expectedTimeToQualify: z.number().min(0),
      }),
      warnings: z.array(z.string()).optional(),
    }),
    alternatives: z.array(z.object({
      repId: z.string(),
      repName: z.string(),
      confidence: z.number().min(0).max(1),
      matchScore: z.number().min(0).max(100),
      reasons: z.array(z.string()),
      expectedOutcomes: z.object({
        conversionProbability: z.number().min(0).max(1),
        expectedTimeToContact: z.number().min(0),
        expectedTimeToQualify: z.number().min(0),
      }),
      warnings: z.array(z.string()).optional(),
    })),
    metadata: z.object({
      rulesEvaluated: z.number().int().min(0),
      repsConsidered: z.number().int().min(0),
      processingTimeMs: z.number().min(0),
      strategyUsed: routingStrategySchema,
    }),
  }).optional(),
  error: z.string().optional(),
  metadata: z.object({
    processingTimeMs: z.number().min(0),
    strategyUsed: routingStrategySchema,
    rulesEvaluated: z.number().int().min(0),
  }),
});

/**
 * Routing analytics request validation
 */
export const routingAnalyticsRequestSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  filters: z.object({
    repIds: z.array(z.string()).optional(),
    strategies: z.array(routingStrategySchema).optional(),
    leadPriorities: z.array(leadPrioritySchema).optional(),
  }).optional(),
});

/**
 * Update routing config request validation
 */
export const updateRoutingConfigRequestSchema = z.object({
  config: routingConfigurationSchema.partial(),
});

/**
 * Create routing rule request validation
 */
export const createRoutingRuleRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: routingRuleTypeSchema,
  priority: z.number().int().min(0).max(100),
  enabled: z.boolean().default(true),
  conditions: z.array(routingConditionSchema).min(1, 'At least one condition is required'),
  actions: z.array(routingActionSchema).min(1, 'At least one action is required'),
});

/**
 * Update routing rule request validation
 */
export const updateRoutingRuleRequestSchema = z.object({
  ruleId: z.string().min(1, 'Rule ID is required'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
  conditions: z.array(routingConditionSchema).optional(),
  actions: z.array(routingActionSchema).optional(),
});

/**
 * Reassign lead request validation
 */
export const reassignLeadRequestSchema = z.object({
  assignmentId: z.string().min(1, 'Assignment ID is required'),
  newRepId: z.string().min(1, 'New rep ID is required'),
  reason: z.string().min(1).max(500),
});

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type RouteLeadRequest = z.infer<typeof routeLeadRequestSchema>;
export type RouteLeadResponse = z.infer<typeof routeLeadResponseSchema>;
export type RoutingAnalyticsRequest = z.infer<typeof routingAnalyticsRequestSchema>;
export type UpdateRoutingConfigRequest = z.infer<typeof updateRoutingConfigRequestSchema>;
export type CreateRoutingRuleRequest = z.infer<typeof createRoutingRuleRequestSchema>;
export type UpdateRoutingRuleRequest = z.infer<typeof updateRoutingRuleRequestSchema>;
export type ReassignLeadRequest = z.infer<typeof reassignLeadRequestSchema>;
