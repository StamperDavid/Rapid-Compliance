/**
 * Team Leaderboard API
 * GET /api/team/leaderboard - Get team performance leaderboard
 */

import { type NextRequest, NextResponse } from 'next/server';
import { calculateLeaderboard } from '@/lib/team/collaboration';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// Valid period type with type guard
type LeaderboardPeriod = 'week' | 'month' | 'quarter' | 'year';
const VALID_PERIODS: readonly LeaderboardPeriod[] = ['week', 'month', 'quarter', 'year'] as const;

function isValidPeriod(value: string): value is LeaderboardPeriod {
  return (VALID_PERIODS as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);

    const periodParam = searchParams.get('period') ?? 'month';
    const period: LeaderboardPeriod = isValidPeriod(periodParam) ? periodParam : 'month';

    const leaderboard = await calculateLeaderboard(period);

    return NextResponse.json({
      success: true,
      data: leaderboard,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Leaderboard API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

