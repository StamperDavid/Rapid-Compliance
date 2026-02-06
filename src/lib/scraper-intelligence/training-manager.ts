/**
 * Training Manager
 * 
 * Manages client feedback and training data for improving extraction accuracy.
 * Implements learning from corrections with Bayesian confidence updates.
 * 
 * Features:
 * - Client feedback submission with validation
 * - TTL integration (flag scrapes for deletion after verification)
 * - Atomic updates with conflict resolution
 * - Version control and audit trail
 * - Rate limiting to prevent abuse
 * - Bayesian confidence scoring
 */

import { db } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';
import {
  ClientFeedbackSchema,
  type ClientFeedback,
  type TrainingData,
  type TrainingHistory,
  type FeedbackType,
} from '@/types/scraper-intelligence';
import { flagScrapeForDeletion, getTemporaryScrape } from './temporary-scrapes-service';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// ============================================================================
// CONSTANTS
// ============================================================================

const FEEDBACK_COLLECTION = 'training_feedback';
const TRAINING_DATA_COLLECTION = 'training_data';
const TRAINING_HISTORY_COLLECTION = 'training_history';
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 feedback submissions per minute per org

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();

  checkLimit(maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.limits.get(DEFAULT_ORG_ID);

    // No entry or window expired
    if (!entry || now - entry.windowStart > windowMs) {
      this.limits.set(DEFAULT_ORG_ID, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Within window
    if (entry.count >= maxRequests) {
      return false; // Rate limit exceeded
    }

    // Increment count
    entry.count++;
    return true;
  }

  reset(): void {
    this.limits.delete(DEFAULT_ORG_ID);
  }

  clear(): void {
    this.limits.clear();
  }
}

const feedbackRateLimiter = new RateLimiter();

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class TrainingManagerError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TrainingManagerError';
  }
}

// ============================================================================
// CLIENT FEEDBACK SUBMISSION
// ============================================================================

/**
 * Submit client feedback on an extraction
 * 
 * Validates feedback, saves to database, and triggers training data update.
 * If feedback confirms extraction, flags the temporary scrape for deletion.
 * 
 * @param params - Feedback submission parameters
 * @returns Saved feedback object
 * @throws TrainingManagerError if validation fails or rate limit exceeded
 * 
 * @example
 * ```typescript
 * const feedback = await submitFeedback({
 *   userId: 'user_456',
 *   feedbackType: 'correct',
 *   signalId: 'signal_789',
 *   sourceScrapeId: 'scrape_abc',
 *   sourceText: 'We are hiring 5 engineers',
 * });
 * ```
 */
