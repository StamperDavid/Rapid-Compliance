/**
 * GET /api/admin/music/status
 *
 * Returns the status of all 15 background music tracks:
 * which files exist in Firebase Storage and which are missing.
 * Admin-only endpoint.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { adminStorage } from '@/lib/firebase/admin';
import { getMusicTracks } from '@/lib/video/music-library';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }

  if (!adminStorage) {
    return NextResponse.json({ success: false, error: 'Storage not available' }, { status: 503 });
  }

  try {
    const tracks = getMusicTracks();
    const bucket = adminStorage.bucket();

    // List all files in the music/ prefix
    const [files] = await bucket.getFiles({ prefix: 'music/' });
    const uploadedPaths = new Set(files.map((f) => f.name));

    const status = tracks.map((track) => ({
      id: track.id,
      name: track.name,
      category: track.category,
      storagePath: track.storagePath,
      durationSeconds: track.durationSeconds,
      bpm: track.bpm,
      uploaded: uploadedPaths.has(track.storagePath),
    }));

    const uploaded = status.filter((s) => s.uploaded).length;
    const missing = status.filter((s) => !s.uploaded).length;

    return NextResponse.json({
      success: true,
      summary: { total: tracks.length, uploaded, missing },
      tracks: status,
    });
  } catch (err) {
    logger.error('Failed to check music status', err instanceof Error ? err : new Error(String(err)), {
      route: '/api/admin/music/status',
    });
    return NextResponse.json({ success: false, error: 'Failed to check status' }, { status: 500 });
  }
}
