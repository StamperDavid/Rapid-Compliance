/**
 * Google OAuth - Handle callback
 * GET /api/integrations/google/callback
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/google-calendar-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { encryptToken } from '@/lib/security/token-encryption';
import { validateOAuthState } from '@/lib/security/oauth-state';
import { saveConnectedGoogleTokens } from '@/lib/integrations/google-tokens';
import { subscribeToConnectedGoogleCalendar } from '@/lib/integrations/calendar-watch-service';

function getRedirectUrl(request: NextRequest, path: string): string {
  const protocolHeader = request.headers.get('x-forwarded-proto');
  const protocol = (protocolHeader !== '' && protocolHeader != null) ? protocolHeader : 'http';
  const hostHeader = request.headers.get('host');
  const host = (hostHeader !== '' && hostHeader != null) ? hostHeader : 'localhost:3000';
  return `${protocol}://${host}${path}`;
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/google/callback');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(getRedirectUrl(request, '/settings/integrations?error=oauth_failed'));
  }

  try {
    // Detect GSC service from state suffix
    const isGSC = state.endsWith(':gsc');
    const cleanState = isGSC ? state.slice(0, -4) : state;

    // Validate CSRF-safe state token against Firestore
    const userId = await validateOAuthState(cleanState, 'google');
    if (!userId) {
      logger.warn('Invalid or expired OAuth state', { route: '/api/integrations/google/callback' });
      return NextResponse.redirect(getRedirectUrl(request, '/settings/integrations?error=invalid_state'));
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Save integration using Admin SDK (server-side, bypasses security rules)
    const { adminDb } = await import('@/lib/firebase/admin');
    const { getSubCollection } = await import('@/lib/firebase/collections');

    if (!adminDb) {
      throw new Error('Firebase Admin not initialized');
    }

    // Resolve the connected Google account's email so we can use it as
    // FROM/reply-to for emails (per the calendar+email identity rule).
    // For the FULL-bundle flow, userinfo.email scope is granted, so we
    // call /userinfo to pull the email. The GSC narrow flow does NOT
    // grant userinfo.email so we skip the lookup and store empty.
    let accountEmail = '';
    if (!isGSC) {
      try {
        const userInfoRes = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          },
        );
        if (userInfoRes.ok) {
          const userInfo = (await userInfoRes.json()) as { email?: string };
          if (typeof userInfo.email === 'string' && userInfo.email.length > 0) {
            accountEmail = userInfo.email;
          }
        } else {
          logger.warn('[google-callback] userinfo fetch failed (non-fatal)', {
            status: userInfoRes.status,
          });
        }
      } catch (err) {
        logger.warn('[google-callback] userinfo fetch threw (non-fatal)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // CENTRAL STORE — single source of truth for the connected Google
    // account, consumed by every Google-touching service (Gmail send,
    // Calendar writes, Drive, YouTube, GBP, GA4, Ads, GSC).
    if (!isGSC) {
      // `scope` is not currently returned by getTokensFromCode (the
      // googleapis client strips it). Future enhancement: pull it from
      // the raw token endpoint response. For now the save defaults it
      // to empty string and the bundle is recoverable from the auth
      // route's GOOGLE_FULL_SCOPE_BUNDLE constant if needed.
      const saveResult = await saveConnectedGoogleTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiryDate: tokens.expiry_date ?? null,
        accountEmail,
      });
      if (!saveResult.success) {
        logger.error(
          '[google-callback] central token save failed',
          new Error(saveResult.error ?? 'unknown'),
          { route: '/api/integrations/google/callback' },
        );
      } else {
        // Two-way sync plumbing: subscribe to push notifications on
        // the operator's primary calendar so cancels/reschedules from
        // Google land back in the platform. Non-blocking — a watch
        // failure (e.g., localhost dev, Google API blip) must NOT
        // fail the OAuth flow.
        try {
          const sub = await subscribeToConnectedGoogleCalendar();
          if (sub.success && !sub.skipped) {
            logger.info('[google-callback] calendar watch subscribed', {
              route: '/api/integrations/google/callback',
              channelId: sub.id,
              expiration: sub.expiration,
            });
          } else if (sub.skipped) {
            logger.warn('[google-callback] calendar watch skipped', {
              route: '/api/integrations/google/callback',
              reason: sub.reason,
            });
          } else {
            logger.warn('[google-callback] calendar watch subscribe failed (non-fatal)', {
              route: '/api/integrations/google/callback',
              reason: sub.reason,
            });
          }
        } catch (watchErr) {
          logger.warn('[google-callback] calendar watch subscribe threw (non-fatal)', {
            route: '/api/integrations/google/callback',
            error: watchErr instanceof Error ? watchErr.message : String(watchErr),
          });
        }
      }
    }

    // LEGACY WRITE — preserved for backward-compat during the migration
    // phase. Existing Gmail/GSC consumers still read from
    // `integrations/{id}` until each is migrated to the central store.
    // Will be removed once all consumers are on the new helper.
    const serviceName = isGSC ? 'google-search-console' : 'gmail';
    const integrationId = isGSC ? `gsc_${Date.now()}` : `google_${Date.now()}`;
    const integrationsPath = getSubCollection('integrations');
    await adminDb
      .collection(integrationsPath)
      .doc(integrationId)
      .set({
        id: integrationId,
        userId,
        service: serviceName,
        providerId: 'google',
        status: 'connected',
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        expiryDate: tokens.expiry_date,
        encrypted: true,
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountEmail,
      });

    const successParam = isGSC ? 'google-search-console' : 'google';
    logger.info(`${serviceName} integration saved`, {
      route: '/api/integrations/google/callback',
      PLATFORM_ID,
      accountEmail,
      centralStoreUpdated: !isGSC,
    });

    return NextResponse.redirect(getRedirectUrl(request, `/settings/integrations?success=${successParam}`));
  } catch (error: unknown) {
    logger.error('Google OAuth callback error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/google/callback' });
    return NextResponse.redirect(getRedirectUrl(request, '/settings/integrations?error=oauth_failed'));
  }
}
