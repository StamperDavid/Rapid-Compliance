/**
 * Gmail Sync Service
 * Bidirectional email syncing between Gmail and CRM
 */

import { google, type gmail_v1 } from 'googleapis';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// Gmail OAuth scopes
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments?: GmailAttachment[];
  isRead: boolean;
  isStarred: boolean;
}

export interface GmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface GmailSyncStatus {
  lastSyncAt: string;
  historyId: string;
  messagesSynced: number;
  errors: number;
}

interface GmailContact {
  id: string;
  email: string;
  name?: string;
}

interface _GmailMessageRef {
  id?: string;
  threadId?: string;
}

/**
 * Initialize Gmail API client
 */
function getGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  return google.gmail({ version: 'v1', auth });
}

/**
 * Sync Gmail messages to CRM
 */
export async function syncGmailMessages(
  accessToken: string,
  maxResults = 100
): Promise<GmailSyncStatus> {
  const gmail = getGmailClient(accessToken);

  try {
    // Get last sync status
    const lastSync = await getLastSyncStatus();

    // If we have a history ID, use incremental sync
    if (lastSync?.historyId) {
      return await incrementalSync(gmail, lastSync.historyId);
    }

    // Full sync (first time)
    return await fullSync(gmail, maxResults);
  } catch (error) {
    logger.error('[Gmail Sync] Error:', error instanceof Error ? error : new Error(String(error)), { file: 'gmail-sync-service.ts' });
    throw error;
  }
}

/**
 * Full sync (initial sync)
 */
async function fullSync(
  gmail: gmail_v1.Gmail,
  maxResults: number
): Promise<GmailSyncStatus> {
  let messagesSynced = 0;
  let errors = 0;
  let historyId: string = '';
  
  try {
    // List messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'in:inbox OR in:sent',
    });
    
    if (!listResponse.data.messages) {
      return {
        lastSyncAt: new Date().toISOString(),
        historyId: (() => {
          const histId = listResponse.data.resultSizeEstimate?.toString();
          return (histId !== '' && histId != null) ? histId : '0';
        })(),
        messagesSynced: 0,
        errors: 0,
      };
    }
    
    // Process messages in batches
    const batchSize = 10;
    for (let i = 0; i < listResponse.data.messages.length; i += batchSize) {
      const batch = listResponse.data.messages.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (msg) => {
          try {
            if (!msg.id) {
              return;
            }

            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'full',
            });
            
            const parsed = parseGmailMessage(fullMessage.data);
            await saveMessageToCRM(parsed);

            messagesSynced++;
            
            // Update history ID
            if (fullMessage.data.historyId) {
              historyId = fullMessage.data.historyId;
            }
          } catch (err) {
            logger.error(`[Gmail Sync] Error processing message ${msg.id}:`, err instanceof Error ? err : new Error(String(err)), { file: 'gmail-sync-service.ts' });
            errors++;
          }
        })
      );
    }
    
    // Save sync status
    const status: GmailSyncStatus = {
      lastSyncAt: new Date().toISOString(),
      historyId,
      messagesSynced,
      errors,
    };
    
    await saveSyncStatus(status);
    
    return status;
  } catch (error) {
    logger.error('[Gmail Sync] Full sync error:', error as Error, { file: 'gmail-sync-service.ts' });
    throw error;
  }
}

/**
 * Incremental sync using Gmail history
 */
