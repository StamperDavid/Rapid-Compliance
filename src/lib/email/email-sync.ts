/**
 * Email Sync Service
 * Handles two-way email synchronization with Gmail/Outlook
 * Integrates with gmail-sync-service.ts and outlook-sync-service.ts
 */

import type { GmailSyncStatus} from '@/lib/integrations/gmail-sync-service';
import { syncGmailMessages, setupGmailPushNotifications, stopGmailPushNotifications } from '@/lib/integrations/gmail-sync-service';
import type { OutlookSyncStatus } from '@/lib/integrations/outlook-sync-service';
import { syncOutlookMessages } from '@/lib/integrations/outlook-sync-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

export interface EmailSyncConfig {
  provider: 'gmail' | 'outlook';
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  syncFolders: string[];
  autoCreateContacts: boolean;
  organizationId: string;
  workspaceId?: string;
  accessToken: string;
  refreshToken?: string;
}

export interface SyncedEmail {
  id: string;
  messageId: string;
  threadId?: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  receivedAt: Date;
  sentAt: Date;
  folder?: string;
  labels?: string[];
  attachments?: Array<{
    filename: string;
    size: number;
    contentType: string;
    downloadUrl?: string;
  }>;
  syncedAt: Date;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  errors: number;
  lastSyncAt: Date;
}

/**
 * Sync emails from email provider using real Gmail/Outlook sync services
 */
export async function syncEmails(config: EmailSyncConfig): Promise<SyncResult> {
  logger.info('Starting email sync', { 
    route: '/email/sync', 
    provider: config.provider,
    organizationId: config.organizationId 
  });

  try {
    if (config.provider === 'gmail') {
      return await syncGmailEmails(config);
    } else if (config.provider === 'outlook') {
      return await syncOutlookEmails(config);
    } else {
      throw new Error(`Unsupported email provider: ${config.provider}`);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Email sync failed', err, {
      route: '/email/sync',
      provider: config.provider
    });

    return {
      success: false,
      synced: 0,
      errors: 1,
      lastSyncAt: new Date(),
    };
  }
}

/**
 * Sync Gmail emails using gmail-sync-service
 */
async function syncGmailEmails(config: EmailSyncConfig): Promise<SyncResult> {
  const result = await syncGmailMessages(
    config.organizationId,
    config.accessToken,
    100 // maxResults
  );

  return {
    success: result.errors === 0,
    synced: result.messagesSynced,
    errors: result.errors,
    lastSyncAt: new Date(result.lastSyncAt),
  };
}

/**
 * Sync Outlook emails using outlook-sync-service
 */
async function syncOutlookEmails(config: EmailSyncConfig): Promise<SyncResult> {
  const result = await syncOutlookMessages(
    config.organizationId,
    config.accessToken,
    100 // maxResults
  );

  return {
    success: result.errors === 0,
    synced: result.messagesSynced,
    errors: result.errors,
    lastSyncAt: new Date(result.lastSyncAt),
  };
}

/**
 * Sync outbound emails to email provider
 * NOTE: Gmail/Outlook automatically track sent emails via API
 */
