/**
 * 2-Way Email Sync
 * Reads Gmail/Outlook inbox and matches replies to sent emails
 * Auto-logs activities and triggers workflows
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { Timestamp } from 'firebase/firestore';
import type { Activity as ActivityType, RelatedEntityType as _RelatedEntityType } from '@/types/activity';

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  receivedAt: Date;
  isRead: boolean;
  labels?: string[];
  inReplyTo?: string; // Message ID this is replying to
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: string[];
  messages: EmailMessage[];
  lastMessageAt: Date;
  messageCount: number;
}

interface OutlookRecipient {
  emailAddress?: {
    address?: string;
    name?: string;
  };
}

interface OutlookEmailMessage {
  id: string;
  conversationId: string;
  from?: {
    emailAddress?: {
      address?: string;
      name?: string;
    };
  };
  toRecipients?: OutlookRecipient[];
  ccRecipients?: OutlookRecipient[];
  subject?: string;
  body?: {
    content?: string;
    contentType?: string;
  };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  inReplyTo?: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailPayloadPart[];
}

interface GmailMessagePayload {
  headers?: GmailHeader[];
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailPayloadPart[];
}

interface GmailMessageData {
  id: string;
  threadId: string;
  internalDate: string;
  labelIds?: string[];
  payload: GmailMessagePayload;
}

interface GmailListItem {
  id: string;
  threadId: string;
}

interface GmailListResponse {
  messages?: GmailListItem[];
}

interface OutlookListResponse {
  value: OutlookEmailMessage[];
}

interface EmailSyncDoc {
  lastSyncAt: Timestamp | Date | string;
}

interface TimestampLike {
  toDate(): Date;
}

/**
 * Fetch new emails from Gmail
 */
export async function fetchGmailInbox(
  since?: Date
): Promise<EmailMessage[]> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials('gmail');
    
    if (!credentials?.accessToken) {
      throw new Error('Gmail not connected');
    }

    // Build query
    let query = 'in:inbox';
    if (since) {
      const afterDate = Math.floor(since.getTime() / 1000);
      query += ` after:${afterDate}`;
    }

    // Get message list
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error('Failed to fetch Gmail messages');
    }

    const listData = await listResponse.json() as GmailListResponse;
    const messageIds = listData.messages ?? [];

    // Fetch full message details
    const messages: EmailMessage[] = [];

    for (const { id } of messageIds) {
      try {
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
          {
            headers: {
              'Authorization': `Bearer ${credentials.accessToken}`,
            },
          }
        );

        if (!messageResponse.ok) {continue;}

        const messageData = await messageResponse.json() as GmailMessageData;
        const message = parseGmailMessage(messageData);
        messages.push(message);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Failed to fetch individual Gmail message', { messageId: id, error: errorMessage });
      }
    }

    logger.info('Gmail inbox fetched', { organizationId: DEFAULT_ORG_ID, count: messages.length });

    return messages;

  } catch (error: unknown) {
    const errorToLog = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to fetch Gmail inbox', errorToLog, { organizationId: DEFAULT_ORG_ID });
    throw error;
  }
}

/**
 * Parse Gmail API message format
 */
function parseGmailMessage(data: GmailMessageData): EmailMessage {
  const headers = data.payload?.headers ?? [];
  const getHeader = (name: string): string => {
    const headerValue = headers.find((h: GmailHeader) => h.name.toLowerCase() === name.toLowerCase())?.value;
    return (headerValue !== '' && headerValue != null) ? headerValue : '';
  };

  const from = getHeader('from');
  const toValue = getHeader('to');
  const to = toValue ? toValue.split(',').map((e: string) => e.trim()) : [];
  const ccValue = getHeader('cc');
  const cc = ccValue ? ccValue.split(',').map((e: string) => e.trim()) : [];
  const subject = getHeader('subject');
  const inReplyTo = getHeader('in-reply-to');

  // Extract body (prefer plain text, fallback to HTML)
  let body = '';
  let htmlBody = '';

  const getBody = (part: GmailPayloadPart): void => {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.parts) {
      part.parts.forEach(getBody);
    }
  };

  getBody(data.payload);

  return {
    id: data.id,
    threadId: data.threadId,
    from,
    to,
    cc,
    subject,
    body: (body !== '' && body != null) ? body : htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML tags if no plain text
    htmlBody,
    receivedAt: new Date(parseInt(data.internalDate)),
    isRead: !data.labelIds?.includes('UNREAD'),
    labels: data.labelIds ?? [],
    inReplyTo,
  };
}

/**
 * Fetch Outlook inbox
 */
