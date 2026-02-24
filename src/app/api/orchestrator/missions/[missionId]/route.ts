/**
 * Single Mission API — Fetch a specific mission by ID
 *
 * GET /api/orchestrator/missions/[missionId]
 *
 * Used by Mission Control for polling individual mission status.
 * Authentication: Required (any authenticated user)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getMission } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { missionId } = await params;

    if (!missionId) {
      return NextResponse.json(
        { success: false, error: 'missionId is required' },
        { status: 400 }
      );
    }

    const mission = await getMission(missionId);

    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mission,
    });
  } catch (error: unknown) {
    logger.error(
      'Mission fetch failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions/[missionId]' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch mission' },
      { status: 500 }
    );
  }
}
