/**
 * Calendar two-way sync — meeting handler.
 *
 * For meetings (refId = `meeting-{bookingId}`):
 *   - Cancel = cancel the Zoom meeting + flip the booking doc's status to
 *     'cancelled'. The Google Calendar event has already been deleted by
 *     the operator on Google's side (that's how this handler got invoked),
 *     so we explicitly do NOT call deleteSalesVelocityCalendarEvent here.
 *   - Reschedule = patch the Zoom meeting's start_time + duration in place
 *     (preserves the join link) + update the booking doc's startTime /
 *     endTime / duration fields. The Google Calendar event was already
 *     moved by the operator — we don't re-upsert it.
 *
 * Mirrors the same logic that `/api/meetings/[meetingId]/cancel` and
 * `/api/meetings/[meetingId]` PATCH use, minus the calendar-event
 * delete/upsert step (already done operator-side).
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { cancelZoomMeeting, updateZoomMeeting } from '@/lib/integrations/zoom';
import { logger } from '@/lib/logger/logger';

interface BookingDoc {
  id?: string;
  status?: string;
  zoomMeetingId?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
}

const FILE = 'calendar-sync-handlers/meeting.ts';

/**
 * Cancel a meeting because the operator deleted its Google Calendar event.
 */
export async function cancelMeeting(
  bookingId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const bookingsPath = getSubCollection('bookings');
    const existing = await AdminFirestoreService.get<BookingDoc>(bookingsPath, bookingId);
    if (!existing) {
      return { success: false, error: `Booking ${bookingId} not found` };
    }

    if (existing.status === 'cancelled') {
      // Already cancelled — idempotent success.
      return { success: true };
    }

    // Cancel the Zoom meeting if one exists. Treat "already gone" as success.
    if (existing.zoomMeetingId) {
      try {
        await cancelZoomMeeting(existing.zoomMeetingId);
      } catch (zoomError) {
        const message = zoomError instanceof Error ? zoomError.message : String(zoomError);
        const alreadyGone = /does not exist|not found|3001|3000/i.test(message);
        if (!alreadyGone) {
          logger.error(
            '[calendar-sync-meeting] Zoom cancel failed',
            zoomError instanceof Error ? zoomError : new Error(message),
            { bookingId, file: FILE },
          );
          return { success: false, error: `Zoom cancel failed: ${message}` };
        }
        logger.info('[calendar-sync-meeting] Zoom meeting already gone — treated as success', {
          bookingId,
          zoomMessage: message,
          file: FILE,
        });
      }
    }

    await AdminFirestoreService.set(
      bookingsPath,
      bookingId,
      {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledVia: 'google-calendar-sync',
      },
      true,
    );

    logger.info('[calendar-sync-meeting] Cancelled', { bookingId, file: FILE });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-meeting] cancelMeeting failed',
      err instanceof Error ? err : new Error(message),
      { bookingId, file: FILE },
    );
    return { success: false, error: message };
  }
}

/**
 * Reschedule a meeting because the operator moved its Google Calendar event.
 */
export async function rescheduleMeeting(
  bookingId: string,
  newStart: Date,
  newEnd: Date,
): Promise<{ success: boolean; error?: string }> {
  try {
    const bookingsPath = getSubCollection('bookings');
    const existing = await AdminFirestoreService.get<BookingDoc>(bookingsPath, bookingId);
    if (!existing) {
      return { success: false, error: `Booking ${bookingId} not found` };
    }

    const newDurationMinutes = Math.max(
      1,
      Math.round((newEnd.getTime() - newStart.getTime()) / (60 * 1000)),
    );

    // Update the Zoom meeting in place. PATCH preserves the join URL,
    // so the recipient's existing invite is still valid at the new time.
    if (existing.zoomMeetingId) {
      try {
        await updateZoomMeeting(existing.zoomMeetingId, {
          startTime: newStart,
          duration: newDurationMinutes,
        });
      } catch (zoomError) {
        const message = zoomError instanceof Error ? zoomError.message : String(zoomError);
        logger.error(
          '[calendar-sync-meeting] Zoom reschedule failed',
          zoomError instanceof Error ? zoomError : new Error(message),
          { bookingId, file: FILE },
        );
        return { success: false, error: `Zoom reschedule failed: ${message}` };
      }
    }

    await AdminFirestoreService.set(
      bookingsPath,
      bookingId,
      {
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        duration: newDurationMinutes,
        rescheduledAt: new Date().toISOString(),
        rescheduledVia: 'google-calendar-sync',
      },
      true,
    );

    logger.info('[calendar-sync-meeting] Rescheduled', {
      bookingId,
      newStart: newStart.toISOString(),
      newEnd: newEnd.toISOString(),
      file: FILE,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[calendar-sync-meeting] rescheduleMeeting failed',
      err instanceof Error ? err : new Error(message),
      { bookingId, file: FILE },
    );
    return { success: false, error: message };
  }
}
