/**
 * Google Ads connection status.
 *
 * GET /api/integrations/google-ads/status
 *   Returns a status snapshot (configured, googleAccountConnected,
 *   hasAdwordsScope, developerToken present, customerId present, plain-English diagnostic).
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { getGoogleAdsStatus } from '@/lib/integrations/google-ads-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) {return auth;}
  try {
    const status = await getGoogleAdsStatus();
    return NextResponse.json({ success: true, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[GoogleAdsStatusAPI] failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
