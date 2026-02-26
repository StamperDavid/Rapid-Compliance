import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

interface RequestPayload {
  linkId: string;
  messageId: string;
  originalUrl: string;
}

/**
 * Store tracked link mapping
 * Called client-side to store link mappings in Firestore
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting (higher limit for tracking)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/email/track/link');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json() as RequestPayload;
    const { linkId, messageId, originalUrl } = body;

    if (!linkId || !messageId || !originalUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store link mapping in Firestore
    await AdminFirestoreService.set(
      getSubCollection('trackedLinks'),
      linkId,
      {
        messageId,
        originalUrl,
        createdAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error storing tracked link', error instanceof Error ? error : new Error(String(error)), { route: '/api/email/track/link' });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
