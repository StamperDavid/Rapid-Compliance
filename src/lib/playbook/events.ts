/**
 * Playbook Builder - Signal Bus Events
 *
 * Event definitions for playbook operations to integrate with the
 * Signal Bus orchestration system.
 *
 * EVENT TYPES:
 * - playbook.generated - New playbook created
 * - playbook.patterns_extracted - Patterns extracted from conversations
 * - playbook.activated - Playbook activated for use
 * - playbook.used - Playbook used in a conversation
 * - playbook.updated - Playbook content updated
 * - playbook.adoption_tracked - Adoption metrics calculated
 * - playbook.effectiveness_measured - Effectiveness metrics measured
 * - playbook.archived - Playbook archived/deprecated
 * - playbook.pattern_identified - New pattern identified
 *
 * @module lib/playbook/events
 */

import type { SalesSignal } from '@/lib/orchestration';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Playbook generated event
 * 
 * Emitted when a new playbook is created from conversation analysis
 */
export interface PlaybookGeneratedEvent extends Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  type: 'playbook.generated';
  metadata: {
    playbookId: string;
    playbookName: string;
    category: string;
    conversationType: string;
    patternsCount: number;
    talkTracksCount: number;
    objectionResponsesCount: number;
    bestPracticesCount: number;
    sourceConversations: number;
    topPerformers: number;
    confidence: number;
    status: 'draft' | 'active' | 'testing';
  };
}

/**
 * Patterns extracted event
 * 
 * Emitted when patterns are extracted from conversations
 */
export interface PatternsExtractedEvent extends Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  type: 'playbook.patterns_extracted';
  metadata: {
    conversationsAnalyzed: number;
    repsAnalyzed: number;
    patternsExtracted: number;
    talkTracksExtracted: number;
    objectionResponsesExtracted: number;
    bestPracticesExtracted: number;
    highConfidencePatterns: number;
    processingTime: number;
  };
}

/**
 * Playbook activated event
 * 
 * Emitted when a playbook is activated for team use
 */
export interface PlaybookActivatedEvent extends Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  type: 'playbook.activated';
  metadata: {
    playbookId: string;
    playbookName: string;
    category: string;
    conversationType: string;
    targetReps?: string[]; // Specific reps or all
    effectiveness: number;
    confidence: number;
  };
}

/**
 * Playbook used event
 * 
 * Emitted when a rep uses a playbook in a conversation
 */
export interface PlaybookUsedEvent extends Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  type: 'playbook.used';
  metadata: {
    playbookId: string;
    playbookName: string;
    conversationId: string;
    repId: string;
    dealId?: string;
    patternsUsed: number;
    talkTracksUsed: number;
    objectionResponsesUsed: number;
    adherenceScore: number;
    overallEffectiveness: 'excellent' | 'good' | 'fair' | 'poor';
    conversationScore: number;
    sentimentScore: number;
    deviationCount: number;
  };
}

/**
 * Playbook updated event
 * 
 * Emitted when playbook content is updated
 */
export interface PlaybookUpdatedEvent extends Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  type: 'playbook.updated';
  metadata: {
    playbookId: string;
    playbookName: string;
    version: number;
    changesType: 'patterns' | 'talk_tracks' | 'objection_responses' | 'best_practices' | 'all';
    addedItems: number;
    removedItems: number;
    modifiedItems: number;
    confidenceChange: number;
    updatedBy: string;
  };
}

/**
 * Adoption tracked event
 * 
 * Emitted when playbook adoption metrics are calculated
 */
export interface AdoptionTrackedEvent extends Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  type: 'playbook.adoption_tracked';
  metadata: {
    playbookId: string;
    playbookName: string;
    adoptionRate: number;
    repsUsing: number;
    repsAvailable: number;
    usageCount: number;
    avgEffectiveness: number;
    period: string;
    trend: 'increasing' | 'stable' | 'decreasing';
    topBarriers?: string[];
  };
}

/**
 * Effectiveness measured event
 * 
 * Emitted when playbook effectiveness metrics are calculated
 */
export interface EffectivenessMeasuredEvent extends Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  type: 'playbook.effectiveness_measured';
  metadata: {
    playbookId: string;
    playbookName: string;
    effectiveness: number;
    conversionRateLift: number;
    sentimentLift: number;
    scoreLift: number;
    winRateLift: number;
    conversationsAnalyzed: number;
    confidence: number;
    pValue?: number;
    recommendation: 'keep_active' | 'needs_improvement' | 'retire';
  };
}

