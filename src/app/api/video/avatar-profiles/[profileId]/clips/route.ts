/**
 * POST   /api/video/avatar-profiles/[profileId]/clips — Add a green screen clip
 * DELETE /api/video/avatar-profiles/[profileId]/clips — Remove a green screen clip
 *
 * Green screen clips are short video recordings of the user against a green background.
 * Each clip has a spoken script so the system learns speaking style and intonation.
 * Adding clips auto-upgrades the avatar profile to 'premium' tier.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  addGreenScreenClip,
  removeGreenScreenClip,
  getAvatarProfile,
} from '@/lib/video/avatar-profile-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const AddClipSchema = z.object({
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().nullable().default(null),
  script: z.string().min(1, 'Script text is required — describe what is spoken in this clip'),
  duration: z.number().positive('Duration must be positive'),
});

const RemoveClipSchema = z.object({
  clipId: z.string().min(1, 'Clip ID is required'),
});

// ============================================================================
// POST — Add green screen clip
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { profileId } = await params;
    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    // Verify profile exists and belongs to user
    const profile = await getAvatarProfile(profileId);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Avatar profile not found' },
        { status: 404 }
      );
    }

    if (profile.userId !== String(authResult.user.uid)) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to modify this profile' },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();
    const parsed = AddClipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const result = await addGreenScreenClip(profileId, parsed.data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    logger.info('Green screen clip added via API', {
      profileId,
      clipId: result.clipId,
      file: 'avatar-profiles/[profileId]/clips/route.ts',
    });

    return NextResponse.json({
      success: true,
      clipId: result.clipId,
      tier: 'premium', // Profile is now premium
    });
  } catch (error) {
    logger.error(
      'Failed to add green screen clip',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'avatar-profiles/[profileId]/clips/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to add green screen clip' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — Remove green screen clip
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { profileId } = await params;
    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    // Verify profile belongs to user
    const profile = await getAvatarProfile(profileId);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Avatar profile not found' },
        { status: 404 }
      );
    }

    if (profile.userId !== String(authResult.user.uid)) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to modify this profile' },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();
    const parsed = RemoveClipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const result = await removeGreenScreenClip(profileId, parsed.data.clipId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Failed to remove green screen clip',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'avatar-profiles/[profileId]/clips/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to remove green screen clip' },
      { status: 500 }
    );
  }
}
