/**
 * Integration Manager Service
 * Manages integration connections and operations
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Integration } from '@/types/integrations';
import { getValidAccessToken } from './oauth-service';

/**
 * Get integration
 */
export async function getIntegration(
  organizationId: string,
  integrationId: string
): Promise<Integration | null> {
  return await FirestoreService.get<Integration>(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId
  );
}

/**
 * Get all integrations for organization
 */
export async function getAllIntegrations(
  organizationId: string,
  workspaceId?: string
): Promise<Integration[]> {
  const { where } = await import('firebase/firestore');
  const constraints = [where('organizationId', '==', organizationId)];
  
  if (workspaceId) {
    constraints.push(where('workspaceId', '==', workspaceId));
  }
  
  return await FirestoreService.getAll<Integration>(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    constraints
  );
}

/**
 * Create integration
 */
export async function createIntegration(
  organizationId: string,
  workspaceId: string | undefined,
  integration: Partial<Integration>
): Promise<Integration> {
  const integrationId = integration.id || `integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const integrationData: Integration = {
    id: integrationId,
    name: integration.name || 'Unknown',
    description: integration.description || '',
    icon: integration.icon || '🔌',
    category: integration.category || 'automation',
    status: 'not_connected',
    organizationId,
    workspaceId,
    ...integration,
  } as Integration;
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId,
    {
      ...integrationData,
      connectedAt: integrationData.connectedAt?.toISOString(),
      lastSyncAt: integrationData.lastSyncAt?.toISOString(),
    },
    false
  );
  
  return integrationData;
}

/**
 * Update integration
 */
export async function updateIntegration(
  organizationId: string,
  integrationId: string,
  updates: Partial<Integration>
): Promise<void> {
  const existing = await getIntegration(organizationId, integrationId);
  if (!existing) {
    throw new Error('Integration not found');
  }
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId,
    {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      connectedAt: (updates.connectedAt || existing.connectedAt)?.toISOString(),
      lastSyncAt: (updates.lastSyncAt || existing.lastSyncAt)?.toISOString(),
    },
    true // Update only
  );
}

/**
 * Delete integration
 */
export async function deleteIntegration(
  organizationId: string,
  integrationId: string
): Promise<void> {
  await FirestoreService.delete(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId
  );
}

/**
 * Test integration connection
 */
export async function testIntegration(
  organizationId: string,
  integrationId: string
): Promise<{ success: boolean; error?: string }> {
  const integration = await getIntegration(organizationId, integrationId);
  
  if (!integration) {
    return { success: false, error: 'Integration not found' };
  }
  
  if (integration.status !== 'connected') {
    return { success: false, error: 'Integration not connected' };
  }
  
  try {
    // Get access token
    const accessToken = await getValidAccessToken(organizationId, integrationId);
    
    // Test based on provider
    switch (integration.id) {
      case 'slack':
        return await testSlackConnection(accessToken);
      
      case 'gmail':
      case 'google-calendar':
        return await testGoogleConnection(accessToken);
      
      case 'outlook':
      case 'outlook-calendar':
        return await testMicrosoftConnection(accessToken);
      
      default:
        return { success: true }; // Assume success for other integrations
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Test Slack connection
 */
async function testSlackConnection(accessToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    
    if (data.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Connection test failed' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Test Google connection
 */
async function testGoogleConnection(accessToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: 'Connection test failed' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Test Microsoft connection
 */
async function testMicrosoftConnection(accessToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: 'Connection test failed' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Sync integration data
 */
export async function syncIntegration(
  organizationId: string,
  integrationId: string
): Promise<{ success: boolean; synced: number; error?: string }> {
  const integration = await getIntegration(organizationId, integrationId);
  
  if (!integration || integration.status !== 'connected') {
    return { success: false, synced: 0, error: 'Integration not connected' };
  }
  
  try {
    // Get access token
    const accessToken = await getValidAccessToken(organizationId, integrationId);
    
    // Sync based on integration type
    let synced = 0;
    
    switch (integration.id) {
      case 'gmail':
        synced = await syncGmail(organizationId, integrationId, accessToken);
        break;
      
      case 'google-calendar':
        synced = await syncGoogleCalendar(organizationId, integrationId, accessToken);
        break;
      
      case 'outlook':
        synced = await syncOutlook(organizationId, integrationId, accessToken);
        break;
      
      case 'slack':
        // Slack doesn't need syncing (real-time via webhooks)
        synced = 0;
        break;
      
      default:
        return { success: false, synced: 0, error: 'Sync not implemented for this integration' };
    }
    
    // Update last sync time
    await updateIntegration(organizationId, integrationId, {
      lastSyncAt: new Date(),
    });
    
    return { success: true, synced };
  } catch (error: any) {
    return { success: false, synced: 0, error: error.message };
  }
}

/**
 * Sync Gmail
 */
async function syncGmail(organizationId: string, integrationId: string, accessToken: string): Promise<number> {
  // TODO: Implement Gmail sync
  // - Fetch emails
  // - Create contacts from senders
  // - Link emails to CRM records
  return 0;
}

/**
 * Sync Google Calendar
 */
async function syncGoogleCalendar(organizationId: string, integrationId: string, accessToken: string): Promise<number> {
  // TODO: Implement Google Calendar sync
  // - Fetch events
  // - Create tasks/appointments in CRM
  return 0;
}

/**
 * Sync Outlook
 */
async function syncOutlook(organizationId: string, integrationId: string, accessToken: string): Promise<number> {
  // TODO: Implement Outlook sync
  // - Fetch emails
  // - Create contacts
  return 0;
}