/**
 * Playbook archived event
 * 
 * Emitted when a playbook is archived or deprecated
 */
export interface PlaybookArchivedEvent extends Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  type: 'playbook.archived';
  metadata: {
    playbookId: string;
    playbookName: string;
    reason: 'low_effectiveness' | 'outdated' | 'replaced' | 'manual';
    replacedBy?: string; // New playbook ID
    finalEffectiveness: number;
    totalUsageCount: number;
    archivedBy: string;
  };
}

/**
 * Pattern identified event
 * 
 * Emitted when a new pattern is identified in real-time
 */
export interface PatternIdentifiedEvent extends Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  type: 'playbook.pattern_identified';
  metadata: {
    patternId: string;
    patternName: string;
    category: string;
    conversationId: string;
    repId: string;
    successRate: number;
    confidence: number;
    shouldAddToPlaybook: boolean;
    suggestedPlaybookIds?: string[];
  };
}

// ============================================================================
// EVENT CREATORS
// ============================================================================

/**
 * Create playbook generated event
 */
export function createPlaybookGeneratedEvent(
  workspaceId: string,
  metadata: PlaybookGeneratedEvent['metadata']
): Omit<PlaybookGeneratedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'playbook.generated',
    timestamp: new Date(),
    workspaceId,
    priority: 'Medium',
    confidence: metadata.confidence / 100, // Convert 0-100 to 0-1
    metadata,
  } as Omit<PlaybookGeneratedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create patterns extracted event
 */
export function createPatternsExtractedEvent(
  workspaceId: string,
  metadata: PatternsExtractedEvent['metadata']
): Omit<PatternsExtractedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'playbook.patterns_extracted',
    timestamp: new Date(),
    workspaceId,
    priority: 'Low',
    confidence: metadata.highConfidencePatterns > 0 ? 0.8 : 0.6,
    metadata,
  } as Omit<PatternsExtractedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create playbook activated event
 */
export function createPlaybookActivatedEvent(
  workspaceId: string,
  metadata: PlaybookActivatedEvent['metadata']
): Omit<PlaybookActivatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'playbook.activated',
    timestamp: new Date(),
    workspaceId,
    priority: 'High',
    confidence: metadata.confidence / 100,
    metadata,
  } as Omit<PlaybookActivatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create playbook used event
 */
export function createPlaybookUsedEvent(
  workspaceId: string,
  metadata: PlaybookUsedEvent['metadata']
): Omit<PlaybookUsedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'playbook.used',
    timestamp: new Date(),
    workspaceId,
    priority: 'Low',
    confidence: metadata.adherenceScore / 100,
    metadata,
  } as Omit<PlaybookUsedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create playbook updated event
 */
export function createPlaybookUpdatedEvent(
  workspaceId: string,
  metadata: PlaybookUpdatedEvent['metadata']
): Omit<PlaybookUpdatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'playbook.updated',
    timestamp: new Date(),
    workspaceId,
    priority: 'Medium',
    confidence: Math.abs(metadata.confidenceChange) > 10 ? 0.7 : 0.8,
    metadata,
  } as Omit<PlaybookUpdatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create adoption tracked event
 */
export function createAdoptionTrackedEvent(
  workspaceId: string,
  metadata: AdoptionTrackedEvent['metadata']
): Omit<AdoptionTrackedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'playbook.adoption_tracked',
    timestamp: new Date(),
    workspaceId,
    priority: 'Low',
    confidence: metadata.adoptionRate / 100,
    metadata,
  } as Omit<AdoptionTrackedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create effectiveness measured event
 */
export function createEffectivenessMeasuredEvent(
  workspaceId: string,
  metadata: EffectivenessMeasuredEvent['metadata']
): Omit<EffectivenessMeasuredEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'playbook.effectiveness_measured',
    timestamp: new Date(),
    workspaceId,
    priority: metadata.recommendation === 'retire' ? 'High' : 'Medium',
    confidence: metadata.confidence / 100,
    metadata,
  } as Omit<EffectivenessMeasuredEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create playbook archived event
 */
