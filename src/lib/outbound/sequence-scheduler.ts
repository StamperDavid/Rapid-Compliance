/**
 * Sequence Scheduler
 * Cron job that processes sequences and sends scheduled emails
 * Should run every hour via Cloud Scheduler or similar
 */

import { SequenceEngine } from './sequence-engine';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { ProspectEnrollment } from '@/types/outbound-sequence'
import { logger } from '@/lib/logger/logger';

// Base Firestore collection path for platform sub-collections
const platformPath = `organizations/${PLATFORM_ID}`;

/**
 * Process all due sequence steps
 * Called by cron job every hour
 */
export async function processSequences(): Promise<{
  processed: number;
  errors: number;
}> {
  logger.info('[Sequence Scheduler] Starting sequence processing...', { file: 'sequence-scheduler.ts' });

  let processed = 0;
  let errors = 0;

  try {
    // Get all active enrollments (single-tenant — one organization)
    const enrollments = await getActiveEnrollments();

    for (const enrollment of enrollments) {
      try {
        // Check if this enrollment is due for next step
        if (enrollment.nextStepAt) {
          const nextStepTime = new Date(enrollment.nextStepAt);
          const now = new Date();

          if (now >= nextStepTime) {
            // Process next step
            await SequenceEngine.processNextStep(enrollment.id);
            processed++;
          }
        }
      } catch (error) {
        logger.error(`[Sequence Scheduler] Error processing enrollment ${enrollment.id}:`, error instanceof Error ? error : undefined, { file: 'sequence-scheduler.ts' });
        errors++;
      }
    }

    logger.info(`[Sequence Scheduler] Completed. Processed: ${processed}, Errors: ${errors}`, { file: 'sequence-scheduler.ts' });

    return { processed, errors };
  } catch (error) {
    logger.error('[Sequence Scheduler] Fatal error:', error instanceof Error ? error : undefined, { file: 'sequence-scheduler.ts' });
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Get all active enrollments
 */
async function getActiveEnrollments(): Promise<ProspectEnrollment[]> {
  try {
    if (!adminDb) {
      logger.error('[Sequence Scheduler] adminDb is not initialized', undefined, { file: 'sequence-scheduler.ts' });
      return [];
    }

    const snapshot = await adminDb
      .collection(`${platformPath}/enrollments`)
      .where('status', '==', 'active')
      .get();

    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as ProspectEnrollment[];
  } catch (error) {
    logger.error('[Sequence Scheduler] Error getting enrollments:', error instanceof Error ? error : undefined, { file: 'sequence-scheduler.ts' });
    return [];
  }
}

/**
 * Handle email bounce (called by webhook)
 */
export async function handleEmailBounce(
  enrollmentId: string,
  stepId: string,
  reason?: string
): Promise<void> {
  logger.info('Sequence Scheduler Handling bounce for enrollment', {
    enrollmentId,
    reason:(reason !== '' && reason != null) ? reason : 'unknown',
    file: 'sequence-scheduler.ts'
  });

  if (!adminDb) {
    logger.error('[Sequence Scheduler] adminDb is not initialized', undefined, { file: 'sequence-scheduler.ts' });
    return;
  }

  // Get enrollment
  const docSnap = await adminDb
    .collection(`${platformPath}/enrollments`)
    .doc(enrollmentId)
    .get();

  if (!docSnap.exists) {return;}

  const enrollment = { id: docSnap.id, ...docSnap.data() } as ProspectEnrollment;

  // Find step action
  const action = enrollment.stepActions.find(a => a.stepId === stepId);
  if (action) {
    action.status = 'bounced';
    action.bouncedAt = new Date().toISOString();
    action.bounceReason =(reason !== '' && reason != null) ? reason : 'unknown';
    action.updatedAt = new Date().toISOString();
  }

  // Determine unenroll reason based on bounce type
  let unenrollReason: 'manual' | 'replied' | 'converted' | 'unsubscribed' | 'bounced' = 'bounced';
  if (reason === 'spam_report' || reason === 'unsubscribed') {
    unenrollReason = 'unsubscribed';
  }

  // Unenroll from sequence
  await SequenceEngine['unenrollProspect'](
    enrollment.prospectId,
    enrollment.sequenceId,
    unenrollReason
  );
}

/**
 * Handle email reply (called by webhook)
 */
export async function handleEmailReply(
  enrollmentId: string,
  stepId: string,
  _replyContent: string
): Promise<void> {
  logger.info('Sequence Scheduler Handling reply for enrollment enrollmentId}', { file: 'sequence-scheduler.ts' });

  if (!adminDb) {
    logger.error('[Sequence Scheduler] adminDb is not initialized', undefined, { file: 'sequence-scheduler.ts' });
    return;
  }

  // Get enrollment
  const enrollmentSnap = await adminDb
    .collection(`${platformPath}/enrollments`)
    .doc(enrollmentId)
    .get();

  if (!enrollmentSnap.exists) {return;}

  const enrollment = { id: enrollmentSnap.id, ...enrollmentSnap.data() } as ProspectEnrollment;

  // Find step action
  const action = enrollment.stepActions.find(a => a.stepId === stepId);
  if (action) {
    action.status = 'replied';
    action.repliedAt = new Date().toISOString();
    action.updatedAt = new Date().toISOString();
  }

  interface SequenceDoc {
    stopOnResponse?: boolean;
  }

  // Get sequence
  const sequenceSnap = await adminDb
    .collection(`${platformPath}/sequences`)
    .doc(enrollment.sequenceId)
    .get();

  const sequence = sequenceSnap.exists
    ? (sequenceSnap.data() as SequenceDoc)
    : null;

  // If sequence is set to stop on response, pause enrollment
  if (sequence?.stopOnResponse) {
    enrollment.status = 'paused';
    enrollment.pausedAt = new Date().toISOString();
    enrollment.outcome = 'replied';
    enrollment.outcomeDate = new Date().toISOString();
  }

  enrollment.updatedAt = new Date().toISOString();

  await adminDb
    .collection(`${platformPath}/enrollments`)
    .doc(enrollmentId)
    .set(enrollment);
}

/**
 * Handle email open (called by webhook)
 */
export async function handleEmailOpen(
  enrollmentId: string,
  stepId: string
): Promise<void> {
  if (!adminDb) {
    logger.error('[Sequence Scheduler] adminDb is not initialized', undefined, { file: 'sequence-scheduler.ts' });
    return;
  }

  const docSnap = await adminDb
    .collection(`${platformPath}/enrollments`)
    .doc(enrollmentId)
    .get();

  if (!docSnap.exists) {return;}

  const enrollment = { id: docSnap.id, ...docSnap.data() } as ProspectEnrollment;

  const action = enrollment.stepActions.find(a => a.stepId === stepId);
  if (action && !action.openedAt) {
    action.status = 'opened';
    action.openedAt = new Date().toISOString();
    action.firstOpenedAt =action.firstOpenedAt ?? new Date().toISOString();
    action.updatedAt = new Date().toISOString();

    await adminDb
      .collection(`${platformPath}/enrollments`)
      .doc(enrollmentId)
      .set(enrollment);
  }
}

/**
 * Handle email click (called by webhook)
 */
export async function handleEmailClick(
  enrollmentId: string,
  stepId: string
): Promise<void> {
  if (!adminDb) {
    logger.error('[Sequence Scheduler] adminDb is not initialized', undefined, { file: 'sequence-scheduler.ts' });
    return;
  }

  const docSnap = await adminDb
    .collection(`${platformPath}/enrollments`)
    .doc(enrollmentId)
    .get();

  if (!docSnap.exists) {return;}

  const enrollment = { id: docSnap.id, ...docSnap.data() } as ProspectEnrollment;

  const action = enrollment.stepActions.find(a => a.stepId === stepId);
  if (action && !action.clickedAt) {
    action.status = 'clicked';
    action.clickedAt = new Date().toISOString();
    action.updatedAt = new Date().toISOString();

    await adminDb
      .collection(`${platformPath}/enrollments`)
      .doc(enrollmentId)
      .set(enrollment);
  }
}