export async function fetchOutlookInbox(
  since?: Date
): Promise<EmailMessage[]> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials('outlook');
    
    if (!credentials?.accessToken) {
      throw new Error('Outlook not connected');
    }

    // Build filter
    const filter = `receivedDateTime ge ${  since ? since.toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`;

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(filter)}&$top=100&$orderby=receivedDateTime desc`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Outlook messages');
    }

    const data = await response.json() as OutlookListResponse;

    const messages: EmailMessage[] = data.value.map((msg: OutlookEmailMessage) => ({
      id: msg.id,
      threadId: msg.conversationId,
      from: (msg.from?.emailAddress?.address !== '' && msg.from?.emailAddress?.address != null) ? msg.from.emailAddress.address : '',
      to: msg.toRecipients?.map((r: OutlookRecipient) => r.emailAddress?.address).filter((addr): addr is string => addr !== undefined) ?? [],
      cc: msg.ccRecipients?.map((r: OutlookRecipient) => r.emailAddress?.address).filter((addr): addr is string => addr !== undefined) ?? [],
      subject: (msg.subject !== '' && msg.subject != null) ? msg.subject : '',
      body: (msg.body?.content !== '' && msg.body?.content != null) ? msg.body.content : '',
      htmlBody: msg.body?.contentType === 'html' ? msg.body?.content : undefined,
      receivedAt: new Date(msg.receivedDateTime),
      isRead: msg.isRead,
      inReplyTo: msg.inReplyTo,
    }));

    logger.info('Outlook inbox fetched', { organizationId: DEFAULT_ORG_ID, count: messages.length });

    return messages;

  } catch (error: unknown) {
    const errorToLog = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to fetch Outlook inbox', errorToLog, { organizationId: DEFAULT_ORG_ID });
    throw error;
  }
}

/**
 * Match email reply to sent email and log activity
 */
export async function processEmailReply(
  workspaceId: string,
  reply: EmailMessage
): Promise<void> {
  try {
    // Try to find the original sent email this is replying to
    const originalEmail = await findOriginalEmail(reply.inReplyTo, reply.threadId);

    if (originalEmail) {
      // Found match - log as reply activity
      const { createActivity } = await import('@/lib/crm/activity-service');

      await createActivity(workspaceId, {
        type: 'email_received',
        direction: 'inbound',
        subject: reply.subject,
        body: reply.body,
        summary: `Reply received: ${reply.subject}`,
        relatedTo: originalEmail.relatedTo,
        metadata: {
          emailId: reply.id,
          fromEmail: reply.from,
          toEmail: reply.to.join(', '),
          threadId: reply.threadId,
        },
        occurredAt: Timestamp.fromDate(reply.receivedAt),
      });

      // Trigger reply handler for AI processing
      // TODO: Implement full reply processing logic
      const { classifyReply } = await import('@/lib/outbound/reply-handler');
      const replyTo = reply.to[0];
      const replyToAddress = (replyTo !== '' && replyTo != null) ? replyTo : '';
      await classifyReply({
        from: reply.from,
        to: replyToAddress,
        subject: reply.subject,
        body: reply.body,
        threadId: reply.threadId,
        inReplyTo: originalEmail.id,
        receivedAt: reply.receivedAt.toISOString(),
      });

      logger.info('Email reply processed', { organizationId: DEFAULT_ORG_ID, replyId: reply.id });

    } else {
      // No match - might be a new inbound email
      logger.debug('Email reply has no matching sent email', { replyId: reply.id });
    }

  } catch (error: unknown) {
    const errorToLog = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to process email reply', errorToLog, { replyId: reply.id });
  }
}

/**
 * Find original sent email
 */
async function findOriginalEmail(
  inReplyTo?: string,
  threadId?: string
): Promise<ActivityType | null> {
  try {
    // Search activities for sent email with matching thread ID or message ID
    const { getActivities } = await import('@/lib/crm/activity-service');

    const activities = await getActivities(
      'default',
      { types: ['email_sent'] },
      { pageSize: 100 }
    );

    // Find match by thread ID or in-reply-to
    const match = activities.data.find(activity => {
      const metadata = activity.metadata;
      if (!metadata) {
        return false;
      }

      const matchByReplyTo = inReplyTo && metadata.emailId === inReplyTo;
      const matchByThread = threadId && metadata.threadId === threadId;
      return matchByReplyTo ? true : (matchByThread ? true : false);
    });

    return match ?? null;

  } catch (error: unknown) {
    const errorToLog = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to find original email', errorToLog);
    return null;
  }
}

/**
 * Sync inbox (run periodically via cron)
 */
export async function syncInbox(
  workspaceId: string,
  provider: 'gmail' | 'outlook'
): Promise<number> {
  try {
    // Get last sync time
    const lastSync = await getLastSyncTime(provider);
    const since = lastSync ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24h

    // Fetch new emails
    const messages = provider === 'gmail'
      ? await fetchGmailInbox(since)
      : await fetchOutlookInbox(since);

    // Process each message
    for (const message of messages) {
      await processEmailReply(workspaceId, message);
    }

    // Update last sync time
    await setLastSyncTime(provider, new Date());

    logger.info('Inbox sync completed', {
      organizationId: DEFAULT_ORG_ID,
      provider,
      messagesProcessed: messages.length,
    });

    return messages.length;

  } catch (error: unknown) {
    const errorToLog = error instanceof Error ? error : new Error(String(error));
    logger.error('Inbox sync failed', errorToLog, { organizationId: DEFAULT_ORG_ID, provider });
    throw error;
  }
}

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

/**
 * Get last sync timestamp
 */
async function getLastSyncTime(provider: string): Promise<Date | null> {
  try {
    const doc = await FirestoreService.get<EmailSyncDoc>(
      `organizations/${DEFAULT_ORG_ID}/emailSync`,
      provider
    );

    if (doc?.lastSyncAt) {
      const syncAt = doc.lastSyncAt;
      // Handle Firestore Timestamp
      if (typeof syncAt === 'object' && syncAt !== null && 'toDate' in syncAt) {
        const timestampLike = syncAt as TimestampLike;
        return timestampLike.toDate();
      }
      // Handle Date or string
      return new Date(syncAt);
    }

    return null;
  } catch (_error: unknown) {
    return null;
  }
}

/**
 * Set last sync timestamp
 */
async function setLastSyncTime(provider: string, time: Date): Promise<void> {
  await FirestoreService.set(
    `organizations/${DEFAULT_ORG_ID}/emailSync`,
    provider,
    { lastSyncAt: time },
    true
  );
}

