/**
 * Google OAuth - Handle callback
 * GET /api/integrations/google/callback
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/google-calendar-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

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
    const protocolHeader = request.headers.get('x-forwarded-proto');
    const protocol = (protocolHeader !== '' && protocolHeader != null) ? protocolHeader : 'http';
    const hostHeader = request.headers.get('host');
    const host = (hostHeader !== '' && hostHeader != null) ? hostHeader : 'localhost:3000';
    return NextResponse.redirect(`${protocol}://${host}/admin/settings/integrations?error=oauth_failed`);
  }

  try {
    // Decode state
    const { userId, orgId } = JSON.parse(
      Buffer.from(state, 'base64').toString('utf-8')
    );

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Save integration using Admin SDK (server-side, bypasses security rules)
    const { adminDb } = await import('@/lib/firebase/admin');
    const { getOrgSubCollection } = await import('@/lib/firebase/collections');
    
    if (!adminDb) {
      throw new Error('Firebase Admin not initialized');
    }

    const integrationId = `google_${Date.now()}`;
    const integrationsPath = getOrgSubCollection(orgId, 'integrations');
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

    logger.info('Gmail integration saved', { route: '/api/integrations/google/callback', orgId });

    // Redirect to admin integrations page (use current domain)
    const successProtocolHeader = request.headers.get('x-forwarded-proto');
    const successProtocol = (successProtocolHeader !== '' && successProtocolHeader != null) ? successProtocolHeader : 'http';
    const successHostHeader = request.headers.get('host');
    const successHost = (successHostHeader !== '' && successHostHeader != null) ? successHostHeader : 'localhost:3000';
    return NextResponse.redirect(`${successProtocol}://${successHost}/admin/settings/integrations?success=gmail`);
  } catch (error: any) {
    logger.error('Google OAuth callback error', error, { route: '/api/integrations/google/callback' });
    const errorProtocolHeader = request.headers.get('x-forwarded-proto');
    const errorProtocol = (errorProtocolHeader !== '' && errorProtocolHeader != null) ? errorProtocolHeader : 'http';
    const errorHostHeader = request.headers.get('host');
    const errorHost = (errorHostHeader !== '' && errorHostHeader != null) ? errorHostHeader : 'localhost:3000';
    return NextResponse.redirect(`${errorProtocol}://${errorHost}/admin/settings/integrations?error=oauth_failed`);
  }
}



















