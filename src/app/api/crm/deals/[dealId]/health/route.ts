/**
 * Deal Health API
 * GET /api/crm/deals/[dealId]/health - Get health score for a deal
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
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

    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = (workspaceIdParam !== '' && workspaceIdParam != null) ? workspaceIdParam : 'default';
    const { dealId } = params;

    const health = await calculateDealHealth(organizationId, workspaceId, dealId);

    return NextResponse.json({
      success: true,
      data: health,
    });

  } catch (error) {
    logger.error('Deal health API failed', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

