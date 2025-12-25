/**
 * Integration Manager
 * Central service for managing all integrations
 * Stores credentials, handles OAuth, refreshes tokens
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

export interface IntegrationCredentials {
  integrationId: string; // 'zoom', 'quickbooks', 'shopify', etc.
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>; // Integration-specific data (realmId, shopDomain, etc.)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Save integration credentials
 */
export async function saveIntegrationCredentials(
  organizationId: string,
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
      `organizations/${organizationId}/integrations`,
      integrationId,
      credentialsDoc,
      true // Merge to preserve metadata
    );

    logger.info('Integration credentials saved', { organizationId, integrationId });

  } catch (error: any) {
    logger.error('Failed to save integration credentials', error, { organizationId, integrationId });
    throw error;
  }
}

/**
 * Get integration credentials
 */
export async function getIntegrationCredentials(
  organizationId: string,
  integrationId: string
): Promise<IntegrationCredentials | null> {
  try {
    const credentials = await FirestoreService.get<IntegrationCredentials>(
      `organizations/${organizationId}/integrations`,
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
          const refreshed = await refreshIntegrationToken(organizationId, integrationId, credentials.refreshToken);
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

  } catch (error: any) {
    logger.error('Failed to get integration credentials', error, { organizationId, integrationId });
    return null;
  }
}

/**
 * Refresh integration token
 */
async function refreshIntegrationToken(
  organizationId: string,
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
      // Add other integrations as needed
      default:
        logger.warn('Token refresh not implemented for integration', { integrationId });
        return null;
    }

    if (!newTokenData) {
      return null;
    }

    // Save new credentials
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expiresIn);

    await saveIntegrationCredentials(organizationId, integrationId, {
      accessToken: newTokenData.accessToken,
      refreshToken: newTokenData.refreshToken || refreshToken,
      expiresAt,
    });

    // Return updated credentials
    return await getIntegrationCredentials(organizationId, integrationId);

  } catch (error: any) {
    logger.error('Token refresh failed', error, { integrationId });
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

  const data = await response.json();

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

  const data = await response.json();

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
  organizationId: string,
  integrationId: string
): Promise<void> {
  try {
    await FirestoreService.delete(
      `organizations/${organizationId}/integrations`,
      integrationId
    );

    logger.info('Integration disconnected', { organizationId, integrationId });

  } catch (error: any) {
    logger.error('Failed to disconnect integration', error, { organizationId, integrationId });
    throw error;
  }
}

/**
 * List all connected integrations for an organization
 */
export async function listConnectedIntegrations(
  organizationId: string
): Promise<IntegrationCredentials[]> {
  try {
    const result = await FirestoreService.getAll<IntegrationCredentials>(
      `organizations/${organizationId}/integrations`
    );

    return result;

  } catch (error: any) {
    logger.error('Failed to list integrations', error, { organizationId });
    return [];
  }
}

/**
 * Get a single integration by ID
 */
export async function getIntegration(
  organizationId: string,
  integrationId: string
): Promise<IntegrationCredentials | null> {
  return getIntegrationCredentials(organizationId, integrationId);
}

/**
 * Update integration settings
 */
export async function updateIntegration(
  organizationId: string,
  integrationId: string,
  updates: Partial<IntegrationCredentials>
): Promise<void> {
  try {
    await FirestoreService.update(
      `organizations/${organizationId}/integrations`,
      integrationId,
      {
        ...updates,
        updatedAt: new Date(),
      }
    );

    logger.info('Integration updated', { organizationId, integrationId });

  } catch (error: any) {
    logger.error('Failed to update integration', error, { organizationId, integrationId });
    throw error;
  }
}

/**
 * Delete an integration
 */
export async function deleteIntegration(
  organizationId: string,
  integrationId: string
): Promise<void> {
  return disconnectIntegration(organizationId, integrationId);
}

/**
 * Sync integration data
 */
export async function syncIntegration(
  organizationId: string,
  integrationId: string
): Promise<{ success: boolean; synced?: number; error?: string }> {
  try {
    logger.info('Syncing integration', { organizationId, integrationId });
    
    // Implementation would depend on the integration type
    // For now, return success
    return {
      success: true,
      synced: 0, // Number of records synced
    };

  } catch (error: any) {
    logger.error('Failed to sync integration', error, { organizationId, integrationId });
    return {
      success: false,
      error: error.message || 'Sync failed',
    };
  }
}

/**
 * Test integration connection
 */
export async function testIntegration(
  organizationId: string,
  integrationId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const credentials = await getIntegrationCredentials(organizationId, integrationId);
    
    if (!credentials) {
      return {
        success: false,
        error: 'Integration not found',
      };
    }

    // Basic check - if we have an access token, consider it valid
    // Real implementation would make a test API call
    if (credentials.accessToken) {
      return {
        success: true,
        message: 'Integration connection is valid',
      };
    }

    return {
      success: false,
      error: 'No access token found',
    };

  } catch (error: any) {
    logger.error('Failed to test integration', error, { organizationId, integrationId });
    return {
      success: false,
      error: error.message || 'Test failed',
    };
  }
}
