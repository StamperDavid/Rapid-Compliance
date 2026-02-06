/**
 * SMS Service
 * Handles sending SMS via Twilio and other providers
 * REAL IMPLEMENTATION with provider integration
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service'
import { logger } from '@/lib/logger/logger';

export interface SMSOptions {
  to: string | string[];
  message: string;
  from?: string; // Phone number or sender ID
  organizationId: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

export interface SMSTemplate {
  id: string;
  name: string;
  message: string;
  variables?: string[]; // e.g., ['{{name}}', '{{orderNumber}}']
  organizationId: string;
}

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber?: string;
}

interface VonageCredentials {
  apiKey: string;
  apiSecret: string;
  phoneNumber?: string;
}

type SMSCredentials = TwilioCredentials | VonageCredentials;

interface TwilioMessageResponse {
  sid: string;
  status?: string;
  date_sent?: string;
  date_updated?: string;
  error_code?: string | number;
  error_message?: string;
}

interface VonageMessageResponse {
  messages?: Array<{
    status: string;
    'message-id': string;
    'error-text'?: string;
  }>;
}

interface SMSMessageRecord {
  status?: string;
  sentAt?: string;
  deliveredAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

// Type guards
function isTwilioCredentials(credentials: SMSCredentials): credentials is TwilioCredentials {
  return 'accountSid' in credentials && 'authToken' in credentials;
}

function isVonageCredentials(credentials: SMSCredentials): credentials is VonageCredentials {
  return 'apiKey' in credentials && 'apiSecret' in credentials;
}

/**
 * Send SMS via Twilio or Vonage
 * REAL: Uses Twilio/Vonage API based on configuration
 */
