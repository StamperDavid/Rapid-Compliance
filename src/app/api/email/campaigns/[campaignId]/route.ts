/**
 * Single Campaign API
 *
 * DELETE /api/email/campaigns/:campaignId — remove a campaign.
 *
 * Server-side wrapper around `deleteCampaign` so the campaigns list
 * dashboard page doesn't import the lib service directly.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { deleteCampaign } from '@/lib/email/campaign-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(
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
    await deleteCampaign(campaignId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Failed to delete campaign',
      error instanceof Error ? error : new Error(String(error)),
      { campaignId, file: 'campaigns/[campaignId]/route.ts' },
    );
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
