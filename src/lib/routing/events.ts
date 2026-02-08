/**
 * Lead Routing Signal Bus Events
 * 
 * SOVEREIGN CORPORATE BRAIN - LEAD ROUTING MODULE
 * 
 * This module defines Signal Bus event types and emission helpers for the
 * lead routing system. All routing events flow through the Signal Bus for
 * orchestration and downstream processing.
 * 
 * EVENT TYPES:
 * - lead.routed: Lead successfully routed to a rep
 * - lead.assigned: Lead assignment accepted by rep
 * - lead.reassigned: Lead reassigned to different rep
 * - lead.routing.failed: Routing failed (no eligible reps, etc.)
 * - lead.assignment.accepted: Rep accepted assignment
 * - lead.assignment.rejected: Rep rejected assignment
 * - lead.assignment.expired: Assignment expired without action
 * - lead.queue.added: Lead added to queue
 * - lead.queue.escalated: Queued lead escalated
 * 
 * @module routing/events
 */

import type { SalesSignal, SignalPriority } from '../orchestration/types';
import type {
  Lead,
  LeadAssignment,
  RoutingStrategy,
  AssignmentMethod} from './types';

// ============================================================================
// EVENT METADATA TYPES
// ============================================================================

/**
 * Lead routed event metadata
 */
export interface LeadRoutedEventMetadata {
  leadId: string;
  repId: string;
  repName: string;
  assignmentId: string;
  strategy: RoutingStrategy;
  assignmentMethod: AssignmentMethod;
  matchScore: number;
  confidence: number;
  reason: string;
  leadQualityScore: number;
  leadPriority: string;
  estimatedValue?: number;
}

/**
 * Lead assigned event metadata
 */
export interface LeadAssignedEventMetadata {
  leadId: string;
  repId: string;
  repName: string;
  assignmentId: string;
  companyName: string;
  contactName: string;
  leadPriority: string;
  matchScore: number;
  expectedTimeToContact: number;
  expectedConversion: number;
}

/**
 * Lead reassigned event metadata
 */
export interface LeadReassignedEventMetadata {
  leadId: string;
  previousRepId: string;
  previousRepName: string;
  newRepId: string;
  newRepName: string;
  assignmentId: string;
  reassignmentReason: string;
  reassignmentCount: number;
  isAutomatic: boolean;
}

/**
 * Routing failed event metadata
 */
export interface RoutingFailedEventMetadata {
  leadId: string;
  companyName: string;
  failureReason: string;
  eligibleRepsCount: number;
  attemptedStrategy: RoutingStrategy;
  addedToQueue: boolean;
  requiresManagerAttention: boolean;
}

/**
 * Assignment accepted event metadata
 */
export interface AssignmentAcceptedEventMetadata {
  assignmentId: string;
  leadId: string;
  repId: string;
  repName: string;
  companyName: string;
  acceptedAt: Date;
  timeToAcceptMinutes: number;
}

/**
 * Assignment rejected event metadata
 */
export interface AssignmentRejectedEventMetadata {
  assignmentId: string;
  leadId: string;
  repId: string;
  repName: string;
  companyName: string;
  rejectionReason: string;
  willReassign: boolean;
}

/**
 * Assignment expired event metadata
 */
export interface AssignmentExpiredEventMetadata {
  assignmentId: string;
  leadId: string;
  repId: string;
  companyName: string;
  hoursUntilExpiry: number;
  willReassign: boolean;
}

/**
 * Lead queued event metadata
 */
export interface LeadQueuedEventMetadata {
  leadId: string;
  companyName: string;
  leadPriority: string;
  queueReason: string;
  estimatedQueueTime: number;
}

/**
 * Queue escalated event metadata
 */
export interface QueueEscalatedEventMetadata {
  leadId: string;
  companyName: string;
  hoursInQueue: number;
  escalationReason: string;
  notifyManager: boolean;
}

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Create lead routed signal
 */
