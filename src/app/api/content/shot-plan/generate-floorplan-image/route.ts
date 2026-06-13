/**
 * POST /api/content/shot-plan/generate-floorplan-image
 *
 * Render a top-down floor-plan backdrop image for a Shot Plan (the OpenArt-style
 * overhead set render) and return the updated plan with
 * `floorPlan.backdropImageUrl` set. The interactive FloorPlanCanvas draws the
 * camera / route / actor markers on top of this image, so the operator sees a
 * real rendered set from above instead of a blank grid.
 *
 * Thin route: authenticate, validate (Zod), delegate, map errors to HTTP. The
 * image is persisted to OUR Firebase Storage + media library (ownership rule).
 *
 * ADDITIVE: part of the Shot-Plan flow; does NOT touch the Hedra path.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { generateFloorPlanImage } from '@/lib/video/shot-plan-generation-service';
import { ShotPlanSchema } from '@/types/shot-plan';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/generate-floorplan-image/route.ts';

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

    const updatedPlan = await generateFloorPlanImage(parsed.data.plan, { tenantId: PLATFORM_ID });

    logger.info('[shot-plan/generate-floorplan-image] floor-plan image generated', { file: FILE });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error) {
    logger.error(
      'Shot Plan generate-floorplan-image failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Floor-plan image generation failed',
      },
      { status: 500 },
    );
  }
}
