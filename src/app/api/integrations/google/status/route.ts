/**
 * GET /api/integrations/google/status
 *
 * Returns the connection state of the central connected-Google account
 * for the current tenant. Reads from `organizations/{tenantId}/connectedAccounts/google`
 * via the Admin SDK (server-side, bypasses Firestore rules — required
 * because client SDK has no auth context for this read on the dev server).
 *
 * Response is intentionally narrow — never returns access/refresh tokens.
 * The integrations settings page consumes this to flip the Gmail,
 * Google Calendar, and Google Search Console cards to "Connected" once
 * the operator has completed the central-OAuth flow.
 *
 * Multi-tenant: getSubCollection('connectedAccounts') resolves to the
 * current tenant's subtree, so this endpoint is multi-tenant-safe at the
 * source. When the tenant flip lands, each tenant gets their own
 * connected-Google doc and this endpoint will return their account.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getConnectedGoogleTokens } from '@/lib/integrations/google-tokens';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tokens = await getConnectedGoogleTokens();
    if (!tokens) {
      return NextResponse.json({
        success: true,
        connected: false,
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      accountEmail: tokens.accountEmail,
      scope: tokens.scope,
      connectedAt: tokens.connectedAt,
      updatedAt: tokens.updatedAt,
      gbpAccountId: tokens.gbpAccountId,
      gbpLocationId: tokens.gbpLocationId,
      gbpLocationName: tokens.gbpLocationName,
    });
  } catch (err) {
    logger.error(
      '[google-status] read failed',
      err instanceof Error ? err : new Error(String(err)),
      { route: '/api/integrations/google/status' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to read connected Google status' },
      { status: 500 },
    );
  }
}
