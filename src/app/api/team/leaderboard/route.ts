/**
 * Team Leaderboard API
 * GET /api/team/leaderboard - Get team performance leaderboard
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { calculateLeaderboard } from '@/lib/team/collaboration';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

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
    const periodParam = searchParams.get('period');
    const period = ((periodParam !== '' && periodParam != null) ? periodParam : 'month') as 'week' | 'month' | 'quarter' | 'year';

    const leaderboard = await calculateLeaderboard(organizationId, workspaceId, period);

    return NextResponse.json({
      success: true,
      data: leaderboard,
    });

  } catch (error: any) {
    logger.error('Leaderboard API failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

