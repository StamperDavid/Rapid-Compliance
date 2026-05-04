/**
 * POST /api/integrations/microsoft/disconnect
 *
 * Removes the central connected-Microsoft account for the current tenant.
 * Deletes the encrypted token doc at
 * `organizations/{tenantId}/connectedAccounts/microsoft` and clears the
 * legacy integration records the OAuth callback writes
 * (`integrations/{id}` shape with `providerId === 'microsoft'`) so neither
 * store keeps stale tokens.
 *
 * The operator's Microsoft session at Microsoft itself is NOT revoked here —
 * Microsoft requires an explicit token-revoke call OR the operator removing
 * access via https://myaccount.microsoft.com/. We don't do that automatically
 * because it would also kill any other app sharing the same Azure AD app
 * registration. If the operator wants the connection wiped on Microsoft's
 * side too, they go to https://myaccount.microsoft.com/.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Firebase admin not initialized' },
        { status: 500 },
      );
    }

    const connectedPath = getSubCollection('connectedAccounts');
    await adminDb.collection(connectedPath).doc('microsoft').delete().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[microsoft-disconnect] central doc delete errored (non-fatal)', { error: msg });
    });

    // Wipe the legacy integrations/{id} docs the OAuth callback also wrote
    // (Outlook / Teams / Outlook Calendar shape). Pre-migration consumers
    // read from there, so leaving them would let the UI show stale
    // "connected" cards.
    const integrationsPath = getSubCollection('integrations');
    const snap = await adminDb.collection(integrationsPath).get();
    const deletes: Promise<unknown>[] = [];
    snap.forEach((d) => {
      const data = d.data() as { providerId?: string; provider?: string; service?: string } | undefined;
      // Match both `providerId` (newer shape) and `provider` (older shape
      // written by the previous Microsoft callback). The legacy callback
      // used `provider: 'microsoft'`.
      if (data?.providerId === 'microsoft' || data?.provider === 'microsoft') {
        deletes.push(
          d.ref.delete().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn('[microsoft-disconnect] legacy doc delete errored (non-fatal)', {
              docId: d.id,
              error: msg,
            });
          }),
        );
      }
    });
    await Promise.all(deletes);

    logger.info('[microsoft-disconnect] central + legacy Microsoft docs cleared', {
      legacyDocsRemoved: deletes.length,
    });

    return NextResponse.json({ success: true, legacyDocsRemoved: deletes.length });
  } catch (err) {
    logger.error(
      '[microsoft-disconnect] failed',
      err instanceof Error ? err : new Error(String(err)),
      { route: '/api/integrations/microsoft/disconnect' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect Microsoft' },
      { status: 500 },
    );
  }
}
