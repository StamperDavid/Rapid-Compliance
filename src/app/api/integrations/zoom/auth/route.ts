/**
 * Zoom OAuth — Start authentication flow
 * GET /api/integrations/zoom/auth
 *
 * User OAuth flow (NOT Server-to-Server). Operator clicks "Connect Zoom"
 * in /settings/integrations; the component calls this route via authFetch
 * (which attaches the Firebase ID token in the Authorization header).
 *
 * Returns JSON `{ success: true, authUrl }` — the component then sets
 * window.location.href to authUrl to navigate the browser to Zoom for
 * consent. Cannot use a 302 redirect here because plain browser navigation
 * (window.location.href) does NOT include the Authorization header, so a
 * direct redirect from this route would 401 before reaching Zoom.
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
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations/zoom/auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }
    const userId = authResult.user.uid;

    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    logger.debug('Zoom OAuth environment check', {
      route: '/api/integrations/zoom/auth',
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });

    if (!clientId || !clientSecret) {
      return errors.internal('Zoom OAuth not configured. Set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in environment variables.');
    }

    // CSRF-safe state token stored in Firestore (validated in callback)
    const state = await generateOAuthState(userId, 'zoom');

    // Build redirect URI from current request — works in dev, preview, prod
    const protocolHeader = request.headers.get('x-forwarded-proto');
    const protocol = (protocolHeader !== '' && protocolHeader != null) ? protocolHeader : 'http';
    const hostHeader = request.headers.get('host');
    const host = (hostHeader !== '' && hostHeader != null) ? hostHeader : 'localhost:3000';
    const redirectUri = `${protocol}://${host}/api/integrations/zoom/callback`;

    logger.debug('Zoom OAuth redirect URI', { route: '/api/integrations/zoom/auth', redirectUri });

    // Zoom User-OAuth authorize endpoint (NOT S2S)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });
    const authUrl = `https://zoom.us/oauth/authorize?${params.toString()}`;

    return NextResponse.json({ success: true, authUrl });
  } catch (error: unknown) {
    logger.error('Zoom OAuth error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/zoom/auth' });
    return errors.externalService('Zoom OAuth', error instanceof Error ? error : undefined);
  }
}
