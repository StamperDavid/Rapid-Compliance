import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { orderBy } from 'firebase/firestore';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getCallsCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface CallRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * GET /api/calls - List call history (most recent first)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const calls = await AdminFirestoreService.getAll<CallRecord>(
      getCallsCollection(),
      [orderBy('createdAt', 'desc')]
    );

    return NextResponse.json({ success: true, calls });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch calls';
    logger.error('Failed to fetch calls', error instanceof Error ? error : new Error(String(error)), { file: 'api/calls/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
