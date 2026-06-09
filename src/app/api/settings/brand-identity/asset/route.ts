/**
 * POST /api/settings/brand-identity/asset
 *
 * Upload a brand REFERENCE asset (past marketing, ads, imagery, logo files,
 * brand guidelines) to Firebase Storage and return a PERMANENT public URL
 * (via makePublic — not an expiring signed URL, because these reference
 * materials are surfaced on the Brand Identity page indefinitely).
 *
 * Accepts multipart/form-data with:
 *   - file: any common marketing/imaging/doc/AV/text asset —
 *       images (png/jpeg/webp/gif/svg/heic/heif/tiff/bmp),
 *       video (mp4/mov/webm/avi/mkv),
 *       audio (mp3/wav/m4a/ogg/aac/flac),
 *       docs (pdf/doc/docx/ppt/pptx/xls/xlsx/csv/txt/md/rtf)
 *
 * Returns: { success: true, url, fileName, contentType, kind }
 *
 * Gated on the same permission as saving the brand identity (canManageTheme).
 */

import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/api-auth';
import { adminStorage } from '@/lib/firebase/admin';
import { firebaseDownloadUrl } from '@/lib/firebase/storage-utils';
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
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/tiff': 'tiff',
  'image/bmp': 'bmp',
  // video
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  // audio
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  // documents
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  // text
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/rtf': 'rtf',
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — videos are bigger

/** Map a MIME type to the coarse asset `kind` stored on BrandExampleAsset. */
function deriveKind(mimeType: string): AssetKind {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/')) {
    return 'image';
  }
  if (mime.startsWith('video/')) {
    return 'video';
  }
  if (mime.startsWith('audio/')) {
    // The 4-value kind enum has no 'audio' — extraction branches on contentType,
    // so audio maps to the coarse 'other' bucket here without losing comprehension.
    return 'other';
  }
  if (mime.startsWith('text/') || mime === 'application/pdf' || mime === 'application/rtf') {
    return 'document';
  }
  if (mime.startsWith('application/')) {
    // Office docs (word/powerpoint/excel) — all coarse-classified as documents.
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
          error: `Unsupported file type: ${mimeType || 'unknown'}. Use an image (PNG, JPEG, WEBP, GIF, SVG, HEIC, TIFF, BMP), video (MP4, MOV, WEBM, AVI, MKV), audio (MP3, WAV, M4A, OGG, AAC, FLAC), or document (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, CSV, TXT, MD, RTF).`,
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
    const downloadToken = randomUUID();

    await storageFile.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          uploadedBy: permResult.user.uid,
          uploadedAt: new Date().toISOString(),
          purpose: 'brand-reference-asset',
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    // Permanent, publicly-fetchable download URL. Works with uniform bucket-level
    // access (UBLA) — `makePublic()` sets a per-object ACL, which throws on UBLA
    // buckets ("Cannot update access control … uniform bucket-level access").
    const url = firebaseDownloadUrl(bucket.name, storagePath, downloadToken);

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
