/**
 * Google OAuth - Handle callback
 * GET /api/integrations/google/callback
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokensFromCode } from '@/lib/integrations/google-calendar-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// Zod schema for OAuth state validation
const OAuthStateSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
});

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
    // Decode and validate state
    const decodedState: unknown = JSON.parse(
      Buffer.from(state, 'base64').toString('utf-8')
    );

    const stateValidation = OAuthStateSchema.safeParse(decodedState);
    if (!stateValidation.success) {
      logger.warn('Invalid OAuth state', { errors: JSON.stringify(stateValidation.error.errors) });
      return NextResponse.redirect(getRedirectUrl(request, '/admin/settings/integrations?error=invalid_state'));
    }

    const { userId } = stateValidation.data;
    // PENTHOUSE: Always use DEFAULT_ORG_ID

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Save integration using Admin SDK (server-side, bypasses security rules)
    const { adminDb } = await import('@/lib/firebase/admin');
    const { getOrgSubCollection } = await import('@/lib/firebase/collections');

    if (!adminDb) {
      throw new Error('Firebase Admin not initialized');
    }

    const integrationId = `google_${Date.now()}`;
    const integrationsPath = getOrgSubCollection('integrations');
    await adminDb
      .collection(integrationsPath)
      .doc(integrationId)
      .set({
        id: integrationId,
        userId,
        service: 'gmail',
        providerId: 'google',
        status: 'connected',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    logger.info('Gmail integration saved', { route: '/api/integrations/google/callback', DEFAULT_ORG_ID });

    return NextResponse.redirect(getRedirectUrl(request, '/admin/settings/integrations?success=gmail'));
  } catch (error: unknown) {
    logger.error('Google OAuth callback error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/google/callback' });
    return NextResponse.redirect(getRedirectUrl(request, '/admin/settings/integrations?error=oauth_failed'));
  }
}
