/**
 * Coaching-Training Bridge
 *
 * Maps coaching insights (generated for AI agent rep profiles)
 * into training signals that feed the Golden Master update pipeline.
 *
 * When the coaching engine generates insights for an AI agent (isAI: true),
 * this bridge converts weaknesses and training suggestions into
 * ImprovementSuggestion[] and GoldenMasterUpdateRequest objects.
 *
 * Integration points:
 * - Input: CoachingInsights from coaching-generator.ts
 * - Output: GoldenMasterUpdateRequest stored in Firestore (pending_review)
 * - Connects to: golden-master-updater.ts update pipeline
 *
 * @module training/coaching-training-bridge
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { CoachingInsights, Weakness, TrainingSuggestion } from '@/lib/coaching/types';
import type {
  AgentDomain,
  ImprovementSuggestion,
  ProposedChange,
  GoldenMasterUpdateRequest,
} from '@/types/training';

// ============================================================================
// COACHING WEAKNESS → TRAINING IMPROVEMENT MAPPING
// ============================================================================

/**
 * Map coaching insight weaknesses to the GM-compatible ImprovementSuggestion format.
 *
 * Skill categories from the coaching engine map to specific GM config fields:
 * - closing → behaviorConfig.closingAggressiveness
 * - discovery → agentPersona.discoveryFrameworks
 * - objection_handling → agentPersona.objectionHandling
 * - product_knowledge → knowledgeBase updates
 * - communication → agentPersona.communicationStyle
 * - time_management → behaviorConfig.proactiveLevel
 */
export function mapCoachingToTrainingSignals(
  insights: CoachingInsights,
  agentType: AgentDomain
): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];

  // Map weaknesses → improvement suggestions
  for (const weakness of insights.weaknesses) {
    suggestions.push(mapWeaknessToImprovement(weakness, agentType));
  }

  // Map training suggestions → improvement suggestions
  for (const training of insights.training) {
    suggestions.push(mapTrainingSuggestionToImprovement(training));
  }

  logger.info(`[CoachingBridge] Mapped ${insights.weaknesses.length} weaknesses + ${insights.training.length} training suggestions → ${suggestions.length} improvements`);

  return suggestions;
}

/**
 * Create a full GoldenMasterUpdateRequest from coaching insights.
 *
 * This wraps mapped suggestions into an update request with evidence
 * from the coaching analysis, targeting the given GM.
 */
export async function createTrainingRequestFromCoaching(
  goldenMasterId: string,
  insights: CoachingInsights,
  agentType: AgentDomain
): Promise<GoldenMasterUpdateRequest | null> {
  const improvements = mapCoachingToTrainingSignals(insights, agentType);

  if (improvements.length === 0) {
    logger.info('[CoachingBridge] No improvements to create — skipping update request');
    return null;
  }

  // Generate proposed changes from improvements
  const proposedChanges = generateProposedChangesFromInsights(improvements, agentType);

  const updateRequest: GoldenMasterUpdateRequest = {
    id: `coaching_update_${agentType}_${Date.now()}`,
    goldenMasterId,
    agentType,
    sourceSessionIds: [], // Coaching insights are aggregated, not per-session
    improvements,
    proposedChanges,
    impactAnalysis: {
      expectedScoreImprovement: estimateImprovementFromInsights(insights),
      areasImproved: [...new Set(improvements.map(i => i.area))],
      risks: [
        'Changes derived from coaching analysis — verify with production A/B test',
        `Based on ${insights.performanceSummary.currentTier} tier performance data`,
      ],
      recommendedTestDuration: 14,
      confidence: insights.confidenceScore,
    },
    status: 'pending_review', // Human gate — always
    createdAt: new Date().toISOString(),
  };

  // Persist to Firestore
  if (adminDb) {
    await adminDb
      .collection(getSubCollection('goldenMasterUpdates'))
      .doc(updateRequest.id)
      .set(updateRequest);

    logger.info(`[CoachingBridge] Created training request ${updateRequest.id} for GM ${goldenMasterId}`);
  }

  return updateRequest;
}

// ============================================================================
// INTERNAL MAPPERS
// ============================================================================

