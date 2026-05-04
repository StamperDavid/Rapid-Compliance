/**
 * GET /api/integrations/microsoft/status
 *
 * Returns the connection state of the central connected-Microsoft account
 * for the current tenant. Reads from
 * `organizations/{tenantId}/connectedAccounts/microsoft` via the Admin SDK
 * (server-side, bypasses Firestore rules — required because client SDK has
 * no auth context for this read on the dev server).
 *
 * Response is intentionally narrow — never returns access/refresh tokens.
 * The integrations settings page consumes this to flip the unified Microsoft
 * Services card to "Connected" once the operator has completed central OAuth.
 *
 * Multi-tenant: getSubCollection('connectedAccounts') resolves to the
 * current tenant's subtree, so this endpoint is multi-tenant-safe at the
 * source. When the tenant flip lands, each tenant gets their own
 * connected-Microsoft doc and this endpoint will return their account.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getConnectedMicrosoftTokens } from '@/lib/integrations/microsoft-tokens';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tokens = await getConnectedMicrosoftTokens();
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
    });
  } catch (err) {
    logger.error(
      '[microsoft-status] read failed',
      err instanceof Error ? err : new Error(String(err)),
      { route: '/api/integrations/microsoft/status' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to read connected Microsoft status' },
      { status: 500 },
    );
  }
}
