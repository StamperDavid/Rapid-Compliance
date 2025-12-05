import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { getSalesForecast } from '@/lib/analytics/analytics-service';

/**
 * GET /api/analytics/forecast - Get sales forecast
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const period = searchParams.get('period') || 'month';

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId required' },
        { status: 400 }
      );
    }

    const { user } = authResult;
    const orgId = user.organizationId;

    const forecast = await getSalesForecast(orgId, workspaceId, period as any);

    return NextResponse.json({
      success: true,
      forecast,
    });
  } catch (error: any) {
    console.error('Error getting sales forecast:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get sales forecast' },
      { status: 500 }
    );
  }
}





