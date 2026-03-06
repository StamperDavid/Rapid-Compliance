/**
 * Public Avatar Photo Serving Endpoint
 * GET /api/video/avatar/photo/[id]
 *
 * Serves avatar photos stored in Firestore as raw image bytes.
 * This endpoint is PUBLIC (no auth) so HeyGen can download the photo
 * to create an Instant Avatar.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !adminDb) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const doc = await adminDb
      .collection(`organizations/${PLATFORM_ID}/avatar_photos`)
      .doc(id)
      .get();

    if (!doc.exists) {
      return new NextResponse('Not found', { status: 404 });
    }

    const data = doc.data();
    if (!data?.base64 || !data?.contentType) {
      return new NextResponse('Invalid photo data', { status: 500 });
    }

    const imageBuffer = Buffer.from(data.base64 as string, 'base64');

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': data.contentType as string,
        'Content-Length': String(imageBuffer.length),
        'Cache-Control': 'public, max-age=86400', // 24 hours
      },
    });
  } catch {
    return new NextResponse('Server error', { status: 500 });
  }
}
