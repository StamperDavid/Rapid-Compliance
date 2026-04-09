/**
 * Public Video Clip Serving Endpoint
 * GET /api/video/avatar/clip/[id]
 *
 * Serves green screen clips stored in Firestore as raw video bytes.
 * This endpoint is PUBLIC (no auth) so external AI engines can
 * download the clip for avatar training.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

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
      .collection(getSubCollection('avatar_clips'))
      .doc(id)
      .get();

    if (!doc.exists) {
      return new NextResponse('Not found', { status: 404 });
    }

    const data = doc.data();
    if (!data?.base64 || !data?.contentType) {
      return new NextResponse('Invalid clip data', { status: 500 });
    }

    const videoBuffer = Buffer.from(data.base64 as string, 'base64');

    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': data.contentType as string,
        'Content-Length': String(videoBuffer.length),
        'Cache-Control': 'public, max-age=86400', // 24 hours
      },
    });
  } catch {
    return new NextResponse('Server error', { status: 500 });
  }
}
