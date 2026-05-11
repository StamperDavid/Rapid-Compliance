/**
 * Meta Ads status snapshot. Used by the settings card to drive its UI.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { getMetaAdsStatus } from '@/lib/integrations/meta-ads-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) {return auth;}
  try {
    const status = await getMetaAdsStatus();
    return NextResponse.json({ success: true, status });
  } catch (err) {
    logger.error('[MetaAdsStatusAPI] failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
