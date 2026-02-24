/**
 * Mission Cancel Endpoint — User-initiated mission cancellation
 *
 * POST /api/orchestrator/missions/[missionId]/cancel
 *
 * Sets mission status to FAILED with 'Cancelled by user' error.
 * Marks any RUNNING steps as FAILED. Used by Mission Control's
 * cancel button for real-time intervention.
 *
 * @module api/orchestrator/missions/[missionId]/cancel
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { cancelMission } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

export async function POST(
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

    const cancelled = await cancelMission(missionId);

    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: 'Mission not found or already completed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      status: 'CANCELLED',
      missionId,
    });
  } catch (error: unknown) {
    logger.error(
      'Mission cancel failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions/[missionId]/cancel' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to cancel mission' },
      { status: 500 }
    );
  }
}
