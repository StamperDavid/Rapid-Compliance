/**
 * OAuth Service
 * Handles OAuth 2.0 authorization flows for integrations
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
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
export const OAuthConfig: Record<string, Partial<OAuthConfig>> = {
  google: { provider: 'google', authorizationUrl: 'https://accounts.google.com/o/oauth2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', scopes: [] },
  microsoft: { provider: 'microsoft', authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', scopes: [] },
  quickbooks: { provider: 'quickbooks', authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2', tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', scopes: [] },
  xero: { provider: 'xero', authorizationUrl: 'https://login.xero.com/identity/connect/authorize', tokenUrl: 'https://identity.xero.com/connect/token', scopes: [] },
};

export interface OAuthState {
  state: string;
  organizationId: string;
  workspaceId?: string;
  integrationId: string;
  provider: string;
  createdAt: Date;
}

/**
 * Generate OAuth authorization URL
 */
export async function generateAuthUrl(
  organizationId: string,
  workspaceId: string | undefined,
  integrationId: string,
  provider: 'google' | 'microsoft' | 'slack' | 'quickbooks' | 'xero'
): Promise<string> {
  // Get OAuth config
  const config = await getOAuthConfig(organizationId, provider);
  
  // Generate state token
  const state = crypto.randomBytes(32).toString('hex');
  
  // Save state to Firestore
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/oauthStates`,
    state,
    {
      state,
      organizationId,
      workspaceId,
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
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  [key: string]: any;
}> {
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
  
  // Get OAuth config
  const config = await getOAuthConfig(stateData.organizationId, stateData.provider as any);
  
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
  
  const tokens = await tokenResponse.json();
  
  // Save tokens to integration
  await saveIntegrationTokens(
    stateData.organizationId,
    stateData.workspaceId,
    stateData.integrationId,
    stateData.provider,
    tokens
  );
  
  // Delete state token
  await FirestoreService.delete(
    `${COLLECTIONS.ORGANIZATIONS}/${stateData.organizationId}/oauthStates`,
    state
  );
  
  return tokens;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(
  organizationId: string,
  integrationId: string,
  provider: string
): Promise<string> {
  // Get integration
  const integration = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId
  );
  
  if (!integration) {
    throw new Error('Integration not found');
  }
  
  const refreshToken = (integration as any).refreshToken;
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  // Get OAuth config
  const config = await getOAuthConfig(organizationId, provider as any);
  
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
  
  const tokens = await tokenResponse.json();
  
  // Update integration with new tokens
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId,
    {
      ...integration,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken, // Keep old refresh token if new one not provided
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
  organizationId: string,
  provider: 'google' | 'microsoft' | 'slack' | 'quickbooks' | 'xero'
): Promise<OAuthConfig> {
  const apiKeys = await apiKeyService.getServiceKey(organizationId, 'integrations');
  
  if (!apiKeys) {
    throw new Error('Integration API keys not configured');
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com';
  
  switch (provider) {
    case 'google': {
      const google = (apiKeys).integrations?.googleWorkspace;
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
      const microsoft = (apiKeys).integrations?.microsoft365;
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
        authorizationUrl: `https://login.microsoftonline.com/${microsoft.tenantId || 'common'}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${microsoft.tenantId || 'common'}/oauth2/v2.0/token`,
      };
    }
    
    case 'slack': {
      const slack = (apiKeys).integrations?.slack;
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
      const quickbooks = (apiKeys).integrations?.quickbooks;
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
      const xero = (apiKeys).integrations?.xero;
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
  organizationId: string,
  workspaceId: string | undefined,
  integrationId: string,
  provider: string,
  tokens: any
): Promise<void> {
  // Get or create integration
  const integration = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId
  );
  
  const integrationData: any = {
    id: integrationId,
    organizationId,
    workspaceId,
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
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }).then(r => r.json());
    
    integrationData.email = userInfo.email;
    integrationData.name = userInfo.name;
  } else if (provider === 'microsoft') {
    const userInfo = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }).then(r => r.json());
    
    integrationData.email = userInfo.mail || userInfo.userPrincipalName;
    integrationData.name = userInfo.displayName;
    integrationData.tenantId = userInfo.tenantId;
  } else if (provider === 'slack') {
    integrationData.teamId = tokens.team?.id;
    integrationData.teamName = tokens.team?.name;
    integrationData.botUserId = tokens.bot_user_id;
  }
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId,
    integration ? { ...integration, ...integrationData } : integrationData,
    false
  );
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(
  organizationId: string,
  integrationId: string
): Promise<string> {
  const integration = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId
  );
  
  if (!integration) {
    throw new Error('Integration not found');
  }
  
  const accessToken = (integration as any).accessToken;
  const tokenExpiresAt = (integration as any).tokenExpiresAt;
  const provider = (integration as any).provider;
  
  // Check if token is expired or about to expire (within 5 minutes)
  if (tokenExpiresAt) {
    const expiresAt = new Date(tokenExpiresAt);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    if (expiresAt <= fiveMinutesFromNow) {
      // Refresh token
      return refreshAccessToken(organizationId, integrationId, provider);
    }
  }
  
  return accessToken;
}

