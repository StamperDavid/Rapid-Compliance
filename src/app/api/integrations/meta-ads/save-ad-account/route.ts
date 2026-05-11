/**
 * Save the operator's chosen Meta ad account (when there are multiple).
 * Keeps the existing access token; only swaps the adAccountId field.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { getMetaAdsConfig, saveMetaAdsConfig } from '@/lib/integrations/meta-ads-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  adAccountId: z.string().min(5).max(40),
});

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) {return auth;}

  try {
    const body: unknown = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 422 });
    }
    const cfg = await getMetaAdsConfig();
    if (!cfg) {return NextResponse.json({ success: false, error: 'Meta Ads not connected' }, { status: 400 });}

    const result = await saveMetaAdsConfig({
      accessToken: cfg.accessToken,
      adAccountId: parsed.data.adAccountId,
      tokenExpiresAt: cfg.tokenExpiresAt,
      scope: cfg.scope,
      userId: cfg.userId,
    });
    if (!result.success) {return NextResponse.json({ success: false, error: result.error }, { status: 400 });}
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[MetaAdsSaveAdAccount] failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
