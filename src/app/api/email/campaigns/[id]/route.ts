/**
 * Email Campaign (single) API Route
 * DELETE: Remove an email campaign by ID.
 *
 * Reads/writes the same collection as the campaign service
 * (`getEmailCampaignsCollection()` -> organizations/{org}/emailCampaigns)
 * via the Admin SDK so the privileged delete bypasses Firestore rules.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getEmailCampaignsCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/email/campaigns/[id] - Delete a single email campaign
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await AdminFirestoreService.delete(getEmailCampaignsCollection(), id);

    logger.info('Email campaign deleted', { id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete campaign';
    logger.error('Failed to delete campaign', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
