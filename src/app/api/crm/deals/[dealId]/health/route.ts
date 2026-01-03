/**
 * Deal Health API
 * GET /api/crm/deals/[dealId]/health - Get health score for a deal
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateDealHealth } from '@/lib/crm/deal-health';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { dealId: string } }
) {
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

    const workspaceId = searchParams.get('workspaceId') || 'default';
    const { dealId } = params;

    const health = await calculateDealHealth(organizationId, workspaceId, dealId);

    return NextResponse.json({
      success: true,
      data: health,
    });

  } catch (error: any) {
    logger.error('Deal health API failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

