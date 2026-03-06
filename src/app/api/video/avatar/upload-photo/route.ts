/**
 * Avatar Photo Upload API
 * POST /api/video/avatar/upload-photo - Upload a photo to Firebase Storage for avatar creation
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminStorage } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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
        { success: false, error: 'File too large. Maximum 10MB.' },
        { status: 400 },
      );
    }

    if (!adminStorage) {
      return NextResponse.json(
        { success: false, error: 'Firebase Storage not configured. Check server environment.' },
        { status: 500 },
      );
    }

    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
    const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const storagePath = `video/avatars/${fileName}`;

    // Use the default bucket from Firebase Admin init (storageBucket config)
    // Same approach as the video assemble route which works
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);
    const buffer = Buffer.from(await file.arrayBuffer());

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          purpose: 'avatar-photo',
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Generate a signed URL (valid for 7 days) — avoids need for public bucket ACLs
    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    logger.info('Avatar photo uploaded', {
      fileName,
      sizeBytes: file.size,
      contentType: file.type,
      file: 'avatar/upload-photo/route.ts',
    });

    return NextResponse.json({
      success: true,
      url: signedUrl,
      fileName,
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
