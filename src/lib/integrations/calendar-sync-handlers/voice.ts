/**
 * Calendar two-way sync — voice call handler.
 *
 * For voice calls (refId = `voice-call-{callId}`):
 *   - Cancel = flip the scheduled-call doc's status from 'scheduled' to
 *     'cancelled'. Mirrors the soft-cancel logic in
 *     `/api/voice/calls/schedule/[id]` DELETE.
 *   - Reschedule = update the doc's `scheduledFor` field. Only
 *     'scheduled' calls can be moved.
 *
 * Field names follow `types/scheduled-call.ts` / the schedule-call
 * routes — `scheduledFor`, NOT `scheduledAt`.
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getScheduledCallsCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { ScheduledCall } from '@/types/scheduled-call';

const FILE = 'calendar-sync-handlers/voice.ts';

/**
 * Cancel a scheduled voice call.
 */
export async function cancelVoiceCall(
  callId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const path = getScheduledCallsCollection();
    const existing = await AdminFirestoreService.get<ScheduledCall>(path, callId);
    if (!existing) {
      return { success: false, error: `Scheduled call ${callId} not found` };
    }
    if (existing.status !== 'scheduled') {
      if (existing.status === 'cancelled') {
        return { success: true };
      }
      return {
        success: false,
        error: `Cannot cancel call in status "${existing.status}"`,
      };
    }

    const nowIso = new Date().toISOString();
    await AdminFirestoreService.update(path, callId, {
      status: 'cancelled',
      cancelReason: 'Cancelled via Google Calendar',
      cancelledAt: nowIso,
      cancelledVia: 'google-calendar-sync',
    });

    logger.info('[calendar-sync-voice] Cancelled', { callId, file: FILE });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-voice] cancelVoiceCall failed',
      err instanceof Error ? err : new Error(message),
      { callId, file: FILE },
    );
    return { success: false, error: message };
  }
}

/**
 * Reschedule a scheduled voice call.
 */
export async function rescheduleVoiceCall(
  callId: string,
  newStart: Date,
): Promise<{ success: boolean; error?: string }> {
  try {
    const path = getScheduledCallsCollection();
    const existing = await AdminFirestoreService.get<ScheduledCall>(path, callId);
    if (!existing) {
      return { success: false, error: `Scheduled call ${callId} not found` };
    }
    if (existing.status !== 'scheduled') {
      return {
        success: false,
        error: `Cannot reschedule call in status "${existing.status}"`,
      };
    }
    if (newStart.getTime() <= Date.now()) {
      return { success: false, error: 'New scheduledFor must be in the future' };
    }

    const nowIso = new Date().toISOString();
    await AdminFirestoreService.update(path, callId, {
      scheduledFor: newStart.toISOString(),
      updatedAt: nowIso,
      rescheduledVia: 'google-calendar-sync',
    });

    logger.info('[calendar-sync-voice] Rescheduled', {
      callId,
      newScheduledFor: newStart.toISOString(),
      file: FILE,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-voice] rescheduleVoiceCall failed',
      err instanceof Error ? err : new Error(message),
      { callId, file: FILE },
    );
    return { success: false, error: message };
  }
}
