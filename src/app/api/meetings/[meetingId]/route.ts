/**
 * DELETE /api/meetings/[meetingId]   — hard-delete a booking record
 * PATCH  /api/meetings/[meetingId]   — reschedule (new startTime / duration)
 *
 * Use cancel (POST .../cancel) for the soft path that preserves history.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

interface BookingDoc {
  id?: string;
  name?: string;
  email?: string;
  duration?: number;
  zoomMeetingId?: string;
  zoomJoinUrl?: string;
  zoomStartUrl?: string;
  zoomPassword?: string;
}

const rescheduleSchema = z.object({
  startTime: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid ISO datetime'),
  duration: z.number().int().positive().max(480).optional(),
});

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    if (!meetingId) {
      return NextResponse.json({ success: false, error: 'meetingId required' }, { status: 400 });
    }

    const bookingsPath = getSubCollection('bookings');
    await AdminFirestoreService.delete(bookingsPath, meetingId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete meeting', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    if (!meetingId) {
      return NextResponse.json({ success: false, error: 'meetingId required' }, { status: 400 });
    }

    const body = await req.json().catch(() => null) as unknown;
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid body', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const newStart = new Date(parsed.data.startTime);
    const bookingsPath = getSubCollection('bookings');
    const existing = await AdminFirestoreService.get<BookingDoc>(bookingsPath, meetingId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
    }

    const newDuration = parsed.data.duration ?? existing.duration ?? 30;

    // Best-effort: cancel the old Zoom meeting + create a new one. If Zoom
    // calls fail, we still update Firestore — operator gets a partial-success
    // message and can manually fix the Zoom side.
    let zoomFields: Record<string, unknown> = {};
    let zoomWarning: string | null = null;

    if (existing.zoomMeetingId) {
      try {
        const { cancelZoomMeeting, createZoomMeeting } = await import('@/lib/integrations/zoom');
        await cancelZoomMeeting(existing.zoomMeetingId);
        const meeting = await createZoomMeeting({
          topic: `Meeting with ${existing.name ?? 'guest'}`,
          startTime: newStart,
          duration: newDuration,
        });
        zoomFields = {
          zoomMeetingId: meeting.meetingId,
          zoomJoinUrl: meeting.joinUrl,
          zoomStartUrl: meeting.startUrl,
          zoomPassword: meeting.password ?? null,
        };
      } catch (zoomError: unknown) {
        zoomWarning = zoomError instanceof Error ? zoomError.message : String(zoomError);
        logger.warn('Zoom reschedule failed (Firestore startTime still updated)', {
          meetingId,
          error: zoomWarning,
        });
      }
    }

    await AdminFirestoreService.set(
      bookingsPath,
      meetingId,
      {
        startTime: newStart.toISOString(),
        duration: newDuration,
        rescheduledAt: new Date().toISOString(),
        ...zoomFields,
      },
      true,
    );

    return NextResponse.json({ success: true, zoomWarning });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to reschedule meeting', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