export async function sendSMS(options: SMSOptions): Promise<SMSResult> {
  // Validate required fields
  if (!options.to || !options.message || !options.organizationId) {
    return {
      success: false,
      error: 'Missing required fields: to, message, organizationId',
    };
  }

  // Validate phone number format
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  for (const phone of recipients) {
    const cleaned = phone.replace(/\s/g, '');
    if (!phoneRegex.test(cleaned)) {
      return {
        success: false,
        error: `Invalid phone number format: ${phone}`,
      };
    }
  }

  // Determine provider and get credentials
  let provider: 'twilio' | 'vonage' | null = null;
  let credentials: SMSCredentials | null = null;

  // Try Twilio first
  const twilioKeysRaw: unknown = await apiKeyService.getServiceKey(options.organizationId, 'twilio');
  if (twilioKeysRaw != null && typeof twilioKeysRaw === 'object' && 'accountSid' in twilioKeysRaw && 'authToken' in twilioKeysRaw) {
    const twilioKeys = twilioKeysRaw as Record<string, unknown>;
    const twilioCredentials: TwilioCredentials = {
      accountSid: String(twilioKeys.accountSid),
      authToken: String(twilioKeys.authToken),
      phoneNumber: 'phoneNumber' in twilioKeys && twilioKeys.phoneNumber != null ? String(twilioKeys.phoneNumber) : undefined,
    };
    provider = 'twilio';
    credentials = twilioCredentials;
  } else {
    // Try Vonage
    const vonageKeysRaw: unknown = await apiKeyService.getServiceKey(options.organizationId, 'vonage');
    if (vonageKeysRaw != null && typeof vonageKeysRaw === 'object' && 'apiKey' in vonageKeysRaw && 'apiSecret' in vonageKeysRaw) {
      const vonageKeys = vonageKeysRaw as Record<string, unknown>;
      const vonageCredentials: VonageCredentials = {
        apiKey: String(vonageKeys.apiKey),
        apiSecret: String(vonageKeys.apiSecret),
        phoneNumber: 'phoneNumber' in vonageKeys && vonageKeys.phoneNumber != null ? String(vonageKeys.phoneNumber) : undefined,
      };
      provider = 'vonage';
      credentials = vonageCredentials;
    }
  }

  if (!provider || !credentials) {
    return {
      success: false,
      error: 'No SMS provider configured. Please configure Twilio or Vonage in settings.',
    };
  }

  // Send via appropriate provider
  try {
    switch (provider) {
      case 'twilio':
        if (isTwilioCredentials(credentials)) {
          return await sendViaTwilio(options, credentials);
        }
        break;
      case 'vonage':
        if (isVonageCredentials(credentials)) {
          return await sendViaVonage(options, credentials);
        }
        break;
      default:
        return {
          success: false,
          error: 'Unknown SMS provider',
        };
    }
    return {
      success: false,
      error: 'Invalid credentials for provider',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send SMS';
    return {
      success: false,
      error: errorMessage,
      provider,
    };
  }
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(options: SMSOptions, credentials: TwilioCredentials): Promise<SMSResult> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const fromNumber = options.from ?? credentials.phoneNumber;

  if (!fromNumber) {
    return {
      success: false,
      error: 'Twilio phone number not configured',
      provider: 'twilio',
    };
  }

  // Twilio API endpoint
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;

  // Send to each recipient
  const results: SMSResult[] = [];
  for (const recipient of recipients) {
    const formData = new URLSearchParams();
    formData.append('From', fromNumber);
    formData.append('To', recipient.replace(/\s/g, ''));
    formData.append('Body', options.message);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${credentials.accountSid}:${credentials.authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Twilio error: ${error}`,
        provider: 'twilio',
      };
    }

    const data = await response.json() as TwilioMessageResponse;
    results.push({
      success: true,
      messageId: data.sid,
      provider: 'twilio',
    });
  }

  // Return first result (or combine if multiple recipients)
  return results[0] || {
    success: true,
    messageId: `twilio_${Date.now()}`,
    provider: 'twilio',
  };
}

/**
 * Send SMS via Vonage (Nexmo)
 */
async function sendViaVonage(options: SMSOptions, credentials: VonageCredentials): Promise<SMSResult> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const fromNumber = options.from ?? credentials.phoneNumber ?? 'Vonage';

  // Vonage API endpoint
  const vonageUrl = 'https://rest.nexmo.com/sms/json';

  // Send to each recipient
  const results: SMSResult[] = [];
  for (const recipient of recipients) {
    const params = new URLSearchParams();
    params.append('api_key', credentials.apiKey);
    params.append('api_secret', credentials.apiSecret);
    params.append('from', fromNumber);
    params.append('to', recipient.replace(/\s/g, '').replace(/^\+/, ''));
    params.append('text', options.message);

    const response = await fetch(`${vonageUrl}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Vonage error: ${error}`,
        provider: 'vonage',
      };
    }

    const data = await response.json() as VonageMessageResponse;
    if (data.messages?.[0]?.status === '0') {
      const messageId = data.messages[0]['message-id'];

      // Store SMS record in Firestore
      if (options.organizationId) {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${options.organizationId}/smsMessages`,
          messageId,
          {
            messageId,
            to: recipient,
            from: fromNumber,
            message: options.message,
            status: 'sent',
            sentAt: new Date().toISOString(),
            provider: 'vonage',
            organizationId: options.organizationId,
          },
          false
        ).catch((error: unknown) => {
          logger.error('Failed to save SMS to Firestore:', error instanceof Error ? error : new Error(String(error)), { file: 'sms-service.ts' });
          // Don't fail the send if Firestore save fails
        });
      }

      results.push({
        success: true,
        messageId,
        provider: 'vonage',
      });
    } else {
      const errorText = data.messages?.[0]?.['error-text'];
      return {
        success: false,
        error: `Vonage error: ${errorText ?? 'Unknown error'}`,
        provider: 'vonage',
      };
    }
  }

  return results[0] || {
    success: true,
    messageId: `vonage_${Date.now()}`,
    provider: 'vonage',
  };
}

/**
 * Send bulk SMS
 * REAL: Sends in parallel with rate limiting
 */
export async function sendBulkSMS(
  recipients: string[],
  message: string,
  options: Omit<SMSOptions, 'to' | 'message'>
): Promise<SMSResult[]> {
  // Send in batches to avoid rate limits
  const batchSize = 5; // SMS providers typically have stricter rate limits
  const results: SMSResult[] = [];

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(recipient => sendSMS({
        ...options,
        to: recipient,
        message,
      }))
    );
    results.push(...batchResults);

    // Rate limiting: wait 2 seconds between batches for SMS
    if (i + batchSize < recipients.length) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 2000);
      });
    }
  }

  return results;
}