export async function submitFeedback(params: {
  userId: string;
  feedbackType: FeedbackType;
  signalId: string;
  sourceScrapeId: string;
  sourceText: string;
  correctedValue?: string;
  notes?: string;
  userConfidence?: number;
  metadata?: {
    url?: string;
    industry?: string;
    systemConfidence?: number;
  };
}): Promise<ClientFeedback> {
  const { userId } = params;

  // Rate limiting
  const allowed = feedbackRateLimiter.checkLimit(
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );

  if (!allowed) {
    throw new TrainingManagerError(
      'Rate limit exceeded. Please wait before submitting more feedback.',
      'RATE_LIMIT_EXCEEDED',
      429
    );
  }

  // Validate feedback
  try {
    // Create feedback object
    const now = new Date();
    const feedbackId = db.collection(FEEDBACK_COLLECTION).doc().id;

    const feedback: ClientFeedback = {
      id: feedbackId,
      userId,
      feedbackType: params.feedbackType,
      signalId: params.signalId,
      sourceScrapeId: params.sourceScrapeId,
      sourceText: params.sourceText.substring(0, 1000), // Limit to 1000 chars
      correctedValue: params.correctedValue,
      notes: params.notes?.substring(0, 500), // Limit to 500 chars
      userConfidence: params.userConfidence,
      submittedAt: now,
      processed: false,
      metadata: params.metadata,
    };

    // Validate with Zod schema
    ClientFeedbackSchema.parse(feedback);

    // Verify temporary scrape exists
    const scrape = await getTemporaryScrape(params.sourceScrapeId);
    if (!scrape) {
      throw new TrainingManagerError(
        'Source scrape not found or already deleted',
        'SCRAPE_NOT_FOUND',
        404
      );
    }


    // Save feedback to database
    await db.collection(FEEDBACK_COLLECTION).doc(feedbackId).set({
      ...feedback,
      submittedAt: now, // Firestore Timestamp
    });

    // If feedback is positive (correct), flag scrape for deletion
    if (params.feedbackType === 'correct') {
      await flagScrapeForDeletion(params.sourceScrapeId);
      logger.info('Flagged scrape for deletion after positive feedback', {
        scrapeId: params.sourceScrapeId,
        organizationId: DEFAULT_ORG_ID,
      });
    }

    // Process feedback into training data (async, don't block)
    processFeedbackAsync(feedback).catch((error) => {
      logger.error('Failed to process feedback into training data', error instanceof Error ? error : new Error(String(error)), {
        feedbackId,
        organizationId: DEFAULT_ORG_ID,
      });
    });

    logger.info('Client feedback submitted', {
      feedbackId,
      organizationId: DEFAULT_ORG_ID,
      userId,
      feedbackType: params.feedbackType,
      signalId: params.signalId,
    });

    return feedback;
  } catch (error) {
    if (error instanceof TrainingManagerError) {
      throw error;
    }

    logger.error('Failed to submit feedback', error instanceof Error ? error : new Error(String(error)), {
      organizationId: DEFAULT_ORG_ID,
      userId,
    });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new TrainingManagerError(
      `Failed to submit feedback: ${errorMessage}`,
      'SUBMISSION_FAILED',
      500
    );
  }
}

/**
 * Process feedback into training data (background task)
 *
 * Extracts patterns from feedback and updates training data with Bayesian inference.
 *
 * @param feedback - The feedback to process
 */
