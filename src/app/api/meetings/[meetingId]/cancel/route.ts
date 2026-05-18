/**
 * POST /api/meetings/[meetingId]/cancel
 *
 * Cancels a booking. Default behavior: tries to cancel the Zoom meeting AND
 * delete the corresponding Google Calendar event AND mark Firestore
 * status='cancelled'. If EITHER external service fails, the route returns
 * 502 with the underlying error so the operator's UI can show the truth
 * instead of pretending the cancel succeeded.
 *
 * `?force=true` query param OR `{ forceLocal: true }` request body lets
 * the operator override — Firestore is flipped to cancelled even when the
 * external services error. Use this only when the operator has independently
 * confirmed the meeting is gone (or unreachable) and wants the local record
 * to reflect that. Logged loudly for audit.
 *
 * Rationale: the previous "best-effort, Firestore is source of truth"
 * pattern was a silent fake-success that misled the operator into thinking
 * a cancel had completed when the Zoom meeting was still scheduled and the
 * customer still got reminders.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { deleteSalesVelocityCalendarEvent } from '@/lib/integrations/google-calendar-service';
import { logger } from '@/lib/logger/logger';

interface BookingDoc {
  id?: string;
  status?: string;
  zoomMeetingId?: string;
  /**
   * Persisted by the booking route's calendar-event creation step so we
   * can find and delete the event on cancel. New as of May 4 2026 — older
   * booking docs may not have this field.
   */
  googleCalendarEventId?: string;
  googleCalendarId?: string; // typically 'primary' for the legacy path
}

interface CancelBody {
  forceLocal?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { meetingId } = await params;
    if (!meetingId) {
      return NextResponse.json({ success: false, error: 'meetingId required' }, { status: 400 });
    }

    // Resolve the operator's force-cancel intent from either query param
    // or body. Default false — silent fake-success is no longer the norm.
    const url = new URL(request.url);
    const forceFromQuery = url.searchParams.get('force') === 'true';
    let forceFromBody = false;
    try {
      const body = (await request.json().catch(() => ({}))) as CancelBody;
      forceFromBody = body.forceLocal === true;
    } catch {
      // No body / not JSON — fine.
    }
    const forceLocal = forceFromQuery || forceFromBody;

    const bookingsPath = getSubCollection('bookings');
    const existing = await AdminFirestoreService.get<BookingDoc>(bookingsPath, meetingId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
    }

    // Track external-service failures so we can decide whether to flip
    // Firestore status (only when forceLocal=true) or refuse and surface
    // the error to the UI.
    const externalErrors: Array<{ service: 'zoom' | 'google-calendar'; message: string }> = [];

    // 1. Cancel the Zoom meeting if there is one. Real failure (not
    //    silent-eat) so the operator sees Zoom's actual rejection
    //    reason — usually one of:
    //    - "Meeting does not exist" (fine, Zoom side is already gone)
    //    - 401 invalid scope / token (operator must reconnect Zoom)
    //    - 429 rate-limited (transient, operator can retry)
    if (existing.zoomMeetingId) {
      try {
        const { cancelZoomMeeting } = await import('@/lib/integrations/zoom');
        await cancelZoomMeeting(existing.zoomMeetingId);
      } catch (zoomError: unknown) {
        const message = zoomError instanceof Error ? zoomError.message : String(zoomError);
        // "Meeting does not exist" / 3001 = the meeting is already gone on
        // Zoom's side. That's effectively success for cancel purposes —
        // we treat it as benign so the operator doesn't get blocked on
        // an already-cancelled meeting.
        const alreadyGone = /does not exist|not found|3001|3000/i.test(message);
        if (!alreadyGone) {
          externalErrors.push({ service: 'zoom', message });
          logger.error('Zoom cancellation failed', new Error(message), { meetingId });
        } else {
          logger.info('Zoom meeting already gone — treating as cancel success', {
            meetingId,
            zoomMessage: message,
          });
        }
      }
    }