export async function syncOutboundEmails(config: EmailSyncConfig): Promise<SyncResult> {
  logger.info('Syncing outbound emails', { 
    route: '/email/sync/outbound', 
    provider: config.provider 
  });

  // Gmail and Outlook automatically track sent emails when using their APIs
  // Emails sent via gmail-service.ts or outlook-service.ts are already in "Sent" folder
  
  // We just need to ensure our local CRM records are marked as synced
  try {
    const { where } = await import('firebase/firestore');
    
    // Get unsent emails from CRM
    const unsentEmails = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${config.organizationId}/emails`,
      [
        where('source', '==', 'crm'),
        where('synced', '!=', true),
      ]
    );

    let synced = 0;
    let errors = 0;

    for (const email of unsentEmails) {
      try {
        // Mark as synced (emails are already sent via API)
        await FirestoreService.update(
          `${COLLECTIONS.ORGANIZATIONS}/${config.organizationId}/emails`,
          email.id,
          {
            synced: true,
            syncedAt: new Date().toISOString(),
          }
        );
        synced++;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to mark email as synced', err, { emailId: email.id });
        errors++;
      }
    }

    return {
      success: errors === 0,
      synced,
      errors,
      lastSyncAt: new Date(),
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Outbound sync failed', err, { route: '/email/sync/outbound' });
  return {
      success: false,
    synced: 0,
      errors: 1,
    lastSyncAt: new Date(),
  };
  }
}

/**
 * Start continuous email sync using webhooks/push notifications
 */
export async function startEmailSync(config: EmailSyncConfig): Promise<void> {
  logger.info('Starting continuous email sync', { 
    route: '/email/sync/start', 
    provider: config.provider,
    organizationId: config.organizationId 
  });

  try {
    // Store sync configuration
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${config.organizationId}/integrationStatus`,
      `${config.provider}-sync-config`,
      {
        ...config,
        isActive: true,
        startedAt: new Date().toISOString(),
        lastSyncAt: null,
        updatedAt: new Date().toISOString(),
      }
    );

    // Set up push notifications for Gmail
    if (config.provider === 'gmail') {
      // Gmail uses Google Cloud Pub/Sub for push notifications
      // Topic name format: projects/{project-id}/topics/gmail-push
      const topicName = process.env.GOOGLE_PUBSUB_TOPIC ?? 
                       `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/gmail-push`;
      
      await setupGmailPushNotifications(config.accessToken, topicName);
      
      logger.info('Gmail push notifications enabled', { 
        route: '/email/sync/start',
        organizationId: config.organizationId 
      });
    } else if (config.provider === 'outlook') {
      // Outlook uses Microsoft Graph webhooks (subscriptions)
      // This would be implemented in outlook-sync-service.ts
      logger.info('Outlook webhooks would be set up here', { 
        route: '/email/sync/start',
        organizationId: config.organizationId 
      });
      
      // TODO: Implement Outlook webhook subscription
      // await setupOutlookWebhook(config.accessToken, config.organizationId);
    }

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to start email sync', err, {
      route: '/email/sync/start',
      provider: config.provider
    });
    throw err;
  }
}

/**
 * Stop email sync and remove webhooks
 */
export async function stopEmailSync(organizationId: string, provider: 'gmail' | 'outlook'): Promise<void> {
  logger.info('Stopping email sync', { 
    route: '/email/sync/stop', 
    provider,
    organizationId 
  });

  try {
    // Get sync configuration
    const syncConfig = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrationStatus`,
      `${provider}-sync-config`
    );

    if (!syncConfig) {
      logger.warn('No sync config found', { organizationId, provider });
      return;
    }

    // Stop push notifications
    if (provider === 'gmail') {
      await stopGmailPushNotifications(syncConfig.accessToken);
      logger.info('Gmail push notifications stopped', { organizationId });
    } else if (provider === 'outlook') {
      // TODO: Implement Outlook webhook removal
      // await stopOutlookWebhook(syncConfig.accessToken);
      logger.info('Outlook webhooks would be stopped here', { organizationId });
    }

    // Update sync configuration
    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrationStatus`,
      `${provider}-sync-config`,
      {
        isActive: false,
        stoppedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to stop email sync', err, {
      route: '/email/sync/stop',
      provider
    });
    throw err;
  }
}

/**
 * Get sync status for organization
 */
export interface SyncStatus {
  isActive: boolean;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  syncedCount: number;
  errorCount: number;
  lastError?: string;
}

export async function getSyncStatus(organizationId: string, provider: 'gmail' | 'outlook'): Promise<SyncStatus> {
  try {
    // Get sync configuration
    const syncConfig = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrationStatus`,
      `${provider}-sync-config`
    );

    // Get last sync result
    const lastSyncResult = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrationStatus`,
      `${provider}-sync`
    );

    if (!lastSyncResult) {
  return {
        isActive: syncConfig?.isActive ?? false,
    syncedCount: 0,
    errorCount: 0,
  };
}

    return {
      isActive: syncConfig?.isActive ?? false,
      lastSyncAt: new Date(lastSyncResult.lastSyncAt),
      nextSyncAt: undefined, // Push-based sync, no scheduled next sync
      syncedCount: lastSyncResult.messagesSynced,
      errorCount: lastSyncResult.errors,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get sync status', err, { organizationId, provider });
    return {
      isActive: false,
      syncedCount: 0,
      errorCount: 0,
      lastError: err.message,
    };
  }
}
