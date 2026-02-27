import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

const TrackLinkSchema = z.object({
  linkId: z.string().min(1),
  messageId: z.string().min(1),
  originalUrl: z.string().url(),
});

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

    const body: unknown = await request.json();
    const parsed = TrackLinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { linkId, messageId, originalUrl } = parsed.data;

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
