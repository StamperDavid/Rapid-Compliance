/**
 * POST /api/content/shot-plan/render-assets
 *
 * Render EVERY image the production sheet needs so the operator reviews a COMPLETE
 * document: the top-down floor-plan backdrop + a keyframe still for every shot.
 * This is the OpenArt-style "Preview Shot Plan" step — planning already happened
 * (POST /generate); here we render the stills before review. Video is generated
 * later, on demand, per shot.
 *
 * LONG-RUNNING: one image generation per shot + one for the floor plan. Best-effort
 * per asset inside the orchestrator — a single failed image is skipped, not fatal.
 *
 * Thin route: authenticate, validate (Zod), delegate, map errors to HTTP. All
 * images are persisted to OUR Firebase Storage + media library (ownership rule).
 *
 * ADDITIVE: part of the Shot-Plan flow; does NOT touch the Hedra path.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { renderShotPlanAssets } from '@/lib/video/shot-plan-generation-service';
import { ShotPlanSchema } from '@/types/shot-plan';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/render-assets/route.ts';

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

    const updatedPlan = await renderShotPlanAssets(parsed.data.plan, { tenantId: PLATFORM_ID });

    logger.info('[shot-plan/render-assets] sheet assets rendered', {
      file: FILE,
      shots: updatedPlan.shots.length,
    });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error) {
    logger.error(
      'Shot Plan render-assets failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Rendering the sheet assets failed',
      },
      { status: 500 },
    );
  }
}
