/**
 * POST /api/video/scene-preview/save
 *
 * Downloads an image from a provider URL and saves it permanently as base64
 * in the scene_previews Firestore collection. Returns a self-hosted URL that
 * never expires.
 *
 * Body: { sceneId: string, projectId: string, imageUrl: string }
 * Returns: { success: true, url: '/api/video/scene-preview/{sceneId}' }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const PREVIEW_COLLECTION = getSubCollection('scene_previews');

const SaveSchema = z.object({
  sceneId: z.string().min(1),
  projectId: z.string().min(1),
  imageUrl: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 },
      );
    }

    const body: unknown = await request.json();
    const parseResult = SaveSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.errors.map((e) => ({
            path: e.path.join('.') || 'unknown',
            message: e.message || 'Validation error',
          })),
        },
        { status: 400 },
      );
    }
    const { sceneId, projectId, imageUrl } = parseResult.data;

    // Download the image from the provider
    const imgResponse = await fetch(imageUrl, { redirect: 'follow' });
    if (!imgResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Image download failed: ${imgResponse.status}` },
        { status: 502 },
      );
    }

    let buffer = Buffer.from(await imgResponse.arrayBuffer());
    let contentType = imgResponse.headers.get('content-type') ?? 'image/png';

    // Firestore field limit is ~1MB. If the image is too large, we need to
    // resize. For storyboard previews, thumbnails are fine — the card is small.
    if (buffer.length > 750_000) {
      logger.info('Scene preview too large for Firestore, image will be stored at reduced quality', {
        originalSize: buffer.length,
        sceneId,
        file: 'api/video/scene-preview/save/route.ts',
      });
      // We can't resize server-side without sharp/canvas, so store a note
      // that this needs Firebase Storage for full-size persistence.
      // For now, try fetching a smaller variant if it's a Hedra imagedelivery URL.
      if (imageUrl.includes('imagedelivery.net')) {
        const baseUrl = imageUrl.replace(/\/[^/]+(\?.*)?$/, '');
        const smallUrl = `${baseUrl}/w=800`;
        try {
          const smallRes = await fetch(smallUrl);
          if (smallRes.ok) {
            const smallBuf = Buffer.from(await smallRes.arrayBuffer());
            if (smallBuf.length < 750_000) {
              buffer = smallBuf;
              contentType = smallRes.headers.get('content-type') ?? 'image/jpeg';
            }
          }
        } catch {
          // Fall through — keep original
        }
      }
    }

    // Firestore document limit is ~1MB. If still too large after resize, warn but proceed.
    const base64 = buffer.toString('base64');
    if (base64.length > 1_000_000) {
      logger.warn('Scene preview base64 exceeds 1MB — Firestore write may fail', {
        sceneId,
        base64Length: base64.length,
        bufferSize: buffer.length,
        file: 'api/video/scene-preview/save/route.ts',
      });
    }

    await adminDb.collection(PREVIEW_COLLECTION).doc(sceneId).set({
      base64,
      contentType,
      sizeBytes: buffer.length,
      sceneId,
      projectId,
      createdAt: new Date().toISOString(),
    });

    const permanentUrl = `/api/video/scene-preview/${sceneId}`;

    logger.info('Scene preview saved permanently', {
      sceneId,
      projectId,
      sizeKB: Math.round(buffer.length / 1024),
      file: 'api/video/scene-preview/save/route.ts',
    });

    return NextResponse.json({ success: true, url: permanentUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Save failed';
    logger.error('Scene preview save failed', error instanceof Error ? error : new Error(msg), {
      file: 'api/video/scene-preview/save/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
