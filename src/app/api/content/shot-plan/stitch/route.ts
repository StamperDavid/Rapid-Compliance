/**
 * POST /api/content/shot-plan/stitch
 *
 * Combine every GENERATED shot of a Shot Plan, in order, into ONE deliverable
 * video on OUR storage and return the plan with `finalVideoUrl` set. This is the
 * manual "build / rebuild the final video" path — the operator can call it after
 * generating all shots (or after regenerating a single shot) without re-rendering
 * any clips. It is also the retry target when the automatic stitch inside
 * /generate-all fails.
 *
 * Thin route: authenticate, validate (Zod), delegate, map errors to HTTP. The
 * stitched file is persisted to OUR Firebase Storage + media library (ownership
 * rule). LONG-RUNNING: one ffmpeg re-encode over all clips.
 *
 * Part of the Shot-Plan flow on fal / Seedance.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { stitchShotPlan } from '@/lib/video/shot-plan-generation-service';
import { ShotPlanSchema } from '@/types/shot-plan';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/stitch/route.ts';

const BodySchema = z.object({
  plan: ShotPlanSchema,
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
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const stitchedPlan = await stitchShotPlan(parsed.data.plan, { tenantId: PLATFORM_ID });

    logger.info('[shot-plan/stitch] final video stitched', {
      file: FILE,
      finalVideoUrl: stitchedPlan.finalVideoUrl,
    });

    return NextResponse.json({ success: true, plan: stitchedPlan });
  } catch (error) {
    logger.error(
      'Shot Plan stitch failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Combining the shots into one video failed',
      },
      { status: 500 },
    );
  }
}
