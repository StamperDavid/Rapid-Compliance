/**
 * Lead Routing Module - Centralized Exports
 * 
 * SOVEREIGN CORPORATE BRAIN - LEAD ROUTING MODULE
 * 
 * This module provides intelligent lead routing capabilities that optimize
 * lead assignment based on rep performance, workload, territory, and skills.
 * 
 * @module routing
 */

// Engine
export { LeadRoutingEngine, leadRoutingEngine } from './routing-engine';

// Types
export type {
  Lead,
  SalesRep,
  LeadAssignment,
  RoutingRule,
  RoutingConfiguration,
  RoutingAnalysis,
  RoutingMetrics,
  RoutingStrategy,
  AssignmentMethod,
  AssignmentStatus,
  RouteLeadRequest,
  RouteLeadResponse,
  RoutingAnalyticsRequest,
  RoutingAnalyticsResponse,
  UpdateRoutingConfigRequest,
  UpdateRoutingConfigResponse,
  CompanySize,
  LeadSource,
  LeadPriority,
  LeadStatus,
  RepCapacity,
  RepWorkload,
  Territory,
  TerritoryType,
  RepRoutingScore,
  LeadQualityAssessment,
  AssignmentRecommendation,
} from './types';

// Validation
export {
  routeLeadRequestSchema,
  routeLeadResponseSchema,
  routingAnalyticsRequestSchema,
  updateRoutingConfigRequestSchema,
  createRoutingRuleRequestSchema,
  updateRoutingRuleRequestSchema,
  reassignLeadRequestSchema,
  leadSchema,
  salesRepSchema,
  routingRuleSchema,
  routingConfigurationSchema,
  leadAssignmentSchema,
} from './validation';

export type {
  RouteLeadRequest as RouteLeadRequestValidated,
  CreateRoutingRuleRequest,
  UpdateRoutingRuleRequest,
  ReassignLeadRequest,
} from './validation';

// Events
export {
  createLeadRoutedSignal,
  createLeadAssignedSignal,
  createLeadReassignedSignal,
  createRoutingFailedSignal,
  createAssignmentAcceptedSignal,
  createAssignmentRejectedSignal,
  createAssignmentExpiredSignal,
  createLeadQueuedSignal,
  createQueueEscalatedSignal,
  ROUTING_EVENT_TYPES,
  EVENT_PRIORITIES,
} from './events';

export type {
  LeadRoutedEventMetadata,
  LeadAssignedEventMetadata,
  LeadReassignedEventMetadata,
  RoutingFailedEventMetadata,
  AssignmentAcceptedEventMetadata,
  AssignmentRejectedEventMetadata,
  AssignmentExpiredEventMetadata,
  LeadQueuedEventMetadata,
  QueueEscalatedEventMetadata,
} from './events';
