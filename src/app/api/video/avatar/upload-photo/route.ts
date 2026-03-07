/**
 * Avatar Photo Upload API
 * POST /api/video/avatar/upload-photo
 *
 * Stores the photo as base64 in Firestore (not Firebase Storage — that requires
 * a billing-enabled GCS bucket). The photo is served via a public GET endpoint
 * at /api/video/avatar/photo/[id] for use by the Kling Avatar Profiles system.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (Firestore doc limit is ~1MB, base64 adds ~33%)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Use JPG, PNG, or WebP.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum 2MB for avatar photos.' },
        { status: 400 },
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available.' },
        { status: 500 },
      );
    }

    // Convert to base64 and store in Firestore
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const photoId = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    await adminDb
      .collection(`organizations/${PLATFORM_ID}/avatar_photos`)
      .doc(photoId)
      .set({
        base64: base64Data,
        contentType: file.type,
        sizeBytes: file.size,
        createdAt: new Date(),
        // Auto-expire after 30 days (cleanup can read this)
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

    // Build the public URL that serves this image (no auth required so video engines can access it)
    const origin = request.headers.get('origin')
      ?? request.headers.get('x-forwarded-host')
      ?? 'https://rapidcompliance.us';
    const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
    const host = request.headers.get('host') ?? origin.replace(/^https?:\/\//, '');
    const publicUrl = `${protocol}://${host}/api/video/avatar/photo/${photoId}`;

    logger.info('Avatar photo stored in Firestore', {
      photoId,
      sizeBytes: file.size,
      contentType: file.type,
      file: 'avatar/upload-photo/route.ts',
    });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: photoId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Avatar photo upload failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'avatar/upload-photo/route.ts',
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
