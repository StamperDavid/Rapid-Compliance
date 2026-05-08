/**
 * Calendar two-way sync — email send handler.
 *
 * For email sends (refId = `email-send-{sendId}`):
 *   - Cancel = flip the workflowSequenceJobs doc's status to 'cancelled'
 *     so the cron dispatcher skips it on the next tick.
 *   - Reschedule = update the job's `fireAt` field (spec mentioned
 *     `nextRunAt`, but the real schema uses `fireAt`; see
 *     `lib/workflows/sequence-scheduler.ts`).
 *
 * Only `pending` jobs are eligible for cancel/reschedule. Once a job has
 * `fired`, `failed`, `cancelled`, or `skipped` it's terminal and editing
 * its calendar event has no operational effect.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { WorkflowSequenceJob } from '@/types/workflow';

const FILE = 'calendar-sync-handlers/email.ts';
const COLLECTION = 'workflowSequenceJobs';

/**
 * Cancel a pending sequence-job (single email send).
 */
export async function cancelEmail(
  sendId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Firestore admin not initialized' };
  }
  try {
    const collectionPath = getSubCollection(COLLECTION);
    const ref = adminDb.collection(collectionPath).doc(sendId);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: `Sequence job ${sendId} not found` };
    }
    const job = snap.data() as WorkflowSequenceJob;
    if (job.status !== 'pending') {
      // Idempotent for already-cancelled; otherwise honest error.
      if (job.status === 'cancelled') {
        return { success: true };
      }
      return {
        success: false,
        error: `Cannot cancel sequence job in status "${job.status}"`,
      };
    }

    await ref.update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      cancelledVia: 'google-calendar-sync',
    });

    logger.info('[calendar-sync-email] Cancelled', { sendId, file: FILE });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-email] cancelEmail failed',
      err instanceof Error ? err : new Error(message),
      { sendId, file: FILE },
    );
    return { success: false, error: message };
  }
}

/**
 * Reschedule a pending sequence-job by moving its `fireAt` timestamp.
 */
export async function rescheduleEmail(
  sendId: string,
  newStart: Date,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Firestore admin not initialized' };
  }
  try {
    const collectionPath = getSubCollection(COLLECTION);
    const ref = adminDb.collection(collectionPath).doc(sendId);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: `Sequence job ${sendId} not found` };
    }
    const job = snap.data() as WorkflowSequenceJob;
    if (job.status !== 'pending') {
      return {
        success: false,
        error: `Cannot reschedule sequence job in status "${job.status}"`,
      };
    }

    await ref.update({
      fireAt: newStart.toISOString(),
      updatedAt: new Date().toISOString(),
      rescheduledVia: 'google-calendar-sync',
    });

    logger.info('[calendar-sync-email] Rescheduled', {
      sendId,
      newFireAt: newStart.toISOString(),
      file: FILE,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-email] rescheduleEmail failed',
      err instanceof Error ? err : new Error(message),
      { sendId, file: FILE },
    );
    return { success: false, error: message };
  }
}
