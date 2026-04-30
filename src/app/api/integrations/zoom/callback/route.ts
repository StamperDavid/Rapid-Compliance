/**
 * Zoom OAuth — Handle callback
 * GET /api/integrations/zoom/callback
 *
 * Encryption decision:
 *   Tokens are stored PLAINTEXT in this callback. Rationale: the existing
 *   consumer path `getIntegrationCredentials('zoom')` (used by zoom.ts'
 *   `createZoomMeeting` and `cancelZoomMeeting`) does NOT decrypt tokens at
 *   read time — it returns whatever string is in `accessToken`. Encrypting
 *   here would silently break the meeting-creation flow (Zoom would reject
 *   the Bearer header as invalid).
 *
 *   If/when `getIntegrationCredentials` is upgraded to detect `encrypted:
 *   true` and call `decryptToken`, this callback should switch to
 *   `encryptToken(...)` AT THE SAME TIME. Until then: plaintext, with the
 *   same trust posture as every other integration that goes through
 *   `integration-manager.ts` (Google email-sync, Shopify, etc.).
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { exchangeZoomCode } from '@/lib/integrations/zoom';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { validateOAuthState } from '@/lib/security/oauth-state';

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

interface ZoomUserResponse {
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
}

function getRedirectUrl(request: NextRequest, path: string): string {
  const protocolHeader = request.headers.get('x-forwarded-proto');
  const protocol = (protocolHeader !== '' && protocolHeader != null) ? protocolHeader : 'http';
  const hostHeader = request.headers.get('host');
  const host = (hostHeader !== '' && hostHeader != null) ? hostHeader : 'localhost:3000';
  return `${protocol}://${host}${path}`;
}

function buildRedirectUri(request: NextRequest): string {
  const protocolHeader = request.headers.get('x-forwarded-proto');
  const protocol = (protocolHeader !== '' && protocolHeader != null) ? protocolHeader : 'http';
  const hostHeader = request.headers.get('host');
  const host = (hostHeader !== '' && hostHeader != null) ? hostHeader : 'localhost:3000';
  return `${protocol}://${host}/api/integrations/zoom/callback`;
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/zoom/callback');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const validation = callbackSchema.safeParse({ code, state });
  if (!validation.success) {
    logger.warn('Zoom OAuth callback missing code or state', {
      route: '/api/integrations/zoom/callback',
      hasCode: !!code,
      hasState: !!state,
    });
    return NextResponse.redirect(getRedirectUrl(request, '/settings/integrations?error=zoom_oauth_failed'));
  }

  try {
    // CSRF: validate state and recover the userId that initiated the flow
    const userId = await validateOAuthState(validation.data.state, 'zoom');
    if (!userId) {
      logger.warn('Invalid or expired Zoom OAuth state', { route: '/api/integrations/zoom/callback' });
      return NextResponse.redirect(getRedirectUrl(request, '/settings/integrations?error=invalid_state'));
    }

    // Redirect URI passed to Zoom token exchange MUST match the one used to
    // start the flow exactly (Zoom verifies it server-side).
    const redirectUri = buildRedirectUri(request);

    const tokens = await exchangeZoomCode(validation.data.code, redirectUri);

    // Fetch the connected Zoom user's profile for the integrations UI
    let connectedEmail: string | null = null;
    let connectedName: string | null = null;
    try {
      const meRes = await fetch('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as ZoomUserResponse;
        connectedEmail = (me.email !== '' && me.email != null) ? me.email : null;
        const composedName = [me.first_name, me.last_name].filter((p) => p && p.length > 0).join(' ').trim();
        connectedName = (me.display_name !== '' && me.display_name != null)
          ? me.display_name
          : (composedName.length > 0 ? composedName : null);
      } else {
        logger.warn('Zoom users/me lookup non-OK', {
          route: '/api/integrations/zoom/callback',
          status: meRes.status,
        });
      }
    } catch (profileError: unknown) {
      // Profile fetch is best-effort — don't fail the whole callback if it errors
      logger.warn('Zoom users/me lookup failed (non-fatal)', {
        route: '/api/integrations/zoom/callback',
        error: profileError instanceof Error ? profileError.message : String(profileError),
      });
    }

    // Save tokens via Admin SDK direct write — required so the consumer
    // (`getIntegrationCredentials('zoom', { useAdminSdk: true })` in
    // createZoomMeeting / cancelZoomMeeting) can read them from a public
    // request context. Schema matches the IntegrationCredentials shape so
    // the existing integration-manager flow continues to work.
    const { adminDb } = await import('@/lib/firebase/admin');
    const { getSubCollection } = await import('@/lib/firebase/collections');

    if (!adminDb) {
      throw new Error('Firebase Admin not initialized');
    }

    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    const now = new Date();
    const integrationsPath = getSubCollection('integrations');

    await adminDb
      .collection(integrationsPath)
      .doc('zoom')
      .set({
        integrationId: 'zoom',
        accessToken: tokens.accessToken,   // plaintext — see file header
        refreshToken: tokens.refreshToken, // plaintext — see file header
        expiresAt,
        encrypted: false,
        metadata: {
          connectedUserId: userId,
          connectedEmail,
          connectedName,
          connectedAt: now.toISOString(),
        },
        createdAt: now,
        updatedAt: now,
      });

    logger.info('Zoom integration saved', {
      route: '/api/integrations/zoom/callback',
      PLATFORM_ID,
      connectedEmail,
    });

    return NextResponse.redirect(getRedirectUrl(request, '/settings/integrations?success=zoom'));
  } catch (error: unknown) {
    logger.error(
      'Zoom OAuth callback error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/integrations/zoom/callback' }
    );
    return NextResponse.redirect(getRedirectUrl(request, '/settings/integrations?error=zoom_oauth_failed'));
  }
}