export function createPlaybookArchivedEvent(
  workspaceId: string,
  metadata: PlaybookArchivedEvent['metadata']
): Omit<PlaybookArchivedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'playbook.archived',
    timestamp: new Date(),
    workspaceId,
    priority: 'Medium',
    confidence: metadata.finalEffectiveness / 100,
    metadata,
  } as Omit<PlaybookArchivedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create pattern identified event
 */
export function createPatternIdentifiedEvent(
  workspaceId: string,
  metadata: PatternIdentifiedEvent['metadata']
): Omit<PatternIdentifiedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'playbook.pattern_identified',
    timestamp: new Date(),
    workspaceId,
    priority: metadata.shouldAddToPlaybook ? 'High' : 'Low',
    confidence: metadata.confidence / 100,
    metadata,
  } as Omit<PatternIdentifiedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

// ============================================================================
// EVENT TYPE GUARDS
// ============================================================================

/**
 * Check if signal is a playbook generated event
 */
export function isPlaybookGeneratedEvent(signal: SalesSignal): signal is SalesSignal & { type: 'playbook.generated' } {
  return signal.type === 'playbook.generated';
}

/**
 * Check if signal is a patterns extracted event
 */
export function isPatternsExtractedEvent(signal: SalesSignal): signal is SalesSignal & { type: 'playbook.patterns_extracted' } {
  return signal.type === 'playbook.patterns_extracted';
}

/**
 * Check if signal is a playbook activated event
 */
export function isPlaybookActivatedEvent(signal: SalesSignal): signal is SalesSignal & { type: 'playbook.activated' } {
  return signal.type === 'playbook.activated';
}

/**
 * Check if signal is a playbook used event
 */
export function isPlaybookUsedEvent(signal: SalesSignal): signal is SalesSignal & { type: 'playbook.used' } {
  return signal.type === 'playbook.used';
}

/**
 * Check if signal is a playbook updated event
 */
export function isPlaybookUpdatedEvent(signal: SalesSignal): signal is SalesSignal & { type: 'playbook.updated' } {
  return signal.type === 'playbook.updated';
}

/**
 * Check if signal is an adoption tracked event
 */
export function isAdoptionTrackedEvent(signal: SalesSignal): signal is SalesSignal & { type: 'playbook.adoption_tracked' } {
  return signal.type === 'playbook.adoption_tracked';
}

/**
 * Check if signal is an effectiveness measured event
 */
export function isEffectivenessMeasuredEvent(signal: SalesSignal): signal is SalesSignal & { type: 'playbook.effectiveness_measured' } {
  return signal.type === 'playbook.effectiveness_measured';
}

/**
 * Check if signal is a playbook archived event
 */
export function isPlaybookArchivedEvent(signal: SalesSignal): signal is SalesSignal & { type: 'playbook.archived' } {
  return signal.type === 'playbook.archived';
}

/**
 * Check if signal is a pattern identified event
 */
export function isPatternIdentifiedEvent(signal: SalesSignal): signal is SalesSignal & { type: 'playbook.pattern_identified' } {
  return signal.type === 'playbook.pattern_identified';
}

/**
 * Check if signal is any playbook-related event
 */
export function isPlaybookEvent(signal: SalesSignal): boolean {
  return signal.type.startsWith('playbook.');
}

// ============================================================================
// EVENT UNION TYPE
// ============================================================================

/**
 * Union of all playbook event types
 */
export type PlaybookEvent =
  | PlaybookGeneratedEvent
  | PatternsExtractedEvent
  | PlaybookActivatedEvent
  | PlaybookUsedEvent
  | PlaybookUpdatedEvent
  | AdoptionTrackedEvent
  | EffectivenessMeasuredEvent
  | PlaybookArchivedEvent
  | PatternIdentifiedEvent;

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

/**
 * Playbook event handler function
 */
export type PlaybookEventHandler<T extends PlaybookEvent = PlaybookEvent> = (
  event: T
) => Promise<void> | void;

/**
 * Playbook event handlers map
 */
export interface PlaybookEventHandlers {
  onPlaybookGenerated?: PlaybookEventHandler<PlaybookGeneratedEvent>;
  onPatternsExtracted?: PlaybookEventHandler<PatternsExtractedEvent>;
  onPlaybookActivated?: PlaybookEventHandler<PlaybookActivatedEvent>;
  onPlaybookUsed?: PlaybookEventHandler<PlaybookUsedEvent>;
  onPlaybookUpdated?: PlaybookEventHandler<PlaybookUpdatedEvent>;
  onAdoptionTracked?: PlaybookEventHandler<AdoptionTrackedEvent>;
  onEffectivenessMeasured?: PlaybookEventHandler<EffectivenessMeasuredEvent>;
  onPlaybookArchived?: PlaybookEventHandler<PlaybookArchivedEvent>;
  onPatternIdentified?: PlaybookEventHandler<PatternIdentifiedEvent>;
}

