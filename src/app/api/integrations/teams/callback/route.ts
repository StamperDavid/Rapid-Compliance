/**
 * Microsoft Teams OAuth Callback
 * Handles OAuth callback and stores access token
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { encryptToken } from '@/lib/security/token-encryption';
import { validateOAuthState } from '@/lib/security/oauth-state';

export const dynamic = 'force-dynamic';

// Zod schema for Teams OAuth callback
const teamsCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  error: z.string().optional(),
});

// Interface for Microsoft 365 API keys
interface Microsoft365Keys {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

// Interface for Microsoft token response
interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

/**
 * GET /api/integrations/teams/callback
 * Handle OAuth callback from Microsoft
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      logger.error('Teams OAuth error', new Error(error), { state });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=teams_auth_failed`
      );
    }

    // Zod validation for OAuth callback params
    const validation = teamsCallbackSchema.safeParse({ code, state, error });
    if (!validation.success) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_callback`
      );
    }

    const validatedCode = validation.data.code;

    // Validate CSRF-safe state token
    const userId = await validateOAuthState(validation.data.state, 'teams');
    if (!userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_state`
      );
    }

    // Get Microsoft 365 (Teams) config
    const microsoft365Keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'microsoft365') as Microsoft365Keys | null;
    if (!microsoft365Keys) {
      throw new Error('Microsoft 365 (Teams) not configured');
    }

    const { clientId, clientSecret, redirectUri } = microsoft365Keys;
    const baseRedirectUri = (redirectUri && redirectUri !== '') ? redirectUri : `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/teams/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: validatedCode,
        redirect_uri: baseRedirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json() as MicrosoftTokenResponse;
      const errorDesc = errorData.error_description ?? errorData.error ?? 'Unknown error';
      throw new Error(`Token exchange failed: ${errorDesc}`);
    }

    const tokens = await tokenResponse.json() as MicrosoftTokenResponse;

    // Store tokens
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/integrations`,
      'teams',
      {
        id: 'teams',
        name: 'Microsoft Teams',
        status: 'active',
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        encrypted: true,
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

    logger.info('Teams connected successfully');

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=teams_connected`
    );
  } catch (error: unknown) {
    logger.error('Teams callback error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/teams/callback' });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=teams_callback_failed`
    );
  }
}

