/**
 * GET /api/website/blog/featured-image/[postId]
 *
 * Serves a blog post's featured image from the base64 payload stored in
 * Firestore at `blog_featured_images/{postId}`. Mirrors the scene_previews
 * serve route — we cache the DALL-E bytes locally because the source URLs
 * expire within hours.
 *
 * Public route (no auth) so the image renders inside both the dashboard
 * blog list and any future public-facing blog views.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const COLLECTION = getSubCollection('blog_featured_images');

interface FeaturedImageDocument {
  base64?: string;
  contentType?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;

  if (!postId || !adminDb) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const doc = await adminDb.collection(COLLECTION).doc(postId).get();
    if (!doc.exists) {
      return new NextResponse('Not found', { status: 404 });
    }

    const data = doc.data() as FeaturedImageDocument | undefined;
    if (!data?.base64) {
      return new NextResponse('Image data missing', { status: 404 });
    }

    const buffer = Buffer.from(data.base64, 'base64');
    const contentType = data.contentType ?? 'image/png';

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
      '[BlogFeaturedImage] Retrieval failed',
      error instanceof Error ? error : new Error(msg),
      { postId, file: 'featured-image/[postId]/route.ts' },
    );
    return new NextResponse('Internal error', { status: 500 });
  }
}
