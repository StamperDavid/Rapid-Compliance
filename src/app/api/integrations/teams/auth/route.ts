/**
 * Microsoft Teams OAuth Authentication
 * Initiates OAuth flow for Teams integration
 */

import { type NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';

// Interface for Microsoft 365 API keys
interface Microsoft365Keys {
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
}

/**
 * POST /api/integrations/teams/auth
 * Start Teams OAuth flow
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const userId = user.uid;

    // Check if Microsoft 365 (Teams) is configured
    const microsoft365Keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'microsoft365') as Microsoft365Keys | null;

    if (!microsoft365Keys?.clientId) {
      return NextResponse.json({
        success: false,
        error: 'Microsoft Teams not configured. Please add Microsoft 365 Client ID and Secret in API Keys settings.',
        configured: false,
      });
    }

    const { clientId, redirectUri } = microsoft365Keys;
    const baseRedirectUri = (redirectUri && redirectUri !== '') ? redirectUri : `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/teams/callback`;

    // Microsoft Teams uses Azure AD OAuth
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(baseRedirectUri)}` +
      `&scope=${encodeURIComponent('https://graph.microsoft.com/ChannelMessage.Send offline_access')}` +
      `&state=${PLATFORM_ID}`;

    logger.info('Teams OAuth flow started', { userId });

    return NextResponse.json({
      success: true,
      authUrl,
    });
  } catch (error: unknown) {
    logger.error('Teams auth error', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations/teams/auth' });
    return errors.internal('Failed to initiate Teams auth', error instanceof Error ? error : new Error(String(error)));
  }
}

