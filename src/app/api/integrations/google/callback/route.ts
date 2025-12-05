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

    // Save integration to Firestore
    const integrationId = `google_calendar_${userId}`;
    await FirestoreService.set(
      COLLECTIONS.INTEGRATIONS,
      integrationId,
      {
        id: integrationId,
        userId,
        organizationId: orgId,
        provider: 'google',
        type: 'calendar',
        status: 'active',
        credentials: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );

    console.log('[Google OAuth] Calendar integration saved for user:', userId);

    return NextResponse.redirect(`/workspace/${orgId}/integrations?success=google_calendar`);
  } catch (error: any) {
    console.error('[Google OAuth] Error:', error);
    return NextResponse.redirect('/integrations?error=oauth_failed');
  }
}





