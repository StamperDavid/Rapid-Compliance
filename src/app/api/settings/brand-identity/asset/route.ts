/**
 * POST /api/settings/brand-identity/asset
 *
 * Upload a brand REFERENCE asset (past marketing, ads, imagery, logo files,
 * brand guidelines) to Firebase Storage and return a PERMANENT public URL
 * (via makePublic — not an expiring signed URL, because these reference
 * materials are surfaced on the Brand Identity page indefinitely).
 *
 * Accepts multipart/form-data with:
 *   - file: image (png/jpeg/webp/svg/gif), video (mp4/webm/quicktime),
 *           or PDF (application/pdf)
 *
 * Returns: { success: true, url, fileName, contentType, kind }
 *
 * Gated on the same permission as saving the brand identity (canManageTheme).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/api-auth';
import { adminStorage } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/settings/brand-identity/asset/route.ts';

type AssetKind = 'image' | 'video' | 'document' | 'other';

/** Supported MIME types → file extension. */
const ALLOWED_TYPES: Record<string, string> = {
  // images
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  // video
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  // documents
  'application/pdf': 'pdf',
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — videos are bigger

/** Map a MIME type to the coarse asset `kind` stored on BrandExampleAsset. */
function deriveKind(mimeType: string): AssetKind {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType === 'application/pdf') {
    return 'document';
  }
  return 'other';
}

/** Strip unsafe characters from the original filename, preserving its extension. */
function sanitizeFileName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  const trimmed = safe.replace(/^[._-]+/, '');
  return trimmed.length > 0 ? trimmed : 'asset';
}

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
        { success: false, error: 'A reference file is required' },
        { status: 400 },
      );
    }

    const mimeType = file.type || '';
    if (!mimeType || !(mimeType in ALLOWED_TYPES)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${mimeType || 'unknown'}. Use an image (PNG, JPEG, WEBP, SVG, GIF), video (MP4, WEBM, MOV), or PDF.`,
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum 50 MB.` },
        { status: 400 },
      );
    }

    const originalName =
      file instanceof File && file.name ? file.name : `asset.${ALLOWED_TYPES[mimeType]}`;
    const safeName = sanitizeFileName(originalName);
    const kind = deriveKind(mimeType);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `organizations/${PLATFORM_ID}/brand-assets/${Date.now()}-${safeName}`;

    const bucket = adminStorage.bucket();
    const storageFile = bucket.file(storagePath);

    await storageFile.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          uploadedBy: permResult.user.uid,
          uploadedAt: new Date().toISOString(),
          purpose: 'brand-reference-asset',
        },
      },
    });

    // Permanent public URL — reference materials are surfaced on the Brand
    // Identity page indefinitely, so the URL must not expire.
    await storageFile.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    logger.info('[brand-identity-asset] Asset uploaded', {
      storagePath,
      mimeType,
      kind,
      sizeBytes: buffer.length,
      file: FILE,
    });

    return NextResponse.json({
      success: true,
      url,
      fileName: originalName,
      contentType: mimeType,
      kind,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Asset upload failed';
    logger.error(
      '[brand-identity-asset] Failed',
      err instanceof Error ? err : new Error(message),
      { file: FILE },
    );
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
