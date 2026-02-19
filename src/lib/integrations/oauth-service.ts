/**
 * OAuth Service
 * Handles OAuth 2.0 authorization flows for integrations
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { COLLECTIONS, getIntegrationsCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';
import crypto from 'crypto';

export interface OAuthConfig {
  provider: 'google' | 'microsoft' | 'slack' | 'quickbooks' | 'xero';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
}

// Lightweight config map for tests and fallback defaults
export const OAuthConfigDefaults: Record<string, Partial<OAuthConfig>> = {
  google: { provider: 'google', authorizationUrl: 'https://accounts.google.com/o/oauth2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', scopes: [] },
  microsoft: { provider: 'microsoft', authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', scopes: [] },
  quickbooks: { provider: 'quickbooks', authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2', tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', scopes: [] },
  xero: { provider: 'xero', authorizationUrl: 'https://login.xero.com/identity/connect/authorize', tokenUrl: 'https://identity.xero.com/connect/token', scopes: [] },
};

export interface OAuthState {
  state: string;
  integrationId: string;
  provider: string;
  createdAt: Date;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  // Slack-specific fields
  team?: {
    id: string;
    name: string;
  };
  bot_user_id?: string;
}

export interface GoogleUserInfo {
  email: string;
  name: string;
  picture?: string;
  verified_email?: boolean;
}

export interface MicrosoftUserInfo {
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  id: string;
}

export interface IntegrationData {
  id: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  status: string;
  connectedAt: string;
  updatedAt: string;
  email?: string;
  name?: string;
  tenantId?: string;
  teamId?: string;
  teamName?: string;
  botUserId?: string;
}

export interface StoredIntegration {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  provider: string;
  [key: string]: unknown;
}

export interface IntegrationsConfig {
  googleWorkspace?: {
    clientId: string;
    clientSecret: string;
  };
  microsoft365?: {
    clientId: string;
    clientSecret: string;
    tenantId?: string;
  };
  slack?: {
    clientId: string;
    clientSecret: string;
  };
  quickbooks?: {
    clientId: string;
    clientSecret: string;
    environment?: string;
  };
  xero?: {
    clientId: string;
    clientSecret: string;
  };
}

export interface ApiKeysResponse {
  integrations?: IntegrationsConfig;
  [key: string]: unknown;
}

/**
 * Generate OAuth authorization URL
 */
export async function generateAuthUrl(
  integrationId: string,
  provider: 'google' | 'microsoft' | 'slack' | 'quickbooks' | 'xero'
): Promise<string> {
  // Get OAuth config
  const config = await getOAuthConfig(provider);

  // Generate state token
  const state = crypto.randomBytes(32).toString('hex');

  // Save state to Firestore
  const { getSubCollection } = await import('@/lib/firebase/collections');
  await FirestoreService.set(
    getSubCollection('oauthStates'),
    state,
    {
      state,
      integrationId,
      provider,
      createdAt: new Date().toISOString(),
    },
    false
  );
  
  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline', // For refresh tokens
    prompt: 'consent', // Force consent to get refresh token
  });
  
  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  state: string
): Promise<OAuthTokenResponse> {
  // Verify state
  const stateData = await FirestoreService.get<OAuthState>(
    `${COLLECTIONS.ORGANIZATIONS}/*/oauthStates`,
    state
  );

  if (!stateData) {
    throw new Error('Invalid state token');
  }

  // Check if state is expired (5 minutes)
  const createdAt = new Date(stateData.createdAt);
  const now = new Date();
  if (now.getTime() - createdAt.getTime() > 5 * 60 * 1000) {
    throw new Error('State token expired');
  }

  // Validate provider type
  const validProviders = ['google', 'microsoft', 'slack', 'quickbooks', 'xero'] as const;
  if (!validProviders.includes(stateData.provider as typeof validProviders[number])) {
    throw new Error(`Invalid provider: ${stateData.provider}`);
  }

  // Get OAuth config
  const config = await getOAuthConfig(
    stateData.provider as 'google' | 'microsoft' | 'slack' | 'quickbooks' | 'xero'
  );

  // Exchange code for tokens
  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens = await tokenResponse.json() as OAuthTokenResponse;

  // Save tokens to integration
  await saveIntegrationTokens(
    stateData.integrationId,
    stateData.provider,
    tokens
  );

  // Delete state token
  const { getSubCollection } = await import('@/lib/firebase/collections');
  await FirestoreService.delete(
    getSubCollection('oauthStates'),
    state
  );

  return tokens;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(
  integrationId: string,
  provider: string
): Promise<string> {
  // Get integration
  const integration = await FirestoreService.get<StoredIntegration>(
    getIntegrationsCollection(),
    integrationId
  );

  if (!integration) {
    throw new Error('Integration not found');
  }

  const refreshToken = integration.refreshToken;
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  // Validate provider type
  const validProviders = ['google', 'microsoft', 'slack', 'quickbooks', 'xero'] as const;
  if (!validProviders.includes(provider as typeof validProviders[number])) {
    throw new Error(`Invalid provider: ${provider}`);
  }

  // Get OAuth config
  const config = await getOAuthConfig(
    provider as 'google' | 'microsoft' | 'slack' | 'quickbooks' | 'xero'
  );

  // Refresh token
  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Token refresh failed');
  }

  const tokens = await tokenResponse.json() as OAuthTokenResponse;

  // Update integration with new tokens
  await FirestoreService.set(
    getIntegrationsCollection(),
    integrationId,
    {
      ...integration,
      accessToken: tokens.access_token,
      refreshToken: (tokens.refresh_token !== '' && tokens.refresh_token != null) ? tokens.refresh_token : refreshToken, // Keep old refresh token if new one not provided
      tokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : undefined,
      updatedAt: new Date().toISOString(),
    },
    true // Update only
  );

  return tokens.access_token;
}

