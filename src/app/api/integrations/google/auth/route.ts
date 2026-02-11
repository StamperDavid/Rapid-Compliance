/**
 * Google OAuth - Start authentication flow
 * GET /api/integrations/google/auth
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';

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

    // Store state for callback
    const state = Buffer.from(JSON.stringify({ userId, PLATFORM_ID })).toString('base64');

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

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      prompt: 'consent',
      state,
    });

    return NextResponse.redirect(authUrl);
  } catch (error: unknown) {
    logger.error('Google OAuth error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/google/auth' });
    return errors.externalService('Google OAuth', error instanceof Error ? error : undefined);
  }
}