function mapWeaknessToImprovement(
  weakness: Weakness,
  _agentType: AgentDomain
): ImprovementSuggestion {
  // Map coaching skill categories to GM config areas
  const areaMapping: Record<string, string> = {
    closing: 'closing_aggressiveness',
    discovery: 'discovery_frameworks',
    objection_handling: 'objection_handling',
    product_knowledge: 'product_knowledge',
    communication: 'communication_style',
    time_management: 'proactive_level',
    prospecting: 'proactive_behavior',
    negotiation: 'closing_aggressiveness',
    relationship_building: 'empathy_level',
    crm_hygiene: 'general_quality',
    ai_tool_usage: 'general_quality',
    presentation: 'communication_style',
    pipeline_management: 'general_quality',
    forecasting: 'general_quality',
  };

  const area = areaMapping[weakness.category] ?? weakness.category;

  // Map urgency to priority
  const priorityMap: Record<string, number> = {
    immediate: 9,
    near_term: 7,
    long_term: 4,
  };

  // Map impact to estimated impact
  const impactMap: Record<string, number> = {
    high: 8,
    medium: 6,
    low: 3,
  };

  return {
    id: `coaching_weakness_${weakness.category}_${Date.now()}`,
    type: mapCategoryToImprovementType(weakness.category),
    area,
    currentBehavior: weakness.description,
    suggestedBehavior: weakness.rootCauses.length > 0
      ? `Address root causes: ${weakness.rootCauses.join('; ')}. ${weakness.title}`
      : weakness.title,
    priority: priorityMap[weakness.urgency] ?? 5,
    estimatedImpact: impactMap[weakness.impact] ?? 5,
    confidence: 0.75, // Coaching analysis provides moderate confidence
  };
}

function mapTrainingSuggestionToImprovement(
  training: TrainingSuggestion
): ImprovementSuggestion {
  // Use the first skill improvement target as the area
  const primarySkill = training.skillImprovement[0];
  const area = primarySkill ? primarySkill.skill.toLowerCase().replace(/\s+/g, '_') : training.category;

  const priorityMap: Record<string, number> = {
    critical: 10,
    high: 8,
    medium: 5,
    low: 3,
  };

  return {
    id: `coaching_training_${training.category}_${Date.now()}`,
    type: 'behavior_change',
    area,
    currentBehavior: training.description,
    suggestedBehavior: primarySkill
      ? `Improve ${primarySkill.skill} from ${primarySkill.currentLevel} to ${primarySkill.targetLevel}`
      : training.title,
    priority: priorityMap[training.priority] ?? 5,
    estimatedImpact: primarySkill
      ? Math.min(10, Math.round((primarySkill.targetLevel - primarySkill.currentLevel) / 10))
      : 5,
    confidence: 0.7,
  };
}

function mapCategoryToImprovementType(
  category: string
): ImprovementSuggestion['type'] {
  switch (category) {
    case 'product_knowledge': return 'knowledge_gap';
    case 'communication': return 'tone_adjustment';
    case 'presentation': return 'tone_adjustment';
    default: return 'behavior_change';
  }
}

function generateProposedChangesFromInsights(
  improvements: ImprovementSuggestion[],
  _agentType: AgentDomain
): ProposedChange[] {
  const changes: ProposedChange[] = [];

  for (const improvement of improvements) {
    // Map improvement areas to specific GM config paths
    const pathMapping: Record<string, { type: ProposedChange['type']; path: string }> = {
      closing_aggressiveness: { type: 'behavior_config', path: 'behaviorConfig.closingAggressiveness' },
      discovery_frameworks: { type: 'system_prompt', path: 'agentPersona.discoveryFrameworks' },
      objection_handling: { type: 'system_prompt', path: 'agentPersona.objectionHandling' },
      product_knowledge: { type: 'knowledge_base', path: 'knowledgeBase' },
      communication_style: { type: 'system_prompt', path: 'agentPersona.communicationStyle' },
      proactive_level: { type: 'behavior_config', path: 'behaviorConfig.proactiveLevel' },
      empathy_level: { type: 'system_prompt', path: 'agentPersona.sentimentHandling.empathyLevel' },
    };

    const mapping = pathMapping[improvement.area];
    if (mapping) {
      changes.push({
        id: `change_${improvement.id}`,
        type: mapping.type,
        path: mapping.path,
        currentValue: improvement.currentBehavior,
        proposedValue: improvement.suggestedBehavior,
        reason: `Coaching analysis identified ${improvement.area} as an improvement area`,
        evidence: [],
        confidence: improvement.confidence,
      });
    }
  }

  return changes;
}

function estimateImprovementFromInsights(insights: CoachingInsights): number {
  // Estimate score improvement based on weakness count and severity
  const highImpactWeaknesses = insights.weaknesses.filter(w => w.impact === 'high').length;
  const mediumImpactWeaknesses = insights.weaknesses.filter(w => w.impact === 'medium').length;

  return Math.min(25, highImpactWeaknesses * 5 + mediumImpactWeaknesses * 2);
}