/**
 * Get OAuth config for provider
 */
async function getOAuthConfig(
  provider: 'google' | 'microsoft' | 'slack' | 'quickbooks' | 'xero'
): Promise<OAuthConfig> {
  const apiKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'integrations');
  
  if (!apiKeys) {
    throw new Error('Integration API keys not configured');
  }

  const baseUrlEnv = process.env.NEXT_PUBLIC_APP_URL;
  const baseUrl = (baseUrlEnv !== '' && baseUrlEnv != null) ? baseUrlEnv : 'https://app.example.com';

  // Type guard to ensure apiKeys has integrations property
  if (typeof apiKeys !== 'object' || apiKeys === null || !('integrations' in apiKeys)) {
    throw new Error('Integration API keys not properly configured');
  }

  const apiKeysTyped = apiKeys as ApiKeysResponse;
  const integrations = apiKeysTyped.integrations;

  if (!integrations || typeof integrations !== 'object') {
    throw new Error('Integration API keys not properly configured');
  }

  switch (provider) {
    case 'google': {
      const google = integrations?.googleWorkspace;
      if (!google?.clientId || !google?.clientSecret) {
        throw new Error('Google OAuth credentials not configured');
      }
      return {
        provider: 'google',
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        redirectUri: `${baseUrl}/api/integrations/oauth/callback/google`,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/drive.readonly',
        ],
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
      };
    }

    case 'microsoft': {
      const microsoft = integrations?.microsoft365;
      if (!microsoft?.clientId || !microsoft?.clientSecret) {
        throw new Error('Microsoft OAuth credentials not configured');
      }
      return {
        provider: 'microsoft',
        clientId: microsoft.clientId,
        clientSecret: microsoft.clientSecret,
        redirectUri: `${baseUrl}/api/integrations/oauth/callback/microsoft`,
        scopes: [
          'https://graph.microsoft.com/Mail.Read',
          'https://graph.microsoft.com/Calendars.ReadWrite',
          'https://graph.microsoft.com/User.Read',
        ],
        authorizationUrl: `https://login.microsoftonline.com/${(microsoft.tenantId !== '' && microsoft.tenantId != null) ? microsoft.tenantId : 'common'}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${(microsoft.tenantId !== '' && microsoft.tenantId != null) ? microsoft.tenantId : 'common'}/oauth2/v2.0/token`,
      };
    }

    case 'slack': {
      const slack = integrations?.slack;
      if (!slack?.clientId || !slack?.clientSecret) {
        throw new Error('Slack OAuth credentials not configured');
      }
      return {
        provider: 'slack',
        clientId: slack.clientId,
        clientSecret: slack.clientSecret,
        redirectUri: `${baseUrl}/api/integrations/oauth/callback/slack`,
        scopes: [
          'channels:read',
          'chat:write',
          'users:read',
          'team:read',
        ],
        authorizationUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
      };
    }

    case 'quickbooks': {
      const quickbooks = integrations?.quickbooks;
      if (!quickbooks?.clientId || !quickbooks?.clientSecret) {
        throw new Error('QuickBooks OAuth credentials not configured');
      }
      return {
        provider: 'quickbooks',
        clientId: quickbooks.clientId,
        clientSecret: quickbooks.clientSecret,
        redirectUri: `${baseUrl}/api/integrations/oauth/callback/quickbooks`,
        scopes: [
          'com.intuit.quickbooks.accounting',
          'com.intuit.quickbooks.payment',
        ],
        authorizationUrl: quickbooks.environment === 'production'
          ? 'https://appcenter.intuit.com/connect/oauth2'
          : 'https://appcenter.intuit.com/connect/oauth2', // Same for both
        tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      };
    }

    case 'xero': {
      const xero = integrations?.xero;
      if (!xero?.clientId || !xero?.clientSecret) {
        throw new Error('Xero OAuth credentials not configured');
      }
      return {
        provider: 'xero',
        clientId: xero.clientId,
        clientSecret: xero.clientSecret,
        redirectUri: `${baseUrl}/api/integrations/oauth/callback/xero`,
        scopes: [
          'offline_access',
          'accounting.transactions',
          'accounting.contacts',
          'accounting.settings',
        ],
        authorizationUrl: 'https://login.xero.com/identity/connect/authorize',
        tokenUrl: 'https://identity.xero.com/connect/token',
      };
    }
    
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Save integration tokens
 */
