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
    return NextResponse.redirect(getRedirectUrl(request, '/admin/settings/integrations?error=oauth_failed'));
  }

  try {
    // Detect GSC service from state suffix
    const isGSC = state.endsWith(':gsc');
    const cleanState = isGSC ? state.slice(0, -4) : state;

    // Validate CSRF-safe state token against Firestore
    const userId = await validateOAuthState(cleanState, 'google');
    if (!userId) {
      logger.warn('Invalid or expired OAuth state', { route: '/api/integrations/google/callback' });
      return NextResponse.redirect(getRedirectUrl(request, '/admin/settings/integrations?error=invalid_state'));
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Save integration using Admin SDK (server-side, bypasses security rules)
    const { adminDb } = await import('@/lib/firebase/admin');
    const { getOrgSubCollection } = await import('@/lib/firebase/collections');

    if (!adminDb) {
      throw new Error('Firebase Admin not initialized');
    }

    const serviceName = isGSC ? 'google-search-console' : 'gmail';
    const integrationId = isGSC ? `gsc_${Date.now()}` : `google_${Date.now()}`;
    const integrationsPath = getOrgSubCollection('integrations');
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
      });

    const successParam = isGSC ? 'google-search-console' : 'gmail';
    logger.info(`${serviceName} integration saved`, { route: '/api/integrations/google/callback', PLATFORM_ID });

    return NextResponse.redirect(getRedirectUrl(request, `/admin/settings/integrations?success=${successParam}`));
  } catch (error: unknown) {
    logger.error('Google OAuth callback error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/google/callback' });
    return NextResponse.redirect(getRedirectUrl(request, '/admin/settings/integrations?error=oauth_failed'));
  }
}
