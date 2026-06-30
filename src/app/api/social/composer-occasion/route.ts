/**
 * Composer — Occasion / Holiday Post
 *
 * GET  /api/social/composer-occasion
 *   Returns the curated list of upcoming occasions for the picker.
 *   Response: { success: true, occasions: UpcomingOccasion[] }
 *
 * POST /api/social/composer-occasion
 *   Drafts a themed post for the chosen occasion via the REAL per-platform
 *   marketing specialist (Brand DNA baked into its Golden Master, Standing
 *   Rule #1).
 *   Body: { platform, contentType, occasionName, occasionDateIso? }
 *   Success: { success: true, text: string }
 *   Error:   { success: false, error: string }
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
import { getUpcomingOccasions } from '@/lib/social/occasions';
import { runOccasionPost } from '@/lib/social/occasion-post-service';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  contentType: z.string().min(1).max(50),
  occasionName: z.string().trim().min(1).max(120),
  occasionDateIso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
});

export async function GET(request: NextRequest) {
  const rl = await rateLimitMiddleware(request, '/api/social/composer-occasion');
  if (rl) { return rl; }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  return NextResponse.json({ success: true, occasions: getUpcomingOccasions() });
}

export async function POST(request: NextRequest) {
  const rl = await rateLimitMiddleware(request, '/api/social/composer-occasion');
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

    const { platform, contentType, occasionName, occasionDateIso } = parsed.data;

    const config = getPlatformConfig(platform);
    if (!config.specialistId) {
      return NextResponse.json(
        { success: false, error: `No AI specialist is registered for ${platform} yet.` },
        { status: 409 },
      );
    }

    const result = await runOccasionPost({
      platform,
      contentType,
      occasionName,
      ...(occasionDateIso ? { occasionDateIso } : {}),
    });

    return NextResponse.json({ success: true, text: result.text });
  } catch (err) {
    logger.error(
      '[ComposerOccasion] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to draft occasion post' },
      { status: 500 },
    );
  }
}