async function saveIntegrationTokens(
  integrationId: string,
  provider: string,
  tokens: OAuthTokenResponse
): Promise<void> {
  // Get or create integration
  const { getSubCollection } = await import('@/lib/firebase/collections');
  const integration = await FirestoreService.get<Record<string, unknown>>(
    getSubCollection('integrations'),
    integrationId
  );

  const integrationData: IntegrationData = {
    id: integrationId,
    provider,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined,
    status: 'connected',
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Provider-specific data
  if (provider === 'google') {
    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    const userInfo = await userInfoResponse.json() as GoogleUserInfo;

    integrationData.email = userInfo.email;
    integrationData.name = userInfo.name;
  } else if (provider === 'microsoft') {
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    const userInfo = await userInfoResponse.json() as MicrosoftUserInfo;

    integrationData.email = (userInfo.mail !== '' && userInfo.mail != null) ? userInfo.mail : userInfo.userPrincipalName;
    integrationData.name = userInfo.displayName;
  } else if (provider === 'slack') {
    integrationData.teamId = tokens.team?.id;
    integrationData.teamName = tokens.team?.name;
    integrationData.botUserId = tokens.bot_user_id;
  }

  await FirestoreService.set(
    getSubCollection('integrations'),
    integrationId,
    integration ? { ...integration, ...integrationData } : integrationData,
    false
  );
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(
  integrationId: string
): Promise<string> {
  const integration = await FirestoreService.get<StoredIntegration>(
    getIntegrationsCollection(),
    integrationId
  );

  if (!integration) {
    throw new Error('Integration not found');
  }

  const accessToken = integration.accessToken;
  const tokenExpiresAt = integration.tokenExpiresAt;
  const provider = integration.provider;

  if (!accessToken) {
    throw new Error('No access token available');
  }

  // Check if token is expired or about to expire (within 5 minutes)
  if (tokenExpiresAt) {
    const expiresAt = new Date(tokenExpiresAt);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt <= fiveMinutesFromNow) {
      // Refresh token
      return refreshAccessToken(integrationId, provider);
    }
  }

  return accessToken;
}

