/**
 * DELETE /api/meetings/[meetingId]
 *
 * Hard-delete a booking record. Use cancel (POST .../cancel) for the soft
 * path that preserves history. This DELETE endpoint is for cleanup.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

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
