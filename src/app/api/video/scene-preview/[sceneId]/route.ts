/**
 * GET /api/video/scene-preview/[sceneId]
 * Serves a scene preview image stored as base64 in Firestore.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

const COLLECTION = `organizations/${PLATFORM_ID}/scene_previews`;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  const { sceneId } = await params;

  if (!sceneId || !adminDb) {
    return new NextResponse('Not found', { status: 404 });
  }

  const doc = await adminDb.collection(COLLECTION).doc(sceneId).get();
  if (!doc.exists) {
    return new NextResponse('Not found', { status: 404 });
  }

  const data = doc.data() as { base64: string; contentType: string };
  const buffer = Buffer.from(data.base64, 'base64');

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': data.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
