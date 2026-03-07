/**
 * GET /api/video/avatars — List avatar profiles for the authenticated user
 *
 * Wraps the avatar-profiles API to maintain backward compatibility
 * with any UI components that still call this endpoint.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { listAvatarProfiles } from '@/lib/video/avatar-profile-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { user } = authResult;
    const profiles = await listAvatarProfiles(String(user.uid));

    // Map profiles to the avatar shape for backward compat
    const avatars = profiles.map((p) => ({
      id: p.id,
      name: p.name,
      thumbnailUrl: p.frontalImageUrl,
      gender: null,
      style: null,
      isCustom: true,
      isPremium: false,
      isDefault: p.isDefault,
      assignedVoiceId: p.voiceId,
      assignedVoiceName: p.voiceProvider,
    }));

    return NextResponse.json({ success: true, avatars });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Avatars API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage, avatars: [] },
      { status: 500 }
    );
  }
}
