/**
 * Team Leaderboard API
 * GET /api/team/leaderboard - Get team performance leaderboard
 */

import { type NextRequest, NextResponse } from 'next/server';
import { calculateLeaderboard } from '@/lib/team/collaboration';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

// Valid period type with type guard
type LeaderboardPeriod = 'week' | 'month' | 'quarter' | 'year';
const VALID_PERIODS: readonly LeaderboardPeriod[] = ['week', 'month', 'quarter', 'year'] as const;

function isValidPeriod(value: string): value is LeaderboardPeriod {
  return (VALID_PERIODS as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = token.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';
    const periodParam = searchParams.get('period') ?? 'month';
    const period: LeaderboardPeriod = isValidPeriod(periodParam) ? periodParam : 'month';

    const leaderboard = await calculateLeaderboard(organizationId, workspaceId, period);

    return NextResponse.json({
      success: true,
      data: leaderboard,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Leaderboard API failed', error instanceof Error ? error : undefined, {});
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

