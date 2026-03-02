/**
 * Sales Coaching Signal Bus Events
 * 
 * SOVEREIGN CORPORATE BRAIN - COACHING MODULE
 * 
 * Signal Bus event definitions for coaching and insights system.
 * Enables event-driven orchestration across the platform.
 * 
 * EVENT TYPES:
 * - coaching.insights.generated - Rep coaching insights generated
 * - coaching.insights.viewed - Rep viewed their coaching insights
 * - coaching.team.insights.generated - Team insights generated
 * - coaching.recommendation.accepted - Rep accepted a recommendation
 * - coaching.recommendation.dismissed - Rep dismissed a recommendation
 * - coaching.action.completed - Rep completed an action item
 * - coaching.training.started - Rep started a training
 * - coaching.training.completed - Rep completed a training
 * 
 * INTEGRATION:
 * - Workflow Engine can trigger on coaching events
 * - Analytics Dashboard tracks coaching adoption
 * - Notification system alerts managers
 */

import type {
  RepPerformanceMetrics,
  CoachingInsights,
  TeamCoachingInsights,
  CoachingRecommendation,
  ActionItem,
  TrainingSuggestion,
  PerformanceTier
} from './types';
import type { AgentDomain } from '@/types/training';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// COACHING EVENT TYPES
// ============================================================================

/**
 * Event emitted when rep coaching insights are generated
 */
export interface CoachingInsightsGeneratedEvent {
  type: 'coaching.insights.generated';
  timestamp: Date;
  data: {
    /** Rep identifier */
    repId: string;
    repName: string;
    repEmail: string;
    
    /** Performance tier */
    tier: PerformanceTier;
    
    /** Overall performance score */
    overallScore: number;
    
    /** Number of recommendations */
    recommendationCount: number;
    
    /** Number of action items */
    actionItemCount: number;
    
    /** Number of training suggestions */
    trainingSuggestionCount: number;
    
    /** Number of risks identified */
    riskCount: number;
    
    /** Critical areas that need attention */
    criticalAreas: string[];
    
    /** Time period analyzed */
    period: string;
    
    /** AI model used */
    modelUsed: string;
    
    /** Processing time */
    processingTimeMs: number;
  };
}

/**
 * Event emitted when a rep views their coaching insights
 */
export interface CoachingInsightsViewedEvent {
  type: 'coaching.insights.viewed';
  timestamp: Date;
  data: {
    /** Rep identifier */
    repId: string;
    repName: string;
    
    /** When insights were generated */
    insightsGeneratedAt: Date;
    
    /** Time between generation and viewing (ms) */
    timeToViewMs: number;
    
    /** View duration (ms) */
    viewDurationMs?: number;
    
    /** Sections viewed */
    sectionsViewed: string[];
  };
}

/**
 * Event emitted when team coaching insights are generated
 */
export interface TeamInsightsGeneratedEvent {
  type: 'coaching.team.insights.generated';
  timestamp: Date;
  data: {
    /** Team identifier */
    teamId: string;
    teamName: string;
    
    /** Number of reps analyzed */
    repCount: number;
    
    /** Number of top performers */
    topPerformerCount: number;
    
    /** Number of reps needing support */
    needsSupportCount: number;
    
    /** Number of reps at risk */
    atRiskCount: number;
    
    /** Team average score */
    teamAverageScore: number;
    
    /** Number of skill gaps identified */
    skillGapCount: number;
    
    /** Number of best practices to share */
    bestPracticeCount: number;
    
    /** Time period analyzed */
    period: string;
    
    /** AI model used */
    modelUsed: string;
    
    /** Processing time */
    processingTimeMs: number;
  };
}

/**
 * Event emitted when a rep accepts a coaching recommendation
 */
export interface RecommendationAcceptedEvent {
  type: 'coaching.recommendation.accepted';
  timestamp: Date;
  data: {
    /** Rep identifier */
    repId: string;
    repName: string;
    
    /** Recommendation ID */
    recommendationId: string;
    
    /** Recommendation category */
    category: string;
    
    /** Recommendation priority */
    priority: string;
    
    /** Expected impact metrics */
    expectedImpact: {
      metric: string;
      baseline: number;
      target: number;
    }[];
    
    /** Time from generation to acceptance (ms) */
    timeToAcceptMs: number;
  };
}

/**
 * Event emitted when a rep dismisses a coaching recommendation
 */
export interface RecommendationDismissedEvent {
  type: 'coaching.recommendation.dismissed';
  timestamp: Date;
  data: {
    /** Rep identifier */
    repId: string;
    repName: string;
    
    /** Recommendation ID */
    recommendationId: string;
    
    /** Recommendation category */
    category: string;
    
    /** Recommendation priority */
    priority: string;
    
    /** Dismissal reason (optional) */
    reason?: string;
    
    /** Time from generation to dismissal (ms) */
    timeToDismissMs: number;
  };
}

