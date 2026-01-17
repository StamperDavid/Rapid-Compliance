/**
 * Gmail Integration
 * REAL Gmail integration for reading and sending emails
 */

import { google, type gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { logger } from '@/lib/logger/logger';

// Type definitions for Gmail API
interface GmailMessagePartHeader {
  name?: string | null;
  value?: string | null;
}

interface GmailMessagePartBody {
  data?: string | null;
}

interface GmailMessagePart {
  mimeType?: string | null;
  body?: GmailMessagePartBody | null;
  parts?: GmailMessagePart[] | null;
}

interface GmailMessagePayload {
  headers?: GmailMessagePartHeader[] | null;
  parts?: GmailMessagePart[] | null;
  mimeType?: string | null;
  body?: GmailMessagePartBody | null;
}

interface GmailMessage {
  id?: string | null;
  threadId?: string | null;
  payload?: GmailMessagePayload | null;
}

interface GmailIntegration {
  service?: string;
  providerId?: string;
  accessToken?: string;
  refreshToken?: string;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUriEnv = process.env.GOOGLE_REDIRECT_URI;
const GOOGLE_REDIRECT_URI = (googleRedirectUriEnv !== '' && googleRedirectUriEnv != null) ? googleRedirectUriEnv : 'http://localhost:3000/api/integrations/google/callback';

/**
 * Create OAuth2 client
 */
function createOAuth2Client(tokens?: {
  access_token: string;
  refresh_token?: string;
}): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  if (tokens) {
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
  }

  return oauth2Client;
}

/**
 * Get Gmail auth URL
 */
export function getGmailAuthUrl(): string {
  const oauth2Client = createOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    prompt: 'consent',
  });
}

/**
 * List emails
 */
export async function listEmails(
  tokens: { access_token: string; refresh_token?: string },
  options?: {
    maxResults?: number;
    query?: string;
    labelIds?: string[];
  }
): Promise<gmail_v1.Schema$Message[]> {
  const auth = createOAuth2Client(tokens);
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: options?.maxResults ?? 50,
    q: options?.query,
    labelIds: options?.labelIds,
  });

  const messages = response.data.messages ?? [];

  // Fetch full message details for each
  const fullMessages = await Promise.all(
    messages.map(async (msg) => {
      const msgId = msg.id ?? '';
      if (!msgId) {
        return {} as gmail_v1.Schema$Message;
      }
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msgId,
        format: 'full',
      });
      return full.data;
    })
  );

  return fullMessages;
}

/**
 * Get email by ID
 */
export async function getEmail(
  tokens: { access_token: string; refresh_token?: string },
  messageId: string
): Promise<gmail_v1.Schema$Message> {
  const auth = createOAuth2Client(tokens);
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return response.data;
}

/**
 * Send email via Gmail
 */
export async function sendGmailEmail(
  tokens: { access_token: string; refresh_token?: string },
  options: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
  }
): Promise<{ id: string; threadId: string }> {
  const auth = createOAuth2Client(tokens);
  const gmail = google.gmail({ version: 'v1', auth });

  // Create email in RFC 2822 format
  const email = [
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    options.body,
  ].join('\n');

  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail,
      threadId: options.inReplyTo,
    },
  });

  return {
    id: response.data.id ?? '',
    threadId: response.data.threadId ?? '',
  };
}

/**
 * Watch for new emails (push notifications)
 */
export async function watchEmails(
  tokens: { access_token: string; refresh_token?: string },
  topicName: string
): Promise<{ historyId: string; expiration: string }> {
  const auth = createOAuth2Client(tokens);
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
    },
  });

  return {
    historyId: response.data.historyId ?? '',
    expiration: response.data.expiration ?? '',
  };
}

/**
 * Get email history (for detecting new emails)
 */
export async function getHistory(
  tokens: { access_token: string; refresh_token?: string },
  startHistoryId: string
): Promise<gmail_v1.Schema$History[]> {
  const auth = createOAuth2Client(tokens);
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.history.list({
    userId: 'me',
    startHistoryId,
  });

  return response.data.history ?? [];
}

/**
 * Parse email headers
 */
export function parseEmailHeaders(message: GmailMessage): {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
} {
  const headers = message.payload?.headers ?? [];

  const getHeader = (name: string): string => {
    const header = headers.find((h: GmailMessagePartHeader) =>
      h.name?.toLowerCase() === name.toLowerCase()
    );
    const headerValue = header?.value;
    return (headerValue !== '' && headerValue != null) ? headerValue : '';
  };

  return {
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    messageId: getHeader('Message-ID'),
    inReplyTo: getHeader('In-Reply-To'),
    references: getHeader('References'),
  };
}

/**
 * Get email body
 */
export function getEmailBody(message: GmailMessage): { text: string; html: string } {
  let text = '';
  let html = '';

  const extractBody = (part: GmailMessagePart): void => {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };

  if (message.payload) {
    extractBody(message.payload);
  }

  return { text, html };
}

/**
 * Send email via Gmail (wrapper for sequence engine)
 */
export async function sendEmailViaGmail(options: {
  to: string;
  from: string;
  subject: string;
  body: string;
  organizationId: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  // Get Gmail tokens from organization's integrations
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

  const integrations = await FirestoreService.getAll<GmailIntegration>(
    `${COLLECTIONS.ORGANIZATIONS}/${options.organizationId}/integrations`,
    []
  );

  const gmailIntegration = integrations.find(
    (i) => i.service === 'gmail' || i.providerId === 'google'
  );

  if (!gmailIntegration?.accessToken) {
    throw new Error('Gmail not connected. Please connect your Google account first.');
  }

  const tokens = {
    access_token: gmailIntegration.accessToken,
    refresh_token: gmailIntegration.refreshToken,
  };

  // Send the email
  await sendGmailEmail(tokens, {
    to: options.to,
    subject: options.subject,
    body: options.body,
  });

  logger.info('Gmail Email sent successfully', { file: 'gmail-service.ts' });
}

/**
 * Sync emails to CRM
 */
export async function syncEmailsToCRM(
  tokens: { access_token: string; refresh_token?: string },
  organizationId: string,
  userId: string
): Promise<{ synced: number; errors: number }> {
  try {
    // Get recent emails (last 24 hours)
    const query = `after:${Math.floor(Date.now() / 1000) - 86400}`;
    const emails = await listEmails(tokens, { query, maxResults: 100 });

    let synced = 0;
    let errors = 0;

    for (const email of emails) {
      try {
        const emailId = email.id ?? '';
        const threadId = email.threadId ?? '';

        if (!emailId) {
          errors++;
          continue;
        }

        const headers = parseEmailHeaders(email);
        const body = getEmailBody(email);

        // Save to CRM
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emails`,
          emailId,
          {
            id: emailId,
            threadId,
            from: headers.from,
            to: headers.to,
            subject: headers.subject,
            body: (body.html !== '' && body.html != null) ? body.html : body.text,
            date: headers.date,
            messageId: headers.messageId,
            inReplyTo: headers.inReplyTo,
            userId,
            createdAt: new Date().toISOString(),
          },
          false
        );

        synced++;
      } catch (error) {
        logger.error('[Gmail Sync] Error syncing email:', error, { file: 'gmail-service.ts' });
        errors++;
      }
    }

    return { synced, errors };
  } catch (error) {
    logger.error('[Gmail Sync] Error syncing emails:', error, { file: 'gmail-service.ts' });
    throw error;
  }
}






















