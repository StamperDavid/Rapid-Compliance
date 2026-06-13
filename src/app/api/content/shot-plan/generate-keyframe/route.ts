/**
 * POST /api/content/shot-plan/generate-keyframe
 *
 * Generate a CHEAP pre-video STILL (keyframe) for ONE shot of a Shot Plan on the
 * fal provider so the operator can approve the look BEFORE committing to the
 * expensive video. The still is persisted to OUR Firebase Storage + media library
 * (ownership rule), and the updated plan is returned with the shot's
 * `generated.keyframeUrl` written.
 *
 * Thin route: authenticate, validate (Zod), delegate to the generation
 * orchestrator, map errors to HTTP. No business logic here.
 *
 * ADDITIVE: this is part of the new Shot-Plan generation flow — it does NOT touch
 * the Hedra scene-generator path or any Hedra route.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { generateShotKeyframe } from '@/lib/video/shot-plan-generation-service';
import { ShotPlanSchema } from '@/types/shot-plan';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/generate-keyframe/route.ts';

const BodySchema = z.object({
  plan: ShotPlanSchema,
  shotId: z.string().trim().min(1, 'shotId is required'),
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
    const { plan, shotId } = parsed.data;

    const updatedPlan = await generateShotKeyframe(plan, shotId, { tenantId: PLATFORM_ID });

    logger.info('[shot-plan/generate-keyframe] keyframe generated', { file: FILE, shotId });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error) {
    logger.error(
      'Shot Plan generate-keyframe failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Keyframe generation failed',
      },
      { status: 500 },
    );
  }
}
