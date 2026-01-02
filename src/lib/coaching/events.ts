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
  | TrainingCompletedEvent;

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