/**
 * Event emitted when a rep completes an action item
 */
export interface ActionItemCompletedEvent {
  type: 'coaching.action.completed';
  timestamp: Date;
  data: {
    /** Rep identifier */
    repId: string;
    repName: string;
    
    /** Action item ID */
    actionItemId: string;
    
    /** Action category */
    category: string;
    
    /** Action priority */
    priority: string;
    
    /** Due date */
    dueDate: Date;
    
    /** Completed on time */
    onTime: boolean;
    
    /** Days early/late */
    daysEarlyLate: number;
    
    /** Estimated effort (hours) */
    estimatedEffort: number;
    
    /** Actual effort (hours) */
    actualEffort?: number;
    
    /** Related recommendations */
    relatedRecommendations: string[];
    
    /** Completion notes */
    notes?: string;
  };
}

/**
 * Event emitted when a rep starts a training
 */
export interface TrainingStartedEvent {
  type: 'coaching.training.started';
  timestamp: Date;
  data: {
    /** Rep identifier */
    repId: string;
    repName: string;
    
    /** Training title */
    trainingTitle: string;
    
    /** Training type */
    trainingType: string;
    
    /** Skill category */
    category: string;
    
    /** Current skill level */
    currentSkillLevel: number;
    
    /** Target skill level */
    targetSkillLevel: number;
    
    /** Expected duration */
    expectedDuration?: string;
  };
}

/**
 * Event emitted when a rep completes a training
 */
export interface TrainingCompletedEvent {
  type: 'coaching.training.completed';
  timestamp: Date;
  data: {
    /** Rep identifier */
    repId: string;
    repName: string;
    
    /** Training title */
    trainingTitle: string;
    
    /** Training type */
    trainingType: string;
    
    /** Skill category */
    category: string;
    
    /** When training started */
    startedAt: Date;
    
    /** Duration (ms) */
    durationMs: number;
    
    /** Pre-training skill level */
    preSkillLevel: number;
    
    /** Post-training skill level */
    postSkillLevel: number;
    
    /** Skill improvement */
    skillImprovement: number;
    
    /** Completion rate (0-1) */
    completionRate: number;
    
    /** Assessment score (if applicable) */
    assessmentScore?: number;
  };
}

// ============================================================================
// AGENT PERFORMANCE EVENT TYPES
// ============================================================================

/**
 * Event emitted when an AI agent's production session is analyzed and scored
 */
export interface AgentPerformanceAnalyzedEvent {
  type: 'agent.performance.analyzed';
  timestamp: Date;
  data: {
    agentId: string;
    agentType: AgentDomain;
    sessionId: string;
    score: number;
    flagged: boolean;
    threshold: number;
    issues: string[];
  };
}

/**
 * Event emitted when an AI agent's session is flagged for training review
 */
export interface AgentPerformanceFlaggedEvent {
  type: 'agent.performance.flagged';
  timestamp: Date;
  data: {
    agentId: string;
    agentType: AgentDomain;
    sessionId: string;
    score: number;
    threshold: number;
    issues: string[];
    unprocessedCount: number;
    batchTriggered: boolean;
  };
}

/**
 * Event emitted when the training pipeline is triggered for an AI agent
 */
export interface AgentTrainingTriggeredEvent {
  type: 'agent.training.triggered';
  timestamp: Date;
  data: {
    agentType: AgentDomain;
    goldenMasterId: string;
    updateRequestId: string;
    sourceType: 'coaching_bridge' | 'auto_flag_batch' | 'manual';
    improvementCount: number;
    expectedScoreImprovement: number;
    confidence: number;
  };
}

// ============================================================================
// UNION TYPE
// ============================================================================

/**
 * Union of all coaching-related events
 */
export type CoachingEvent =
  | CoachingInsightsGeneratedEvent
  | CoachingInsightsViewedEvent
  | TeamInsightsGeneratedEvent
  | RecommendationAcceptedEvent
  | RecommendationDismissedEvent
  | ActionItemCompletedEvent
  | TrainingStartedEvent
  | TrainingCompletedEvent
  | AgentPerformanceAnalyzedEvent
  | AgentPerformanceFlaggedEvent
  | AgentTrainingTriggeredEvent;

// ============================================================================
// EVENT BUILDERS
// ============================================================================

/**
 * Creates a coaching insights generated event
 */
