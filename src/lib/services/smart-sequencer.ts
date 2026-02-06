/**
 * Smart Sequencer with Lead Scoring Integration
 * 
 * Extends the base Sequencer with intelligent lead prioritization
 * based on lead scores.
 * 
 * HUNTER-CLOSER COMPLIANCE:
 * - 100% native (no Outreach.io, Salesloft)
 * - Uses native lead scoring
 * - Automatic priority-based scheduling
 * - Smart enrollment based on score thresholds
 */

import { logger } from '@/lib/logger/logger';
import {
  enrollInSequence,
  getSequence,
  type Sequence,
} from './sequencer';
import { calculateLeadScore } from './lead-scoring-engine';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { LeadScore } from '@/types/lead-scoring';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Firestore document data for sequence enrollment with smart metadata
 */
interface EnrollmentDocumentData {
  organizationId: string;
  status: 'active' | 'paused' | 'completed' | 'stopped' | 'failed';
  leadId: string;
  nextExecutionAt?: FirebaseFirestore.Timestamp;
  metadata?: {
    leadPriority?: 'hot' | 'warm' | 'cold';
    scoredAt?: string;
    leadScore?: number;
    leadGrade?: string;
    delayMultiplier?: number;
    smartEnrollment?: boolean;
    topSignals?: string[];
    timingAdjusted?: boolean;
    rescored?: boolean;
    rescoredAt?: FirebaseFirestore.Timestamp;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SmartEnrollmentOptions {
  /** Minimum score required to enroll (default: 0) */
  minScore?: number;

  /** Auto-adjust delays based on priority */
  priorityBasedTiming?: boolean;

  /** Hot leads get faster follow-ups */
  hotLeadDelayMultiplier?: number; // Default: 0.5 (2x faster)

  /** Warm leads get normal timing */
  warmLeadDelayMultiplier?: number; // Default: 1.0 (normal)

  /** Cold leads get slower follow-ups */
  coldLeadDelayMultiplier?: number; // Default: 1.5 (slower)

  /** Skip low-scoring leads */
  skipBelowScore?: number;

  /** Metadata to attach */
  metadata?: Record<string, unknown>;
}

export interface PrioritizedLead {
  leadId: string;
  score: LeadScore;
  enrollmentId?: string;
  enrolled: boolean;
  reason?: string;
}

// ============================================================================
// SMART ENROLLMENT
// ============================================================================

/**
 * Enroll lead in sequence with automatic scoring and prioritization
 * 
 * This function:
 * 1. Calculates lead score (or uses cached)
 * 2. Checks score threshold
 * 3. Adjusts timing based on priority
 * 4. Enrolls lead with smart metadata
 * 
 * @param params - Smart enrollment params
 * @returns Enrollment result with score
 * 
 * @example
 * ```typescript
 * const result = await smartEnrollInSequence({
 *   sequenceId: 'seq_123',
 *   leadId: 'lead_456',
 *   minScore: 60, // Only enroll if score >= 60
 *   priorityBasedTiming: true, // Hot leads get faster follow-ups
 * });
 * 
 * if (result.enrolled) {
 *   console.log(`Enrolled! Score: ${result.score.totalScore}`);
 *   console.log(`Priority: ${result.score.priority}`);
 * }
 * ```
 */
export async function smartEnrollInSequence(params: {
  sequenceId: string;
  leadId: string;
  organizationId: string;
  options?: SmartEnrollmentOptions;
}): Promise<PrioritizedLead> {
  const { sequenceId, leadId, organizationId, options = {} } = params;
  
  const {
    minScore = 0,
    skipBelowScore,
    priorityBasedTiming = true,
    hotLeadDelayMultiplier = 0.5,
    warmLeadDelayMultiplier = 1.0,
    coldLeadDelayMultiplier = 1.5,
    metadata = {},
  } = options;

  try {
    logger.info('Smart enrollment started', {
      sequenceId,
      leadId,
      organizationId,
      minScore,
    });

    // Step 1: Calculate/fetch lead score
    const score = await calculateLeadScore({
      leadId,
      forceRescore: false, // Use cache if available
    });

    logger.info('Lead score calculated', {
      leadId,
      totalScore: score.totalScore,
      grade: score.grade,
      priority: score.priority,
    });

    // Step 2: Check score thresholds
    if (skipBelowScore && score.totalScore < skipBelowScore) {
      return {
        leadId,
        score,
        enrolled: false,
        reason: `Score ${score.totalScore} is below skip threshold ${skipBelowScore}`,
      };
    }

    if (score.totalScore < minScore) {
      return {
        leadId,
        score,
        enrolled: false,
        reason: `Score ${score.totalScore} is below minimum ${minScore}`,
      };
    }

    // Step 3: Get sequence and adjust timing if needed
    const sequence = await getSequence(sequenceId);
    if (!sequence) {
      throw new Error(`Sequence not found: ${sequenceId}`);
    }

    // Step 4: Calculate delay multiplier based on priority
    let delayMultiplier = 1.0;
    if (priorityBasedTiming) {
      switch (score.priority) {
        case 'hot':
          delayMultiplier = hotLeadDelayMultiplier;
          break;
        case 'warm':
          delayMultiplier = warmLeadDelayMultiplier;
          break;
        case 'cold':
          delayMultiplier = coldLeadDelayMultiplier;
          break;
      }
    }

    // Step 5: Enroll with enriched metadata
    const enrollment = await enrollInSequence({
      sequenceId,
      leadId,
      organizationId,
      metadata: {
        ...metadata,
        leadScore: score.totalScore,
        leadGrade: score.grade,
        leadPriority: score.priority,
        scoredAt: score.metadata.scoredAt.toISOString(),
        delayMultiplier,
        smartEnrollment: true,
        topSignals: score.detectedSignals.slice(0, 3).map((s) => s.type),
      },
    });

    // Step 6: Adjust step timing if priority-based timing is enabled
    if (priorityBasedTiming && delayMultiplier !== 1.0) {
      await adjustEnrollmentTiming(enrollment.id, delayMultiplier);
    }

    logger.info('Smart enrollment complete', {
      leadId,
      enrollmentId: enrollment.id,
      score: score.totalScore,
      priority: score.priority,
      delayMultiplier,
    });

    return {
      leadId,
      score,
      enrollmentId: enrollment.id,
      enrolled: true,
    };
  } catch (error) {
    const errorInstance = error instanceof Error ? error : undefined;
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Smart enrollment failed', errorInstance, {
      leadId,
      sequenceId,
      errorMessage: message,
    });
    throw error;
  }
}

