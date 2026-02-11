/**
 * Deal Health API
 * GET /api/crm/deals/[dealId]/health - Get health score for a deal
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { calculateDealHealth } from '@/lib/crm/deal-health';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { dealId } = await params;

    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';

    const health = await calculateDealHealth(workspaceId, dealId);

    return NextResponse.json({
      success: true,
      data: health,
    });

  } catch (error) {
    logger.error('Deal health API failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