async function incrementalSync(
  gmail: gmail_v1.Gmail,
  startHistoryId: string
): Promise<GmailSyncStatus> {
  let messagesSynced = 0;
  let errors = 0;
  
  try {
    // Get history changes since last sync
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
    });
    
    if (!historyResponse.data.history) {
      return {
        lastSyncAt: new Date().toISOString(),
        historyId: (historyResponse.data.historyId !== '' && historyResponse.data.historyId != null) ? historyResponse.data.historyId : startHistoryId,
        messagesSynced: 0,
        errors: 0,
      };
    }
    
    // Process each history record
    for (const record of historyResponse.data.history) {
      // Handle new messages
      if (record.messagesAdded) {
        for (const msgAdded of record.messagesAdded) {
          try {
            const messageId = msgAdded.message?.id;
            if (!messageId) {
              continue;
            }

            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: messageId,
              format: 'full',
            });
            
            const parsed = parseGmailMessage(fullMessage.data);
            await saveMessageToCRM(parsed);
            messagesSynced++;
          } catch (err) {
            logger.error('[Gmail Sync] Error processing added message:', err as Error, { file: 'gmail-sync-service.ts' });
            errors++;
          }
        }
      }
      
      // Handle deleted messages
      if (record.messagesDeleted) {
        for (const msgDeleted of record.messagesDeleted) {
          try {
            const messageId = msgDeleted.message?.id;
            if (!messageId) {
              continue;
            }

            await deleteMessageFromCRM(messageId);
          } catch (err) {
            logger.error('[Gmail Sync] Error deleting message:', err instanceof Error ? err : new Error(String(err)), { file: 'gmail-sync-service.ts' });
            errors++;
          }
        }
      }
      
      // Handle label changes (read/unread, starred, etc.)
      if (record.labelsAdded || record.labelsRemoved) {
        const addedMsgId = record.labelsAdded?.[0]?.message?.id;
        const removedMsgId = record.labelsRemoved?.[0]?.message?.id;
        const messageId = (addedMsgId !== '' && addedMsgId != null) ? addedMsgId : removedMsgId;
        if (messageId) {
          try {
            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: messageId,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject'],
            });
            
            await updateMessageLabels(messageId, fullMessage.data.labelIds ?? []);
          } catch (err) {
            logger.error('[Gmail Sync] Error updating labels:', err as Error, { file: 'gmail-sync-service.ts' });
            errors++;
          }
        }
      }
    }
    
    const status: GmailSyncStatus = {
      lastSyncAt: new Date().toISOString(),
      historyId: (historyResponse.data.historyId !== '' && historyResponse.data.historyId != null) ? historyResponse.data.historyId : startHistoryId,
      messagesSynced,
      errors,
    };
    
    await saveSyncStatus(status);
    
    return status;
  } catch (error) {
    logger.error('[Gmail Sync] Incremental sync error:', error as Error, { file: 'gmail-sync-service.ts' });
    throw error;
  }
}

/**
 * Parse Gmail message to our format
 */
function parseGmailMessage(message: gmail_v1.Schema$Message): GmailMessage {
  const headers = message.payload?.headers ?? [];
  
  const getHeader = (name: string): string => {
    const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
    const headerValue = header?.value;
    return (headerValue !== '' && headerValue != null) ? headerValue : '';
  };
  
  const parseAddresses = (value: string): string[] => {
    if (!value) {return [];}
    return value.split(',').map(addr => addr.trim()).filter(Boolean);
  };
  
  // Extract body
  let body = '';
  let bodyHtml = '';
  
  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload?.parts) {
    // Multipart message
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
  }
  
  // Extract attachments
  const attachments: GmailAttachment[] = [];
  if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: (part.mimeType !== '' && part.mimeType != null) ? part.mimeType : 'application/octet-stream',
          size: part.body.size ?? 0,
          attachmentId: part.body.attachmentId,
        });
      }
    }
  }
  
  const messageId = message.id ?? `temp-${Date.now()}`;
  const threadId = message.threadId ?? messageId;

  return {
    id: messageId,
    threadId,
    labelIds: message.labelIds ?? [],
    snippet: (message.snippet !== '' && message.snippet != null) ? message.snippet : '',
    internalDate: (message.internalDate !== '' && message.internalDate != null) ? message.internalDate : Date.now().toString(),
    from: getHeader('From'),
    to: parseAddresses(getHeader('To')),
    cc: parseAddresses(getHeader('Cc')),
    bcc: parseAddresses(getHeader('Bcc')),
    subject: getHeader('Subject'),
    body,
    bodyHtml,
    attachments,
    isRead: !(message.labelIds?.includes('UNREAD') ?? false),
    isStarred: message.labelIds?.includes('STARRED') ?? false,
  };
}

/**
 * Save message to CRM
 */
