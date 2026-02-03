/**
 * SendGrid Email Service
 * REAL email sending, tracking, and webhook handling
 */

import sgMail, { type MailDataRequired, type ResponseError } from '@sendgrid/mail';
import { logger } from '@/lib/logger/logger';

const FROM_EMAIL =(process.env.FROM_EMAIL !== '' && process.env.FROM_EMAIL != null) ? process.env.FROM_EMAIL : 'noreply@yourdomain.com';
const FROM_NAME =(process.env.FROM_NAME !== '' && process.env.FROM_NAME != null) ? process.env.FROM_NAME : 'Rapid Compliance';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: {
    email: string;
    name: string;
  };
  replyTo?: string;
  tracking?: {
    trackOpens: boolean;
    trackClicks: boolean;
  };
  metadata?: Record<string, string>;
}

export interface EmailTrackingData {
  enrollmentId?: string;
  stepId?: string;
  organizationId?: string;
  prospectId?: string;
  campaignId?: string;
}

/**
 * Send email via SendGrid with tracking
 */
export async function sendEmail(options: SendEmailOptions, apiKey?: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const SENDGRID_API_KEY =apiKey ?? process.env.SENDGRID_API_KEY;
  
  if (!SENDGRID_API_KEY) {
    logger.error('[SendGrid] API key not configured', new Error('[SendGrid] API key not configured'), { file: 'sendgrid-service.ts' });
    return {
      success: false,
      error: 'Email service not configured.',
    };
  }
  
  sgMail.setApiKey(SENDGRID_API_KEY);

  try {
    const msg: MailDataRequired = {
      to: options.to,
      from:options.from ?? {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject: options.subject,
      html: options.html,
      text:options.text ?? stripHtml(options.html),
      trackingSettings: {
        clickTracking: {
          enable: options.tracking?.trackClicks ?? true,
        },
        openTracking: {
          enable: options.tracking?.trackOpens ?? true,
        },
      },
    };

    // Add reply-to if specified
    if (options.replyTo) {
      msg.replyTo = options.replyTo;
    }

    // Add custom headers for tracking
    if (options.metadata) {
      msg.customArgs = options.metadata;
    }

    const [response] = await sgMail.send(msg);

    logger.info('SendGrid Email sent successfully to options.to}', { file: 'sendgrid-service.ts' });

    const headers = response.headers as Record<string, unknown> | undefined;
    const messageId = headers?.['x-message-id'];

    return {
      success: true,
      messageId: typeof messageId === 'string' ? messageId : undefined,
    };
  } catch (error) {
    const err = error as ResponseError | Error;
    logger.error('[SendGrid] Error sending email:', err instanceof Error ? err : new Error(String(error)), { file: 'sendgrid-service.ts' });

    if ('response' in err && err.response) {
      logger.error('[SendGrid] Response error', new Error('SendGrid error'), {
        responseBody: err.response.body,
        file: 'sendgrid-service.ts'
      });
    }

    return {
      success: false,
      error: err instanceof Error && err.message ? err.message : 'Failed to send email',
    };
  }
}

/**
 * Send bulk emails (batch send)
 */
export async function sendBulkEmails(
  emails: SendEmailOptions[]
): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const results = await Promise.allSettled(
    emails.map(email => sendEmail(email))
  );

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      sent++;
    } else {
      failed++;
      let errorMessage: string;
      if (result.status === 'rejected') {
        errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
      } else {
        errorMessage = result.value.error ?? 'Unknown error';
      }
      errors.push(`Email ${index + 1}: ${errorMessage}`);
    }
  });

  return {
    success: failed === 0,
    sent,
    failed,
    errors,
  };
}

/**
 * Add tracking pixel to HTML email
 */
export function addTrackingPixel(html: string, trackingId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  
  const pixel = `<img src="${baseUrl}/api/email/track/${trackingId}" width="1" height="1" alt="" style="display:none" />`;
  
  // Add pixel before closing body tag if it exists
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }
  
  // Otherwise append to end
  return html + pixel;
}

/**
 * Wrap links with click tracking
 */
export function addClickTracking(html: string, trackingId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  
  // Replace all href attributes with tracking redirect
  return html.replace(
    /href="([^"]+)"/g,
    (_match, url: string) => {
      const trackingUrl = `${baseUrl}/api/email/track/link?t=${trackingId}&url=${encodeURIComponent(url)}`;
      return `href="${trackingUrl}"`;
    }
  );
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Send template email using SendGrid dynamic templates
 */
export async function sendTemplateEmail(options: {
  to: string;
  templateId: string;
  dynamicData: Record<string, unknown>;
  metadata?: Record<string, string>;
}): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  if (!process.env.SENDGRID_API_KEY) {
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const msg: MailDataRequired = {
      to: options.to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      templateId: options.templateId,
      dynamicTemplateData: options.dynamicData,
    };

    if (options.metadata) {
      msg.customArgs = options.metadata;
    }

    const [response] = await sgMail.send(msg);

    const headers = response.headers as Record<string, unknown> | undefined;
    const messageId = headers?.['x-message-id'];

    return {
      success: true,
      messageId: typeof messageId === 'string' ? messageId : undefined,
    };
  } catch (error) {
    const err = error as ResponseError | Error;
    logger.error('[SendGrid] Error sending template email:', err instanceof Error ? err : new Error(String(error)), { file: 'sendgrid-service.ts' });
    return {
      success: false,
      error: err instanceof Error && err.message ? err.message : 'Failed to send template email',
    };
  }
}

/**
 * Verify email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parse SendGrid webhook event
 */
export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event: 'processed' | 'delivered' | 'open' | 'click' | 'bounce' | 'deferred' | 'dropped' | 'spamreport' | 'unsubscribe';
  sg_event_id: string;
  sg_message_id: string;
  url?: string; // For click events
  reason?: string; // For bounce/drop events
  type?: string; // bounce type
  status?: string; // delivery status
  [key: string]: unknown; // Custom args
}

interface RawSendGridEvent {
  email: string;
  timestamp: number;
  event: string;
  sg_event_id: string;
  sg_message_id: string;
  url?: string;
  reason?: string;
  type?: string;
  status?: string;
  [key: string]: unknown;
}

export function parseSendGridWebhook(body: RawSendGridEvent[]): SendGridWebhookEvent[] {
  // SendGrid sends an array of events
  return body.map(event => {
    const { email, timestamp, sg_event_id, sg_message_id, url, reason, type, status, ...rest } = event;
    return {
      ...rest,
      email,
      timestamp,
      event: event.event as SendGridWebhookEvent['event'],
      sg_event_id,
      sg_message_id,
      url,
      reason,
      type,
      status,
    };
  });
}

