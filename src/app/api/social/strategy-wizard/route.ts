/**
 * API Route: Social Strategy Wizard
 *
 * POST /api/social/strategy-wizard
 *   Body: { businessDescription, goals?, platforms?, postsPerPlatform? }
 *   Generates a cross-platform strategy + per-platform post DRAFTS by fanning
 *   out to the real per-platform specialists (Brand DNA baked into each GM —
 *   Standing Rule #1). Returns a structured plan. Does NOT post or queue
 *   anything. Read-only with respect to the swarm (no GM mutation — Rule #2).
 *
 * Response (success): { success: true, plan: StrategyWizardPlan }
 * Response (failure): { success: false, error: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { generateStrategyWizardPlan } from '@/lib/social/strategy-wizard-service';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const PlatformEnum = z.enum(
  SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]],
);

const BodySchema = z.object({
  businessDescription: z.string().trim().min(10).max(4000),
  goals: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
  platforms: z.array(PlatformEnum).max(SOCIAL_PLATFORMS.length).optional(),
  postsPerPlatform: z.number().int().min(1).max(5).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimitMiddleware(request, '/api/social/strategy-wizard');
    if (rl) { return rl; }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) { return auth; }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Request body must be valid JSON.' },
        { status: 400 },
      );
    }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request.', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const plan = await generateStrategyWizardPlan(parsed.data);

    return NextResponse.json({ success: true, plan });
  } catch (error: unknown) {
    logger.error(
      'Strategy Wizard API: POST failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    const message = error instanceof Error ? error.message : 'Failed to generate strategy.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
