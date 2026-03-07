/**
 * GET  /api/video/avatar-profiles — List avatar profiles for the authenticated user
 * POST /api/video/avatar-profiles — Create a new avatar profile
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  createAvatarProfile,
  listAvatarProfiles,
} from '@/lib/video/avatar-profile-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schema
// ============================================================================

const GreenScreenClipSchema = z.object({
  id: z.string().min(1),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().nullable().default(null),
  script: z.string().min(1),
  duration: z.number().positive(),
  createdAt: z.string().default(() => new Date().toISOString()),
});

const CreateProfileSchema = z.object({
  name: z.string().min(1),
  frontalImageUrl: z.string().url(),
  tier: z.enum(['premium', 'standard']).default('standard'),
  additionalImageUrls: z.array(z.string().url()).default([]),
  fullBodyImageUrl: z.string().url().nullable().default(null),
  upperBodyImageUrl: z.string().url().nullable().default(null),
  greenScreenClips: z.array(GreenScreenClipSchema).default([]),
  voiceId: z.string().nullable().default(null),
  voiceProvider: z
    .enum(['elevenlabs', 'unrealspeech', 'custom'])
    .nullable()
    .default(null),
  description: z.string().nullable().default(null),
  isDefault: z.boolean().default(false),
});

// ============================================================================
// GET — List profiles
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const userId = String(user.uid);

    logger.info('Listing avatar profiles', {
      file: 'api/video/avatar-profiles/route.ts',
      userId,
    });

    const profiles = await listAvatarProfiles(userId);

    return NextResponse.json({
      success: true,
      profiles,
    });
  } catch (error) {
    logger.error(
      'Failed to list avatar profiles',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/avatar-profiles/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to list avatar profiles' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST — Create profile
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const userId = String(user.uid);

    const body: unknown = await request.json();
    const parseResult = CreateProfileSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid create avatar profile request', {
        file: 'api/video/avatar-profiles/route.ts',
        userId,
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

    logger.info('Creating avatar profile', {
      file: 'api/video/avatar-profiles/route.ts',
      userId,
      name: data.name,
    });

    const result = await createAvatarProfile(userId, {
      name: data.name,
      frontalImageUrl: data.frontalImageUrl,
      tier: data.tier,
      additionalImageUrls: data.additionalImageUrls,
      fullBodyImageUrl: data.fullBodyImageUrl,
      upperBodyImageUrl: data.upperBodyImageUrl,
      greenScreenClips: data.greenScreenClips,
      voiceId: data.voiceId,
      voiceProvider: data.voiceProvider,
      description: data.description,
      isDefault: data.isDefault,
    });

    if (!result.success || !result.profile) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: result.profile,
    });
  } catch (error) {
    logger.error(
      'Failed to create avatar profile',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/avatar-profiles/route.ts' }
    );

    return NextResponse.json(
      { success: false, error: 'Failed to create avatar profile' },
      { status: 500 }
    );
  }
}
