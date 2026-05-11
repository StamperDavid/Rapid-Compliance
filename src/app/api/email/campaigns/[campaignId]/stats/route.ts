/**
 * Campaign Stats API
 *
 * GET /api/email/campaigns/:campaignId/stats
 *
 * Reads aggregate metrics for an email campaign (sent / opened / clicked /
 * bounced + derived rates). Server-side only so the underlying Firestore
 * read goes through Admin SDK — the dashboard page used to import the
 * service directly, which leaked firebase-admin into the client bundle.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCampaignStats } from '@/lib/email/campaign-manager';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { campaignId } = await params;
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
  }

  try {
    const stats = await getCampaignStats(campaignId);
    if (!stats) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json(stats);
  } catch (error) {
    logger.error(
      'Failed to load campaign stats',
      error instanceof Error ? error : new Error(String(error)),
      { campaignId, file: 'campaigns/[campaignId]/stats/route.ts' },
    );
    return NextResponse.json({ error: 'Failed to load campaign stats' }, { status: 500 });
  }
}
