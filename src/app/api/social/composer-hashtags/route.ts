/**
 * Composer — AI Hashtag Suggestions
 *
 * POST /api/social/composer-hashtags
 *
 * Asks the REAL per-platform marketing specialist (Brand DNA baked into its
 * Golden Master, Standing Rule #1) for the best hashtags for the operator's
 * current draft, respecting that platform's hashtag conventions.
 *
 * Body:    { platform, contentType, text }
 * Success: { success: true, hashtags: string[] }
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
import { runHashtagSuggest } from '@/lib/social/hashtag-suggest-service';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  contentType: z.string().min(1).max(50),
  text: z.string().trim().min(1).max(50000),
});

export async function POST(request: NextRequest) {
  const rl = await rateLimitMiddleware(request, '/api/social/composer-hashtags');
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

    const { platform, contentType, text } = parsed.data;

    const config = getPlatformConfig(platform);
    if (!config.specialistId) {
      return NextResponse.json(
        { success: false, error: `No AI specialist is registered for ${platform} yet.` },
        { status: 409 },
      );
    }

    const result = await runHashtagSuggest({ platform, contentType, text });
    return NextResponse.json({ success: true, hashtags: result.hashtags });
  } catch (err) {
    logger.error(
      '[ComposerHashtags] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to suggest hashtags' },
      { status: 500 },
    );
  }
}