async function processFeedbackAsync(feedback: ClientFeedback): Promise<void> {
  try {
    const { signalId, sourceText, feedbackType } = feedback;

    // Extract pattern from source text
    // For now, use the source text as the pattern
    // Later, this will use embeddings for semantic matching
    const pattern = sourceText.toLowerCase().trim();

    if (!pattern || pattern.length < 3) {
      // Skip very short patterns
      return;
    }

    // Look for existing training data with this pattern
    const existing = await db
      .collection(TRAINING_DATA_COLLECTION)
      .where('signalId', '==', signalId)
      .where('pattern', '==', pattern)
      .limit(1)
      .get();

    const isPositive = feedbackType === 'correct';
    const now = new Date();

    if (!existing.empty) {
      // Update existing training data
      const doc = existing.docs[0];
      const trainingData = toTrainingData(doc.data());

      // Bayesian update
      const updatedTrainingData = updateConfidenceScore(
        trainingData,
        isPositive
      );

      // Update in database with optimistic locking
      await db.runTransaction(async (transaction) => {
        const latest = await transaction.get(doc.ref);
        
        if (!latest.exists) {
          throw new Error('Training data deleted during update');
        }

        const latestData = toTrainingData(latest.data());

        // Check version for conflict detection
        if (latestData.version !== trainingData.version) {
          // Version conflict - re-apply Bayesian update on latest data
          const recomputedData = updateConfidenceScore(latestData, isPositive);
          
          transaction.update(doc.ref, {
            ...recomputedData,
            version: latestData.version + 1,
            lastUpdatedAt: now,
            lastSeenAt: now,
          });

          // Log history
          logTrainingHistory(transaction, {
            trainingDataId: doc.id,
            organizationId: '',
            userId: feedback.userId,
            changeType: 'updated',
            previousValue: latestData,
            newValue: recomputedData,
            reason: `Feedback: ${feedbackType}`,
          });
        } else {
          // No conflict - apply original update
          transaction.update(doc.ref, {
            ...updatedTrainingData,
            version: trainingData.version + 1,
            lastUpdatedAt: now,
            lastSeenAt: now,
          });

          // Log history
          logTrainingHistory(transaction, {
            trainingDataId: doc.id,
            organizationId: '',
            userId: feedback.userId,
            changeType: 'updated',
            previousValue: trainingData,
            newValue: updatedTrainingData,
            reason: `Feedback: ${feedbackType}`,
          });
        }
      });
    } else {
      // Create new training data
      const trainingDataId = db.collection(TRAINING_DATA_COLLECTION).doc().id;

      const newTrainingData: TrainingData = {
        id: trainingDataId,
        signalId,
        pattern,
        patternType: 'keyword',
        confidence: isPositive ? 75 : 25, // Initial confidence
        positiveCount: isPositive ? 1 : 0,
        negativeCount: isPositive ? 0 : 1,
        seenCount: 1,
        createdAt: now,
        lastUpdatedAt: now,
        lastSeenAt: now,
        version: 1,
        active: true,
        metadata: {
          industry: feedback.metadata?.industry,
          examples: [sourceText.substring(0, 200)],
        },
      };

      await db.collection(TRAINING_DATA_COLLECTION).doc(trainingDataId).set({
        ...newTrainingData,
        createdAt: now,
        lastUpdatedAt: now,
        lastSeenAt: now,
      });

      logger.info('Created new training data from feedback', {
        trainingDataId,
        signalId,
        pattern: pattern.substring(0, 50),
      });
    }

    // Mark feedback as processed
    await db.collection(FEEDBACK_COLLECTION).doc(feedback.id).update({
      processed: true,
      processedAt: now,
    });
  } catch (error) {
    logger.error('Error processing feedback', error instanceof Error ? error : new Error(String(error)), {
      feedbackId: feedback.id,
    });
    throw error;
  }
}

// ============================================================================
// BAYESIAN CONFIDENCE SCORING
// ============================================================================

/**
 * Update confidence score using Bayesian inference
 * 
 * Uses Beta distribution for Bayesian updating:
 * - Prior: Beta(α, β) where α = positive + 1, β = negative + 1
 * - Posterior mean: α / (α + β)
 * 
 * @param trainingData - Current training data
 * @param isPositive - Whether the new feedback is positive
 * @returns Updated training data with new confidence score
 */
function updateConfidenceScore(
  trainingData: TrainingData,
  isPositive: boolean
): TrainingData {
  const newPositiveCount = isPositive
    ? trainingData.positiveCount + 1
    : trainingData.positiveCount;
  const newNegativeCount = isPositive
    ? trainingData.negativeCount
    : trainingData.negativeCount + 1;
  const newSeenCount = trainingData.seenCount + 1;

  // Bayesian confidence using Beta distribution
  // Prior: Beta(α, β) where α = positive + 1, β = negative + 1
  const alpha = newPositiveCount + 1;
  const beta = newNegativeCount + 1;
  const posteriorMean = alpha / (alpha + beta);

  // Scale to 0-100
  const confidence = Math.round(posteriorMean * 100);

  return {
    ...trainingData,
    positiveCount: newPositiveCount,
    negativeCount: newNegativeCount,
    seenCount: newSeenCount,
    confidence,
  };
}

// ============================================================================
// TRAINING DATA CRUD
// ============================================================================

/**
 * Get training data for a signal
 *
 * @param signalId - Signal ID
 * @param activeOnly - Only return active patterns
 * @returns Array of training data
 */
