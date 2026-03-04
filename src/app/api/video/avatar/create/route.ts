/**
 * Custom Avatar Creation API
 * POST /api/video/avatar/create - Create a HeyGen Instant Avatar from a photo URL
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { createInstantAvatar } from '@/lib/video/video-service';

export const dynamic = 'force-dynamic';

const CreateAvatarSchema = z.object({
  photoUrl: z.string().url('Valid photo URL required'),
  avatarName: z.string().min(1, 'Avatar name required').max(100),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parseResult = CreateAvatarSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const { photoUrl, avatarName } = parseResult.data;

    logger.info('Creating custom avatar', {
      avatarName,
      file: 'avatar/create/route.ts',
    });

    const result = await createInstantAvatar(photoUrl, avatarName);

    return NextResponse.json({
      success: true,
      avatarId: result.avatarId,
      status: result.status,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Avatar creation failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'avatar/create/route.ts',
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