/**
 * Batch smart enrollment for multiple leads
 */
export async function smartEnrollBatch(params: {
  sequenceId: string;
  leadIds: string[];
  organizationId: string;
  options?: SmartEnrollmentOptions;
}): Promise<PrioritizedLead[]> {
  const { sequenceId, leadIds, organizationId, options } = params;

  logger.info('Batch smart enrollment started', {
    sequenceId,
    organizationId,
    leadsCount: leadIds.length,
  });

  const results: PrioritizedLead[] = [];
  
  // Process in parallel with concurrency limit
  const concurrency = 5;
  for (let i = 0; i < leadIds.length; i += concurrency) {
    const batch = leadIds.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map((leadId) =>
        smartEnrollInSequence({
          sequenceId,
          leadId,
          organizationId,
          options,
        })
      )
    );

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const errorInstance = result.reason instanceof Error ? result.reason : undefined;
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        logger.error('Batch enrollment failed for lead', errorInstance, {
          errorMessage: message,
        });
      }
    });
  }

  const enrolled = results.filter((r) => r.enrolled).length;
  const skipped = results.filter((r) => !r.enrolled).length;

  logger.info('Batch smart enrollment complete', {
    total: leadIds.length,
    enrolled,
    skipped,
  });

  return results;
}

// ============================================================================
// PRIORITY-BASED PROCESSING
// ============================================================================

