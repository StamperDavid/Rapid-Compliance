/**
 * Microsoft Teams OAuth Callback
 * Handles OAuth callback and stores access token
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

/**
 * GET /api/integrations/teams/callback
 * Handle OAuth callback from Microsoft
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // organizationId
    const error = searchParams.get('error');

    if (error) {
      logger.error('Teams OAuth error', new Error(error), { state });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${state}/settings/integrations?error=teams_auth_failed`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${state}/settings/integrations?error=invalid_callback`
      );
    }

    const organizationId = state;

    // Get Microsoft 365 (Teams) config
    const microsoft365Keys = await apiKeyService.getServiceKey(organizationId, 'microsoft365');
    if (!microsoft365Keys) {
      throw new Error('Microsoft 365 (Teams) not configured');
    }

    const { clientId, clientSecret, redirectUri } = microsoft365Keys;
    const baseRedirectUri = (redirectUri !== '' && redirectUri != null) ? redirectUri : `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/teams/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: baseRedirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      const errorDesc = (errorData.error_description !== '' && errorData.error_description != null) ? errorData.error_description : errorData.error;
      throw new Error(`Token exchange failed: ${errorDesc}`);
    }

    const tokens = await tokenResponse.json();

    // Store tokens
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
      'teams',
      {
        id: 'teams',
        name: 'Microsoft Teams',
        status: 'active',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connectedAt: new Date().toISOString(),
        settings: {
          notifications: {
            newDeal: true,
            dealWon: true,
            dealLost: false,
            newLead: true,
            taskDue: true,
          },
          channels: {},
        },
      },
      false
    );

    logger.info('Teams connected successfully', { organizationId });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${organizationId}/settings/integrations?success=teams_connected`
    );
  } catch (error: any) {
    logger.error('Teams callback error', error, { route: '/api/integrations/teams/callback' });
    const errorOrgId = (error.organizationId !== '' && error.organizationId != null) ? error.organizationId : 'default';
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${errorOrgId}/settings/integrations?error=teams_callback_failed`
    );
  }
}

