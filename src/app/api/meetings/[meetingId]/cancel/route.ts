/**
 * POST /api/meetings/[meetingId]/cancel
 *
 * Cancels a booking — marks it cancelled in Firestore. If the booking has
 * a Zoom meetingId, attempts to cancel on Zoom side too (best-effort, the
 * Firestore status update is the source of truth).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

interface BookingDoc {
  id?: string;
  status?: string;
  zoomMeetingId?: string;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    if (!meetingId) {
      return NextResponse.json({ success: false, error: 'meetingId required' }, { status: 400 });
    }

    const bookingsPath = getSubCollection('bookings');
    const existing = await AdminFirestoreService.get<BookingDoc>(bookingsPath, meetingId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 });
    }

    // Best-effort Zoom cancellation. If it fails, log and proceed — Firestore
    // status flip is the source of truth.
    if (existing.zoomMeetingId) {
      try {
        const { cancelZoomMeeting } = await import('@/lib/integrations/zoom');
        await cancelZoomMeeting(existing.zoomMeetingId);
      } catch (zoomError: unknown) {
        logger.warn('Zoom cancellation failed (Firestore status still updated)', {
          meetingId,
          error: zoomError instanceof Error ? zoomError.message : String(zoomError),
        });
      }
    }

    await AdminFirestoreService.set(
      bookingsPath,
      meetingId,
      { status: 'cancelled', cancelledAt: new Date().toISOString() },
      true
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to cancel meeting', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
