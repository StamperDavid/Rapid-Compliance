import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

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

    const body = await request.json();
    const { linkId, messageId, originalUrl, organizationId } = body;

    if (!linkId || !messageId || !originalUrl || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store link mapping in Firestore
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trackedLinks`,
      linkId,
      {
        messageId,
        originalUrl,
        createdAt: new Date().toISOString(),
      },
      false
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Error storing tracked link', error, { route: '/api/email/track/link' });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




