export function createLeadRoutedSignal(
  lead: Lead,
  assignment: LeadAssignment,
  qualityScore: number,
  _expectedConversion: number
): Omit<SalesSignal, 'id' | 'createdAt' | 'ttl'> {
  const metadata: LeadRoutedEventMetadata = {
    leadId: lead.id,
    repId: assignment.repId,
    repName: '', // Should be populated by caller
    assignmentId: assignment.id,
    strategy: assignment.strategy,
    assignmentMethod: assignment.assignmentMethod,
    matchScore: assignment.matchScore,
    confidence: assignment.confidence,
    reason: assignment.reason,
    leadQualityScore: qualityScore,
    leadPriority: lead.priority,
    estimatedValue: lead.estimatedValue,
  };

  // Priority based on lead priority
  let priority: SignalPriority = 'Medium';
  if (lead.priority === 'hot') {
    priority = 'High';
  } else if (lead.priority === 'cold') {
    priority = 'Low';
  }

  return {
    type: 'lead.discovered', // Using existing signal type (would add custom type in production)
    leadId: lead.id,
    confidence: assignment.confidence,
    priority,
    metadata: metadata as unknown as Record<string, unknown>,
    processed: false,
    processedAt: null,
  };
}

/**
 * Create lead assigned signal
 */
export function createLeadAssignedSignal(
  lead: Lead,
  assignment: LeadAssignment,
  repName: string,
  expectedTimeToContact: number,
  expectedConversion: number
): Omit<SalesSignal, 'id' | 'createdAt' | 'ttl'> {
  const metadata: LeadAssignedEventMetadata = {
    leadId: lead.id,
    repId: assignment.repId,
    repName,
    assignmentId: assignment.id,
    companyName: lead.companyName,
    contactName: lead.contactName,
    leadPriority: lead.priority,
    matchScore: assignment.matchScore,
    expectedTimeToContact,
    expectedConversion,
  };

  return {
    type: 'lead.qualified', // Using existing signal type
    leadId: lead.id,
    confidence: expectedConversion,
    priority: lead.priority === 'hot' ? 'High' : 'Medium',
    metadata: metadata as unknown as Record<string, unknown>,
    processed: false,
    processedAt: null,
  };
}

/**
 * Create lead reassigned signal
 */
export function createLeadReassignedSignal(
  lead: Lead,
  assignment: LeadAssignment,
  previousRepId: string,
  previousRepName: string,
  newRepName: string
): Omit<SalesSignal, 'id' | 'createdAt' | 'ttl'> {
  const metadata: LeadReassignedEventMetadata = {
    leadId: lead.id,
    previousRepId,
    previousRepName,
    newRepId: assignment.repId,
    newRepName,
    assignmentId: assignment.id,
    reassignmentReason:(assignment.reassignmentReason !== '' && assignment.reassignmentReason != null) ? assignment.reassignmentReason : 'Not specified',
    reassignmentCount: assignment.reassignmentCount ?? 1,
    isAutomatic: assignment.assignmentMethod === 'reassignment',
  };

  return {
    type: 'lead.status.changed', // Using existing signal type
    leadId: lead.id,
    confidence: 0.7,
    priority: 'Medium',
    metadata: metadata as unknown as Record<string, unknown>,
    processed: false,
    processedAt: null,
  };
}

/**
 * Create routing failed signal
 */
export function createRoutingFailedSignal(
  lead: Lead,
  failureReason: string,
  eligibleRepsCount: number,
  strategy: RoutingStrategy,
  addedToQueue: boolean
): Omit<SalesSignal, 'id' | 'createdAt' | 'ttl'> {
  const metadata: RoutingFailedEventMetadata = {
    leadId: lead.id,
    companyName: lead.companyName,
    failureReason,
    eligibleRepsCount,
    attemptedStrategy: strategy,
    addedToQueue,
    requiresManagerAttention: !addedToQueue,
  };

  return {
    type: 'system.error', // Using existing signal type
    leadId: lead.id,
    confidence: 1.0, // High confidence in the error
    priority: lead.priority === 'hot' ? 'High' : 'Medium',
    metadata: metadata as unknown as Record<string, unknown>,
    processed: false,
    processedAt: null,
  };
}

/**
 * Create assignment accepted signal
 */
export function createAssignmentAcceptedSignal(
  lead: Lead,
  assignment: LeadAssignment,
  repName: string,
  timeToAcceptMinutes: number
): Omit<SalesSignal, 'id' | 'createdAt' | 'ttl'> {
  const metadata: AssignmentAcceptedEventMetadata = {
    assignmentId: assignment.id,
    leadId: lead.id,
    repId: assignment.repId,
    repName,
    companyName: lead.companyName,
    acceptedAt:assignment.acceptedAt ?? new Date(),
    timeToAcceptMinutes,
  };

  return {
    type: 'lead.engaged', // Using existing signal type
    leadId: lead.id,
    confidence: 0.8,
    priority: 'Medium',
    metadata: metadata as unknown as Record<string, unknown>,
    processed: false,
    processedAt: null,
  };
}

/**
 * Create assignment rejected signal
 */