export function createCoachingInsightsGeneratedEvent(
  performance: RepPerformanceMetrics,
  insights: CoachingInsights,
  modelUsed: string,
  processingTimeMs: number
): CoachingInsightsGeneratedEvent {
  return {
    type: 'coaching.insights.generated',
    timestamp: new Date(),
    data: {
      repId: performance.repId,
      repName: performance.repName,
      repEmail: performance.repEmail,
      tier: performance.tier,
      overallScore: performance.overallScore,
      recommendationCount: insights.recommendations.length,
      actionItemCount: insights.actionItems.length,
      trainingSuggestionCount: insights.training.length,
      riskCount: insights.risks.length,
      criticalAreas: insights.performanceSummary.focusAreas,
      period: performance.period,
      modelUsed,
      processingTimeMs
    }
  };
}

/**
 * Creates a coaching insights viewed event
 */
export function createCoachingInsightsViewedEvent(
  repId: string,
  repName: string,
  insightsGeneratedAt: Date,
  sectionsViewed: string[],
  viewDurationMs?: number
): CoachingInsightsViewedEvent {
  return {
    type: 'coaching.insights.viewed',
    timestamp: new Date(),
    data: {
      repId,
      repName,
      insightsGeneratedAt,
      timeToViewMs: Date.now() - insightsGeneratedAt.getTime(),
      viewDurationMs,
      sectionsViewed
    }
  };
}

/**
 * Creates a team insights generated event
 */
export function createTeamInsightsGeneratedEvent(
  teamInsights: TeamCoachingInsights,
  modelUsed: string,
  processingTimeMs: number
): TeamInsightsGeneratedEvent {
  return {
    type: 'coaching.team.insights.generated',
    timestamp: new Date(),
    data: {
      teamId: teamInsights.teamId,
      teamName: teamInsights.teamName,
      repCount: teamInsights.repInsights.length,
      topPerformerCount: teamInsights.topPerformers.length,
      needsSupportCount: teamInsights.needsSupport.length,
      atRiskCount: teamInsights.teamSummary.atRiskCount,
      teamAverageScore: teamInsights.teamSummary.teamAverages.overallScore,
      skillGapCount: teamInsights.skillGaps.length,
      bestPracticeCount: teamInsights.bestPracticesToShare.length,
      period: teamInsights.period,
      modelUsed,
      processingTimeMs
    }
  };
}

/**
 * Creates a recommendation accepted event
 */
export function createRecommendationAcceptedEvent(
  repId: string,
  repName: string,
  recommendation: CoachingRecommendation,
  generatedAt: Date
): RecommendationAcceptedEvent {
  return {
    type: 'coaching.recommendation.accepted',
    timestamp: new Date(),
    data: {
      repId,
      repName,
      recommendationId: recommendation.id,
      category: recommendation.category,
      priority: recommendation.priority,
      expectedImpact: recommendation.expectedOutcomes,
      timeToAcceptMs: Date.now() - generatedAt.getTime()
    }
  };
}

/**
 * Creates a recommendation dismissed event
 */
export function createRecommendationDismissedEvent(
  repId: string,
  repName: string,
  recommendationId: string,
  category: string,
  priority: string,
  generatedAt: Date,
  reason?: string
): RecommendationDismissedEvent {
  return {
    type: 'coaching.recommendation.dismissed',
    timestamp: new Date(),
    data: {
      repId,
      repName,
      recommendationId,
      category,
      priority,
      reason,
      timeToDismissMs: Date.now() - generatedAt.getTime()
    }
  };
}

/**
 * Creates an action item completed event
 */