/**
 * Process sequence steps with priority-based ordering
 * 
 * Hot leads are processed first, then warm, then cold.
 */
export async function processSequenceStepsWithPriority(
  organizationId: string
): Promise<number> {
  try {
    logger.info('Processing sequences with priority ordering', {
      organizationId,
    });

    const now = new Date();

    // Get all due enrollments (using environment-aware collection path)
    const { COLLECTIONS } = await import('@/lib/firebase/collections');
    const snapshot = await db
      .collection(COLLECTIONS.SEQUENCE_ENROLLMENTS)
      .where('status', '==', 'active')
      .where('nextExecutionAt', '<=', Timestamp.fromDate(now))
      .get();

    // Separate by priority
    const hot: string[] = [];
    const warm: string[] = [];
    const cold: string[] = [];
    const unknown: string[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as EnrollmentDocumentData;
      const priority = data.metadata?.leadPriority;

      switch (priority) {
        case 'hot':
          hot.push(doc.id);
          break;
        case 'warm':
          warm.push(doc.id);
          break;
        case 'cold':
          cold.push(doc.id);
          break;
        default:
          unknown.push(doc.id);
      }
    });

    logger.info('Priority distribution for due steps', {
      hot: hot.length,
      warm: warm.length,
      cold: cold.length,
      unknown: unknown.length,
    });

    // Process in priority order: hot → warm → cold → unknown
    const orderedIds = [...hot, ...warm, ...cold, ...unknown];
    
    let processed = 0;
    for (const enrollmentId of orderedIds) {
      try {
        // Use base sequencer's executeSequenceStep
        const { executeSequenceStep } = await import('./sequencer');
        await executeSequenceStep(enrollmentId);
        processed++;
      } catch (error) {
        const errorInstance = error instanceof Error ? error : undefined;
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to execute sequence step', errorInstance, {
          enrollmentId,
          errorMessage: message,
        });
      }
    }

    logger.info('Priority-based processing complete', {
      organizationId,
      processed,
      total: orderedIds.length,
    });

    return processed;
  } catch (error) {
    const errorInstance = error instanceof Error ? error : undefined;
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to process sequences with priority', errorInstance, {
      errorMessage: message,
    });
    throw error;
  }
}

// ============================================================================
// AUTOMATIC RE-SCORING
// ============================================================================

/**
 * Automatically rescore leads in active sequences
 * 
 * Re-scores leads whose scores have expired (>7 days old)
 * and updates enrollment metadata.
 */
export async function rescoreActiveSequenceLeads(
  organizationId: string
): Promise<number> {
  try {
    logger.info('Rescoring active sequence leads', { organizationId });

    // Get all active enrollments (using environment-aware collection path)
    const { COLLECTIONS } = await import('@/lib/firebase/collections');
    const snapshot = await db
      .collection(COLLECTIONS.SEQUENCE_ENROLLMENTS)
      .where('status', '==', 'active')
      .get();

    let rescored = 0;

    for (const doc of snapshot.docs) {
      const enrollment = doc.data() as EnrollmentDocumentData;
      const leadId = enrollment.leadId;
      const lastScoredAt = enrollment.metadata?.scoredAt
        ? new Date(enrollment.metadata.scoredAt)
        : null;

      // Check if score is expired (>7 days old)
      if (!lastScoredAt || Date.now() - lastScoredAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
        try {
          // Rescore the lead
          const score = await calculateLeadScore({
            leadId,
            forceRescore: true,
          });

          // Update enrollment metadata (using environment-aware collection path)
          const { COLLECTIONS: COLS } = await import('@/lib/firebase/collections');
          await db.collection(COLS.SEQUENCE_ENROLLMENTS).doc(doc.id).update({
            'metadata.leadScore': score.totalScore,
            'metadata.leadGrade': score.grade,
            'metadata.leadPriority': score.priority,
            'metadata.scoredAt': score.metadata.scoredAt.toISOString(),
            'metadata.rescored': true,
            'metadata.rescoredAt': Timestamp.now(),
          });

          rescored++;

          logger.info('Rescored sequence lead', {
            leadId,
            enrollmentId: doc.id,
            newScore: score.totalScore,
            priority: score.priority,
          });
        } catch (error) {
          const errorInstance = error instanceof Error ? error : undefined;
          const message = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Failed to rescore lead', errorInstance, {
            leadId,
            errorMessage: message,
          });
        }
      }
    }

    logger.info('Automatic rescoring complete', {
      organizationId,
      rescored,
      total: snapshot.size,
    });

    return rescored;
  } catch (error) {
    const errorInstance = error instanceof Error ? error : undefined;
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to rescore active leads', errorInstance, {
      errorMessage: message,
    });
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Adjust enrollment timing based on priority multiplier
 */
