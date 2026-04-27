/**
 * API Route: Social Metrics Per-Platform
 *
 * GET /api/social/metrics/{platform}
 *
 * Returns the same totals shape as the overview endpoint, scoped to
 * one platform, plus the 20 most recent published posts for that
 * platform and a 30-day trend. Validates `platform` against the
 * canonical `SOCIAL_PLATFORMS` list — returns 422 for unknown values.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSocialMetricsForPlatform } from '@/lib/social/metrics-service';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const PlatformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      '/api/social/metrics/platform',
    );
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const rawParams = await params;
    const parsed = PlatformSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const platform = parsed.data.platform;
    const data = await getSocialMetricsForPlatform(platform);

    return NextResponse.json({
      success: true,
      platform: data.platform,
      totals: data.totals,
      recentPosts: data.recentPosts,
      trend: data.trend,
    });
  } catch (error: unknown) {
    logger.error(
      'Social Metrics Per-Platform API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load platform social metrics' },
      { status: 500 },
    );
  }
}
