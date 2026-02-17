/**
 * Sales Velocity API
 * GET /api/crm/analytics/velocity - Get sales velocity metrics
 */

import { type NextRequest, NextResponse } from 'next/server';
import { calculateSalesVelocity, getPipelineInsights } from '@/lib/crm/sales-velocity';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAuthToken } from '@/lib/auth/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse date range
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const dateRange = startDate && endDate
      ? { start: new Date(startDate), end: new Date(endDate) }
      : undefined;

    const [metrics, insights] = await Promise.all([
      calculateSalesVelocity(dateRange),
      getPipelineInsights(),
    ]);

    // Convert Map objects to plain objects for JSON serialization
    // (Map serializes to {} in JSON.stringify)
    const serializedMetrics = {
      ...metrics,
      stageMetrics: Object.fromEntries(metrics.stageMetrics),
      conversionRates: Object.fromEntries(metrics.conversionRates),
    };

    return NextResponse.json({
      success: true,
      data: {
        metrics: serializedMetrics,
        insights,
      },
    });

  } catch (error) {
    logger.error('Sales velocity API failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

