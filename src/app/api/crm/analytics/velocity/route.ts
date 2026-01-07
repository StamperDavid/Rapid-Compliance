/**
 * Sales Velocity API
 * GET /api/crm/analytics/velocity - Get sales velocity metrics
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { calculateSalesVelocity, getPipelineInsights } from '@/lib/crm/sales-velocity';
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

    // Parse date range
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const dateRange = startDate && endDate 
      ? { start: new Date(startDate), end: new Date(endDate) }
      : undefined;

    const [metrics, insights] = await Promise.all([
      calculateSalesVelocity(organizationId, workspaceId, dateRange),
      getPipelineInsights(organizationId, workspaceId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        insights,
      },
    });

  } catch (error: any) {
    logger.error('Sales velocity API failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