async function saveMessageToCRM(message: GmailMessage): Promise<void> {
  try {
    // Extract email address from "Name <email@example.com>" format
    const extractEmail = (str: string): string => {
      const match = str.match(/<([^>]+)>/);
      return match ? match[1] : str.trim();
    };

    const fromEmail = extractEmail(message.from);

    // Try to match to existing contact
    const contact = await findContactByEmail(fromEmail);
    
    // Save email record
    const emailData = {
      id: message.id,
      threadId: message.threadId,
      contactId: contact?.id,
      from: message.from,
      fromEmail,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      body: message.body,
      bodyHtml: message.bodyHtml,
      snippet: message.snippet,
      date: new Date(parseInt(message.internalDate)),
      isRead: message.isRead,
      isStarred: message.isStarred,
      hasAttachments: (message.attachments?.length ?? 0) > 0,
      attachments: message.attachments,
      source: 'gmail',
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
          lastContactDate: new Date(parseInt(message.internalDate)),
          lastContactType: 'email',
          updatedAt: new Date(),
        }
      );
    }
  } catch (error) {
    logger.error('[Gmail Sync] Error saving message to CRM:', error as Error, { file: 'gmail-sync-service.ts' });
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
    logger.error('[Gmail Sync] Error deleting message:', error as Error, { file: 'gmail-sync-service.ts' });
  }
}

/**
 * Update message labels in CRM
 */
async function updateMessageLabels(messageId: string, labels: string[]): Promise<void> {
  try {
    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/emails`,
      messageId,
      {
        isRead: !labels.includes('UNREAD'),
        isStarred: labels.includes('STARRED'),
        updatedAt: new Date(),
      }
    );
  } catch (error) {
    logger.error('[Gmail Sync] Error updating labels:', error as Error, { file: 'gmail-sync-service.ts' });
  }
}

/**
 * Find contact by email
 */
async function findContactByEmail(email: string): Promise<GmailContact | null> {
  try {
    const contacts = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/contacts`
    );
    const contactsFiltered = contacts.filter((c: unknown) => {
      const contact = c as GmailContact;
      return contact.email === email;
    });

    return contactsFiltered.length > 0 ? (contactsFiltered[0] as GmailContact) : null;
  } catch (error) {
    logger.error('[Gmail Sync] Error finding contact:', error instanceof Error ? error : new Error(String(error)), { file: 'gmail-sync-service.ts' });
    return null;
  }
}

/**
 * Get last sync status
 */
async function getLastSyncStatus(): Promise<GmailSyncStatus | null> {
  try {
    const status = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/integrationStatus`,
      'gmail-sync'
    );
    return status as GmailSyncStatus | null;
  } catch (_error) {
    return null;
  }
}

/**
 * Save sync status
 */
async function saveSyncStatus(status: GmailSyncStatus): Promise<void> {
  try {
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/integrationStatus`,
      'gmail-sync',
      status
    );
  } catch (error) {
    logger.error('[Gmail Sync] Error saving sync status:', error as Error, { file: 'gmail-sync-service.ts' });
  }
}

/**
 * Setup Gmail push notifications (webhook)
 */
export async function setupGmailPushNotifications(
  accessToken: string,
  topicName: string // Google Cloud Pub/Sub topic
): Promise<void> {
  const gmail = getGmailClient(accessToken);
  
  try {
    await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX', 'SENT'],
      },
    });

    logger.info('[Gmail Sync] Push notifications enabled', { file: 'gmail-sync-service.ts' });
  } catch (error) {
    logger.error('[Gmail Sync] Error setting up push notifications:', error as Error, { file: 'gmail-sync-service.ts' });
    throw error;
  }
}

/**
 * Stop Gmail push notifications
 */
export async function stopGmailPushNotifications(accessToken: string): Promise<void> {
  const gmail = getGmailClient(accessToken);
  
  try {
    await gmail.users.stop({
      userId: 'me',
    });

    logger.info('[Gmail Sync] Push notifications disabled', { file: 'gmail-sync-service.ts' });
  } catch (error) {
    logger.error('[Gmail Sync] Error stopping push notifications:', error as Error, { file: 'gmail-sync-service.ts' });
    throw error;
  }
}

