/**
 * POST /api/video/avatar-profiles/[profileId]/add-image
 *
 * MOVE a media-library image onto this character as a reference image.
 *
 * This RELOCATES the image: its URL is appended to the character's reference
 * set and the media-library record is deleted, so the image no longer appears
 * in the general media browse. The underlying Storage file is NOT deleted —
 * the character now references that same URL.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { moveImageToCharacter } from '@/lib/video/avatar-profile-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/video/avatar-profiles/[profileId]/add-image/route.ts';

const MoveImageSchema = z.object({
  assetId: z.string().min(1),
  // Which reference slot to fill. Optional — defaults to 'additional' downstream.
  slot: z.enum(['frontal', 'additional', 'fullBody', 'upperBody']).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const userId = authResult.user.uid;

    const { profileId } = await params;
    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'Character ID is required' },
        { status: 400 },
      );
    }

    const body: unknown = await request.json();
    const parsed = MoveImageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: parsed.error.errors.map((e) => ({
            path: e.path.join('.') || 'unknown',
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    const { assetId, slot } = parsed.data;

    logger.info('Moving media image onto character', {
      file: FILE,
      profileId,
      assetId,
      slot: slot ?? 'additional',
    });

    const result = await moveImageToCharacter(userId, assetId, profileId, slot);

    if (!result.success) {
      const message = result.error ?? 'Failed to add image to character';
      // Ownership / not-found failures are client errors, not server faults.
      const status =
        message.includes('not found') ||
        message.includes('does not belong') ||
        message.includes('Only image') ||
        message.includes('maximum')
          ? 400
          : 500;
      return NextResponse.json({ success: false, error: message }, { status });
    }

    return NextResponse.json({ success: true, profile: result.profile });
  } catch (error) {
    logger.error(
      'Failed to move image to character',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to add image to character' },
      { status: 500 },
    );
  }
}
