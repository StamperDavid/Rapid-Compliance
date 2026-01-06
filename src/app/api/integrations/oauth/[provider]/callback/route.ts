import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';

/**
 * OAuth Callback Handler
 * Exchanges authorization code for access token and stores credentials
 * Note: This is called by OAuth provider, so we validate state but don't require auth header
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const provider = params.provider;
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/workspace/demo-org/settings/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/workspace/demo-org/settings/integrations?error=missing_code_or_state`
      );
    }

    try {
      const stateData = JSON.parse(state);
      const { organizationId } = stateData;

      if (!organizationId) {
        throw new Error('Invalid state: missing organizationId');
      }

      // Exchange code for access token
      let credentials: any = {};

      switch (provider) {
        case 'gmail':
        case 'google-calendar':
          credentials = await exchangeGoogleToken(code, request.nextUrl.origin);
          break;
        case 'outlook':
        case 'outlook-calendar':
          credentials = await exchangeMicrosoftToken(code, request.nextUrl.origin);
          break;
        case 'slack':
          credentials = await exchangeSlackToken(code, request.nextUrl.origin);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Store credentials in API keys
      const existingKeys = await apiKeyService.getKeys(organizationId);
      const updatedKeys: any = {
        ...existingKeys,
        integrations: {
          ...existingKeys?.integrations,
          [provider]: credentials,
        },
      };

      await apiKeyService.saveKeys(organizationId, updatedKeys);

      // Redirect back to integrations page with success
      return NextResponse.redirect(
        `${request.nextUrl.origin}/workspace/demo-org/settings/integrations?success=${encodeURIComponent(provider)}`
      );
    } catch (error: any) {
      logger.error('OAuth callback inner error', error, { route: '/api/integrations/oauth/callback', provider: params.provider });
      return NextResponse.redirect(
        `${request.nextUrl.origin}/workspace/demo-org/settings/integrations?error=${encodeURIComponent(error.message)}`
      );
    }
  } catch (error: any) {
    logger.error('OAuth callback error', error, { route: '/api/integrations/oauth/callback', provider: params.provider });
    return NextResponse.redirect(
      `${request.nextUrl.origin}/workspace/demo-org/settings/integrations?error=${encodeURIComponent(error.message || 'Unknown error')}`
    );
  }
}

async function exchangeGoogleToken(code: string, redirectUri: string): Promise<any> {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${redirectUri}/api/integrations/oauth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function exchangeMicrosoftToken(code: string, redirectUri: string): Promise<any> {
  const clientId = process.env.MICROSOFT_CLIENT_ID || '';
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${redirectUri}/api/integrations/oauth/microsoft/callback`,
      grant_type: 'authorization_code',
      scope: 'https://graph.microsoft.com/.default',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function exchangeSlackToken(code: string, redirectUri: string): Promise<any> {
  const clientId = process.env.SLACK_CLIENT_ID || '';
  const clientSecret = process.env.SLACK_CLIENT_SECRET || '';

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${redirectUri}/api/integrations/oauth/slack/callback`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Slack token exchange failed: ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack error: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    botToken: data.bot?.bot_access_token,
    teamId: data.team?.id,
    webhookUrl: data.incoming_webhook?.url,
  };
}