    // 2. Delete the Google Calendar event. Try TWO paths in order:
    //    (a) New path: deleteSalesVelocityCalendarEvent — works for any
    //        booking created via the upsertSalesVelocityCalendarEvent
    //        helper (future bookings post the May 4 calendar-wiring batch).
    //    (b) Legacy path: read googleCalendarEventId from the booking doc
    //        and call deleteEvent directly on the stored calendarId.
    //        Works for bookings made AFTER the May 4 booking-route patch
    //        (which started persisting the event id) but BEFORE migration
    //        to the new helper.
    //    Older bookings (before May 4) have no event id stored — there is
    //    no way to clean up the calendar event for those, surfaced as a
    //    real warning rather than a silent skip.
    let calendarHandled = false;
    try {
      const result = await deleteSalesVelocityCalendarEvent(`meeting-${meetingId}`);
      if (result.success) {
        calendarHandled = true;
      }
    } catch (calError: unknown) {
      const message = calError instanceof Error ? calError.message : String(calError);
      logger.warn('New-path calendar event deletion errored — will try legacy path', {
        meetingId,
        error: message,
      });
    }

    if (!calendarHandled) {
      // Legacy path: delete via stored googleCalendarEventId.
      if (existing.googleCalendarEventId && existing.googleCalendarId) {
        try {
          const calendarTokenDoc = await AdminFirestoreService.get(
            getSubCollection('integrations'),
            'google-calendar',
          );
          const calendarTokens = calendarTokenDoc as
            | { access_token?: string; refresh_token?: string }
            | null;
          if (calendarTokens?.access_token) {
            const { deleteEvent } = await import('@/lib/integrations/google-calendar-service');
            await deleteEvent(
              {
                access_token: calendarTokens.access_token,
                refresh_token: calendarTokens.refresh_token,
              },
              existing.googleCalendarId,
              existing.googleCalendarEventId,
            );
            calendarHandled = true;
          } else {
            externalErrors.push({
              service: 'google-calendar',
              message: 'Legacy Google Calendar tokens missing — booking has a stored eventId but no auth available to delete',
            });
          }
        } catch (calError: unknown) {
          const message = calError instanceof Error ? calError.message : String(calError);
          externalErrors.push({ service: 'google-calendar', message });
          logger.error('Legacy calendar event deletion failed', new Error(message), { meetingId });
        }
      } else {
        // No event id stored AND new path didn't find a mapping — this is
        // a pre-May 4 booking. Honest gap: we can't clean up its calendar
        // event because we never captured its id.
        externalErrors.push({
          service: 'google-calendar',
          message: 'No Google Calendar event id stored on this booking (pre-May 4 record) — calendar event cannot be deleted automatically. Operator must remove it from Google Calendar manually if it exists.',
        });
      }
    }

    // 3. Decide: if external services all succeeded (or there are none),
    //    flip Firestore. If any failed AND operator hasn't passed
    //    forceLocal, refuse with a 502 so the UI surfaces the truth.
    if (externalErrors.length > 0 && !forceLocal) {
      return NextResponse.json(
        {
          success: false,
          error: 'External cancellation failed — meeting is still scheduled on at least one provider',
          externalErrors,
          hint: 'Pass forceLocal: true to mark the meeting cancelled locally anyway. The recipient may still receive reminders from the un-cancelled provider.',
        },
        { status: 502 },
      );
    }

    await AdminFirestoreService.set(
      bookingsPath,
      meetingId,
      {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        ...(forceLocal && externalErrors.length > 0
          ? { cancelledWithErrors: externalErrors }
          : {}),
      },
      true
    );

    if (forceLocal && externalErrors.length > 0) {
      // Serialize to string so logger's typed context doesn't reject the
      // structured array shape. Audit-quality detail is preserved as JSON.
      logger.warn('Meeting cancelled with forceLocal — external services still report it as scheduled', {
        meetingId,
        externalErrorsJson: JSON.stringify(externalErrors),
      });
    }

    return NextResponse.json({
      success: true,
      ...(externalErrors.length > 0 ? { externalErrors, forceLocalUsed: true } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to cancel meeting', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
