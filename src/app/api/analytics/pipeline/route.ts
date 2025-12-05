import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { getPipelineReport } from '@/lib/analytics/analytics-service';

/**
 * GET /api/analytics/pipeline - Get pipeline report
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const period = searchParams.get('period') || 'current';

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId required' },
        { status: 400 }
      );
    }

    const { user } = authResult;
    const orgId = user.organizationId;

    const report = await getPipelineReport(orgId, workspaceId, period);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Error getting pipeline report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get pipeline report' },
      { status: 500 }
    );
  }
}





