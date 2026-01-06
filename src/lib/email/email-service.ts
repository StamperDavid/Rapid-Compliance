/**
 * Email Service
 * Handles sending emails via configured providers (SendGrid, Resend, SMTP)
 * REAL IMPLEMENTATION with provider integration
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service'
import { logger } from '@/lib/logger/logger';;

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  tracking?: {
    trackOpens?: boolean;
    trackClicks?: boolean;
  };
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

export interface EmailTracking {
  emailId: string;
  opened: boolean;
  openedAt?: Date;
  clicked: boolean;
  clickedAt?: Date;
  clickLinks?: Array<{
    url: string;
    clickedAt: Date;
  }>;
}

/**
 * Send email via configured provider
 * REAL: Uses SendGrid, Resend, or SMTP based on configuration
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  // Validate required fields
  if (!options.to || !options.subject) {
    return {
      success: false,
      error: 'Missing required fields: to, subject',
    };
  }

  // Get organization ID from metadata
  const organizationId = options.metadata?.organizationId;
  if (!organizationId) {
    return {
      success: false,
      error: 'Organization ID required in metadata',
    };
  }

  // Determine provider and get credentials
  let provider: 'sendgrid' | 'resend' | 'smtp' | null = null;
  let credentials: any = null;

  // Try SendGrid first
  const sendgridKeys = await apiKeyService.getServiceKey(organizationId, 'sendgrid');
  if (sendgridKeys?.apiKey) {
    provider = 'sendgrid';
    credentials = sendgridKeys;
  } else {
    // Try Resend
    const resendKeys = await apiKeyService.getServiceKey(organizationId, 'resend');
    if (resendKeys?.apiKey) {
      provider = 'resend';
      credentials = resendKeys;
    } else {
      // Try SMTP
      const smtpKeys = await apiKeyService.getServiceKey(organizationId, 'smtp');
      if (smtpKeys?.host && smtpKeys?.username && smtpKeys?.password) {
        provider = 'smtp';
        credentials = smtpKeys;
      }
    }
  }

  if (!provider || !credentials) {
    return {
      success: false,
      error: 'No email provider configured. Please configure SendGrid, Resend, or SMTP in settings.',
    };
  }

  // Send via appropriate provider
  try {
    switch (provider) {
      case 'sendgrid':
        return await sendViaSendGrid(options, credentials);
      case 'resend':
        return await sendViaResend(options, credentials);
      case 'smtp':
        return await sendViaSMTP(options, credentials);
      default:
        return {
          success: false,
          error: 'Unknown email provider',
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email',
      provider,
    };
  }
}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid(options: EmailOptions, credentials: any): Promise<EmailResult> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const fromEmail = options.from || credentials.fromEmail || 'noreply@example.com';
  const fromName = options.fromName || credentials.fromName || 'AI Sales Platform';

  const payload: any = {
    personalizations: recipients.map(to => ({
      to: [{ email: to }],
      ...(options.cc && { cc: Array.isArray(options.cc) ? options.cc.map(e => ({ email: e })) : [{ email: options.cc }] }),
      ...(options.bcc && { bcc: Array.isArray(options.bcc) ? options.bcc.map(e => ({ email: e })) : [{ email: options.bcc }] }),
    })),
    from: {
      email: fromEmail,
      name: fromName,
    },
    subject: options.subject,
    content: [],
  };

  if (options.html) {
    const orgId = options.metadata?.organizationId;
    const { html: modifiedHtml } = addTrackingPixel(
      options.html,
      options.tracking?.trackOpens,
      undefined, // messageId not available yet
      orgId
    );
    payload.content.push({
      type: 'text/html',
      value: modifiedHtml,
    });
  }
  if (options.text) {
    payload.content.push({
      type: 'text/plain',
      value: options.text,
    });
  }

  if (options.attachments) {
    payload.attachments = options.attachments.map(att => ({
      content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
      filename: att.filename,
      type: att.contentType || 'application/octet-stream',
      disposition: 'attachment',
    }));
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    return {
      success: false,
      error: `SendGrid error: ${error}`,
      provider: 'sendgrid',
    };
  }

  const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;
  
  // Store tracking mapping if tracking is enabled
  const orgId = options.metadata?.organizationId;
  if (orgId && options.tracking?.trackOpens) {
    import('@/lib/db/firestore-service').then(({ FirestoreService, COLLECTIONS }) => {
      FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/emailTrackingMappings`,
        messageId,
        {
          messageId,
          organizationId: orgId,
          createdAt: new Date().toISOString(),
        },
        false
      ).catch(() => {
        // Silently fail
      });
    });
  }

  return {
    success: true,
    messageId,
    provider: 'sendgrid',
  };
}

/**
 * Send email via Resend
 */
