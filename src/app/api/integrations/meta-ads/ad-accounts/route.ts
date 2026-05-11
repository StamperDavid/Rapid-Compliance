/**
 * List Meta ad accounts the operator's connected token can see. The
 * settings card calls this to populate the ad-account picker when the
 * operator wants to switch which account BUDGET_STRATEGIST targets.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { getMetaAdsConfig, listAdAccounts } from '@/lib/integrations/meta-ads-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) {return auth;}
  try {
    const cfg = await getMetaAdsConfig();
    if (!cfg) {return NextResponse.json({ success: false, error: 'Meta Ads not connected' }, { status: 400 });}
    const adAccounts = await listAdAccounts(cfg.accessToken);
    return NextResponse.json({ success: true, adAccounts, selected: cfg.adAccountId });
  } catch (err) {
    logger.error('[MetaAdsAdAccountsAPI] failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
