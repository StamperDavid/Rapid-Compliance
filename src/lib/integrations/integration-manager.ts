/**
 * Integration Manager
 * Central service for managing all integrations
 * Stores credentials, handles OAuth, refreshes tokens
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export interface IntegrationCredentials {
  integrationId: string; // 'zoom', 'quickbooks', 'shopify', etc.
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>; // Integration-specific data (realmId, shopDomain, etc.)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Save integration credentials
 */
export async function saveIntegrationCredentials(
  integrationId: string,
  credentials: Omit<IntegrationCredentials, 'integrationId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  try {
    const now = new Date();

    const credentialsDoc: IntegrationCredentials = {
      ...credentials,
      integrationId,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      getSubCollection('integrations'),
      integrationId,
      credentialsDoc,
      true // Merge to preserve metadata
    );

    logger.info('Integration credentials saved', { integrationId });

  } catch (error) {
    logger.error('Failed to save integration credentials', error instanceof Error ? error : undefined, { integrationId });
    throw error;
  }
}

/**
 * Get integration credentials
 */
export async function getIntegrationCredentials(
  integrationId: string
): Promise<IntegrationCredentials | null> {
  try {
    const credentials = await FirestoreService.get<IntegrationCredentials>(
      getSubCollection('integrations'),
      integrationId
    );

    if (!credentials) {
      return null;
    }

    // Check if token is expired
    if (credentials.expiresAt) {
      const expiresAt = credentials.expiresAt instanceof Date
        ? credentials.expiresAt
        : new Date(credentials.expiresAt);

      if (expiresAt < new Date()) {
        // Token expired, try to refresh
        if (credentials.refreshToken) {
          logger.info('Token expired, refreshing', { integrationId });
          const refreshed = await refreshIntegrationToken(integrationId, credentials.refreshToken);
          if (refreshed) {
            return refreshed;
          }
        }
        // Can't refresh, return null
        logger.warn('Integration token expired and cannot refresh', { integrationId });
        return null;
      }
    }

    return credentials;

  } catch (error) {
    logger.error('Failed to get integration credentials', error instanceof Error ? error : undefined, { integrationId });
    return null;
  }
}

/**
 * Refresh integration token
 */
async function refreshIntegrationToken(
  integrationId: string,
  refreshToken: string
): Promise<IntegrationCredentials | null> {
  try {
    let newTokenData: { accessToken: string; refreshToken?: string; expiresIn: number } | null = null;

    // Call appropriate refresh endpoint based on integration
    switch (integrationId) {
      case 'zoom':
        newTokenData = await refreshZoomToken(refreshToken);
        break;
      case 'quickbooks':
        newTokenData = await refreshQuickBooksToken(refreshToken);
        break;
      case 'google':
        newTokenData = await refreshGoogleToken(refreshToken);
        break;
      case 'microsoft':
        newTokenData = await refreshMicrosoftToken(refreshToken);
        break;
      case 'slack':
        newTokenData = await refreshSlackToken(refreshToken);
        break;
      case 'hubspot':
        newTokenData = await refreshHubSpotToken(refreshToken);
        break;
      default:
        // Integrations not listed above (e.g. Twitter PKCE, future providers) do not
        // use server-side refresh tokens — this is expected, not an error.
        logger.info('No server-side token refresh for integration', { integrationId });
        return null;
    }

    if (!newTokenData) {
      return null;
    }

    // Save new credentials
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expiresIn);

    const newRefreshToken = (newTokenData.refreshToken !== '' && newTokenData.refreshToken != null) ? newTokenData.refreshToken : refreshToken;
    await saveIntegrationCredentials(integrationId, {
      accessToken: newTokenData.accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    });

    // Return updated credentials
    return await getIntegrationCredentials(integrationId);

  } catch (error) {
    logger.error('Token refresh failed', error instanceof Error ? error : undefined, { integrationId });
    return null;
  }
}

/**
 * Refresh Zoom token
 */
async function refreshZoomToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Zoom token refresh failed');
  }

  const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh QuickBooks token
 */
async function refreshQuickBooksToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('QuickBooks token refresh failed');
  }

  const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh Google OAuth token
 */
async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Google token refresh failed');
  }

  const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh Microsoft OAuth token
 */
async function refreshMicrosoftToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? 'common';

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
      scope: 'https://graph.microsoft.com/.default offline_access',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Microsoft token refresh failed');
  }

  const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh Slack OAuth token
 */
