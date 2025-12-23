/**
 * Google OAuth - Handle callback
 * GET /api/integrations/google/callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/google-calendar-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }

  try {
    // Decode state
    const { userId, orgId } = JSON.parse(
      Buffer.from(state, 'base64').toString('utf-8')
    );

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Save integration to Firestore (in organization's integrations subcollection)
    const integrationId = `google_${Date.now()}`;
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.INTEGRATIONS}`,
      integrationId,
      {
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
      },
      false
    );

    console.log('[Google OAuth] Gmail integration saved for org:', orgId);

    // Redirect to admin integrations page
    return NextResponse.redirect(`/admin/settings/integrations?success=gmail`);
  } catch (error: any) {
    console.error('[Google OAuth] Error:', error);
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }
}



















