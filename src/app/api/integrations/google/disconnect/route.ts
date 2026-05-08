/**
 * POST /api/integrations/google/disconnect
 *
 * Removes the central connected-Google account for the current tenant.
 * Deletes the encrypted token doc at
 * `organizations/{tenantId}/connectedAccounts/google` and clears the
 * legacy integration records the OAuth callback writes (Gmail / GSC
 * shape under `integrations/{id}`) so neither store keeps stale tokens.
 *
 * The operator's Google session at Google itself is NOT revoked here —
 * Google requires an explicit token-revoke call OR the operator
 * removing access in their Google Account settings. We don't do that
 * automatically because it would also kill any other app sharing the
 * same OAuth client. If the operator wants the connection wiped on
 * Google's side too, they go to https://myaccount.google.com/permissions.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { unsubscribeConnectedGoogleCalendarWatch } from '@/lib/integrations/calendar-watch-service';

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

    // Unsubscribe Google Calendar push channel BEFORE deleting tokens —
    // calendar.channels.stop needs valid OAuth credentials. If we
    // delete the central doc first, the unsubscribe call will fail and
    // leak a dangling channel until it expires on its own.
    try {
      const unsub = await unsubscribeConnectedGoogleCalendarWatch();
      if (!unsub.success) {
        logger.warn('[google-disconnect] calendar watch unsubscribe failed (non-fatal)', {
          reason: unsub.reason,
        });
      }
    } catch (watchErr) {
      logger.warn('[google-disconnect] calendar watch unsubscribe threw (non-fatal)', {
        error: watchErr instanceof Error ? watchErr.message : String(watchErr),
      });
    }

    const connectedPath = getSubCollection('connectedAccounts');
    await adminDb.collection(connectedPath).doc('google').delete().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[google-disconnect] central doc delete errored (non-fatal)', { error: msg });
    });

    // Wipe the legacy integrations/{id} docs the OAuth callback also
    // wrote (Gmail / GSC shape with timestamp suffix). Pre-migration
    // consumers read from there, so leaving them would let the UI
    // show stale "connected" cards.
    const integrationsPath = getSubCollection('integrations');
    const snap = await adminDb.collection(integrationsPath).get();
    const deletes: Promise<unknown>[] = [];
    snap.forEach((d) => {
      const data = d.data() as { providerId?: string; service?: string } | undefined;
      if (data?.providerId === 'google') {
        deletes.push(
          d.ref.delete().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn('[google-disconnect] legacy doc delete errored (non-fatal)', {
              docId: d.id,
              error: msg,
            });
          }),
        );
      }
    });
    await Promise.all(deletes);

    logger.info('[google-disconnect] central + legacy Google docs cleared', {
      legacyDocsRemoved: deletes.length,
    });

    return NextResponse.json({ success: true, legacyDocsRemoved: deletes.length });
  } catch (err) {
    logger.error(
      '[google-disconnect] failed',
      err instanceof Error ? err : new Error(String(err)),
      { route: '/api/integrations/google/disconnect' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect Google' },
      { status: 500 },
    );
  }
}
