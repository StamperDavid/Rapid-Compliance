/**
 * Custom Avatar Management API
 * DELETE /api/video/avatar/[avatarId]
 *
 * Deletes a custom avatar from Firestore (and optionally from HeyGen).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { deleteCustomAvatar } from '@/lib/video/video-service';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ avatarId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { avatarId } = await params;

    if (!avatarId || avatarId.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Avatar ID is required' },
        { status: 400 }
      );
    }

    logger.info('Deleting custom avatar', {
      avatarId,
      userId: typeof authResult === 'object' && 'uid' in authResult ? String(authResult.uid) : 'unknown',
      file: 'avatar/[avatarId]/route.ts',
    });

    await deleteCustomAvatar(avatarId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Avatar deletion failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'avatar/[avatarId]/route.ts',
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
