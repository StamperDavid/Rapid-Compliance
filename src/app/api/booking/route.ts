/**
 * Booking API
 * GET  /api/booking?date=YYYY-MM-DD — returns available time slots for a given date
 * POST /api/booking — creates a booking (no auth required — public endpoint)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';

export const dynamic = 'force-dynamic';

const FILE = 'api/booking/route.ts';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const bookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  notes: z.string().max(500).optional(),
  duration: z.number().int().min(15).max(120).optional().default(30),
  // Discriminator for the video-conferencing provider. 'zoom' is the only
  // provider implemented today; the field exists so the unified calendar
  // dashboard and future provider adapters can dispatch without a schema
  // migration. Stage 3 will populate the corresponding *Url fields.
  meetingProvider: z.enum(['zoom', 'google_meet', 'teams', 'none']).optional().default('zoom'),
});

// ---------------------------------------------------------------------------
// GET — available slots for a date
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.STANDARD);
    if (rateLimitResponse) { return NextResponse.json({ error: 'Too many requests' }, { status: 429 }); }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const durationStr = searchParams.get('duration');
    const duration = durationStr ? parseInt(durationStr, 10) : 30;

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'date query param required (YYYY-MM-DD)' }, { status: 400 });
    }

    // Load availability config (per-day workingHours, with backward-compat
    // fallback to the flat businessHoursStart/businessHoursEnd triple).
    const { getAvailabilityConfig } = await import('@/lib/meetings/availability-config-service');
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const { getSubCollection } = await import('@/lib/firebase/collections');

    const availability = await getAvailabilityConfig();
    const timezone = availability.timezone;

    // Check if Google Calendar tokens exist for availability check
    const calendarTokenDoc = await AdminFirestoreService.get(getSubCollection('integrations'), 'google-calendar');
    const calendarTokens = calendarTokenDoc as { access_token?: string; refresh_token?: string } | null;

    const requestedDate = new Date(`${dateStr}T00:00:00`);
    const nextDay = new Date(requestedDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Resolve which day of the week the requested date falls on, then look up
    // the operator's hours for that day. If the day is disabled, no slots.
    const dayIndex = requestedDate.getDay(); // 0 = Sunday, 6 = Saturday
    type ConfigDayKey = keyof typeof availability.workingHours;
    const jsDayToConfigKey: Record<number, ConfigDayKey> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    };
    const dayHours = availability.workingHours[jsDayToConfigKey[dayIndex]];
    if (!dayHours.enabled) {
      return NextResponse.json({ slots: [], date: dateStr, timezone });
    }

    const [startHourStr, startMinuteStr] = dayHours.start.split(':');
    const [endHourStr, endMinuteStr] = dayHours.end.split(':');
    const businessStartHour = parseInt(startHourStr, 10);
    const businessStartMinute = parseInt(startMinuteStr, 10);
    const businessEndHour = parseInt(endHourStr, 10);
    const businessEndMinute = parseInt(endMinuteStr, 10);

    let busyTimes: Array<{ start: string; end: string }> = [];

    // If Google Calendar is connected, get real busy times
    if (calendarTokens?.access_token) {
      try {
        const { getFreeBusy } = await import('@/lib/integrations/google-calendar-service');
        const result = await getFreeBusy(
          { access_token: calendarTokens.access_token, refresh_token: calendarTokens.refresh_token },
          'primary',
          requestedDate,
          nextDay
        );
        busyTimes = result.busy;
      } catch (calError) {
        logger.warn('Could not fetch Google Calendar busy times, using open schedule', {
          error: calError instanceof Error ? calError.message : String(calError),
          file: FILE,
        });
      }
    }

    // Also check existing bookings in Firestore
    const bookingsPath = getSubCollection('bookings');
    const { where: firestoreWhere } = await import('firebase/firestore');
    const existingBookings = await AdminFirestoreService.getAll(bookingsPath, [
      firestoreWhere('date', '==', dateStr),
      firestoreWhere('status', '==', 'confirmed'),
    ]);

    for (const booking of existingBookings) {
      const b = booking as Record<string, unknown>;
      if (typeof b.startTime === 'string' && typeof b.endTime === 'string') {
        busyTimes.push({ start: b.startTime, end: b.endTime });
      }
    }

    // Generate available slots in 30-minute increments within the day's window.
    const slots: Array<{ start: string; end: string; display: string }> = [];
    const windowEndMinutes = businessEndHour * 60 + businessEndMinute;

    for (let totalMinutes = businessStartHour * 60 + businessStartMinute;
         totalMinutes + duration <= windowEndMinutes;
         totalMinutes += 30) {
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const slotStart = new Date(requestedDate);
      slotStart.setHours(hour, minute, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Don't suggest past slots
      if (slotStart < new Date()) {
        continue;
      }

      // Check conflicts with busy times
      const hasConflict = busyTimes.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return (slotStart >= busyStart && slotStart < busyEnd) ||
               (slotEnd > busyStart && slotEnd <= busyEnd) ||
               (slotStart <= busyStart && slotEnd >= busyEnd);
      });

      if (!hasConflict) {
        const displayTime = slotStart.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          display: displayTime,
        });
      }
    }

    return NextResponse.json({ slots, date: dateStr, timezone, duration });
  } catch (error: unknown) {
    logger.error('Failed to fetch available slots', error instanceof Error ? error : new Error(String(error)), { file: FILE });
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a booking
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.STANDARD);
    if (rateLimitResponse) { return NextResponse.json({ error: 'Too many requests' }, { status: 429 }); }

    const body: unknown = await request.json();
    const parsed = bookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { date, time, name, email, phone, notes, duration, meetingProvider } = parsed.data;

    // Build start/end times
    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + duration);

    // Verify the slot is still available (prevent double-booking)
    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const { getSubCollection } = await import('@/lib/firebase/collections');

    const bookingsPath = getSubCollection('bookings');
    const { where: fw } = await import('firebase/firestore');
    const existingBookings = await AdminFirestoreService.getAll(bookingsPath, [
      fw('date', '==', date),
      fw('status', '==', 'confirmed'),
    ]);

    const hasConflict = existingBookings.some((b: Record<string, unknown>) => {
      if (typeof b.startTime !== 'string' || typeof b.endTime !== 'string') { return false; }
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return (startTime >= bStart && startTime < bEnd) ||
             (endTime > bStart && endTime <= bEnd) ||
             (startTime <= bStart && endTime >= bEnd);
    });

    if (hasConflict) {
      return NextResponse.json(
        { error: 'This time slot is no longer available. Please choose another.' },
        { status: 409 }
      );
    }

    // Try to create the Zoom meeting inline. If Zoom is offline / rate-limited
    // / not connected, the booking is still written so the slot is reserved
    // and the operator can manually generate a link. The response signals
    // `zoomCreationFailed: true` so the client can show "we'll email your
    // meeting link separately" instead of a missing-link confirmation.
    let zoomMeetingId: string | null = null;
    let zoomJoinUrl: string | null = null;
    let zoomStartUrl: string | null = null;
    let zoomCreationFailed = false;
    let zoomError: string | null = null;

    // Load editable scheduling messages (template strings for emails, Zoom
    // metadata, etc.). Falls back to DEFAULT_MESSAGES when the doc isn't set,
    // so this works on a fresh deployment with no operator customization.
    const { getSchedulingMessages, renderTemplate, buildMeetingTemplateVars } =
      await import('@/lib/meetings/scheduling-messages-service');
    const messages = await getSchedulingMessages();

    if (meetingProvider === 'zoom') {
      try {
        const { createZoomMeeting } = await import('@/lib/integrations/zoom');
        const zoomTemplateVars = buildMeetingTemplateVars({
          attendeeName: name,
          startTime,
          durationMinutes: duration,
          orgName: 'SalesVelocity.ai',
        });
        const zoomTopic = renderTemplate(messages.zoomMeetingTopic, zoomTemplateVars);
        const zoomAgenda = renderTemplate(messages.zoomMeetingAgenda, zoomTemplateVars);
        const zoomMeeting = await createZoomMeeting({
          topic: zoomTopic,
          startTime,
          duration,
          agenda: notes ?? zoomAgenda,
          attendees: [email],
        });
        zoomMeetingId = zoomMeeting.meetingId;
        zoomJoinUrl = zoomMeeting.joinUrl;
        zoomStartUrl = zoomMeeting.startUrl;
      } catch (zoomErr) {
        zoomCreationFailed = true;
        zoomError = zoomErr instanceof Error ? zoomErr.message : String(zoomErr);
        logger.warn('Zoom meeting creation failed for public booking — booking will be written without a join link', {
          error: zoomError,
          file: FILE,
        });
      }
    }

    // Create booking
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const booking = {
      id: bookingId,
      date,
      time,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      name,
      email,
      phone: phone ?? null,
      notes: notes ?? null,
      status: 'confirmed' as const,
      meetingProvider,
      zoomMeetingId,
      zoomJoinUrl,
      zoomStartUrl,
      zoomCreationFailed,
      organizationId: PLATFORM_ID,
      createdAt: new Date().toISOString(),
    };

    await AdminFirestoreService.set(bookingsPath, bookingId, booking);

    // Try to create Google Calendar event (non-blocking). The Zoom join URL
    // is included in the description so the operator (and Google's calendar
    // notifications) surface it alongside the standard booking metadata.
    void (async () => {
      try {
        const calendarTokenDoc = await AdminFirestoreService.get(getSubCollection('integrations'), 'google-calendar');
        const calendarTokens = calendarTokenDoc as { access_token?: string; refresh_token?: string } | null;

        if (calendarTokens?.access_token) {
          const { createEvent } = await import('@/lib/integrations/google-calendar-service');
          const description = [
            'Booked via SalesVelocity.ai',
            '',
            `Name: ${name}`,
            `Email: ${email}`,
            phone ? `Phone: ${phone}` : null,
            notes ? `Notes: ${notes}` : null,
            zoomJoinUrl ? `\nZoom: ${zoomJoinUrl}` : null,
          ].filter(Boolean).join('\n');
          await createEvent(
            { access_token: calendarTokens.access_token, refresh_token: calendarTokens.refresh_token },
            'primary',
            {
              summary: `Meeting with ${name}`,
              description,
              start: { dateTime: startTime.toISOString() },
              end: { dateTime: endTime.toISOString() },
              attendees: [{ email }],
            }
          );
        }
      } catch (calError) {
        logger.warn('Could not create Google Calendar event for booking', {
          bookingId,
          error: calError instanceof Error ? calError.message : String(calError),
          file: FILE,
        });
      }
    })();

    // Try to send confirmation email (non-blocking) — subject + body come
    // from the scheduling-messages config so the operator can edit the copy
    // from /settings/scheduling-messages without a deploy.
    void (async () => {
      try {
        const { sendEmail } = await import('@/lib/email/email-service');
        const emailTemplateVars = buildMeetingTemplateVars({
          attendeeName: name,
          startTime,
          durationMinutes: duration,
          zoomJoinUrl,
          orgName: 'SalesVelocity.ai',
        });
        const subject = renderTemplate(messages.demoConfirmationEmailSubject, emailTemplateVars);
        let html = renderTemplate(messages.demoConfirmationEmailBody, emailTemplateVars);

        // If Zoom failed, the {zoomLink} placeholder rendered to empty string.
        // Swap the join-link block for the fallback copy so the prospect knows
        // the link is coming separately rather than seeing an empty <a>.
        if (!zoomJoinUrl) {
          html = html.replace(
            /<p[^>]*>[^<]*<strong>Join the meeting[\s\S]*?<\/p>/i,
            '<p>We hit a snag generating your meeting link automatically — we will email it to you separately within the hour.</p>',
          );
        }

        if (notes) {
          html += `<p>Notes: ${notes}</p>`;
        }

        await sendEmail({ to: email, subject, html });
      } catch (emailError) {
        logger.warn('Could not send booking confirmation email', {
          bookingId,
          error: emailError instanceof Error ? emailError.message : String(emailError),
          file: FILE,
        });
      }
    })();

    return NextResponse.json({
      success: true,
      booking: {
        id: bookingId,
        date,
        time,
        duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        zoomJoinUrl,
        zoomCreationFailed,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to create booking', error instanceof Error ? error : new Error(String(error)), { file: FILE });
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
