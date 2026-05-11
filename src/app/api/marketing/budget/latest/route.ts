/**
 * Marketing Budget — Latest Snapshot API
 *
 * GET /api/marketing/budget/latest
 *   Returns the most recent BUDGET_STRATEGIST snapshot from Firestore.
 *   The dashboard widget calls this on mount so it can render the latest
 *   allocation without re-running the LLM. Returns 200 with `snapshot: null`
 *   when no analyses have been run yet.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getLatestSnapshot } from '@/lib/marketing/budget-snapshot-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const snapshot = await getLatestSnapshot();
    return NextResponse.json({ success: true, snapshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(
      '[BudgetLatestAPI] getLatestSnapshot failed',
      err instanceof Error ? err : undefined,
      { route: '/api/marketing/budget/latest' },
    );
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
