/**
 * API Route: Pending Mission Step for Platform
 *
 * GET  /api/social/platforms/{platform}/pending-mission-step
 *   Returns the most-recent AWAITING_APPROVAL mission tagged with the given
 *   platform in mission.metadata.platform, together with its first FAILED step.
 *   Returns { success: true, mission: null } when no pending mission is found.
 *
 * Used by PlatformDashboard's InlineReviewCard to surface operator-attention
 * items directly inside the platform hub without requiring a Mission Control visit.
 *
 * Response shape on success:
 *   { success: true, missionId: string, step: MissionStep }
 *   { success: true, mission: null }
 *   { success: false, error: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { findPendingMissionForPlatform } from '@/lib/orchestrator/mission-persistence';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const PlatformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

async function applyGuards(request: NextRequest): Promise<NextResponse | null> {
  const rl = await rateLimitMiddleware(request, '/api/social/platforms/pending-mission-step');
  if (rl) { return rl; }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) { return auth; }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const guard = await applyGuards(request);
    if (guard) { return guard; }

    const rawParams = await params;
    const parsed = PlatformSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const platform = parsed.data.platform;

    const result = await findPendingMissionForPlatform(platform);
    if (!result) {
      return NextResponse.json({ success: true, mission: null });
    }

    return NextResponse.json({
      success: true,
      missionId: result.mission.missionId,
      step: result.step,
    });
  } catch (error: unknown) {
    logger.error(
      'Pending Mission Step API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch pending mission step' },
      { status: 500 },
    );
  }
}
