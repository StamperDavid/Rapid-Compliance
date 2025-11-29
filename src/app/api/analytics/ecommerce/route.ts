import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { getEcommerceAnalytics } from '@/lib/analytics/ecommerce-analytics';

/**
 * GET /api/analytics/ecommerce - Get e-commerce analytics
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId required' },
        { status: 400 }
      );
    }

    // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();

    const analytics = await getEcommerceAnalytics(workspaceId, start, end);

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    console.error('Error getting e-commerce analytics:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get e-commerce analytics' },
      { status: 500 }
    );
  }
}