/**
 * Send SMS from template
 * Loads template, replaces variables, and sends SMS
 */
export async function sendSMSFromTemplate(
  templateId: string,
  to: string | string[],
  variables: Record<string, string>,
  options: Omit<SMSOptions, 'to' | 'message'>
): Promise<SMSResult> {
  // Template-based SMS flow:
  // 1. Load template from database
  // 2. Replace variables in template message
  // 3. Send SMS

  // Load template from Firestore
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const templateData = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${options.organizationId}/smsTemplates`,
    templateId
  );

  if (!templateData) {
    return {
      success: false,
      error: 'Template not found',
    };
  }

  const template = templateData as SMSTemplate;

  // Replace variables
  let message = template.message;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  return sendSMS({
    ...options,
    to,
    message,
  });
}

/**
 * Get SMS delivery status
 */
export interface SMSDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  sentAt?: Date;
  deliveredAt?: Date;
  errorCode?: string;
  errorMessage?: string;
}

export async function getSMSDeliveryStatus(
  messageId: string,
  organizationId?: string
): Promise<SMSDeliveryStatus | null> {
  if (!organizationId) {
    return null;
  }

  // Load from Firestore
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const smsData = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/smsMessages`,
    messageId
  );

  if (!smsData) {
    return null;
  }

  const record = smsData as SMSMessageRecord;
  const validStatus = record.status && record.status !== '' ? record.status : 'sent';

  return {
    messageId,
    status: validStatus as SMSDeliveryStatus['status'],
    sentAt: record.sentAt ? new Date(record.sentAt) : new Date(),
    deliveredAt: record.deliveredAt ? new Date(record.deliveredAt) : undefined,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
  };
}

/**
 * Query Twilio API for real-time delivery status
 */
export async function queryTwilioStatus(
  messageId: string
): Promise<SMSDeliveryStatus | null> {
  try {
    // Get Twilio credentials
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const keys = await apiKeyService.getKeys();
    const twilioConfig = keys?.sms?.twilio;

    if (!twilioConfig || typeof twilioConfig !== 'object') {
      throw new Error('Twilio configuration not found');
    }

    if (!('accountSid' in twilioConfig) || !('authToken' in twilioConfig)) {
      throw new Error('Twilio credentials not configured');
    }

    const accountSid = String(twilioConfig.accountSid);
    const authToken = String(twilioConfig.authToken);

    // Query Twilio API
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageId}.json`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.statusText}`);
    }

    const data = await response.json() as TwilioMessageResponse;

    return {
      messageId: data.sid,
      status: (data.status as SMSDeliveryStatus['status']) ?? 'sent',
      sentAt: data.date_sent ? new Date(data.date_sent) : undefined,
      deliveredAt: data.date_updated && data.status === 'delivered' ? new Date(data.date_updated) : undefined,
      errorCode: data.error_code != null ? String(data.error_code) : undefined,
      errorMessage: data.error_message,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[SMS Service] Error querying Twilio status:', err, { file: 'sms-service.ts' });
    return null;
  }
}

/**
 * SMS Provider configurations
 */
export const SMS_PROVIDERS = [
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Global SMS provider with excellent delivery rates',
  },
  {
    id: 'vonage',
    name: 'Vonage (formerly Nexmo)',
    description: 'International SMS provider',
  },
];

/**
 * Validate phone number format
 * Returns true if phone number is valid E.164 format
 */
export function validatePhoneNumber(phone: string): boolean {
  // E.164 format: +[country code][number]
  // Must start with +, followed by 1-15 digits
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const cleaned = phone.replace(/\s/g, '');
  return phoneRegex.test(cleaned);
}

/**
 * Render SMS template with variable replacement
 * Replaces {{variableName}} with actual values
 */
export function renderSMSTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    if (value == null) {
      return match;
    }
    return String(value);
  });
}
