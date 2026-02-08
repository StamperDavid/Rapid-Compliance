/**
 * Outlook / Microsoft 365 Email Sync Service
 * Bidirectional email syncing between Outlook and CRM
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

export interface OutlookMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  bccRecipients?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  sentDateTime: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  importance: 'low' | 'normal' | 'high';
  isRead: boolean;
  isDraft: boolean;
  webLink: string;
}

export interface OutlookSyncStatus {
  lastSyncAt: string;
  deltaLink?: string;
  messagesSynced: number;
  errors: number;
}

interface OutlookContact {
  id: string;
  email: string;
  name?: string;
}

interface GraphDeltaResponse {
  value: OutlookMessage[];
  '@odata.deltaLink'?: string;
  '@odata.nextLink'?: string;
}

interface OutlookMessageWithRemoved extends OutlookMessage {
  '@removed'?: boolean;
}

interface GraphSendMailResponse {
  id?: string;
}

/**
 * Initialize Microsoft Graph client
 */
function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Sync Outlook messages to CRM
 */
export async function syncOutlookMessages(
  accessToken: string,
  maxResults = 100
): Promise<OutlookSyncStatus> {
  const client = getGraphClient(accessToken);

  try {
    // Get last sync status
    const lastSync = await getLastSyncStatus();

    // If we have a delta link, use incremental sync
    if (lastSync?.deltaLink) {
      return await incrementalSync(client, lastSync.deltaLink);
    }

    // Full sync (first time)
    return await fullSync(client, maxResults);
  } catch (error) {
    logger.error('[Outlook Sync] Error:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
    throw error;
  }
}

/**
 * Full sync (initial sync)
 */
async function fullSync(
  client: Client,
  maxResults: number
): Promise<OutlookSyncStatus> {
  let messagesSynced = 0;
  let errors = 0;
  let deltaLink: string | undefined;

  try {
    // Get messages from inbox and sent items
    const response = await client
      .api('/me/messages/delta')
      .select('id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,hasAttachments,importance,isRead,isDraft,webLink')
      .top(maxResults)
      .get() as GraphDeltaResponse;

    for (const message of response.value) {
      try {
        await saveMessageToCRM(message);
        messagesSynced++;
      } catch (err) {
        logger.error(`[Outlook Sync] Error processing message ${message.id}:`, err instanceof Error ? err : new Error(String(err)), { file: 'outlook-sync-service.ts' });
        errors++;
      }
    }

    // Get delta link for future incremental syncs
    deltaLink = response['@odata.deltaLink'];

    const status: OutlookSyncStatus = {
      lastSyncAt: new Date().toISOString(),
      deltaLink,
      messagesSynced,
      errors,
    };

    await saveSyncStatus(status);

    return status;
  } catch (error) {
    logger.error('[Outlook Sync] Full sync error:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
    throw error;
  }
}

/**
 * Incremental sync using delta link
 */
async function incrementalSync(
  client: Client,
  startDeltaLink: string
): Promise<OutlookSyncStatus> {
  let messagesSynced = 0;
  let errors = 0;
  let deltaLink: string = startDeltaLink;

  try {
    // Use delta link to get changes
    const response = await client
      .api(deltaLink)
      .get() as GraphDeltaResponse;

    for (const message of response.value) {
      try {
        const messageWithRemoved = message as OutlookMessageWithRemoved;
        if (messageWithRemoved['@removed']) {
          // Message was deleted
          await deleteMessageFromCRM(message.id);
        } else {
          // Message was added or updated
          await saveMessageToCRM(message);
          messagesSynced++;
        }
      } catch (err) {
        logger.error(`[Outlook Sync] Error processing message ${message.id}:`, err instanceof Error ? err : new Error(String(err)), { file: 'outlook-sync-service.ts' });
        errors++;
      }
    }

    // Update delta link
    if (response['@odata.deltaLink']) {
      deltaLink = response['@odata.deltaLink'];
    }

    const status: OutlookSyncStatus = {
      lastSyncAt: new Date().toISOString(),
      deltaLink,
      messagesSynced,
      errors,
    };

    await saveSyncStatus(status);

    return status;
  } catch (error) {
    logger.error('[Outlook Sync] Incremental sync error:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
    // If delta link is invalid, fall back to full sync
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 410) {
      logger.info('[Outlook Sync] Delta link invalid, performing full sync', { file: 'outlook-sync-service.ts' });
      return fullSync(client, 100);
    }
    throw error;
  }
}

/**
 * Save message to CRM
 */
async function saveMessageToCRM(message: OutlookMessage): Promise<void> {
  try {
    const fromEmail = message.from.emailAddress.address;

    // Try to match to existing contact
    const contact = await findContactByEmail(fromEmail);
    
    // Save email record
    const emailData = {
      id: message.id,
      conversationId: message.conversationId,
      contactId: contact?.id,
      from: `${message.from.emailAddress.name} <${message.from.emailAddress.address}>`,
      fromEmail,
      to: message.toRecipients.map(r => r.emailAddress.address),
      cc: message.ccRecipients?.map(r => r.emailAddress.address),
      bcc: message.bccRecipients?.map(r => r.emailAddress.address),
      subject: message.subject,
      body: message.body.content,
      bodyType: message.body.contentType,
      snippet: message.bodyPreview,
      sentDate: new Date(message.sentDateTime),
      receivedDate: new Date(message.receivedDateTime),
      isRead: message.isRead,
      isDraft: message.isDraft,
      importance: message.importance,
      hasAttachments: message.hasAttachments,
      webLink: message.webLink,
      source: 'outlook',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/emails`,
      message.id,
      emailData
    );
    
    // Update contact with last interaction
    if (contact) {
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/contacts`,
        contact.id,
        {
          lastContactDate: new Date(message.receivedDateTime),
          lastContactType: 'email',
          updatedAt: new Date(),
        }
      );
    }
  } catch (error) {
    logger.error('[Outlook Sync] Error saving message to CRM:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
    throw error;
  }
}

/**
 * Delete message from CRM
 */
async function deleteMessageFromCRM(messageId: string): Promise<void> {
  try {
    await FirestoreService.delete(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/emails`,
      messageId
    );
  } catch (error) {
    logger.error('[Outlook Sync] Error deleting message:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
  }
}

/**
 * Send email via Outlook
 */
export async function sendOutlookEmail(
  accessToken: string,
  emailData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    bodyType?: 'text' | 'html';
    importance?: 'low' | 'normal' | 'high';
  }
): Promise<string> {
  const client = getGraphClient(accessToken);
  
  try {
    const message = {
      subject: emailData.subject,
      body: {
        contentType: emailData.bodyType ?? 'html',
        content: emailData.body,
      },
      toRecipients: emailData.to.map(email => ({
        emailAddress: { address: email },
      })),
      ccRecipients: emailData.cc?.map(email => ({
        emailAddress: { address: email },
      })),
      bccRecipients: emailData.bcc?.map(email => ({
        emailAddress: { address: email },
      })),
      importance: emailData.importance ?? 'normal',
    };
    
    const response = await client
      .api('/me/sendMail')
      .post({
        message,
        saveToSentItems: true,
      }) as GraphSendMailResponse;

    const responseId = response.id;
    return (responseId !== '' && responseId != null) ? responseId : 'sent';
  } catch (error) {
    logger.error('[Outlook Sync] Error sending email:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
    throw error;
  }
}

/**
 * Find contact by email
 */
async function findContactByEmail(email: string): Promise<OutlookContact | null> {
  try {
    const contacts = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/contacts`
    );
    const contactsFiltered = contacts.filter((c: unknown) => {
      const contact = c as OutlookContact;
      return contact.email === email;
    });

    return contactsFiltered.length > 0 ? (contactsFiltered[0] as OutlookContact) : null;
  } catch (error) {
    logger.error('[Outlook Sync] Error finding contact:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
    return null;
  }
}

/**
 * Get last sync status
 */
async function getLastSyncStatus(): Promise<OutlookSyncStatus | null> {
  try {
    const status = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/integrationStatus`,
      'outlook-sync'
    );
    return status as OutlookSyncStatus | null;
  } catch (_error) {
    return null;
  }
}

/**
 * Save sync status
 */
async function saveSyncStatus(status: OutlookSyncStatus): Promise<void> {
  try {
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/integrationStatus`,
      'outlook-sync',
      status
    );
  } catch (error) {
    logger.error('[Outlook Sync] Error saving sync status:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
  }
}

/**
 * Setup Outlook push notifications (webhook)
 */
export async function setupOutlookPushNotifications(
  accessToken: string,
  notificationUrl: string
): Promise<string> {
  const client = getGraphClient(accessToken);
  
  try {
    const subscription = {
      changeType: 'created,updated,deleted',
      notificationUrl,
      resource: '/me/messages',
      expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
      clientState: `outlook-webhook-${Date.now()}`,
    };
    
    const response = await client
      .api('/subscriptions')
      .post(subscription) as { id: string };

    logger.info('[Outlook Sync] Push notifications enabled', { file: 'outlook-sync-service.ts' });
    return response.id;
  } catch (error) {
    logger.error('[Outlook Sync] Error setting up push notifications:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
    throw error;
  }
}

/**
 * Stop Outlook push notifications
 */
export async function stopOutlookPushNotifications(
  accessToken: string,
  subscriptionId: string
): Promise<void> {
  const client = getGraphClient(accessToken);
  
  try {
    await client
      .api(`/subscriptions/${subscriptionId}`)
      .delete();
    
    logger.info('[Outlook Sync] Push notifications disabled', { file: 'outlook-sync-service.ts' });
  } catch (error) {
    logger.error('[Outlook Sync] Error stopping push notifications:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
    throw error;
  }
}

/**
 * Renew Outlook subscription (before it expires)
 */
export async function renewOutlookSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<void> {
  const client = getGraphClient(accessToken);
  
  try {
    await client
      .api(`/subscriptions/${subscriptionId}`)
      .patch({
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
    
    logger.info('[Outlook Sync] Subscription renewed', { file: 'outlook-sync-service.ts' });
  } catch (error) {
    logger.error('[Outlook Sync] Error renewing subscription:', error instanceof Error ? error : new Error(String(error)), { file: 'outlook-sync-service.ts' });
    throw error;
  }
}

