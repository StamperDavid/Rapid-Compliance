/**
 * POST /api/content/shot-plan/render-asset
 *
 * Render ONE asset of the production sheet and return the updated plan, so the
 * client can render the whole spread PROGRESSIVELY (one short request per asset)
 * instead of a single multi-minute request that can drop before the browser
 * receives it. Steps: floor-plan backdrop, environment hero, lighting swatches,
 * character model-sheets, or a single shot's keyframe.
 *
 * Thin route: auth, validate (Zod), delegate to the generation service, map errors.
 * All images persist to OUR storage + media library (ownership rule).
 *
 * Part of the Shot-Plan flow on fal / Seedance.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import {
  generateFloorPlanImage,
  generateEnvironmentHero,
  generateLightingSwatches,
  generateCharacterSheets,
  generateShotKeyframe,
} from '@/lib/video/shot-plan-generation-service';
import { type ShotPlan, ShotPlanSchema } from '@/types/shot-plan';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/render-asset/route.ts';

const BodySchema = z.object({
  plan: ShotPlanSchema,
  step: z.enum(['floor-plan', 'environment-hero', 'lighting', 'characters', 'keyframe']),
  shotId: z.string().trim().min(1).optional(),
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
    const { plan, step, shotId } = parsed.data;
    const ctx = { tenantId: PLATFORM_ID };

    let updated: ShotPlan;
    switch (step) {
      case 'floor-plan':
        updated = await generateFloorPlanImage(plan, ctx);
        break;
      case 'environment-hero':
        updated = await generateEnvironmentHero(plan, ctx);
        break;
      case 'lighting':
        updated = await generateLightingSwatches(plan, ctx);
        break;
      case 'characters':
        updated = await generateCharacterSheets(plan, ctx);
        break;
      case 'keyframe':
        if (!shotId) {
          return NextResponse.json(
            { success: false, error: 'shotId is required for the keyframe step' },
            { status: 400 },
          );
        }
        updated = await generateShotKeyframe(plan, shotId, ctx);
        break;
    }

    logger.info('[shot-plan/render-asset] step rendered', { file: FILE, step, shotId });
    return NextResponse.json({ success: true, plan: updated });
  } catch (error) {
    logger.error(
      'Shot Plan render-asset failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Rendering that asset failed',
      },
      { status: 500 },
    );
  }
}
