/**
 * POST /api/content/shot-plan/generate-all
 *
 * Generate EVERY shot of a Shot Plan, in order, on the fal / Seedance provider.
 * Continue shots chain off the prior shot's freshly-persisted last frame, so the
 * orchestrator runs them sequentially and accumulates the plan shot-by-shot.
 * Returns the final, fully-generated plan.
 *
 * LONG-RUNNING: one synchronous fal generation + persist per shot, so this
 * request can take several minutes for a multi-shot plan. That is acceptable for
 * now; a queue/poll split (submit → 202 + job id, poll for progress) can come
 * later without changing the orchestrator's API.
 *
 * Thin route: authenticate, validate (Zod), delegate, map errors to HTTP. On a
 * shot failure the orchestrator halts and the partial plan is returned in the
 * error response so the operator can inspect / resume.
 *
 * The Shot-Plan generation flow, rendering on fal / Seedance.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { generateAllShots } from '@/lib/video/shot-plan-generation-service';
import { type ShotPlan, ShotPlanSchema } from '@/types/shot-plan';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/generate-all/route.ts';

const BodySchema = z.object({
  plan: ShotPlanSchema,
});

/** Narrow an unknown error to its optional `partialPlan` payload (set by the orchestrator on halt). */
function partialPlanOf(error: unknown): ShotPlan | undefined {
  if (error && typeof error === 'object' && 'partialPlan' in error) {
    const candidate = (error as { partialPlan?: unknown }).partialPlan;
    const result = ShotPlanSchema.safeParse(candidate);
    if (result.success) {
      return result.data;
    }
  }
  return undefined;
}

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

    const finalPlan = await generateAllShots(parsed.data.plan, { tenantId: PLATFORM_ID });

    logger.info('[shot-plan/generate-all] all shots generated', {
      file: FILE,
      shots: finalPlan.shots.length,
    });

    return NextResponse.json({ success: true, plan: finalPlan });
  } catch (error) {
    logger.error(
      'Shot Plan generate-all failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    const partialPlan = partialPlanOf(error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Shot Plan generation failed',
        ...(partialPlan ? { partialPlan } : {}),
      },
      { status: 500 },
    );
  }
}
