/**
 * Playbook Bridge
 *
 * Bridges the existing GoldenPlaybook system (used for social/email/voice agents)
 * into the unified Golden Master update pipeline.
 *
 * This allows playbook corrections and performance patterns to flow through
 * the same training improvement path as chat agent feedback.
 *
 * @module training/playbook-bridge
 */

import { logger } from '@/lib/logger/logger';
import type {
  GoldenMaster,
  GoldenPlaybook,
  PlaybookCorrection,
} from '@/types/agent-memory';
import type { ImprovementSuggestion, AgentDomain } from '@/types/training';
import { analyzeSocialCorrections } from './feedback-processor';

// ============================================================================
// PLAYBOOK → GOLDEN MASTER CONVERSION
// ============================================================================

/**
 * Convert a GoldenPlaybook document into a Golden Master format.
 *
 * This enables social/email/voice agents that currently use GoldenPlaybook
 * to transition to the unified GM update pipeline without losing data.
 */
export function convertPlaybookToGM(
  playbook: GoldenPlaybook,
  userId: string
): GoldenMaster {
  logger.info(`[Playbook Bridge] Converting playbook ${playbook.id} (${playbook.agentType}) to GM format`);

  const agentType = mapPlaybookTypeToAgentDomain(playbook.agentType);

  const gm: GoldenMaster = {
    id: `gm_from_playbook_${playbook.id}`,
    version: playbook.version,
    baseModelId: `playbook_${playbook.id}`,
    agentType,

    // Business context — minimal, derived from playbook
    businessContext: {
      businessName: 'SalesVelocity.ai',
      industry: 'Technology',
      problemSolved: 'AI-powered sales acceleration',
      uniqueValue: 'Unified AI agent platform',
      targetCustomer: 'Sales teams',
      topProducts: 'AI Sales Platform',
    },

    // Persona — derived from brand voice DNA
    agentPersona: {
      name: `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent`,
      tone: playbook.brandVoiceDNA.tone,
      greeting: 'Hello!',
      closingMessage: 'Thank you!',
      objectives: playbook.brandVoiceDNA.keyMessages,
      can_negotiate: false,
      escalationRules: [],
      rules: {
        prohibitedBehaviors: playbook.explicitRules.neverPostAbout,
        behavioralBoundaries: playbook.explicitRules.topicRestrictions,
        neverMention: playbook.explicitRules.neverPostAbout,
      },
    },

    // Behavior config — defaults
    behaviorConfig: {
      closingAggressiveness: 3,
      questionFrequency: 1,
      responseLength: 'balanced',
      proactiveLevel: 7,
      idleTimeoutMinutes: 60,
    },

    // Knowledge base — brand voice from playbook
    knowledgeBase: {
      documents: [],
      urls: [],
      faqs: [],
      brandVoice: {
        tone: playbook.brandVoiceDNA.tone,
        keyMessages: playbook.brandVoiceDNA.keyMessages,
        commonPhrases: playbook.brandVoiceDNA.commonPhrases,
      },
    },

    // System prompt from compiled playbook prompt
    systemPrompt: playbook.compiledPrompt,

    // Training data
    trainedScenarios: playbook.trainedScenarios,
    trainingCompletedAt: playbook.updatedAt,
    trainingScore: playbook.trainingScore,

    // Deployment
    isActive: playbook.isActive,
    deployedAt: playbook.deployedAt,

    // Versioning
    previousVersion: playbook.previousVersion,
    changesSummary: playbook.changesSummary,

    // Metadata
    createdBy: userId,
    createdAt: playbook.createdAt,
    notes: `Bridged from GoldenPlaybook ${playbook.id} (${playbook.version})`,
  };

  return gm;
}

// ============================================================================
// CORRECTIONS → IMPROVEMENTS MAPPING
// ============================================================================

/**
 * Convert playbook corrections (user edits to AI-generated content)
 * into the standard ImprovementSuggestion[] format used by the GM update pipeline.
 *
 * This reuses the existing `analyzeSocialCorrections()` from feedback-processor
 * which sends corrections to an LLM for pattern analysis.
 */
export async function mapCorrectionsToImprovements(
  corrections: PlaybookCorrection[]
): Promise<ImprovementSuggestion[]> {
  if (corrections.length === 0) {
    return [];
  }

  logger.info(`[Playbook Bridge] Mapping ${corrections.length} playbook corrections to improvements`);

  // Transform PlaybookCorrection[] to the format analyzeSocialCorrections expects
  const correctionInputs = corrections.map(c => ({
    original: c.original,
    corrected: c.corrected,
    platform: c.platform,
    context: c.context,
  }));

  // Reuse the existing social corrections analyzer
  const suggestions = await analyzeSocialCorrections(correctionInputs);

  logger.info(`[Playbook Bridge] Generated ${suggestions.length} improvement suggestions from corrections`);

  return suggestions;
}

// ============================================================================
// PERFORMANCE PATTERNS → IMPROVEMENTS
// ============================================================================

/**
 * Convert playbook performance patterns into improvement suggestions.
 *
 * Performance patterns capture what content works well (high engagement)
 * and what doesn't. This converts those patterns into actionable suggestions
 * for the GM update pipeline.
 */
export function mapPerformancePatternsToImprovements(
  patterns: GoldenPlaybook['performancePatterns']
): ImprovementSuggestion[] {
  if (!patterns || patterns.length === 0) {
    return [];
  }

  const suggestions: ImprovementSuggestion[] = [];

  // Group patterns by metric
  const highPerformers = patterns.filter(p => p.value > 0.7 && p.confidence > 0.6);
  const lowPerformers = patterns.filter(p => p.value < 0.3 && p.confidence > 0.6);

  // Create suggestions from low-performing patterns (things to change)
  for (const pattern of lowPerformers) {
    suggestions.push({
      id: `perf_pattern_${pattern.id}`,
      type: 'process_improvement',
      area: pattern.pattern,
      currentBehavior: `Low performance on ${pattern.metric}: ${Math.round(pattern.value * 100)}% (sample size: ${pattern.sampleSize})`,
      suggestedBehavior: `Reduce or modify usage of pattern: "${pattern.pattern}" — consistently underperforming`,
      priority: 7,
      estimatedImpact: 6,
      confidence: pattern.confidence,
    });
  }

  // Create suggestions from high-performing patterns (things to do more of)
  for (const pattern of highPerformers) {
    suggestions.push({
      id: `perf_pattern_${pattern.id}`,
      type: 'process_improvement',
      area: pattern.pattern,
      currentBehavior: `Pattern "${pattern.pattern}" shows ${Math.round(pattern.value * 100)}% ${pattern.metric} (sample size: ${pattern.sampleSize})`,
      suggestedBehavior: `Increase usage of this high-performing pattern across more content`,
      priority: 5,
      estimatedImpact: 5,
      confidence: pattern.confidence,
    });
  }

  return suggestions;
}

// ============================================================================
// HELPERS
// ============================================================================

function mapPlaybookTypeToAgentDomain(playbookType: GoldenPlaybook['agentType']): AgentDomain {
  switch (playbookType) {
    case 'social': return 'social';
    case 'email': return 'email';
    case 'voice': return 'voice';
    default: return 'social';
  }
}
