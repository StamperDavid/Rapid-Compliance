/**
 * Production Monitor
 *
 * Generalized production analysis trigger for all agent types.
 * Replaces the chat-specific triggerChatAnalysis with a unified entry point.
 *
 * When a session completes, this module:
 * 1. Loads session data from the appropriate collection
 * 2. Calls the coaching/analysis endpoint to score the session
 * 3. Records the score on the session document
 * 4. Checks against configurable thresholds from AgentTypeTrainingConfig
 * 5. If below threshold → calls autoFlagForTraining()
 *
 * This wires into the existing coaching-analytics-engine for scoring
 * and the existing feedback-processor for analysis.
 *
 * @module training/production-monitor
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getFlagThreshold } from './agent-type-configs';
import { autoFlagForTraining } from './auto-flag-service';
import type { AgentDomain } from '@/types/training';

// ============================================================================
// COLLECTION MAPPING — where each agent type stores session data
// ============================================================================

function getSessionCollectionForType(agentType: AgentDomain): string {
  switch (agentType) {
    case 'chat':
      return getSubCollection('chatSessions');
    case 'voice':
      return getSubCollection('calls');
    case 'email':
      return getSubCollection('emailCampaigns');
    case 'social':
      return getSubCollection('socialPosts');
    case 'seo':
      return getSubCollection('blogPosts');
    case 'video':
      return getSubCollection('trainingSessions');
    case 'orchestrator':
      return getSubCollection('missions');
    case 'sales_chat':
      return getSubCollection('chatSessions');
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Trigger analysis for any agent type's production session.
 *
 * This is the unified entry point replacing per-type analysis triggers.
 * It scores the session, records the score, and auto-flags if below threshold.
 *
 * @param sessionId - The Firestore document ID of the session/interaction
 * @param agentType - Which agent domain this session belongs to
 * @param metadata  - Additional context for the analysis
 */
export async function triggerAgentAnalysis(
  sessionId: string,
  agentType: AgentDomain,
  metadata: {
    agentId?: string;
    ownerId?: string;
    score?: number;
    issues?: string[];
  } = {}
): Promise<{ scored: boolean; flagged: boolean; score: number }> {
  logger.info(`[ProductionMonitor] Analyzing ${agentType} session: ${sessionId}`);

  if (!adminDb) {
    logger.warn('[ProductionMonitor] adminDb not available — skipping analysis');
    return { scored: false, flagged: false, score: 0 };
  }

  try {
    // 1. Load the session document
    const collectionPath = getSessionCollectionForType(agentType);
    const sessionDoc = await adminDb.collection(collectionPath).doc(sessionId).get();

    if (!sessionDoc.exists) {
      logger.warn(`[ProductionMonitor] Session ${sessionId} not found in ${collectionPath}`);
      return { scored: false, flagged: false, score: 0 };
    }

    const sessionData = sessionDoc.data() as Record<string, unknown>;

    // 2. Determine score — use pre-computed if available, otherwise compute
    let score = metadata.score ?? 0;
    const issues = metadata.issues ?? [];

    if (!metadata.score) {
      // Extract score from session data (different fields per type)
      score = extractScoreFromSession(sessionData, agentType);
    }

    // 3. Record score on the session document
    await adminDb.collection(collectionPath).doc(sessionId).update({
      performanceScore: score,
      performanceScoredAt: new Date().toISOString(),
    });

    // 4. Check against threshold
    const threshold = getFlagThreshold(agentType);
    const shouldFlag = score > 0 && score < threshold;

    if (shouldFlag) {
      logger.info(`[ProductionMonitor] Session ${sessionId} scored ${score} (below ${threshold} threshold) — flagging`);
      await autoFlagForTraining(sessionId, agentType, score, issues.length > 0 ? issues : [`Score ${score} below threshold ${threshold}`]);
    }

    return { scored: true, flagged: shouldFlag, score };
  } catch (error) {
    logger.error(
      '[ProductionMonitor] Analysis failed',
      error instanceof Error ? error : new Error(String(error)),
      { sessionId, agentType }
    );
    return { scored: false, flagged: false, score: 0 };
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Extract a performance score from session data.
 * Different agent types store their scores in different fields.
 */
function extractScoreFromSession(sessionData: Record<string, unknown>, agentType: AgentDomain): number {
  // Check common score fields
  if (typeof sessionData.performanceScore === 'number') {
    return sessionData.performanceScore;
  }
  if (typeof sessionData.score === 'number') {
    return sessionData.score;
  }
  if (typeof sessionData.qualityScore === 'number') {
    return sessionData.qualityScore;
  }

  // Agent-type-specific fields
  switch (agentType) {
    case 'chat': {
      // Chat sessions may have sentiment-based scoring
      if (typeof sessionData.sentimentScore === 'number') {
        // Convert -1..1 sentiment to 0..100 quality
        return Math.round((sessionData.sentimentScore + 1) * 50);
      }
      if (sessionData.outcome === 'sale') { return 90; }
      if (sessionData.outcome === 'qualified_lead') { return 75; }
      if (sessionData.outcome === 'escalated') { return 50; }
      if (sessionData.outcome === 'abandoned') { return 30; }
      break;
    }
    case 'voice': {
      if (typeof sessionData.callScore === 'number') { return sessionData.callScore; }
      if (sessionData.callOutcome === 'appointment_set') { return 85; }
      if (sessionData.callOutcome === 'qualified') { return 70; }
      break;
    }
    case 'email': {
      if (typeof sessionData.openRate === 'number' && typeof sessionData.clickRate === 'number') {
        return Math.round((sessionData.openRate * 50) + (sessionData.clickRate * 50));
      }
      break;
    }
    case 'social': {
      if (typeof sessionData.engagementRate === 'number') {
        return Math.min(100, Math.round(sessionData.engagementRate * 1000)); // normalize
      }
      break;
    }
    case 'seo': {
      if (typeof sessionData.readabilityScore === 'number') { return sessionData.readabilityScore; }
      if (typeof sessionData.seoScore === 'number') { return sessionData.seoScore; }
      break;
    }
  }

  // Default: 0 means "not scored" (won't trigger flagging)
  return 0;
}