export async function getTrainingData(
  signalId: string,
  activeOnly: boolean = true
): Promise<TrainingData[]> {
  try {
    let query = db
      .collection(TRAINING_DATA_COLLECTION)
      .where('signalId', '==', signalId);

    if (activeOnly) {
      query = query.where('active', '==', true);
    }

    const docs = await query.orderBy('confidence', 'desc').get();

    return docs.docs.map((doc) => toTrainingData(doc.data()));
  } catch (error) {
    logger.error('Failed to get training data', error instanceof Error ? error : new Error(String(error)), {
      organizationId: DEFAULT_ORG_ID,
      signalId,
    });
    throw new TrainingManagerError(
      'Failed to get training data',
      'FETCH_FAILED',
      500
    );
  }
}

/**
 * Get all training data for an organization
 *
 * @param activeOnly - Only return active patterns
 * @returns Array of training data
 */
export async function getAllTrainingData(
  activeOnly: boolean = true
): Promise<TrainingData[]> {
  try {
    const collectionRef = db.collection(TRAINING_DATA_COLLECTION);
    const baseQuery = activeOnly
      ? collectionRef.where('active', '==', true)
      : collectionRef;

    const docs = await baseQuery.orderBy('lastUpdatedAt', 'desc').get();

    return docs.docs.map((doc) => toTrainingData(doc.data()));
  } catch (error) {
    logger.error('Failed to get all training data', error instanceof Error ? error : new Error(String(error)), {
      organizationId: DEFAULT_ORG_ID,
    });
    throw new TrainingManagerError(
      'Failed to get all training data',
      'FETCH_FAILED',
      500
    );
  }
}

/**
 * Deactivate training data pattern
 *
 * Soft delete - keeps the data but marks it as inactive.
 *
 * @param trainingDataId - Training data ID
 * @param userId - User making the change
 * @param reason - Reason for deactivation
 */
export async function deactivateTrainingData(
  trainingDataId: string,
  userId: string,
  reason?: string
): Promise<void> {
  try {
    await db.runTransaction(async (transaction) => {
      const ref = db.collection(TRAINING_DATA_COLLECTION).doc(trainingDataId);
      const doc = await transaction.get(ref);

      if (!doc.exists) {
        throw new TrainingManagerError(
          'Training data not found',
          'NOT_FOUND',
          404
        );
      }

      const trainingData = toTrainingData(doc.data());

      const now = new Date();
      const updatedData = {
        ...trainingData,
        active: false,
        lastUpdatedAt: now,
        version: trainingData.version + 1,
      };

      transaction.update(ref, {
        active: false,
        lastUpdatedAt: now,
        version: trainingData.version + 1,
      });

      // Log history
      logTrainingHistory(transaction, {
        trainingDataId,
        organizationId: DEFAULT_ORG_ID,
        userId,
        changeType: 'deactivated',
        previousValue: trainingData,
        newValue: updatedData,
        reason,
      });
    });

    logger.info('Deactivated training data', {
      trainingDataId,
      organizationId: DEFAULT_ORG_ID,
      userId,
    });
  } catch (error) {
    if (error instanceof TrainingManagerError) {
      throw error;
    }

    logger.error('Failed to deactivate training data', error instanceof Error ? error : new Error(String(error)), {
      trainingDataId,
      organizationId: DEFAULT_ORG_ID,
    });
    throw new TrainingManagerError(
      'Failed to deactivate training data',
      'DEACTIVATION_FAILED',
      500
    );
  }
}

/**
 * Activate training data pattern
 *
 * Re-enables a previously deactivated pattern.
 *
 * @param trainingDataId - Training data ID
 * @param userId - User making the change
 * @param reason - Reason for activation
 */