async function refreshSlackToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Slack token refresh failed');
  }

  const data = await response.json() as { ok: boolean; access_token: string; refresh_token?: string; expires_in: number; error?: string };
  if (!data.ok) {
    throw new Error(`Slack token refresh failed: ${data.error ?? 'unknown error'}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh HubSpot OAuth token
 */
async function refreshHubSpotToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('HubSpot token refresh failed');
  }

  const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Disconnect integration
 */
export async function disconnectIntegration(
  integrationId: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      getSubCollection('integrations'),
      integrationId
    );

    logger.info('Integration disconnected', { integrationId });

  } catch (error) {
    logger.error('Failed to disconnect integration', error instanceof Error ? error : undefined, { integrationId });
    throw error;
  }
}

/**
 * List all connected integrations for an organization
 */
export async function listConnectedIntegrations(): Promise<IntegrationCredentials[]> {
  try {
    const result = await FirestoreService.getAll<IntegrationCredentials>(
      getSubCollection('integrations')
    );

    return result;

  } catch (error) {
    logger.error('Failed to list integrations', error instanceof Error ? error : undefined);
    return [];
  }
}

/**
 * Get a single integration by ID
 */
export async function getIntegration(
  integrationId: string
): Promise<IntegrationCredentials | null> {
  return getIntegrationCredentials(integrationId);
}

/**
 * Update integration settings
 */
export async function updateIntegration(
  integrationId: string,
  updates: Partial<IntegrationCredentials>
): Promise<void> {
  try {
    await FirestoreService.update(
      getSubCollection('integrations'),
      integrationId,
      {
        ...updates,
        updatedAt: new Date(),
      }
    );

    logger.info('Integration updated', { integrationId });

  } catch (error) {
    logger.error('Failed to update integration', error instanceof Error ? error : undefined, { integrationId });
    throw error;
  }
}

/**
 * Delete an integration
 */
export async function deleteIntegration(
  integrationId: string
): Promise<void> {
  return disconnectIntegration(integrationId);
}

/**
 * Sync integration data — verifies credentials are valid and refreshes if needed
 */
export async function syncIntegration(
  integrationId: string
): Promise<{ success: boolean; synced?: number; error?: string }> {
  try {
    logger.info('Syncing integration', { integrationId });

    // Verify credentials exist and are valid
    const credentials = await getIntegrationCredentials(integrationId);
    if (!credentials) {
      return { success: false, error: 'Integration not connected or token expired' };
    }

    // If token was refreshed during getIntegrationCredentials, that counts as a sync
    return {
      success: true,
      synced: 0,
    };

  } catch (error) {
    logger.error('Failed to sync integration', error instanceof Error ? error : undefined, { integrationId });
    const syncErrorMsg = error instanceof Error && error.message ? error.message : 'Sync failed';
    return {
      success: false,
      error: syncErrorMsg,
    };
  }
}

/**
 * Test integration connection — makes a lightweight API call to verify the token works
 */
export async function testIntegration(
  integrationId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const credentials = await getIntegrationCredentials(integrationId);

    if (!credentials) {
      return { success: false, error: 'Integration not found or token expired' };
    }

    if (!credentials.accessToken) {
      return { success: false, error: 'No access token found' };
    }

    // Make a lightweight test call per provider
    const testEndpoints: Record<string, string> = {
      google: 'https://www.googleapis.com/oauth2/v1/tokeninfo',
      microsoft: 'https://graph.microsoft.com/v1.0/me',
      slack: 'https://slack.com/api/auth.test',
      zoom: 'https://api.zoom.us/v2/users/me',
      quickbooks: 'https://accounts.platform.intuit.com/v1/openid_connect/userinfo',
      hubspot: `https://api.hubapi.com/oauth/v1/access-tokens/${credentials.accessToken}`,
    };

    const testUrl = testEndpoints[integrationId];
    if (!testUrl) {
      // For integrations without a test endpoint, verify token exists
      return { success: true, message: `Integration ${integrationId} has valid credentials` };
    }

    const response = await fetch(testUrl, {
      headers: { 'Authorization': `Bearer ${credentials.accessToken}` },
    });

    if (response.ok) {
      return { success: true, message: `${integrationId} connection verified` };
    }

    return {
      success: false,
      error: `${integrationId} API returned ${response.status}: token may be invalid`,
    };

  } catch (error) {
    logger.error('Failed to test integration', error instanceof Error ? error : undefined, { integrationId });
    const testErrorMsg = error instanceof Error && error.message ? error.message : 'Test failed';
    return { success: false, error: testErrorMsg };
  }
}
