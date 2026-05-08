/**
 * Renew Google Calendar Watch Channel — Daily Cron
 * ─────────────────────────────────────────────────────────────────────
 * POST /api/cron/renew-calendar-watch
 * Schedule: 09:00 UTC daily (vercel.json)
 *
 * Google Calendar push channels max out at 30 days. We renew at
 * <7 days remaining so any cron miss (Vercel outage, push delay)
 * doesn't drop us into a state where the channel expired before
 * the next cron tick.
 *
 * The renewal itself is no-op if the channel is still fresh — calling
 * this hourly would also be safe, daily is just frugal.
 *
 * Authenticated via CRON_SECRET (existing pattern, see
 * `/api/cron/run-scheduled-calls/route.ts`). Vercel passes
 * `Authorization: Bearer <CRON_SECRET>` on every cron invocation.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { renewConnectedGoogleCalendarWatch } from '@/lib/integrations/calendar-watch-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROUTE = '/api/cron/renew-calendar-watch';

async function handle(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request, ROUTE);
  if (authError) {
    return authError;
  }

  try {
    const result = await renewConnectedGoogleCalendarWatch();
    logger.info('[renew-calendar-watch] cron run', {
      route: ROUTE,
      renewed: result.renewed,
      reason: result.reason,
      expiration: result.expiration,
    });
    return NextResponse.json({
      success: true,
      renewed: result.renewed,
      reason: result.reason,
      expiration: result.expiration,
    });
  } catch (err) {
    logger.error(
      '[renew-calendar-watch] cron threw',
      err instanceof Error ? err : new Error(String(err)),
      { route: ROUTE },
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Vercel cron POSTs by default; accept GET too in case of manual trigger
// from a curl / browser test (existing run-scheduled-calls follows the
// same dual-handler pattern).
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
