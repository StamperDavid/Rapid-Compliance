import { NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { getRevenueReport } from '@/lib/analytics/analytics-service';
import { z } from 'zod';
import { validateInput } from '@/lib/validation/schemas';

const revenueReportSchema = z.object({
  workspaceId: z.string(),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
});

/**
 * GET /api/analytics/revenue - Get revenue report
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const period = searchParams.get('period') || 'monthly';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!workspaceId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, startDate, and endDate required' },
        { status: 400 }
      );
    }

    const validation = revenueReportSchema.safeParse({
      workspaceId,
      period,
      startDate,
      endDate,
    });

    if (!validation.success) {
      const errorDetails = validation.error.errors.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      }));
      
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const { user } = authResult;
    const orgId = user.organizationId;

    const report = await getRevenueReport(
      orgId,
      workspaceId,
      period as any,
      validation.data.startDate,
      validation.data.endDate
    );

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('Error getting revenue report:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get revenue report' },
      { status: 500 }
    );
  }
}

