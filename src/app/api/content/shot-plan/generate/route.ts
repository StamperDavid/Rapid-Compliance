/**
 * POST /api/content/shot-plan/generate
 *
 * Thin route: requireAuth → validate { brief, shotCount?, title? } with Zod →
 * delegate to `generateShotPlan` (the real Shot Plan Planner specialist, which
 * auto-casts the operator's own Character Library and loads its Golden Master
 * from Firestore per Standing Rule #1). Returns the contract-valid ShotPlan.
 *
 * No business logic lives here — the planner owns generation. The route only
 * authenticates, validates the input shape, binds the authed uid, and maps
 * thrown errors onto HTTP responses.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateShotPlan } from '@/lib/agents/content/shot-plan/planner';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/generate/route.ts';

const BodySchema = z.object({
  brief: z.string().trim().min(1, 'Describe the video you want to plan').max(8000),
  shotCount: z.number().int().min(1).max(50).optional(),
  title: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const plan = await generateShotPlan({
      brief: body.brief,
      userId: user.uid,
      ...(body.shotCount !== undefined ? { shotCount: body.shotCount } : {}),
      ...(body.title ? { title: body.title } : {}),
    });

    logger.info('[shot-plan/generate] plan generated', {
      file: FILE,
      shots: plan.shots.length,
      castSize: plan.sharedChoices.cast.length,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    logger.error(
      'Shot Plan generation failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Shot Plan generation failed',
      },
      { status: 500 },
    );
  }
}
