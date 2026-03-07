/**
 * GET    /api/video/avatar-profiles/[profileId] — Get a single avatar profile
 * PATCH  /api/video/avatar-profiles/[profileId] — Update an avatar profile
 * DELETE /api/video/avatar-profiles/[profileId] — Delete an avatar profile
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  getAvatarProfile,
  updateAvatarProfile,
  deleteAvatarProfile,
} from '@/lib/video/avatar-profile-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schema
// ============================================================================

const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  frontalImageUrl: z.string().url().optional(),
  additionalImageUrls: z.array(z.string().url()).optional(),
  fullBodyImageUrl: z.string().url().nullable().optional(),
  upperBodyImageUrl: z.string().url().nullable().optional(),
  voiceId: z.string().nullable().optional(),
  voiceProvider: z
    .enum(['elevenlabs', 'heygen', 'unrealspeech', 'custom'])
    .nullable()
    .optional(),
  heygenAvatarId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

// ============================================================================
// GET — Get single profile
// ============================================================================

export async function GET(
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

    logger.info('Getting avatar profile', {
      file: 'api/video/avatar-profiles/[profileId]/route.ts',
      profileId,
    });

    const profile = await getAvatarProfile(profileId);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    logger.error(
      'Failed to get avatar profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/avatar-profiles/[profileId]/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to get avatar profile' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH — Update profile
// ============================================================================

export async function PATCH(
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

    const body: unknown = await request.json();
    const parseResult = UpdateProfileSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid update avatar profile request', {
        file: 'api/video/avatar-profiles/[profileId]/route.ts',
        profileId,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    logger.info('Updating avatar profile', {
      file: 'api/video/avatar-profiles/[profileId]/route.ts',
      profileId,
    });

    const result = await updateAvatarProfile(profileId, data);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Failed to update avatar profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/avatar-profiles/[profileId]/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to update avatar profile' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — Delete profile
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

    logger.info('Deleting avatar profile', {
      file: 'api/video/avatar-profiles/[profileId]/route.ts',
      profileId,
    });

    const deleted = await deleteAvatarProfile(profileId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Failed to delete avatar profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/avatar-profiles/[profileId]/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to delete avatar profile' },
      { status: 500 }
    );
  }
}