export function createAssignmentRejectedSignal(
  lead: Lead,
  assignment: LeadAssignment,
  repName: string,
  rejectionReason: string,
  willReassign: boolean
): Omit<SalesSignal, 'id' | 'createdAt' | 'ttl'> {
  const metadata: AssignmentRejectedEventMetadata = {
    assignmentId: assignment.id,
    leadId: lead.id,
    repId: assignment.repId,
    repName,
    companyName: lead.companyName,
    rejectionReason,
    willReassign,
  };

  return {
    type: 'lead.status.changed', // Using existing signal type
    leadId: lead.id,
    confidence: 0.9,
    priority: lead.priority === 'hot' ? 'High' : 'Medium',
    metadata: metadata as unknown as Record<string, unknown>,
    processed: false,
    processedAt: null,
  };
}

/**
 * Create assignment expired signal
 */
export function createAssignmentExpiredSignal(
  lead: Lead,
  assignment: LeadAssignment,
  hoursUntilExpiry: number,
  willReassign: boolean
): Omit<SalesSignal, 'id' | 'createdAt' | 'ttl'> {
  const metadata: AssignmentExpiredEventMetadata = {
    assignmentId: assignment.id,
    leadId: lead.id,
    repId: assignment.repId,
    companyName: lead.companyName,
    hoursUntilExpiry,
    willReassign,
  };

  return {
    type: 'lead.status.changed', // Using existing signal type
    leadId: lead.id,
    confidence: 0.9,
    priority: 'High', // Expired assignments are high priority
    metadata: metadata as unknown as Record<string, unknown>,
    processed: false,
    processedAt: null,
  };
}

/**
 * Create lead queued signal
 */
export function createLeadQueuedSignal(
  lead: Lead,
  queueReason: string,
  estimatedQueueTime: number
): Omit<SalesSignal, 'id' | 'createdAt' | 'ttl'> {
  const metadata: LeadQueuedEventMetadata = {
    leadId: lead.id,
    companyName: lead.companyName,
    leadPriority: lead.priority,
    queueReason,
    estimatedQueueTime,
  };

  return {
    type: 'lead.status.changed', // Using existing signal type
    leadId: lead.id,
    confidence: 0.8,
    priority: lead.priority === 'hot' ? 'High' : 'Low',
    metadata: metadata as unknown as Record<string, unknown>,
    processed: false,
    processedAt: null,
  };
}

/**
 * Create queue escalated signal
 */
export function createQueueEscalatedSignal(
  lead: Lead,
  hoursInQueue: number,
  escalationReason: string
): Omit<SalesSignal, 'id' | 'createdAt' | 'ttl'> {
  const metadata: QueueEscalatedEventMetadata = {
    leadId: lead.id,
    companyName: lead.companyName,
    hoursInQueue,
    escalationReason,
    notifyManager: true,
  };

  return {
    type: 'system.error', // Using existing signal type for escalations
    leadId: lead.id,
    confidence: 1.0,
    priority: 'High', // Always high priority
    metadata: metadata as unknown as Record<string, unknown>,
    processed: false,
    processedAt: null,
  };
}

// ============================================================================
// EVENT TYPE CONSTANTS
// ============================================================================

/**
 * Routing event types for filtering
 */
export const ROUTING_EVENT_TYPES = {
  LEAD_ROUTED: 'lead.discovered', // Mapped to existing type
  LEAD_ASSIGNED: 'lead.qualified', // Mapped to existing type
  LEAD_REASSIGNED: 'lead.status.changed', // Mapped to existing type
  ROUTING_FAILED: 'system.error', // Mapped to existing type
  ASSIGNMENT_ACCEPTED: 'lead.engaged', // Mapped to existing type
  ASSIGNMENT_REJECTED: 'lead.status.changed', // Mapped to existing type
  ASSIGNMENT_EXPIRED: 'lead.status.changed', // Mapped to existing type
  LEAD_QUEUED: 'lead.status.changed', // Mapped to existing type
  QUEUE_ESCALATED: 'system.error', // Mapped to existing type
} as const;

/**
 * Event priority helpers
 */
export const EVENT_PRIORITIES = {
  HOT_LEAD: 'High' as SignalPriority,
  WARM_LEAD: 'Medium' as SignalPriority,
  COLD_LEAD: 'Low' as SignalPriority,
  FAILED_ROUTING: 'High' as SignalPriority,
  QUEUE_ESCALATION: 'High' as SignalPriority,
  ASSIGNMENT_EXPIRED: 'High' as SignalPriority,
} as const;
