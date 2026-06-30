/**
 * Composer — Multi-Variant Generation
 *
 * POST /api/social/composer-variants
 *
 * Produces N alternative versions of the operator's current draft via the REAL
 * per-platform marketing specialist (Brand DNA baked into its Golden Master,
 * Standing Rule #1). Each variant is a distinct-angle specialist call.
 *
 * Body:    { platform, contentType, text, count? }
 * Success: { success: true, variants: string[] }
 * Error:   { success: false, error: string }
 *
 * Auth-gated. Standing Rule #2: does NOT mutate any Golden Master.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getPlatformConfig } from '@/components/social/_platform-state';
import { SOCIAL_PLATFORMS } from '@/types/social';
import { runPostVariants } from '@/lib/social/post-variants-service';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  contentType: z.string().min(1).max(50),
  text: z.string().trim().min(1).max(50000),
  count: z.number().int().min(2).max(5).optional(),
});

export async function POST(request: NextRequest) {
  const rl = await rateLimitMiddleware(request, '/api/social/composer-variants');
  if (rl) { return rl; }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const rawBody: unknown = await request.json();
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { platform, contentType, text, count } = parsed.data;

    const config = getPlatformConfig(platform);
    if (!config.specialistId) {
      return NextResponse.json(
        { success: false, error: `No AI specialist is registered for ${platform} yet.` },
        { status: 409 },
      );
    }

    const result = await runPostVariants({
      platform,
      contentType,
      text,
      ...(count ? { count } : {}),
    });
    return NextResponse.json({ success: true, variants: result.variants });
  } catch (err) {
    logger.error(
      '[ComposerVariants] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to generate variations' },
      { status: 500 },
    );
  }
}
