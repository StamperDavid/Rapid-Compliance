/**
 * API Route: Per-Platform Audience Trajectory
 *
 * GET /api/social/platforms/{platform}/audience
 *
 * Returns the brand's audience trajectory for a single platform:
 *   - baseline:    counts captured at OAuth-connect time
 *   - current:     counts fetched live right now
 *   - improvement: deltas (absolute + percent) since the baseline
 *   - history:     recent daily snapshots for the sparkline
 *
 * Response shape:
 *   { success: true, baseline, current, improvement, history }
 *   { success: false, error }
 *
 * Read-only — no GM mutation, no Brand DNA mutation. The fetch may take a
 * second on Twitter/Bluesky/Mastodon (one external API call).
 *
 * If the platform is not yet live (no specialist with credentials) we
 * return success=true with all four fields null/empty so the UI can
 * render an empty state rather than an error toast.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import {
  AudienceBaselineService,
} from '@/lib/social/audience-baseline-service';
import { fetchAudienceCounts } from '@/lib/social/audience-counts-fetcher';
import { SocialAccountService } from '@/lib/social/social-account-service';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const PlatformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

const HISTORY_DAYS = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      '/api/social/platforms/audience',
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

    // Find the connected account for this platform. If none, return an
    // empty trajectory — the UI will render the "no data yet" state.
    const accounts = await SocialAccountService.listAccounts(platform);
    const active = accounts.find((a) => a.status === 'active') ?? accounts[0];

    if (!active) {
      return NextResponse.json({
        success: true,
        platform,
        connected: false,
        baseline: null,
        current: null,
        improvement: null,
        history: [],
      });
    }

    // Fetch current counts in parallel with the baseline + history reads.
    const [current, trajectory] = await Promise.all([
      fetchAudienceCounts(platform),
      AudienceBaselineService.getTrajectory(platform, active.id, HISTORY_DAYS, null),
    ]);

    // Re-compute improvement now that we have the live current value.
    const improvement = trajectory.baseline && current
      ? AudienceBaselineService.computeImprovement(trajectory.baseline, current)
      : null;

    return NextResponse.json({
      success: true,
      platform,
      connected: true,
      accountId: active.id,
      baseline: trajectory.baseline,
      current,
      improvement,
      history: trajectory.history,
    });
  } catch (error: unknown) {
    logger.error(
      'Audience Trajectory API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load audience trajectory',
      },
      { status: 500 },
    );
  }
}
