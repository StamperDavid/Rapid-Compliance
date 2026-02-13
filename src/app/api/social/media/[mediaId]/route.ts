/**
 * API Route: Social Media Asset Management
 *
 * GET    /api/social/media/{mediaId} → Get media asset metadata
 * DELETE /api/social/media/{mediaId} → Delete media asset
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { SocialMediaAsset } from '@/types/social';

export const dynamic = 'force-dynamic';

const MEDIA_COLLECTION = 'social_media_assets';

function mediaPath(): string {
  return `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${MEDIA_COLLECTION}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/media');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { mediaId } = await params;

    const asset = await FirestoreService.get<SocialMediaAsset>(mediaPath(), mediaId);

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Media asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, asset });
  } catch (error: unknown) {
    logger.error('Media API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to get media asset' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/media');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { mediaId } = await params;

    // Try to delete from Firestore metadata
    await FirestoreService.delete(mediaPath(), mediaId);

    logger.info('Media API: Asset deleted', { mediaId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Media API: DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to delete media asset' },
      { status: 500 }
    );
  }
}
