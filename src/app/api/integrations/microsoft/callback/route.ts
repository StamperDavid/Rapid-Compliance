/**
 * Microsoft OAuth - Handle callback
 * GET /api/integrations/microsoft/callback
 *
 * Mirror of the Google callback: exchanges the authorization code for
 * tokens, captures the operator's account email via Microsoft Graph
 * `/me`, persists the tokens to the central
 * `organizations/{tenantId}/connectedAccounts/microsoft` doc via
 * `saveConnectedMicrosoftTokens`, AND keeps the legacy
 * `integrations/{id}` write so existing Outlook/Teams/Calendar consumers
 * keep working until they're migrated to read from the central store.
 *
 * Redirects back to /settings/integrations on success/failure (NOT
 * /admin/... or /integrations/...), matching the Google card's UX and the
 * rest of the integrations page that lives under /settings.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/outlook-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { encryptToken } from '@/lib/security/token-encryption';
import { validateOAuthState } from '@/lib/security/oauth-state';
import { saveConnectedMicrosoftTokens } from '@/lib/integrations/microsoft-tokens';

function getRedirectUrl(request: NextRequest, path: string): string {
  const protocolHeader = request.headers.get('x-forwarded-proto');
  const protocol = (protocolHeader !== '' && protocolHeader != null) ? protocolHeader : 'http';
  const hostHeader = request.headers.get('host');
  const host = (hostHeader !== '' && hostHeader != null) ? hostHeader : 'localhost:3000';
  return `${protocol}://${host}${path}`;
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/microsoft/callback');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(
      getRedirectUrl(request, '/settings/integrations?error=oauth_failed'),
    );
  }

  try {
    // Validate CSRF-safe state token against Firestore.
    const userId = await validateOAuthState(state, 'microsoft');
    if (!userId) {
      logger.warn('Invalid or expired OAuth state', {
        route: '/api/integrations/microsoft/callback',
      });
      return NextResponse.redirect(
        getRedirectUrl(request, '/settings/integrations?error=invalid_state'),
      );
    }

    const tokens = await getTokensFromCode(code);

    // Resolve the connected Microsoft account's email so we can use it as
    // FROM/reply-to for emails (per the calendar+email identity rule).
    // Microsoft Graph `/me` returns userPrincipalName / mail — we prefer
    // `mail` because `userPrincipalName` is sometimes a non-routable
    // tenant alias.
    let accountEmail = '';
    try {
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          mail?: string;
          userPrincipalName?: string;
        };
        if (typeof me.mail === 'string' && me.mail.length > 0) {
          accountEmail = me.mail;
        } else if (
          typeof me.userPrincipalName === 'string' &&
          me.userPrincipalName.length > 0
        ) {
          accountEmail = me.userPrincipalName;
        }
      } else {
        logger.warn('[microsoft-callback] /me fetch failed (non-fatal)', {
          status: meRes.status,
        });
      }
    } catch (err) {
      logger.warn('[microsoft-callback] /me fetch threw (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // CENTRAL STORE — single source of truth for the connected Microsoft
    // account, consumed by every Microsoft-touching service (Outlook Mail
    // send, Outlook Calendar writes, OneDrive, Teams).
    const expiryDate = typeof tokens.expires_in === 'number'
      ? Date.now() + tokens.expires_in * 1000
      : null;

    const saveResult = await saveConnectedMicrosoftTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate,
      scope: tokens.scope ?? '',
      accountEmail,
    });
    if (!saveResult.success) {
      logger.error(
        '[microsoft-callback] central token save failed',
        new Error(saveResult.error ?? 'unknown'),
        { route: '/api/integrations/microsoft/callback' },
      );
    }

    // LEGACY WRITE — preserved for backward-compat during the migration
    // phase. Existing Outlook/Teams/Calendar consumers still read from
    // `integrations/{id}` until each is migrated to the central store.
    // Will be removed once all consumers are on the new helper.
    const { adminDb } = await import('@/lib/firebase/admin');
    const { getSubCollection } = await import('@/lib/firebase/collections');

    if (!adminDb) {
      throw new Error('Firebase Admin not initialized');
    }

    const integrationId = `microsoft_${userId}`;
    const integrationsPath = getSubCollection('integrations');
    await adminDb
      .collection(integrationsPath)
      .doc(integrationId)
      .set({
        id: integrationId,
        userId,
        provider: 'microsoft',
        providerId: 'microsoft',
        type: 'outlook',
        status: 'connected',
        credentials: {
          access_token: encryptToken(tokens.access_token),
          refresh_token: tokens.refresh_token
            ? encryptToken(tokens.refresh_token)
            : undefined,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          encrypted: true,
        },
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountEmail,
      });

    logger.info('Microsoft integration saved', {
      route: '/api/integrations/microsoft/callback',
      PLATFORM_ID,
      accountEmail,
      centralStoreUpdated: saveResult.success,
    });

    return NextResponse.redirect(
      getRedirectUrl(request, '/settings/integrations?success=microsoft'),
    );
  } catch (error) {
    logger.error(
      'Microsoft OAuth callback error',
      error instanceof Error ? error : undefined,
      { route: '/api/integrations/microsoft/callback' },
    );
    return NextResponse.redirect(
      getRedirectUrl(request, '/settings/integrations?error=oauth_failed'),
    );
  }
}