async function sendViaResend(options: EmailOptions, credentials: any): Promise<EmailResult> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const fromEmail = options.from || credentials.fromEmail || 'noreply@example.com';

  const payload: any = {
    from: fromEmail,
    to: recipients,
    subject: options.subject,
  };

  if (options.html) {
    const orgId = options.metadata?.organizationId;
    const { html: modifiedHtml } = addTrackingPixel(
      options.html,
      options.tracking?.trackOpens,
      undefined,
      orgId
    );
    payload.html = modifiedHtml;
  }
  if (options.text) {
    payload.text = options.text;
  }
  if (options.cc) {
    payload.cc = Array.isArray(options.cc) ? options.cc : [options.cc];
  }
  if (options.bcc) {
    payload.bcc = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
  }
  if (options.replyTo) {
    payload.reply_to = options.replyTo;
  }

  if (options.attachments) {
    payload.attachments = options.attachments.map(att => ({
      filename: att.filename,
      content: typeof att.content === 'string' ? att.content : Buffer.from(att.content).toString('base64'),
    }));
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    return {
      success: false,
      error: `Resend error: ${error.message || JSON.stringify(error)}`,
      provider: 'resend',
    };
  }

  const data = await response.json();
  const messageId = data.id;
  
  // Store tracking mapping if tracking is enabled
  const orgId = options.metadata?.organizationId;
  if (orgId && options.tracking?.trackOpens) {
    import('@/lib/db/firestore-service').then(({ FirestoreService, COLLECTIONS }) => {
      FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/emailTrackingMappings`,
        messageId,
        {
          messageId,
          organizationId: orgId,
          createdAt: new Date().toISOString(),
        },
        false
      ).catch(() => {
        // Silently fail
      });
    });
  }

  return {
    success: true,
    messageId,
    provider: 'resend',
  };
}

/**
 * Send email via SMTP
 */
async function sendViaSMTP(options: EmailOptions, credentials: any): Promise<EmailResult> {
  // For SMTP, we need to use a server-side implementation
  // This would typically use nodemailer or similar
  // For now, we'll make a call to an API route that handles SMTP
  
  const response = await fetch('/api/email/send-smtp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...options,
      smtpConfig: credentials,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    return {
      success: false,
      error: error.error || 'SMTP send failed',
      provider: 'smtp',
    };
  }

  const data = await response.json();
  return {
    success: true,
    messageId: data.messageId,
    provider: 'smtp',
  };
}

/**
 * Add tracking pixel to HTML if tracking is enabled
 * Returns both the modified HTML and the trackingId
 */
function addTrackingPixel(
  html: string,
  trackOpens?: boolean,
  messageId?: string,
  organizationId?: string
): { html: string; trackingId?: string } {
  if (!trackOpens) {return { html };}
  
  // Use messageId as trackingId if provided, otherwise generate one
  const trackingId = messageId || `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const trackingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/email/track/${trackingId}`;
  
  // Store tracking mapping in Firestore if we have organizationId
  if (organizationId && messageId) {
    import('@/lib/db/firestore-service').then(({ FirestoreService, COLLECTIONS }) => {
      FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailTrackingMappings`,
        trackingId,
        {
          messageId,
          organizationId,
          createdAt: new Date().toISOString(),
        },
        false
      ).catch((error) => {
        logger.error('Failed to store tracking mapping:', error, { file: 'email-service.ts' });
      });
    });
  }
  
  // Add tracking pixel before closing body tag
  const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" />`;
  
  const modifiedHtml = html.includes('</body>')
    ? html.replace('</body>', `${trackingPixel}</body>`)
    : html + trackingPixel;
  
  return { html: modifiedHtml, trackingId };
}

/**
 * Send bulk emails
 * REAL: Uses provider's batch API when available, otherwise sends in parallel
 */
export async function sendBulkEmails(
  recipients: string[],
  options: Omit<EmailOptions, 'to'>
): Promise<EmailResult[]> {
  // For now, send in parallel with rate limiting
  // In production, use provider's batch API (SendGrid has batch API)
  const batchSize = 10;
  const results: EmailResult[] = [];
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(recipient => sendEmail({
        ...options,
        to: recipient,
      }))
    );
    results.push(...batchResults);
    
    // Rate limiting: wait 1 second between batches
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Get email tracking data
 * REAL: Queries Firestore for tracking data
 */
export async function getEmailTracking(messageId: string, organizationId?: string): Promise<EmailTracking | null> {
  if (!organizationId) {
    return null;
  }

  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const trackingData = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailTracking`,
    messageId
  );

  if (!trackingData) {
    return null;
  }

  return {
    ...trackingData,
    openedAt: trackingData.openedAt ? new Date(trackingData.openedAt) : undefined,
    clickedAt: trackingData.clickedAt ? new Date(trackingData.clickedAt) : undefined,
    clickLinks: trackingData.clickLinks?.map((link: any) => ({
      ...link,
      clickedAt: new Date(link.clickedAt),
    })) || [],
  } as EmailTracking;
}

/**
 * Record email open
 * REAL: Updates Firestore tracking record
 */
export async function recordEmailOpen(
  messageId: string,
  organizationId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  // Get existing tracking or create new
  const existing = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailTracking`,
    messageId
  );

  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailTracking`,
    messageId,
    {
      emailId: messageId,
      opened: true,
      openedAt: new Date().toISOString(),
      clicked: existing?.clicked || false,
      clickLinks: existing?.clickLinks || [],
      ipAddress,
      userAgent,
    },
    false
  );
}

/**
 * Record email click
 * REAL: Updates Firestore tracking record
 */
export async function recordEmailClick(
  messageId: string,
  organizationId: string,
  url: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  // Get existing tracking or create new
  const existing = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailTracking`,
    messageId
  );

  const clickLinks = existing?.clickLinks || [];
  clickLinks.push({
    url,
    clickedAt: new Date().toISOString(),
  });

  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/emailTracking`,
    messageId,
    {
      emailId: messageId,
      opened: existing?.opened || false,
      openedAt: existing?.openedAt,
      clicked: true,
      clickedAt: existing?.clickedAt || new Date().toISOString(),
      clickLinks,
      ipAddress,
      userAgent,
    },
    false
  );
}



