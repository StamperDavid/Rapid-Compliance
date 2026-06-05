import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface TutorialRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * GET /api/academy - List all academy tutorials
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tutorials = await AdminFirestoreService.getAll<TutorialRecord>(
      getSubCollection('academy_tutorials'),
      []
    );

    return NextResponse.json({ success: true, tutorials });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tutorials';
    logger.error('Failed to fetch academy tutorials', error instanceof Error ? error : new Error(String(error)), { file: 'api/academy/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
