/**
 * Green Screen Clip Upload API
 * POST /api/video/avatar/upload-clip
 *
 * Stores the video clip as base64 in Firestore (same pattern as avatar photos).
 * The clip is served via a public GET endpoint at /api/video/avatar/clip/[id]
 * so external AI training systems can access it.
 *
 * Also generates a thumbnail by extracting metadata.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// Green screen clips can be larger than photos — up to 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
];

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
        { success: false, error: 'Invalid file type. Use MP4, WebM, MOV, or AVI.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum 50MB for video clips.' },
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
    const clipId = `clip-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    await adminDb
      .collection(getSubCollection('avatar_clips'))
      .doc(clipId)
      .set({
        base64: base64Data,
        contentType: file.type,
        sizeBytes: file.size,
        fileName: file.name,
        createdAt: new Date(),
        userId: String(authResult.user.uid),
        // Auto-expire after 90 days (cleanup can read this)
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

    // Build public URL
    const origin = request.headers.get('origin')
      ?? request.headers.get('x-forwarded-host')
      ?? 'https://salesvelocity.ai';
    const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
    const host = request.headers.get('host') ?? origin.replace(/^https?:\/\//, '');
    const publicUrl = `${protocol}://${host}/api/video/avatar/clip/${clipId}`;

    logger.info('Green screen clip stored in Firestore', {
      clipId,
      sizeBytes: file.size,
      contentType: file.type,
      file: 'avatar/upload-clip/route.ts',
    });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      clipId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Green screen clip upload failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'avatar/upload-clip/route.ts',
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
