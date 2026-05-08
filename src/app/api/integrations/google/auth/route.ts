/**
 * Google OAuth - Start authentication flow
 * GET /api/integrations/google/auth
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateOAuthState } from '@/lib/security/oauth-state';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/google/auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}
    const userId = authResult.user.uid;

    // Generate CSRF-safe state token stored in Firestore
    const state = await generateOAuthState(userId, 'google');

    // Get Google OAuth URL with Gmail AND Calendar scopes
    const { OAuth2Client } = await import('google-auth-library');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    logger.debug('Google OAuth environment check', {
      route: '/api/integrations/google/auth',
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret
    });

    if (!clientId || !clientSecret) {
      return errors.internal('Google OAuth not configured. Check environment variables.');
    }

    // Use current domain for redirect (works in dev, preview, and production)
    const protocolHeader = request.headers.get('x-forwarded-proto');
    const protocol = protocolHeader ?? 'http';
    const hostHeader = request.headers.get('host');
    const host = hostHeader ?? 'localhost:3000';
    const redirectUri = `${protocol}://${host}/api/integrations/google/callback`;

    logger.debug('Google OAuth redirect URI', { route: '/api/integrations/google/auth', redirectUri });

    const oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      redirectUri
    );

    // Determine scopes based on requested service.
    //
    // Default flow (no `?service=` query param) requests the FULL scope
    // bundle — Gmail, Calendar, Drive, YouTube, Google Business, GA4,
    // GSC, Google Ads, and userinfo — in ONE consent screen, per the
    // architectural rule that single-Google-OAuth-at-onboarding should
    // auto-connect every Google tool. Per
    // `feedback_one_google_account_per_tenant_runs_calendars_and_email`.
    //
    // The `?service=gsc` branch is preserved as a narrow re-auth path
    // for operators who only want to grant GSC without the full bundle
    // (rare). Other narrow paths can be added later if needed.
    const { GOOGLE_FULL_SCOPE_BUNDLE, GOOGLE_GSC_ONLY_SCOPES } = await import(
      '@/lib/integrations/google-tokens'
    );
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');

    const scopes = service === 'gsc'
      ? [...GOOGLE_GSC_ONLY_SCOPES]
      : [...GOOGLE_FULL_SCOPE_BUNDLE];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: `${state}${service === 'gsc' ? ':gsc' : ''}`,
    });

    // Return the auth URL as JSON instead of issuing a 302 redirect.
    // Browser-level navigations (window.location.href) do NOT send the
    // Authorization header that requireAuth above checks — only cookies.
    // So the integration components fetch this route with authFetch
    // (which sends the bearer token), get { authUrl } back, and THEN
    // do window.location.href = authUrl on the client side. This keeps
    // the requireAuth gate in place while still letting the OAuth
    // handshake complete.
    return NextResponse.json({ success: true, authUrl });
  } catch (error: unknown) {
    logger.error('Google OAuth error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/google/auth' });
    return errors.externalService('Google OAuth', error instanceof Error ? error : undefined);
  }
}
