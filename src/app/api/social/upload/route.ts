/**
 * POST /api/social/upload
 *
 * Upload a media file for social media posts to Firebase Storage.
 *
 * Accepts multipart/form-data with:
 *   - file: the image or video file
 *
 * Returns: { success: true, url: string, type: 'image' | 'video', size: number }
 *
 * Auth-gated via requireAuth.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminStorage } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime', // .mov
  'video/webm',
]);

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;    // 10 MB
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;    // 100 MB

function classifyMimeType(mime: string): 'image' | 'video' | null {
  if (ALLOWED_IMAGE_TYPES.has(mime)) {
    return 'image';
  }
  if (ALLOWED_VIDEO_TYPES.has(mime)) {
    return 'video';
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!adminStorage) {
    return NextResponse.json(
      { success: false, error: 'Storage service is not available' },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'A file is required' },
        { status: 400 },
      );
    }

    const mimeType = file.type || 'application/octet-stream';
    const mediaType = classifyMimeType(mimeType);

    if (!mediaType) {
      const allowed = [
        ...Array.from(ALLOWED_IMAGE_TYPES),
        ...Array.from(ALLOWED_VIDEO_TYPES),
      ].join(', ');
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${mimeType}. Allowed: ${allowed}` },
        { status: 400 },
      );
    }

    // Enforce size limits
    const maxBytes = mediaType === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (file.size > maxBytes) {
      const maxMB = Math.round(maxBytes / (1024 * 1024));
      return NextResponse.json(
        { success: false, error: `File too large. Maximum for ${mediaType}: ${maxMB} MB` },
        { status: 400 },
      );
    }

    // Derive a safe filename
    // FormData file entries are File objects (extends Blob) with a name property
    const fileObj = file as unknown as { name?: string };
    const rawName = fileObj.name ?? `upload-${Date.now()}`;
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const userId = authResult.user.uid;
    const storagePath = `social-media/${userId}/${timestamp}_${safeName}`;

    // Read into buffer and upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucket = adminStorage.bucket();
    const storageFile = bucket.file(storagePath);

    await storageFile.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          mediaType,
        },
      },
    });

    // Generate a signed URL valid for 7 days
    const [signedUrl] = await storageFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    logger.info('[SocialUpload] File uploaded', {
      userId,
      storagePath,
      mimeType,
      mediaType,
      sizeBytes: buffer.length,
    });

    return NextResponse.json({
      success: true,
      url: signedUrl,
      type: mediaType,
      size: buffer.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    logger.error('[SocialUpload] Failed', err instanceof Error ? err : new Error(message));
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
