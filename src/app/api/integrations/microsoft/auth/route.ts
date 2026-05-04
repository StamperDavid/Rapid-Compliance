/**
 * Microsoft OAuth - Initiate Auth Flow
 * GET /api/integrations/microsoft/auth
 *
 * Returns `{ success, authUrl }` JSON instead of issuing a 302 redirect so
 * the client-side MicrosoftServicesIntegration card can call it via
 * `useAuthFetch` (which sends the Bearer token requireAuth checks).
 * Browser-level navigations (window.location.href) do NOT send the
 * Authorization header — only cookies — so we hand the authUrl back to the
 * client and the client navigates to it.
 *
 * Default flow requests the FULL scope bundle (Outlook Mail + Outlook
 * Calendar + OneDrive + Teams + identity) in ONE consent screen, per the
 * "one Microsoft OAuth grants every Microsoft service" rule that mirrors
 * the Google card.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateOAuthState } from '@/lib/security/oauth-state';
import { MICROSOFT_FULL_SCOPE_BUNDLE } from '@/lib/integrations/microsoft-tokens';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/microsoft/auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const userId = authResult.user.uid;

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    logger.debug('Microsoft OAuth environment check', {
      route: '/api/integrations/microsoft/auth',
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });

    if (!clientId || !clientSecret) {
      return errors.internal('Microsoft OAuth not configured. Check environment variables.');
    }

    // Use current domain for redirect (works in dev, preview, and production).
    // Microsoft requires the exact `redirect_uri` registered in the Azure AD
    // app, which we keep on the same path.
    const protocolHeader = request.headers.get('x-forwarded-proto');
    const protocol = protocolHeader ?? 'http';
    const hostHeader = request.headers.get('host');
    const host = hostHeader ?? 'localhost:3000';
    const redirectUriEnv = process.env.MICROSOFT_REDIRECT_URI;
    const redirectUri = (redirectUriEnv !== '' && redirectUriEnv != null)
      ? redirectUriEnv
      : `${protocol}://${host}/api/integrations/microsoft/callback`;

    logger.debug('Microsoft OAuth redirect URI', {
      route: '/api/integrations/microsoft/auth',
      redirectUri,
    });

    // CSRF-safe state token stored in Firestore — validated by the
    // callback handler before we accept the authorization code.
    const state = await generateOAuthState(userId, 'microsoft');

    const scope = [...MICROSOFT_FULL_SCOPE_BUNDLE].join(' ');
    const authUrl =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(state)}`;

    return NextResponse.json({ success: true, authUrl });
  } catch (error: unknown) {
    logger.error(
      'Microsoft OAuth error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/integrations/microsoft/auth' },
    );
    return errors.externalService(
      'Microsoft OAuth',
      error instanceof Error ? error : undefined,
    );
  }
}