export function createActionItemCompletedEvent(
  repId: string,
  repName: string,
  actionItem: ActionItem,
  actualEffort?: number,
  notes?: string
): ActionItemCompletedEvent {
  const now = new Date();
  const daysEarlyLate = Math.floor(
    (actionItem.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return {
    type: 'coaching.action.completed',
    timestamp: now,
    data: {
      repId,
      repName,
      actionItemId: actionItem.id,
      category: actionItem.category,
      priority: actionItem.priority,
      dueDate: actionItem.dueDate,
      onTime: daysEarlyLate >= 0,
      daysEarlyLate,
      estimatedEffort: actionItem.estimatedEffort,
      actualEffort,
      relatedRecommendations: actionItem.relatedRecommendations,
      notes
    }
  };
}

/**
 * Creates a training started event
 */
export function createTrainingStartedEvent(
  repId: string,
  repName: string,
  training: TrainingSuggestion
): TrainingStartedEvent {
  return {
    type: 'coaching.training.started',
    timestamp: new Date(),
    data: {
      repId,
      repName,
      trainingTitle: training.title,
      trainingType: training.type,
      category: training.category,
      currentSkillLevel: training.skillImprovement[0]?.currentLevel ?? 0,
      targetSkillLevel: training.skillImprovement[0]?.targetLevel ?? 100,
      expectedDuration: training.resources[0]?.duration
    }
  };
}

/**
 * Creates a training completed event
 */
export function createTrainingCompletedEvent(
  repId: string,
  repName: string,
  trainingTitle: string,
  trainingType: string,
  category: string,
  startedAt: Date,
  preSkillLevel: number,
  postSkillLevel: number,
  completionRate: number,
  assessmentScore?: number
): TrainingCompletedEvent {
  const now = new Date();
  
  return {
    type: 'coaching.training.completed',
    timestamp: now,
    data: {
      repId,
      repName,
      trainingTitle,
      trainingType,
      category,
      startedAt,
      durationMs: now.getTime() - startedAt.getTime(),
      preSkillLevel,
      postSkillLevel,
      skillImprovement: postSkillLevel - preSkillLevel,
      completionRate,
      assessmentScore
    }
  };
}

// ============================================================================
// AGENT PERFORMANCE EVENT BUILDERS
// ============================================================================

/**
 * Creates an agent performance analyzed event
 */
export function createAgentPerformanceAnalyzedEvent(
  agentId: string,
  agentType: AgentDomain,
  sessionId: string,
  score: number,
  flagged: boolean,
  threshold: number,
  issues: string[] = []
): AgentPerformanceAnalyzedEvent {
  return {
    type: 'agent.performance.analyzed',
    timestamp: new Date(),
    data: {
      agentId,
      agentType,
      sessionId,
      score,
      flagged,
      threshold,
      issues,
    },
  };
}

/**
 * Creates an agent performance flagged event
 */
export function createAgentPerformanceFlaggedEvent(
  agentId: string,
  agentType: AgentDomain,
  sessionId: string,
  score: number,
  threshold: number,
  issues: string[],
  unprocessedCount: number,
  batchTriggered: boolean
): AgentPerformanceFlaggedEvent {
  return {
    type: 'agent.performance.flagged',
    timestamp: new Date(),
    data: {
      agentId,
      agentType,
      sessionId,
      score,
      threshold,
      issues,
      unprocessedCount,
      batchTriggered,
    },
  };
}

/**
 * Creates an agent training triggered event
 */
export function createAgentTrainingTriggeredEvent(
  agentType: AgentDomain,
  goldenMasterId: string,
  updateRequestId: string,
  sourceType: 'coaching_bridge' | 'auto_flag_batch' | 'manual',
  improvementCount: number,
  expectedScoreImprovement: number,
  confidence: number
): AgentTrainingTriggeredEvent {
  return {
    type: 'agent.training.triggered',
    timestamp: new Date(),
    data: {
      agentType,
      goldenMasterId,
      updateRequestId,
      sourceType,
      improvementCount,
      expectedScoreImprovement,
      confidence,
    },
  };
}

// ============================================================================
// SIGNAL COORDINATOR BRIDGE
// ============================================================================

/**
 * Emit a coaching event through the SignalCoordinator.
 *
 * This bridges the coaching event system to the platform-wide signal bus.
 * Non-blocking — signal emission failures are logged but never throw.
 */
export async function emitCoachingSignal(event: CoachingEvent): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies — orchestration imports are heavy
    const { getServerSignalCoordinator } = await import('@/lib/orchestration/coordinator-factory-server');
    const coordinator = getServerSignalCoordinator();

    const signalTypeMap: Record<CoachingEvent['type'], string> = {
      'coaching.insights.generated': 'coaching.insights.generated',
      'coaching.insights.viewed': 'coaching.insights.generated', // maps to same signal
      'coaching.team.insights.generated': 'performance.analyzed',
      'coaching.recommendation.accepted': 'coaching.insights.generated',
      'coaching.recommendation.dismissed': 'coaching.insights.generated',
      'coaching.action.completed': 'coaching.insights.generated',
      'coaching.training.started': 'coaching.insights.generated',
      'coaching.training.completed': 'coaching.insights.generated',
      'agent.performance.analyzed': 'agent.performance.analyzed',
      'agent.performance.flagged': 'agent.performance.flagged',
      'agent.training.triggered': 'agent.training.triggered',
    };

    const signalType = signalTypeMap[event.type] ?? 'coaching.insights.generated';

    const priorityMap: Record<string, 'High' | 'Medium' | 'Low'> = {
      'agent.performance.flagged': 'High',
      'agent.training.triggered': 'High',
      'agent.performance.analyzed': 'Medium',
      'coaching.insights.generated': 'Medium',
      'coaching.team.insights.generated': 'Medium',
    };

    await coordinator.emitSignal({
      type: signalType as Parameters<typeof coordinator.emitSignal>[0]['type'],
      confidence: 0.9,
      priority: priorityMap[event.type] ?? 'Low',
      metadata: {
        eventType: event.type,
        timestamp: event.timestamp.toISOString(),
        ...event.data,
      },
    });

    logger.debug(`[CoachingEvents] Emitted signal: ${event.type} → ${signalType}`);
  } catch (error) {
    // Never fail the calling code if signal emission fails
    logger.warn('[CoachingEvents] Failed to emit coaching signal', {
      eventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
