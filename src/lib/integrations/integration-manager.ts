/**
 * Integration Manager Service
 * Manages integration connections and operations
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { ConnectedIntegration } from '@/types/integrations';
import { getValidAccessToken } from './oauth-service';
import type { Timestamp } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

/**
 * Get integration
 */
export async function getIntegration(
  organizationId: string,
  integrationId: string
): Promise<ConnectedIntegration | null> {
  return await FirestoreService.get<ConnectedIntegration>(
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
): Promise<ConnectedIntegration[]> {
  const { where } = await import('firebase/firestore');
  const constraints = [where('organizationId', '==', organizationId)];
  
  if (workspaceId) {
    constraints.push(where('workspaceId', '==', workspaceId));
  }
  
  return await FirestoreService.getAll<ConnectedIntegration>(
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
  integration: Partial<ConnectedIntegration>
): Promise<ConnectedIntegration> {
  const integrationId = integration.id || `integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const integrationData: ConnectedIntegration = {
    id: integrationId,
    name: integration.name || 'Unknown',
    description: integration.description || '',
    icon: integration.icon || '🔌',
    category: integration.category || 'automation',
    status: 'not_connected',
    organizationId,
    workspaceId,
    ...integration,
  } as ConnectedIntegration;
  
  // Convert Timestamp to string if needed
  const connectedAtString = integrationData.connectedAt
    ? typeof integrationData.connectedAt === 'string'
      ? integrationData.connectedAt
      : integrationData.connectedAt.toDate().toISOString()
    : new Date().toISOString();
    
  const lastSyncAtString = integrationData.lastSyncAt
    ? typeof integrationData.lastSyncAt === 'string'
      ? integrationData.lastSyncAt
      : integrationData.lastSyncAt.toDate().toISOString()
    : undefined;

  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId,
    {
      ...integrationData,
      connectedAt: connectedAtString,
      lastSyncAt: lastSyncAtString,
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
  updates: Partial<ConnectedIntegration>
): Promise<void> {
  const existing = await getIntegration(organizationId, integrationId);
  if (!existing) {
    throw new Error('Integration not found');
  }
  
  // Helper to convert Timestamp to string
  const toISOString = (value: string | Timestamp | undefined): string | undefined => {
    if (!value) return undefined;
    return typeof value === 'string' ? value : value.toDate().toISOString();
  };

  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    integrationId,
    {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      connectedAt: toISOString(updates.connectedAt || existing.connectedAt) || existing.connectedAt,
      lastSyncAt: toISOString(updates.lastSyncAt || existing.lastSyncAt),
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
  
  if (integration.status !== 'active') {
    return { success: false, error: 'Integration not active' };
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
  
  if (!integration || integration.status !== 'active') {
    return { success: false, synced: 0, error: 'Integration not active' };
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
      lastSyncAt: new Date().toISOString(),
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
  try {
    const gmailService = await import('./gmail-sync-service');
    const result = await gmailService.syncGmailMessages(organizationId, accessToken);
    logger.info('Gmail Sync Synced result.messagesSynced} emails for org organizationId}', { file: 'integration-manager.ts' });
    return result.messagesSynced;
  } catch (error: any) {
    logger.error('[Gmail Sync] Error:', error, { file: 'integration-manager.ts' });
    throw new Error(`Gmail sync failed: ${error.message}`);
  }
}

/**
 * Sync Google Calendar
 */
async function syncGoogleCalendar(organizationId: string, integrationId: string, accessToken: string): Promise<number> {
  try {
    const calendarService = await import('./calendar-sync-service');
    const result = await calendarService.syncCalendarEvents(organizationId, 'google', accessToken);
    logger.info('Google Calendar Sync Synced result.eventsSynced} events for org organizationId}', { file: 'integration-manager.ts' });
    return result.eventsSynced;
  } catch (error: any) {
    logger.error('[Google Calendar Sync] Error:', error, { file: 'integration-manager.ts' });
    throw new Error(`Google Calendar sync failed: ${error.message}`);
  }
}

/**
 * Sync Outlook
 */
async function syncOutlook(organizationId: string, integrationId: string, accessToken: string): Promise<number> {
  try {
    const outlookService = await import('./outlook-sync-service');
    const result = await outlookService.syncOutlookMessages(organizationId, accessToken);
    logger.info('Outlook Sync Synced result.messagesSynced} emails for org organizationId}', { file: 'integration-manager.ts' });
    return result.messagesSynced;
  } catch (error: any) {
    logger.error('[Outlook Sync] Error:', error, { file: 'integration-manager.ts' });
    throw new Error(`Outlook sync failed: ${error.message}`);
  }
}

