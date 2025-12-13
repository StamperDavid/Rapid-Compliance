/**
 * SendGrid Email Service
 * Handles email sending via SendGrid API
 */

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
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
    console.warn('[SendGrid] No API key configured, email not sent');
    return {
      success: false,
      error: 'SendGrid API key not configured',
    };
  }

  try {
    const fromEmail = options.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
    
    const payload: any = {
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

    const messageId = response.headers.get('x-message-id') || undefined;

    console.log(`[SendGrid] Email sent successfully to ${options.to}`);
    
    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    console.error('[SendGrid] Error sending email:', error);
    return {
      success: false,
      error: error.message,
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




