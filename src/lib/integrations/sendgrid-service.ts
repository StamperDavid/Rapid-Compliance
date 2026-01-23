/**
 * SendGrid Email Service
 * Handles email sending via SendGrid API
 */

import { logger } from '@/lib/logger/logger';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: 'attachment' | 'inline';
  }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email via SendGrid
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    logger.warn('[SendGrid] No API key configured, email not sent', { file: 'sendgrid-service.ts' });
    return {
      success: false,
      error: 'SendGrid API key not configured',
    };
  }

  try {
    const fromEnv = process.env.SENDGRID_FROM_EMAIL;
    const fromFallback = (fromEnv !== '' && fromEnv != null) ? fromEnv : 'noreply@example.com';
    const fromEmail = (options.from !== '' && options.from != null) ? options.from : fromFallback;

    interface SendGridPayload {
      personalizations: Array<{
        to: Array<{ email: string }>;
        dynamic_template_data?: Record<string, unknown>;
      }>;
      from: { email: string };
      subject: string;
      reply_to?: { email: string };
      template_id?: string;
      content?: Array<{
        type: string;
        value: string;
      }>;
      attachments?: Array<{
        content: string;
        filename: string;
        type?: string;
        disposition?: string;
      }>;
    }

    const payload: SendGridPayload = {
      personalizations: [
        {
          to: Array.isArray(options.to) 
            ? options.to.map(email => ({ email }))
            : [{ email: options.to }],
          dynamic_template_data: options.dynamicTemplateData,
        },
      ],
      from: { email: fromEmail },
      subject: options.subject,
    };

    if (options.replyTo) {
      payload.reply_to = { email: options.replyTo };
    }

    if (options.templateId) {
      payload.template_id = options.templateId;
    } else {
      payload.content = [];
      if (options.text) {
        payload.content.push({ type: 'text/plain', value: options.text });
      }
      if (options.html) {
        payload.content.push({ type: 'text/html', value: options.html });
      }
    }

    if (options.attachments && options.attachments.length > 0) {
      payload.attachments = options.attachments;
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid error: ${response.status} - ${errorText}`);
    }

    const msgIdHeader = response.headers.get('x-message-id');
    const messageId = (msgIdHeader !== '' && msgIdHeader != null) ? msgIdHeader : undefined;

    logger.info('SendGrid Email sent successfully to options.to}', { file: 'sendgrid-service.ts' });
    
    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[SendGrid] Error sending email:', error as Error, { file: 'sendgrid-service.ts' });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send bulk emails
 */
export async function sendBulkEmail(
  emails: SendEmailOptions[]
): Promise<SendEmailResult[]> {
  const results = await Promise.all(
    emails.map(email => sendEmail(email))
  );
  return results;
}









