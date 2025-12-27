/**
 * SendGrid Email Service
 * REAL email sending, tracking, and webhook handling
 */

import sgMail from '@sendgrid/mail'
import { logger } from '@/lib/logger/logger';;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';
const FROM_NAME = process.env.FROM_NAME || 'AI Sales Platform';

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
  const SENDGRID_API_KEY = apiKey || process.env.SENDGRID_API_KEY;
  
  if (!SENDGRID_API_KEY) {
    logger.error('[SendGrid] API key not configured', new Error('[SendGrid] API key not configured'), { file: 'sendgrid-service.ts' });
    return {
      success: false,
      error: 'Email service not configured.',
    };
  }
  
  sgMail.setApiKey(SENDGRID_API_KEY);

  try {
    const msg: any = {
      to: options.to,
      from: options.from || {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
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

    return {
      success: true,
      messageId: response.headers['x-message-id'],
    };
  } catch (error: any) {
    logger.error('[SendGrid] Error sending email:', error, { file: 'sendgrid-service.ts' });
    
    if (error.response) {
      logger.error('[SendGrid] Response error', new Error('SendGrid error'), { 
        responseBody: error.response.body,
        file: 'sendgrid-service.ts' 
      });
    }

    return {
      success: false,
      error: error.message || 'Failed to send email',
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
      const error = result.status === 'rejected' 
        ? result.reason.message 
        : (result.value as any).error;
      errors.push(`Email ${index + 1}: ${error}`);
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
    (match, url) => {
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
  dynamicData: Record<string, any>;
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
    const msg: any = {
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

    return {
      success: true,
      messageId: response.headers['x-message-id'],
    };
  } catch (error: any) {
    logger.error('[SendGrid] Error sending template email:', error, { file: 'sendgrid-service.ts' });
    return {
      success: false,
      error: error.message,
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
  [key: string]: any; // Custom args
}

export function parseSendGridWebhook(body: any[]): SendGridWebhookEvent[] {
  // SendGrid sends an array of events
  return body.map(event => ({
    email: event.email,
    timestamp: event.timestamp,
    event: event.event,
    sg_event_id: event.sg_event_id,
    sg_message_id: event.sg_message_id,
    url: event.url,
    reason: event.reason,
    type: event.type,
    status: event.status,
    ...event,
  }));
}

