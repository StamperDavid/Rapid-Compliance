/**
 * Marketing Budget Conversions API
 *
 * GET /api/marketing/budget/conversions?windowDays=30
 *   Returns per-platform conversion counts aggregated from the `leads`
 *   collection. The budget page "Pull from CRM" button calls this so the
 *   operator can populate the spend snapshot from real attributed data
 *   instead of typing counts by hand.
 *
 * Gated by requireRole(['owner', 'admin']) — marketing-attribution data is
 * sensitive; never expose lead counts to non-admin tenants.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { aggregateConversionsByPlatform } from '@/lib/marketing/budget-conversion-aggregator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const url = new URL(request.url);
    const windowDaysRaw = url.searchParams.get('windowDays') ?? '30';
    const windowDays = Number.parseInt(windowDaysRaw, 10);
    if (!Number.isFinite(windowDays) || windowDays <= 0 || windowDays > 365) {
      return NextResponse.json(
        { success: false, error: `windowDays must be an integer between 1 and 365 (got "${windowDaysRaw}")` },
        { status: 422 },
      );
    }

    const aggregation = await aggregateConversionsByPlatform(windowDays);
    return NextResponse.json({ success: true, aggregation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(
      '[BudgetConversionsAPI] aggregation failed',
      err instanceof Error ? err : undefined,
      { route: '/api/marketing/budget/conversions' },
    );
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
