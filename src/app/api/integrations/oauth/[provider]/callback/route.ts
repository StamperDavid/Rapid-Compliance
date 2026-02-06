/**
 * OAuth Callback Handler
 * GET /api/integrations/oauth/[provider]/callback
 *
 * Exchanges authorization code for access token and stores credentials
 * Note: This is called by OAuth provider, so we validate state but don't require auth header
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

// Zod schemas for OAuth responses
const OAuthStateSchema = z.object({
  organizationId: z.string().min(1),
  provider: z.string().optional(),
  userId: z.string().optional(),
});

const GoogleTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
});

const MicrosoftTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  token_type: z.string().optional(),
});

const SlackTokenResponseSchema = z.object({
  ok: z.boolean(),
  access_token: z.string().optional(),
  error: z.string().optional(),
  bot: z.object({
    bot_access_token: z.string().optional(),
  }).optional(),
  team: z.object({
    id: z.string().optional(),
  }).optional(),
  incoming_webhook: z.object({
    url: z.string().optional(),
  }).optional(),
});

// Credential types
interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

interface SlackCredentials {
  accessToken?: string;
  botToken?: string;
  teamId?: string;
  webhookUrl?: string;
}

type ProviderCredentials = OAuthCredentials | SlackCredentials;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings/integrations?error=${encodeURIComponent(errorParam)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings/integrations?error=missing_code_or_state`
      );
    }

    try {
      const stateData: unknown = JSON.parse(state);
      const stateValidation = OAuthStateSchema.safeParse(stateData);

      if (!stateValidation.success) {
        throw new Error('Invalid state: missing organizationId');
      }

      const { organizationId: _organizationId, userId } = stateValidation.data;

      // Exchange code for access token
      let credentials: ProviderCredentials;

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
      const existingKeys = await apiKeyService.getKeys();
      const updatedKeys = {
        ...existingKeys,
        integrations: {
          ...existingKeys?.integrations,
          [provider]: credentials,
        },
      };

      await apiKeyService.saveKeys(updatedKeys, userId ?? 'system');

      // Redirect back to integrations page with success
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings/integrations?success=${encodeURIComponent(provider)}`
      );
    } catch (innerError) {
      const innerErrorMsg = innerError instanceof Error ? innerError.message : 'Unknown error';
      const resolvedParams = await params;
      logger.error('OAuth callback inner error', innerError instanceof Error ? innerError : undefined, { route: '/api/integrations/oauth/callback', provider: resolvedParams.provider });
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings/integrations?error=${encodeURIComponent(innerErrorMsg)}`
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const resolvedParams = await params;
    logger.error('OAuth callback error', error instanceof Error ? error : undefined, { route: '/api/integrations/oauth/callback', provider: resolvedParams.provider });
    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings/integrations?error=${encodeURIComponent(errorMsg)}`
    );
  }
}

async function exchangeGoogleToken(code: string, redirectUri: string): Promise<OAuthCredentials> {
  const clientIdEnv = process.env.GOOGLE_CLIENT_ID;
  const clientId = (clientIdEnv !== '' && clientIdEnv != null) ? clientIdEnv : '';
  const clientSecretEnv = process.env.GOOGLE_CLIENT_SECRET;
  const clientSecret = (clientSecretEnv !== '' && clientSecretEnv != null) ? clientSecretEnv : '';

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
    const errorText = await response.text();
    throw new Error(`Google token exchange failed: ${errorText}`);
  }

  const rawData: unknown = await response.json();
  const validation = GoogleTokenResponseSchema.safeParse(rawData);

  if (!validation.success) {
    throw new Error('Invalid Google token response');
  }

  const data = validation.data;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function exchangeMicrosoftToken(code: string, redirectUri: string): Promise<OAuthCredentials> {
  const clientIdEnv = process.env.MICROSOFT_CLIENT_ID;
  const clientId = (clientIdEnv !== '' && clientIdEnv != null) ? clientIdEnv : '';
  const clientSecretEnv = process.env.MICROSOFT_CLIENT_SECRET;
  const clientSecret = (clientSecretEnv !== '' && clientSecretEnv != null) ? clientSecretEnv : '';
  const tenantIdEnv = process.env.MICROSOFT_TENANT_ID;
  const tenantId = (tenantIdEnv !== '' && tenantIdEnv != null) ? tenantIdEnv : 'common';

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
    const errorText = await response.text();
    throw new Error(`Microsoft token exchange failed: ${errorText}`);
  }

  const rawData: unknown = await response.json();
  const validation = MicrosoftTokenResponseSchema.safeParse(rawData);

  if (!validation.success) {
    throw new Error('Invalid Microsoft token response');
  }

  const data = validation.data;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function exchangeSlackToken(code: string, redirectUri: string): Promise<SlackCredentials> {
  const clientIdEnv = process.env.SLACK_CLIENT_ID;
  const clientId = (clientIdEnv !== '' && clientIdEnv != null) ? clientIdEnv : '';
  const clientSecretEnv = process.env.SLACK_CLIENT_SECRET;
  const clientSecret = (clientSecretEnv !== '' && clientSecretEnv != null) ? clientSecretEnv : '';

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
    const errorText = await response.text();
    throw new Error(`Slack token exchange failed: ${errorText}`);
  }

  const rawData: unknown = await response.json();
  const validation = SlackTokenResponseSchema.safeParse(rawData);

  if (!validation.success) {
    throw new Error('Invalid Slack token response');
  }

  const data = validation.data;
  if (!data.ok) {
    throw new Error(`Slack error: ${data.error ?? 'Unknown error'}`);
  }

  return {
    accessToken: data.access_token,
    botToken: data.bot?.bot_access_token,
    teamId: data.team?.id,
    webhookUrl: data.incoming_webhook?.url,
  };
}
