/**
 * Calendar two-way sync — workflow action handler.
 *
 * For workflow actions (refId = `workflow-action-{waitId}`):
 *   - Cancel = flip the matching `workflowWaits` doc's status from
 *     'waiting' to 'cancelled' so the wait-resume cron skips it.
 *   - Reschedule = update the wait's `resumeAt` (delay waits) or
 *     `expiresAt` (until waits) to the new operator-chosen time.
 *
 * Field names follow the producer in `lib/workflow/workflow-engine.ts`'s
 * `executeWaitAction`. Spec mentioned `scheduledAt` but the real field
 * is `resumeAt` (for delay waits) — using actual schema.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

const FILE = 'calendar-sync-handlers/workflow.ts';
const COLLECTION = 'workflowWaits';

interface WorkflowWaitDoc {
  id?: string;
  workflowId?: string;
  status?: 'waiting' | 'resumed' | 'cancelled' | 'expired';
  waitType?: 'delay' | 'until';
  resumeAt?: string;
  expiresAt?: string | null;
}

/**
 * Cancel a pending workflow action (wait).
 */
export async function cancelWorkflowAction(
  actionId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Firestore admin not initialized' };
  }
  try {
    const ref = adminDb.collection(getSubCollection(COLLECTION)).doc(actionId);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: `Workflow wait ${actionId} not found` };
    }
    const wait = snap.data() as WorkflowWaitDoc;
    if (wait.status !== 'waiting') {
      if (wait.status === 'cancelled') {
        return { success: true };
      }
      return {
        success: false,
        error: `Cannot cancel workflow action in status "${wait.status ?? 'unknown'}"`,
      };
    }

    await ref.update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledVia: 'google-calendar-sync',
    });

    logger.info('[calendar-sync-workflow] Cancelled', { actionId, file: FILE });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-workflow] cancelWorkflowAction failed',
      err instanceof Error ? err : new Error(message),
      { actionId, file: FILE },
    );
    return { success: false, error: message };
  }
}

/**
 * Reschedule a pending workflow action — moves resumeAt (delay waits)
 * or expiresAt (until waits).
 */
export async function rescheduleWorkflowAction(
  actionId: string,
  newStart: Date,
): Promise<{ success: boolean; error?: string }> {
  if (!adminDb) {
    return { success: false, error: 'Firestore admin not initialized' };
  }
  try {
    const ref = adminDb.collection(getSubCollection(COLLECTION)).doc(actionId);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: `Workflow wait ${actionId} not found` };
    }
    const wait = snap.data() as WorkflowWaitDoc;
    if (wait.status !== 'waiting') {
      return {
        success: false,
        error: `Cannot reschedule workflow action in status "${wait.status ?? 'unknown'}"`,
      };
    }

    const nowIso = new Date().toISOString();
    const updates: Record<string, unknown> = {
      updatedAt: nowIso,
      rescheduledVia: 'google-calendar-sync',
    };
    if (wait.waitType === 'until') {
      updates.expiresAt = newStart.toISOString();
    } else {
      // Delay wait — resumeAt drives the cron.
      updates.resumeAt = newStart.toISOString();
    }

    await ref.update(updates);

    logger.info('[calendar-sync-workflow] Rescheduled', {
      actionId,
      waitType: wait.waitType,
      newStart: newStart.toISOString(),
      file: FILE,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-workflow] rescheduleWorkflowAction failed',
      err instanceof Error ? err : new Error(message),
      { actionId, file: FILE },
    );
    return { success: false, error: message };
  }
}