export async function activateTrainingData(
  trainingDataId: string,
  userId: string,
  reason?: string
): Promise<void> {
  try {
    await db.runTransaction(async (transaction) => {
      const ref = db.collection(TRAINING_DATA_COLLECTION).doc(trainingDataId);
      const doc = await transaction.get(ref);

      if (!doc.exists) {
        throw new TrainingManagerError(
          'Training data not found',
          'NOT_FOUND',
          404
        );
      }

      const trainingData = toTrainingData(doc.data());

      const now = new Date();
      const updatedData = {
        ...trainingData,
        active: true,
        lastUpdatedAt: now,
        version: trainingData.version + 1,
      };

      transaction.update(ref, {
        active: true,
        lastUpdatedAt: now,
        version: trainingData.version + 1,
      });

      // Log history
      logTrainingHistory(transaction, {
        trainingDataId,
        organizationId: DEFAULT_ORG_ID,
        userId,
        changeType: 'activated',
        previousValue: trainingData,
        newValue: updatedData,
        reason,
      });
    });

    logger.info('Activated training data', {
      trainingDataId,
      organizationId: DEFAULT_ORG_ID,
      userId,
    });
  } catch (error) {
    if (error instanceof TrainingManagerError) {
      throw error;
    }

    logger.error('Failed to activate training data', error instanceof Error ? error : new Error(String(error)), {
      trainingDataId,
      organizationId: DEFAULT_ORG_ID,
    });
    throw new TrainingManagerError(
      'Failed to activate training data',
      'ACTIVATION_FAILED',
      500
    );
  }
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

/**
 * Log training history for audit trail
 *
 * Creates a history record within a transaction.
 *
 * @param transaction - Firestore transaction
 * @param params - History parameters
 */
function logTrainingHistory(
  transaction: FirebaseFirestore.Transaction,
  params: {
    trainingDataId: string;
    organizationId: string;
    userId: string;
    changeType: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated';
    previousValue?: TrainingData;
    newValue?: TrainingData;
    reason?: string;
  }
): void {
  const historyId = db.collection(TRAINING_HISTORY_COLLECTION).doc().id;
  const now = new Date();

  const history: TrainingHistory = {
    id: historyId,
    trainingDataId: params.trainingDataId,
    userId: params.userId,
    changeType: params.changeType,
    previousValue: params.previousValue,
    newValue: params.newValue,
    reason: params.reason,
    changedAt: now,
    version:params.newValue?.version ?? params.previousValue?.version ?? 1,
  };

  const ref = db.collection(TRAINING_HISTORY_COLLECTION).doc(historyId);
  transaction.set(ref, {
    ...history,
    changedAt: now,
  });
}

/**
 * Get training history for a pattern
 *
 * @param trainingDataId - Training data ID
 * @returns Array of history entries
 */
export async function getTrainingHistory(
  trainingDataId: string
): Promise<TrainingHistory[]> {
  try {
    const docs = await db
      .collection(TRAINING_HISTORY_COLLECTION)
      .where('trainingDataId', '==', trainingDataId)
      .orderBy('changedAt', 'desc')
      .get();

    return docs.docs.map((doc) => {
      const raw = doc.data();
      return {
        ...raw,
        changedAt: toDate(raw.changedAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
        previousValue: raw.previousValue ? toTrainingData(raw.previousValue as FirebaseFirestore.DocumentData) : undefined,
        newValue: raw.newValue ? toTrainingData(raw.newValue as FirebaseFirestore.DocumentData) : undefined,
      } as TrainingHistory;
    });
  } catch (error) {
    logger.error('Failed to get training history', error instanceof Error ? error : new Error(String(error)), {
      trainingDataId,
      organizationId: DEFAULT_ORG_ID,
    });
    throw new TrainingManagerError(
      'Failed to get training history',
      'FETCH_FAILED',
      500
    );
  }
}

/**
 * Rollback training data to a previous version
 *
 * @param trainingDataId - Training data ID
 * @param targetVersion - Version to rollback to
 * @param userId - User making the change
 * @param reason - Reason for rollback
 */
export async function rollbackTrainingData(
  trainingDataId: string,
  targetVersion: number,
  userId: string,
  reason?: string
): Promise<void> {
  try {
    // Get history for target version
    const historyDocs = await db
      .collection(TRAINING_HISTORY_COLLECTION)
      .where('trainingDataId', '==', trainingDataId)
      .where('version', '==', targetVersion)
      .limit(1)
      .get();

    if (historyDocs.empty) {
      throw new TrainingManagerError(
        `Version ${targetVersion} not found in history`,
        'VERSION_NOT_FOUND',
        404
      );
    }

    const historyData = historyDocs.docs[0].data() as TrainingHistory;
    const targetData = historyData.newValue;

    if (!targetData) {
      throw new TrainingManagerError(
        'Target version data not available',
        'DATA_NOT_AVAILABLE',
        400
      );
    }

    await db.runTransaction(async (transaction) => {
      const ref = db.collection(TRAINING_DATA_COLLECTION).doc(trainingDataId);
      const doc = await transaction.get(ref);

      if (!doc.exists) {
        throw new TrainingManagerError(
          'Training data not found',
          'NOT_FOUND',
          404
        );
      }

      const currentData = toTrainingData(doc.data());

      const now = new Date();
      const rolledBackData = {
        ...targetData,
        lastUpdatedAt: now,
        version: currentData.version + 1, // Increment version for rollback
      };

      transaction.update(ref, {
        ...rolledBackData,
        lastUpdatedAt: now,
      });

      // Log history
      logTrainingHistory(transaction, {
        trainingDataId,
        organizationId: DEFAULT_ORG_ID,
        userId,
        changeType: 'updated',
        previousValue: currentData,
        newValue: rolledBackData,
        reason:(reason !== '' && reason != null) ? reason : `Rollback to version ${targetVersion}`,
      });
    });

    logger.info('Rolled back training data', {
      trainingDataId,
      targetVersion,
      organizationId: DEFAULT_ORG_ID,
      userId,
    });
  } catch (error) {
    if (error instanceof TrainingManagerError) {
      throw error;
    }

    logger.error('Failed to rollback training data', error instanceof Error ? error : new Error(String(error)), {
      trainingDataId,
      targetVersion,
      organizationId: DEFAULT_ORG_ID,
    });
    throw new TrainingManagerError(
      'Failed to rollback training data',
      'ROLLBACK_FAILED',
      500
    );
  }
}

// ============================================================================
// FEEDBACK QUERIES
// ============================================================================

/**
 * Get feedback for a scrape
 *
 * @param sourceScrapeId - Scrape ID
 * @returns Array of feedback
 */
export async function getFeedbackForScrape(
  sourceScrapeId: string
): Promise<ClientFeedback[]> {
  try {
    const docs = await db
      .collection(FEEDBACK_COLLECTION)
      .where('sourceScrapeId', '==', sourceScrapeId)
      .orderBy('submittedAt', 'desc')
      .get();

    return docs.docs.map((doc) => {
      const raw = doc.data();
      return {
        ...raw,
        submittedAt: toDate(raw.submittedAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
        processedAt: raw.processedAt ? toDate(raw.processedAt as Date | FirestoreTimestamp | { seconds: number } | string | number) : undefined,
      } as ClientFeedback;
    });
  } catch (error) {
    logger.error('Failed to get feedback for scrape', error instanceof Error ? error : new Error(String(error)), {
      sourceScrapeId,
      organizationId: DEFAULT_ORG_ID,
    });
    throw new TrainingManagerError(
      'Failed to get feedback',
      'FETCH_FAILED',
      500
    );
  }
}

/**
 * Get unprocessed feedback for background processing
 *
 * @param limit - Max number of feedback to fetch
 * @returns Array of unprocessed feedback
 */
export async function getUnprocessedFeedback(
  limit: number = 100
): Promise<ClientFeedback[]> {
  try {
    const docs = await db
      .collection(FEEDBACK_COLLECTION)
      .where('processed', '==', false)
      .orderBy('submittedAt', 'asc')
      .limit(limit)
      .get();

    return docs.docs.map((doc) => {
      const raw = doc.data();
      return {
        ...raw,
        submittedAt: toDate(raw.submittedAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
        processedAt: raw.processedAt ? toDate(raw.processedAt as Date | FirestoreTimestamp | { seconds: number } | string | number) : undefined,
      } as ClientFeedback;
    });
  } catch (error) {
    logger.error('Failed to get unprocessed feedback', error instanceof Error ? error : new Error(String(error)), {
      organizationId: DEFAULT_ORG_ID,
    });
    throw new TrainingManagerError(
      'Failed to get unprocessed feedback',
      'FETCH_FAILED',
      500
    );
  }
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get training analytics for an organization
 *
 * @returns Analytics object
 */
export async function getTrainingAnalytics(): Promise<{
  totalFeedback: number;
  processedFeedback: number;
  unprocessedFeedback: number;
  totalPatterns: number;
  activePatterns: number;
  averageConfidence: number;
  feedbackByType: Record<FeedbackType, number>;
}> {
  try {
    // Get feedback stats
    const feedbackDocs = await db
      .collection(FEEDBACK_COLLECTION)
      .get();

    const totalFeedback = feedbackDocs.size;
    const processedFeedback = feedbackDocs.docs.filter(
      (doc) => doc.data().processed === true
    ).length;
    const unprocessedFeedback = totalFeedback - processedFeedback;

    const feedbackByType: Record<string, number> = {
      correct: 0,
      incorrect: 0,
      missing: 0,
      false_positive: 0,
      low_confidence: 0,
    };

    feedbackDocs.docs.forEach((doc) => {
      const docData = doc.data();
      const type = docData.feedbackType as string;
      feedbackByType[type] = (feedbackByType[type] || 0) + 1;
    });

    // Get training data stats
    const trainingDocs = await db
      .collection(TRAINING_DATA_COLLECTION)
      .get();

    const totalPatterns = trainingDocs.size;
    const activePatterns = trainingDocs.docs.filter(
      (doc) => doc.data().active === true
    ).length;

    const confidenceSum = trainingDocs.docs.reduce(
      (sum, doc) => {
        const docData = doc.data();
        return sum + ((docData.confidence as number | undefined) ?? 0);
      },
      0
    );
    const averageConfidence =
      totalPatterns > 0 ? Math.round(confidenceSum / totalPatterns) : 0;

    return {
      totalFeedback,
      processedFeedback,
      unprocessedFeedback,
      totalPatterns,
      activePatterns,
      averageConfidence,
      feedbackByType: feedbackByType as Record<FeedbackType, number>,
    };
  } catch (error) {
    logger.error('Failed to get training analytics', error instanceof Error ? error : new Error(String(error)), {
      organizationId: DEFAULT_ORG_ID,
    });
    throw new TrainingManagerError(
      'Failed to get training analytics',
      'FETCH_FAILED',
      500
    );
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Firestore Timestamp interface
 */
interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}

/**
 * Convert Firestore data to TrainingData type
 */
function toTrainingData(data: FirebaseFirestore.DocumentData | undefined): TrainingData {
  if (!data) {
    throw new Error('Invalid training data');
  }

  return {
    ...data,
    createdAt: toDate(data.createdAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
    lastUpdatedAt: toDate(data.lastUpdatedAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
    lastSeenAt: toDate(data.lastSeenAt as Date | FirestoreTimestamp | { seconds: number } | string | number),
  } as TrainingData;
}

/**
 * Convert Firestore Timestamp to JavaScript Date
 */
function toDate(timestamp: Date | FirestoreTimestamp | { seconds: number } | string | number): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp && typeof (timestamp as FirestoreTimestamp).toDate === 'function') {
    return (timestamp as FirestoreTimestamp).toDate();
  }
  if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}

/**
 * Reset rate limiter (for testing)
 */
export function resetRateLimiter(): void {
  feedbackRateLimiter.clear();
}