async function adjustEnrollmentTiming(
  enrollmentId: string,
  multiplier: number
): Promise<void> {
  try {
    const { COLLECTIONS } = await import('@/lib/firebase/collections');
    const enrollmentDoc = await db
      .collection(COLLECTIONS.SEQUENCE_ENROLLMENTS)
      .doc(enrollmentId)
      .get();

    if (!enrollmentDoc.exists) {
      return;
    }

    const enrollment = enrollmentDoc.data() as EnrollmentDocumentData | undefined;
    if (!enrollment?.nextExecutionAt) {
      return;
    }

    const currentNext = enrollment.nextExecutionAt.toDate();
    const now = new Date();
    const delayMs = currentNext.getTime() - now.getTime();
    const adjustedDelayMs = delayMs * multiplier;
    const newNext = new Date(now.getTime() + adjustedDelayMs);

    await db.collection(COLLECTIONS.SEQUENCE_ENROLLMENTS).doc(enrollmentId).update({
      nextExecutionAt: Timestamp.fromDate(newNext),
      'metadata.timingAdjusted': true,
      'metadata.delayMultiplier': multiplier,
    });

    logger.info('Adjusted enrollment timing', {
      enrollmentId,
      multiplier,
      originalNext: currentNext.toISOString(),
      adjustedNext: newNext.toISOString(),
    });
  } catch (error) {
    const errorInstance = error instanceof Error ? error : undefined;
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to adjust timing', errorInstance, {
      enrollmentId,
      errorMessage: message,
    });
  }
}

/**
 * Get recommended sequence for a lead based on score
 */
export async function getRecommendedSequence(params: {
  leadId: string;
  organizationId: string;
  availableSequences?: Sequence[];
}): Promise<Sequence | null> {
  const { leadId, organizationId: _organizationId, availableSequences } = params;

  try {
    // Calculate lead score (for future smart matching implementation)
    const _score = await calculateLeadScore({
      leadId,
    });

    // Get available sequences (using environment-aware collection path)
    const { COLLECTIONS } = await import('@/lib/firebase/collections');
    const sequences =
      availableSequences ??
      (await db
        .collection(COLLECTIONS.SEQUENCES)
        .where('isActive', '==', true)
        .get()
        .then((snap) => snap.docs.map((doc) => doc.data() as Sequence)));

    // Simple recommendation logic:
    // Hot leads → aggressive sequences
    // Warm leads → standard sequences
    // Cold leads → nurture sequences

    // For now, return the first active sequence
    // TODO: Implement sequence tagging and smart matching based on _score

    return sequences?.[0] ?? null;
  } catch (error) {
    const errorInstance = error instanceof Error ? error : undefined;
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get recommended sequence', errorInstance, {
      leadId,
      errorMessage: message,
    });
    return null;
  }
}
