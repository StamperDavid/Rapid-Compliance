/**
 * Twilio Webhook Signature Verification
 * Verifies that incoming webhook requests are actually from Twilio
 */

import { createHmac } from 'crypto';
import { logger } from '@/lib/logger/logger';

/**
 * Verify a Twilio webhook signature
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(
  authToken: string,
  twilioSignature: string,
  url: string,
  params: Record<string, string>
): boolean {
  try {
    // Sort params alphabetically and concatenate
    const data = url + Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + (params[key] ?? ''), '');

    const computed = createHmac('sha1', authToken)
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');

    return computed === twilioSignature;
  } catch (error) {
    logger.error('Twilio signature verification failed', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Middleware helper to verify Twilio webhook requests
 * Returns null if valid, or an error message if invalid
 */
export function validateTwilioRequest(
  signature: string | null,
  url: string,
  params: Record<string, string>
): string | null {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('TWILIO_AUTH_TOKEN not configured - skipping verification in development');
      return null;
    }
    return 'TWILIO_AUTH_TOKEN not configured';
  }

  if (!signature) {
    return 'Missing X-Twilio-Signature header';
  }

  const isValid = verifyTwilioSignature(authToken, signature, url, params);
  if (!isValid) {
    return 'Invalid Twilio signature';
  }

  return null;
}
