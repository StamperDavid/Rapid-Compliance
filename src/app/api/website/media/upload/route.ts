/**
 * POST /api/website/media/upload
 *
 * Upload an image for the website builder (image / hero / logo / gallery
 * widgets) to Firebase Storage and catalog it in the unified media library so
 * it can be picked again later.
 *
 * Accepts multipart/form-data with:
 *   - file: the image file (required)
 *   - name: optional display name for the library record
 *
 * Returns: { success: true, url: string, asset: UnifiedMediaAsset }
 *
 * The returned `url` is a PERMANENT Firebase Storage download URL (token-based,
 * never expires) — safe to embed in a published website.
 *
 * Auth-gated via requireAuth. Reuses `persistBufferToStorage` (storage) and
 * `createAsset` (library catalog) — no new storage mechanism.
 */

import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/api-auth';
import { adminStorage } from '@/lib/firebase/admin';
import { persistBufferToStorage } from '@/lib/firebase/storage-utils';
import { createAsset } from '@/lib/media/media-library-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/website/media/upload/route.ts';

/** Images only — this endpoint feeds image/hero/logo/gallery widgets. */
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Optional form metadata (the file itself is validated separately). */
const MetadataSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!adminStorage) {
    return NextResponse.json(
      { success: false, error: 'Image storage is unavailable right now. Please try again shortly.' },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'Please choose an image file to upload.' },
        { status: 400 },
      );
    }

    const mimeType = file.type || 'application/octet-stream';
    const extension = ALLOWED_IMAGE_TYPES[mimeType];
    if (!extension) {
      const allowed = Object.keys(ALLOWED_IMAGE_TYPES).join(', ');
      return NextResponse.json(
        {
          success: false,
          error: `That file type isn't supported. Please upload one of: ${allowed}.`,
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const maxMb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
      return NextResponse.json(
        { success: false, error: `That image is too large. The maximum size is ${maxMb} MB.` },
        { status: 400 },
      );
    }

    // Validate optional metadata.
    const parsed = MetadataSchema.safeParse({
      name: typeof formData.get('name') === 'string' ? (formData.get('name') as string) : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid upload details.', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const fileObj = file as unknown as { name?: string };
    const rawName = parsed.data.name ?? fileObj.name ?? `website-image-${Date.now()}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Permanent, token-based Storage URL (reuses storage-utils — never expires).
    const storagePath = `organizations/${PLATFORM_ID}/website/images/${randomUUID()}.${extension}`;
    const url = await persistBufferToStorage(buffer, storagePath, mimeType);
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'We couldn\'t save your image. Please try again.' },
        { status: 502 },
      );
    }

    // Catalog in the unified media library so it's pickable later.
    const asset = await createAsset({
      type: 'image',
      category: 'graphic',
      name: rawName,
      url,
      mimeType,
      fileSize: buffer.length,
      source: 'user-upload',
      createdBy: authResult.user.uid,
      tags: ['website'],
    });

    logger.info('[WebsiteMediaUpload] Image uploaded', {
      file: FILE,
      userId: authResult.user.uid,
      assetId: asset.id,
      mimeType,
      sizeBytes: buffer.length,
    });

    return NextResponse.json({ success: true, url, asset }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    logger.error('[WebsiteMediaUpload] Failed', err instanceof Error ? err : new Error(message));
    return NextResponse.json(
      { success: false, error: 'Something went wrong uploading your image. Please try again.' },
      { status: 500 },
    );
  }
}
