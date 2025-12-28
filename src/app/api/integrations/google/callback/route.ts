/**
 * Google OAuth - Handle callback
 * GET /api/integrations/google/callback
 */

import { NextRequest, NextResponse } from 'next/server';
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
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
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
    
    if (!adminDb) {
      throw new Error('Firebase Admin not initialized');
    }

    const integrationId = `google_${Date.now()}`;
    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('integrations')
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
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    return NextResponse.redirect(`${protocol}://${host}/admin/settings/integrations?success=gmail`);
  } catch (error: any) {
    logger.error('Google OAuth callback error', error, { route: '/api/integrations/google/callback' });
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    return NextResponse.redirect(`${protocol}://${host}/admin/settings/integrations?error=oauth_failed`);
  }
}



















