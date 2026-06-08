/**
 * POST /api/settings/brand-kit/logo
 *
 * Upload the brand logo file to Firebase Storage and return a PERMANENT public
 * URL (via makePublic — not an expiring signed URL, because the logo is
 * composited onto every generated image and must outlive any expiry window).
 *
 * Accepts multipart/form-data with:
 *   - file: PNG / SVG / JPEG / WEBP (transparent PNG recommended)
 *
 * Returns: { success: true, url: string }
 *
 * Gated on the same permission as saving the brand kit (canManageTheme).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/api-auth';
import { adminStorage } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/settings/brand-kit/logo/route.ts';

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — logos are small

export async function POST(request: NextRequest): Promise<NextResponse> {
  const permResult = await requirePermission(request, 'canManageTheme');
  if (permResult instanceof NextResponse) {
    return permResult;
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
        { success: false, error: 'A logo file is required' },
        { status: 400 },
      );
    }

    const mimeType = file.type || 'application/octet-stream';
    const ext = ALLOWED_TYPES[mimeType];
    if (!ext) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported logo type: ${mimeType}. Use PNG, SVG, JPEG, or WEBP (transparent PNG recommended).`,
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `Logo too large. Maximum 5 MB.` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const storagePath = `organizations/${PLATFORM_ID}/brand-kit/logo-${timestamp}.${ext}`;

    const bucket = adminStorage.bucket();
    const storageFile = bucket.file(storagePath);

    await storageFile.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          uploadedBy: permResult.user.uid,
          uploadedAt: new Date().toISOString(),
          purpose: 'brand-logo',
        },
      },
    });

    // Permanent public URL — the logo is composited onto generated images and
    // referenced by the assembled video, so it must not expire.
    await storageFile.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    logger.info('[brand-kit-logo] Logo uploaded', {
      storagePath,
      mimeType,
      sizeBytes: buffer.length,
      file: FILE,
    });

    return NextResponse.json({ success: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Logo upload failed';
    logger.error('[brand-kit-logo] Failed', err instanceof Error ? err : new Error(message), {
      file: FILE,
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
