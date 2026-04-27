/**
 * GET /api/content/social-post-image/[imageId]
 *
 * Serves a social post's accompanying image from the base64 payload stored
 * in Firestore at `social_post_images/{imageId}`. Mirrors the blog
 * featured-image serve route — DALL-E URLs expire within hours so we
 * cache the bytes locally on creation.
 *
 * Public route (no auth) so external platforms (Mastodon, Bluesky, X) can
 * fetch the URL when the publish step posts media-attached content.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const COLLECTION = getSubCollection('social_post_images');

interface SocialPostImageDocument {
  base64?: string;
  contentType?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await params;

  if (!imageId || !adminDb) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const doc = await adminDb.collection(COLLECTION).doc(imageId).get();
    if (!doc.exists) {
      return new NextResponse('Not found', { status: 404 });
    }

    const data = doc.data() as SocialPostImageDocument | undefined;
    if (!data?.base64) {
      return new NextResponse('Image data missing', { status: 404 });
    }

    const buffer = Buffer.from(data.base64, 'base64');
    const contentType = data.contentType ?? 'image/jpeg';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(
      '[SocialPostImage] Retrieval failed',
      error instanceof Error ? error : new Error(msg),
      { imageId, file: 'social-post-image/[imageId]/route.ts' },
    );
    return new NextResponse('Internal error', { status: 500 });
  }
}
