/**
 * 2-Way Email Sync
 * Reads Gmail/Outlook inbox and matches replies to sent emails
 * Auto-logs activities and triggers workflows
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { logEmailOpened } from '@/lib/crm/activity-logger';
import { Timestamp } from 'firebase/firestore';

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

interface OutlookEmailMessage {
  id: string;
  conversationId: string;
  from?: {
    emailAddress?: {
      address?: string;
      name?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress?: {
      address?: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress?: {
      address?: string;
      name?: string;
    };
  }>;
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

/**
 * Fetch new emails from Gmail
 */
export async function fetchGmailInbox(
  organizationId: string,
  since?: Date
): Promise<EmailMessage[]> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials(organizationId, 'gmail');
    
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

    const listData = await listResponse.json();
    const messageIds = listData.messages ?? [];

    // Fetch full message details
    const messages: EmailMessage[] = [];

    for (const { id, threadId } of messageIds) {
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

        const messageData = await messageResponse.json();
        const message = parseGmailMessage(messageData);
        messages.push(message);

      } catch (error) {
        logger.warn('Failed to fetch individual Gmail message', { messageId: id, error });
      }
    }

    logger.info('Gmail inbox fetched', { organizationId, count: messages.length });

    return messages;

  } catch (error: any) {
    logger.error('Failed to fetch Gmail inbox', error, { organizationId });
    throw error;
  }
}

/**
 * Parse Gmail API message format
 */
function parseGmailMessage(data: any): EmailMessage {
  const headers = data.payload?.headers ?? [];
  const getHeader = (name: string) => {
    const headerValue = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;
    return (headerValue !== '' && headerValue != null) ? headerValue : '';
  };

  const from = getHeader('from');
  const to = getHeader('to').split(',').map((e: string) => e.trim());
  const cc = getHeader('cc') ? getHeader('cc').split(',').map((e: string) => e.trim()) : [];
  const subject = getHeader('subject');
  const inReplyTo = getHeader('in-reply-to');

  // Extract body (prefer plain text, fallback to HTML)
  let body = '';
  let htmlBody = '';

  const getBody = (part: any): void => {
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
  organizationId: string,
  since?: Date
): Promise<EmailMessage[]> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials(organizationId, 'outlook');
    
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

    const data = await response.json();
    
    interface OutlookRecipient {
      emailAddress?: {
        address?: string;
        name?: string;
      };
    }
    
    const messages: EmailMessage[] = data.value.map((msg: OutlookEmailMessage) => ({
      id: msg.id,
      threadId: msg.conversationId,
      from: (msg.from?.emailAddress?.address !== '' && msg.from?.emailAddress?.address != null) ? msg.from.emailAddress.address : '',
      to: msg.toRecipients?.map((r: OutlookRecipient) => r.emailAddress?.address) ?? [],
      cc: msg.ccRecipients?.map((r: OutlookRecipient) => r.emailAddress?.address) ?? [],
      subject: (msg.subject !== '' && msg.subject != null) ? msg.subject : '',
      body: (msg.body?.content !== '' && msg.body?.content != null) ? msg.body.content : '',
      htmlBody: msg.body?.contentType === 'html' ? msg.body?.content : undefined,
      receivedAt: new Date(msg.receivedDateTime),
      isRead: msg.isRead,
      inReplyTo: msg.inReplyTo,
    }));

    logger.info('Outlook inbox fetched', { organizationId, count: messages.length });

    return messages;

  } catch (error: any) {
    logger.error('Failed to fetch Outlook inbox', error, { organizationId });
    throw error;
  }
}

/**
 * Match email reply to sent email and log activity
 */
export async function processEmailReply(
  organizationId: string,
  workspaceId: string,
  reply: EmailMessage
): Promise<void> {
  try {
    // Try to find the original sent email this is replying to
    const originalEmail = await findOriginalEmail(organizationId, reply.inReplyTo, reply.threadId);

    if (originalEmail) {
      // Found match - log as reply activity
      const { createActivity } = await import('@/lib/crm/activity-service');
      
      await createActivity(organizationId, workspaceId, {
        type: 'email_received',
        direction: 'inbound',
        subject: reply.subject,
        body: reply.body,
        summary: `Reply received: ${reply.subject}`,
        relatedTo: originalEmail.relatedTo ?? [],
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

      logger.info('Email reply processed', { organizationId, replyId: reply.id });

    } else {
      // No match - might be a new inbound email
      logger.debug('Email reply has no matching sent email', { replyId: reply.id });
    }

  } catch (error: any) {
    logger.error('Failed to process email reply', error, { replyId: reply.id });
  }
}

/**
 * Find original sent email
 */
async function findOriginalEmail(
  organizationId: string,
  inReplyTo?: string,
  threadId?: string
): Promise<any | null> {
  try {
    // Search activities for sent email with matching thread ID or message ID
    const { getActivities } = await import('@/lib/crm/activity-service');
    
    const activities = await getActivities(
      organizationId,
      'default',
      { types: ['email_sent'] },
      { pageSize: 100 }
    );

    // Find match by thread ID or in-reply-to
    const match = activities.data.find(activity => {
      const metadata = activity.metadata;
      const matchByReplyTo = inReplyTo && metadata?.emailId === inReplyTo;
      const matchByThread = threadId && metadata?.threadId === threadId;
      return matchByReplyTo ? true : (matchByThread ? true : false);
    });

    return match ?? null;

  } catch (error) {
    logger.error('Failed to find original email', error);
    return null;
  }
}

/**
 * Sync inbox (run periodically via cron)
 */
export async function syncInbox(
  organizationId: string,
  workspaceId: string,
  provider: 'gmail' | 'outlook'
): Promise<number> {
  try {
    // Get last sync time
    const lastSync = await getLastSyncTime(organizationId, provider);
    const since = lastSync ?? new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24h

    // Fetch new emails
    const messages = provider === 'gmail' 
      ? await fetchGmailInbox(organizationId, since)
      : await fetchOutlookInbox(organizationId, since);

    // Process each message
    for (const message of messages) {
      await processEmailReply(organizationId, workspaceId, message);
    }

    // Update last sync time
    await setLastSyncTime(organizationId, provider, new Date());

    logger.info('Inbox sync completed', {
      organizationId,
      provider,
      messagesProcessed: messages.length,
    });

    return messages.length;

  } catch (error: any) {
    logger.error('Inbox sync failed', error, { organizationId, provider });
    throw error;
  }
}

/**
 * Get last sync timestamp
 */
async function getLastSyncTime(organizationId: string, provider: string): Promise<Date | null> {
  try {
    const doc = await FirestoreService.get<{ lastSyncAt: any }>(
      `organizations/${organizationId}/emailSync`,
      provider
    );

    if (doc?.lastSyncAt) {
      return doc.lastSyncAt.toDate ? doc.lastSyncAt.toDate() : new Date(doc.lastSyncAt);
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Set last sync timestamp
 */
async function setLastSyncTime(organizationId: string, provider: string, time: Date): Promise<void> {
  await FirestoreService.set(
    `organizations/${organizationId}/emailSync`,
    provider,
    { lastSyncAt: time },
    true
  );
}

