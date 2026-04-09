/**
 * GET /api/video/scene-preview/[sceneId]
 * Serves a scene preview image stored as base64 in Firestore.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const COLLECTION = getSubCollection('scene_previews');

interface PreviewDocument {
  base64?: string;
  contentType?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  const { sceneId } = await params;

  if (!sceneId || !adminDb) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const doc = await adminDb.collection(COLLECTION).doc(sceneId).get();
    if (!doc.exists) {
      logger.warn('Scene preview not found in Firestore', {
        sceneId,
        collection: COLLECTION,
        file: 'scene-preview/[sceneId]/route.ts',
      });
      return new NextResponse('Not found', { status: 404 });
    }

    const data = doc.data() as PreviewDocument | undefined;
    if (!data?.base64) {
      logger.warn('Scene preview document has no base64 data', {
        sceneId,
        hasData: Boolean(data),
        fields: data ? Object.keys(data) : [],
        file: 'scene-preview/[sceneId]/route.ts',
      });
      return new NextResponse('Preview data missing', { status: 404 });
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
    logger.error('Scene preview retrieval failed', error instanceof Error ? error : new Error(msg), {
      sceneId,
      file: 'scene-preview/[sceneId]/route.ts',
    });
    return new NextResponse('Internal error', { status: 500 });
  }
}
