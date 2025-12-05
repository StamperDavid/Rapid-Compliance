import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { getWinLossAnalysis } from '@/lib/analytics/analytics-service';

/**
 * GET /api/analytics/win-loss - Get win/loss analysis
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const period = searchParams.get('period') || 'last_30_days';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId required' },
        { status: 400 }
      );
    }

    // Default to last 30 days if dates not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();

    const { user } = authResult;
    const orgId = user.organizationId;

    const analysis = await getWinLossAnalysis(orgId, workspaceId, period, start, end);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error('Error getting win/loss analysis:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get win/loss analysis' },
      { status: 500 }
    );
  }
}





