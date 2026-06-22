/**
 * POST /api/content/shot-plan/save-character
 *
 * One-click "Add to Character Library" for a single shot-doc cast member. Creates a
 * Character-Library profile (NOT the media library), autofilling the card from the
 * cast member's authored identity and reusing the images already generated for the
 * doc — nothing is regenerated. Idempotent: a character that is already a saved
 * profile returns success with `alreadySaved: true`.
 *
 * Thin route: authenticate, Zod-validate the cast member against its canonical
 * contract, delegate to `saveCastMemberToLibrary`, return plain-English result.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { ShotPlanCastMemberSchema } from '@/types/shot-plan';
import { saveCastMemberToLibrary } from '@/lib/video/shot-plan-generation-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/save-character/route.ts';

const BodySchema = z.object({
  /** The cast member to save — validated against the canonical Shot Plan contract. */
  member: ShotPlanCastMemberSchema,
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid character' },
        { status: 400 },
      );
    }

    const result = await saveCastMemberToLibrary(parsed.data.member, authResult.user.uid);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? "We couldn't add this character to your library." },
        { status: 400 },
      );
    }

    logger.info('[shot-plan/save-character] character added to Character Library', {
      file: FILE,
      userId: authResult.user.uid,
      profileId: result.profileId,
      alreadySaved: result.alreadySaved ?? false,
    });

    return NextResponse.json({
      success: true,
      profileId: result.profileId,
      alreadySaved: result.alreadySaved ?? false,
    });
  } catch (error) {
    logger.error(
      'Save character to library failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `We couldn't add this character to your library: ${error.message}`
            : "We couldn't add this character to your library. Please try again.",
      },
      { status: 500 },
    );
  }
}