// ============================================================================
// EVENT ROUTING
// ============================================================================

/**
 * Route playbook event to appropriate handler
 */
export async function routePlaybookEvent(
  event: PlaybookEvent,
  handlers: PlaybookEventHandlers
): Promise<void> {
  switch (event.type) {
    case 'playbook.generated':
      if (handlers.onPlaybookGenerated) {
        await handlers.onPlaybookGenerated(event);
      }
      break;
    
    case 'playbook.patterns_extracted':
      if (handlers.onPatternsExtracted) {
        await handlers.onPatternsExtracted(event);
      }
      break;
    
    case 'playbook.activated':
      if (handlers.onPlaybookActivated) {
        await handlers.onPlaybookActivated(event);
      }
      break;
    
    case 'playbook.used':
      if (handlers.onPlaybookUsed) {
        await handlers.onPlaybookUsed(event);
      }
      break;
    
    case 'playbook.updated':
      if (handlers.onPlaybookUpdated) {
        await handlers.onPlaybookUpdated(event);
      }
      break;
    
    case 'playbook.adoption_tracked':
      if (handlers.onAdoptionTracked) {
        await handlers.onAdoptionTracked(event);
      }
      break;
    
    case 'playbook.effectiveness_measured':
      if (handlers.onEffectivenessMeasured) {
        await handlers.onEffectivenessMeasured(event);
      }
      break;
    
    case 'playbook.archived':
      if (handlers.onPlaybookArchived) {
        await handlers.onPlaybookArchived(event);
      }
      break;
    
    case 'playbook.pattern_identified':
      if (handlers.onPatternIdentified) {
        await handlers.onPatternIdentified(event);
      }
      break;
  }
}

// ============================================================================
// WORKFLOW TRIGGERS
// ============================================================================

/**
 * Suggested workflow triggers for playbook events
 * 
 * These can be used to configure automated workflows based on playbook events
 */
export const PLAYBOOK_WORKFLOW_TRIGGERS = {
  // When playbook is generated, notify sales managers
  PLAYBOOK_GENERATED_NOTIFY_MANAGERS: {
    event: 'playbook.generated',
    condition: 'confidence >= 80',
    actions: [
      'send_email',
      'create_task',
      'send_notification',
    ],
  },
  
  // When playbook has low adoption, send reminders
  LOW_ADOPTION_REMINDER: {
    event: 'playbook.adoption_tracked',
    condition: 'adoptionRate < 50 AND daysActive > 7',
    actions: [
      'send_email',
      'create_training_task',
      'send_notification',
    ],
  },
  
  // When playbook shows excellent effectiveness, share with team
  HIGH_EFFECTIVENESS_SHARE: {
    event: 'playbook.effectiveness_measured',
    condition: 'effectiveness >= 90 AND confidence >= 80',
    actions: [
      'send_email',
      'create_announcement',
      'send_notification',
    ],
  },
  
  // When playbook is used exceptionally well, recognize rep
  EXCEPTIONAL_USAGE_RECOGNITION: {
    event: 'playbook.used',
    condition: 'overallEffectiveness === "excellent" AND adherenceScore >= 90',
    actions: [
      'send_email',
      'create_recognition',
      'send_notification',
    ],
  },
  
  // When pattern is identified with high confidence, suggest playbook addition
  HIGH_CONFIDENCE_PATTERN_SUGGESTION: {
    event: 'playbook.pattern_identified',
    condition: 'confidence >= 85 AND shouldAddToPlaybook === true',
    actions: [
      'send_email',
      'create_task',
      'send_notification',
    ],
  },
  
  // When playbook should be retired, notify stakeholders
  RETIREMENT_NOTIFICATION: {
    event: 'playbook.effectiveness_measured',
    condition: 'recommendation === "retire"',
    actions: [
      'send_email',
      'create_task',
      'send_notification',
    ],
  },
} as const;
