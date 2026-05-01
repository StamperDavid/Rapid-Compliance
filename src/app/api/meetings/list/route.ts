/**
 * GET /api/meetings/list
 *
 * Lists all bookings (demo bookings + scheduled meetings) for the current
 * organization. Read uses Admin SDK so server-side rules don't deny.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export async function GET(_req: NextRequest) {
  try {
    const bookingsPath = getSubCollection('bookings');
    const docs = await AdminFirestoreService.getAll(bookingsPath, []);

    // Newest first. startTime can arrive as a string (ISO), a Firestore
    // Timestamp object ({_seconds, _nanoseconds} or {seconds, nanoseconds}),
    // or be missing entirely. Coerce everything to a comparable epoch ms.
    const toEpoch = (v: unknown): number => {
      if (v == null) {return 0;}
      if (typeof v === 'string') {
        const t = Date.parse(v);
        return Number.isNaN(t) ? 0 : t;
      }
      if (typeof v === 'number') {return v;}
      if (typeof v === 'object') {
        const ts = v as { _seconds?: number; seconds?: number; toDate?: () => Date };
        if (typeof ts.toDate === 'function') {return ts.toDate().getTime();}
        if (typeof ts._seconds === 'number') {return ts._seconds * 1000;}
        if (typeof ts.seconds === 'number') {return ts.seconds * 1000;}
      }
      return 0;
    };

    const sorted = [...docs].sort((a, b) => {
      const aStart = toEpoch((a as { startTime?: unknown }).startTime);
      const bStart = toEpoch((b as { startTime?: unknown }).startTime);
      return bStart - aStart;
    });

    return NextResponse.json({ success: true, meetings: sorted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to list meetings', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
