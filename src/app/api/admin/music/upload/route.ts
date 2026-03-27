/**
 * POST /api/admin/music/upload
 *
 * Upload a background music track to Firebase Storage.
 * Accepts multipart/form-data with:
 *   - file: the MP3 file
 *   - trackId: the music track ID (e.g. 'music-upbeat-drive')
 *
 * Admin-only endpoint. Validates that trackId matches a known track
 * from the music library before uploading.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { adminStorage } from '@/lib/firebase/admin';
import { getMusicTrackById } from '@/lib/video/music-library';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }

  if (!adminStorage) {
    return NextResponse.json({ success: false, error: 'Storage not available' }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const trackId = formData.get('trackId');

    if (!trackId || typeof trackId !== 'string') {
      return NextResponse.json({ success: false, error: 'trackId is required' }, { status: 400 });
    }

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: 'Audio file is required' }, { status: 400 });
    }

    // Validate track ID
    const track = getMusicTrackById(trackId);
    if (!track) {
      return NextResponse.json({ success: false, error: `Unknown track ID: ${trackId}` }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (max 20MB)' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('audio/')) {
      return NextResponse.json({ success: false, error: `Invalid file type: ${file.type}. Expected audio file.` }, { status: 400 });
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Firebase Storage
    const bucket = adminStorage.bucket();
    const storageFile = bucket.file(track.storagePath);

    await storageFile.save(buffer, {
      metadata: {
        contentType: file.type || 'audio/mpeg',
        metadata: {
          trackId: track.id,
          trackName: track.name,
          category: track.category,
          bpm: String(track.bpm),
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    logger.info('Music track uploaded', {
      trackId: track.id,
      trackName: track.name,
      storagePath: track.storagePath,
      fileSize: buffer.length,
      route: '/api/admin/music/upload',
    });

    return NextResponse.json({
      success: true,
      message: `"${track.name}" uploaded successfully.`,
      track: {
        id: track.id,
        name: track.name,
        storagePath: track.storagePath,
      },
    });
  } catch (err) {
    logger.error('Failed to upload music track', err instanceof Error ? err : new Error(String(err)), {
      route: '/api/admin/music/upload',
    });
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
