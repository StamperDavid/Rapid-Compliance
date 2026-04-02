/**
 * Auto-Flag Service
 *
 * Automatically flags production sessions that fall below performance thresholds.
 * When enough sessions accumulate for an agent type, batches them through the
 * existing feedback-processor → GoldenMasterUpdateRequest pipeline.
 *
 * Integration points:
 * - Called by production-monitor.ts when a session scores below threshold
 * - Writes flagged status to the session's Firestore document
 * - Emits signal via SignalCoordinator for dashboard notifications
 * - Batches flagged sessions through feedback-processor → createUpdateRequest()
 * - Routes to the correct agent's GM based on agentType
 * - Human review gate preserved (status: pending_review)
 *
 * @module training/auto-flag-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { AgentDomain, GoldenMasterUpdateRequest, ImprovementSuggestion } from '@/types/training';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Number of flagged sessions before auto-creating an update request */
const BATCH_THRESHOLD = 5;

/** Collection for flagged sessions */
const FLAGGED_SESSIONS_COLLECTION = 'flaggedTrainingSessions';

// ============================================================================
// TYPES
// ============================================================================

export interface FlaggedSession {
  id: string;
  sessionId: string;
  agentType: AgentDomain;
  score: number;
  issues: string[];
  flaggedAt: string;
  processed: boolean;
  updateRequestId?: string;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Flag a production session for training review.
 *
 * 1. Marks the session document with `flaggedForTraining: true`
 * 2. Creates a FlaggedSession record
 * 3. Checks accumulated count — if >= threshold, triggers batch processing
 */
export async function autoFlagForTraining(
  sessionId: string,
  agentType: AgentDomain,
  score: number,
  issues: string[]
): Promise<void> {
  logger.info(`[AutoFlag] Flagging ${agentType} session ${sessionId} (score: ${score})`);

  if (!adminDb) {
    logger.warn('[AutoFlag] adminDb not available — skipping flag');
    return;
  }

  const now = new Date().toISOString();
  const flagId = `flag_${sessionId}_${Date.now()}`;

  // 1. Create flagged session record
  const flaggedSession: FlaggedSession = {
    id: flagId,
    sessionId,
    agentType,
    score,
    issues,
    flaggedAt: now,
    processed: false,
  };

  await adminDb
    .collection(getSubCollection(FLAGGED_SESSIONS_COLLECTION))
    .doc(flagId)
    .set(flaggedSession);

  // 2. Mark the original session document
  await markSessionFlagged(sessionId, agentType, score, issues);

  // 3. Check if we have enough flagged sessions to trigger batch processing
  const unprocessedCount = await getUnprocessedFlaggedCount(agentType);
  logger.info(`[AutoFlag] Unprocessed flagged sessions for ${agentType}: ${unprocessedCount}/${BATCH_THRESHOLD}`);

  if (unprocessedCount >= BATCH_THRESHOLD) {
    await batchProcessFlaggedSessions(agentType);
  }
}

/**
 * Get flagged sessions, optionally filtered by agent type.
 */
export async function getFlaggedSessions(
  agentType?: AgentDomain,
  limit: number = 50,
  includeProcessed: boolean = false
): Promise<FlaggedSession[]> {
  if (!adminDb) { return []; }

  let query = adminDb
    .collection(getSubCollection(FLAGGED_SESSIONS_COLLECTION)) as FirebaseFirestore.Query;

  if (agentType) {
    query = query.where('agentType', '==', agentType);
  }

  if (!includeProcessed) {
    query = query.where('processed', '==', false);
  }

  query = query.orderBy('flaggedAt', 'desc').limit(limit);

  const snap = await query.get();
  return snap.docs.map(doc => doc.data() as FlaggedSession);
}

// ============================================================================
// INTERNAL
// ============================================================================

/**
 * Mark the original session document as flagged for training.
 */
async function markSessionFlagged(
  sessionId: string,
  agentType: AgentDomain,
  score: number,
  issues: string[]
): Promise<void> {
  if (!adminDb) { return; }

  // Determine which collection the session lives in
  const collectionMap: Record<AgentDomain, string> = {
    chat: 'chatSessions',
    content: 'contentPosts',
    voice: 'calls',
    email: 'emailCampaigns',
    social: 'socialPosts',
    seo: 'blogPosts',
    video: 'trainingSessions',
    orchestrator: 'missions',
    sales_chat: 'chatSessions',
  };

  const collectionPath = getSubCollection(collectionMap[agentType]);

  try {
    await adminDb.collection(collectionPath).doc(sessionId).update({
      flaggedForTraining: true,
      flaggedReason: issues,
      flaggedScore: score,
      flaggedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Session doc may not exist if it was deleted — log and continue
    logger.warn('[AutoFlag] Failed to mark session as flagged', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Count unprocessed flagged sessions for a given agent type.
 */
async function getUnprocessedFlaggedCount(agentType: AgentDomain): Promise<number> {
  if (!adminDb) { return 0; }

  const snap = await adminDb
    .collection(getSubCollection(FLAGGED_SESSIONS_COLLECTION))
    .where('agentType', '==', agentType)
    .where('processed', '==', false)
    .get();

  return snap.size;
}

/**
 * Batch process flagged sessions into a GoldenMasterUpdateRequest.
 *
 * This takes all unprocessed flagged sessions for an agent type,
 * generates improvement suggestions from the issues, wraps them into
 * an update request targeting the correct Golden Master, and saves it.
 */
async function batchProcessFlaggedSessions(agentType: AgentDomain): Promise<void> {
  if (!adminDb) { return; }

  const db = adminDb;
  logger.info(`[AutoFlag] Batch processing flagged sessions for ${agentType}`);

  // Use a transaction to prevent race conditions where two concurrent
  // requests both try to process the same flagged sessions
  await db.runTransaction(async (transaction) => {
    // Get unprocessed sessions inside the transaction
    const snap = await transaction.get(
      db
        .collection(getSubCollection(FLAGGED_SESSIONS_COLLECTION))
        .where('agentType', '==', agentType)
        .where('processed', '==', false)
        .orderBy('flaggedAt', 'asc')
        .limit(BATCH_THRESHOLD * 2) // process up to 2x threshold
    );

    if (snap.empty) { return; }

    // Double-check none were processed between count check and transaction start
    const unprocessedDocs = snap.docs.filter(doc => {
      const data = doc.data() as FlaggedSession;
      return !data.processed;
    });

    if (unprocessedDocs.length < BATCH_THRESHOLD) {
      logger.info(`[AutoFlag] Not enough unprocessed sessions after recheck (${unprocessedDocs.length}/${BATCH_THRESHOLD})`);
      return;
    }

    const flaggedSessions = unprocessedDocs.map(doc => doc.data() as FlaggedSession);
    const sessionIds = flaggedSessions.map(s => s.sessionId);

    // Generate improvement suggestions from accumulated issues
    const allIssues = flaggedSessions.flatMap(s => s.issues);
    const issueFrequency = new Map<string, number>();
    for (const issue of allIssues) {
      issueFrequency.set(issue, (issueFrequency.get(issue) ?? 0) + 1);
    }

    const improvements: ImprovementSuggestion[] = Array.from(issueFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count], index) => ({
        id: `auto_flag_${agentType}_${Date.now()}_${index}`,
        type: 'behavior_change' as const,
        area: categorizeIssue(issue, agentType),
        currentBehavior: `Recurring issue (${count} occurrences): ${issue}`,
        suggestedBehavior: `Address the pattern causing: ${issue}`,
        priority: Math.min(10, 5 + count),
        estimatedImpact: Math.min(10, 3 + count),
        confidence: Math.min(0.95, 0.5 + (count / flaggedSessions.length) * 0.4),
      }));

    // Find the Golden Master for this agent type
    // db is guaranteed non-null by the check at function entry
    const gmSnap = await db
      .collection(getSubCollection('goldenMasters'))
      .where('agentType', '==', agentType)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    const goldenMasterId = gmSnap.empty
      ? `pending_${agentType}` // No active GM yet — request still created for review
      : gmSnap.docs[0].id;

    // Create the update request
    const avgScore = flaggedSessions.reduce((sum, s) => sum + s.score, 0) / flaggedSessions.length;
    const updateRequest: GoldenMasterUpdateRequest = {
      id: `auto_update_${agentType}_${Date.now()}`,
      goldenMasterId,
      agentType,
      sourceSessionIds: sessionIds,
      improvements,
      proposedChanges: [],
      impactAnalysis: {
        expectedScoreImprovement: Math.round(100 - avgScore) * 0.3,
        areasImproved: [...new Set(improvements.map(i => i.area))],
        risks: ['Auto-generated from production flags — human review required'],
        recommendedTestDuration: 7,
        confidence: Math.min(0.9, 0.5 + flaggedSessions.length * 0.05),
      },
      status: 'pending_review', // Human gate — always requires review
      createdAt: new Date().toISOString(),
    };

    // Save update request (inside transaction)
    transaction.set(
      db.collection(getSubCollection('goldenMasterUpdates')).doc(updateRequest.id),
      updateRequest
    );

    // Mark all processed sessions (inside transaction)
    for (const doc of unprocessedDocs) {
      transaction.update(doc.ref, {
        processed: true,
        updateRequestId: updateRequest.id,
      });
    }

    logger.info(`[AutoFlag] Created update request ${updateRequest.id} from ${flaggedSessions.length} flagged sessions`);
  });
}

/**
 * Categorize an issue string into an area for improvement suggestions.
 */
function categorizeIssue(issue: string, _agentType: AgentDomain): string {
  const lower = issue.toLowerCase();

  if (lower.includes('objection') || lower.includes('pushback')) { return 'objection_handling'; }
  if (lower.includes('close') || lower.includes('closing') || lower.includes('conversion')) { return 'closing'; }
  if (lower.includes('discovery') || lower.includes('question') || lower.includes('qualification')) { return 'discovery'; }
  if (lower.includes('tone') || lower.includes('voice') || lower.includes('brand')) { return 'tone_consistency'; }
  if (lower.includes('product') || lower.includes('knowledge') || lower.includes('accuracy')) { return 'product_knowledge'; }
  if (lower.includes('escalat') || lower.includes('handoff')) { return 'escalation'; }
  if (lower.includes('greeting') || lower.includes('opening')) { return 'greeting'; }

  return 'general_quality';
}
