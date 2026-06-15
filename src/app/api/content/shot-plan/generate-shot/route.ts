/**
 * POST /api/content/shot-plan/generate-shot
 *
 * Generate ONE shot of a Shot Plan on the fal / Seedance provider, persist its
 * clip + last frame to OUR Firebase Storage + media library, and return the
 * updated plan with the shot's `generated` field written.
 *
 * Thin route: authenticate, validate (Zod), delegate to the generation
 * orchestrator, map errors to HTTP. No business logic here.
 *
 * This is the Shot-Plan generation flow, rendering on fal / Seedance.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { generateShot } from '@/lib/video/shot-plan-generation-service';
import { ShotPlanSchema } from '@/types/shot-plan';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/generate-shot/route.ts';

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

    const updatedPlan = await generateShot(plan, shotId, { tenantId: PLATFORM_ID });

    logger.info('[shot-plan/generate-shot] shot generated', { file: FILE, shotId });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error) {
    logger.error(
      'Shot Plan generate-shot failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Shot generation failed',
      },
      { status: 500 },
    );
  }
}
