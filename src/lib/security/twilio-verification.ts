/**
 * Twilio Webhook Signature Verification
 * Verifies that incoming webhook requests are actually from Twilio
 * Auth token is fetched from Firestore via apiKeyService (not env vars).
 */

import { createHmac } from 'crypto';
import { logger } from '@/lib/logger/logger';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

interface TwilioKeys {
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
}

/**
 * Fetch the Twilio auth token from the API key service (Firestore).
 * Returns null if not configured.
 */
export async function getTwilioAuthToken(): Promise<string | null> {
  try {
    const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'twilio') as TwilioKeys | null;
    return keys?.authToken ?? null;
  } catch (error) {
    logger.error('Failed to fetch Twilio auth token from API key service', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Fetch all Twilio credentials from the API key service (Firestore).
 * Returns null if not configured.
 */
export async function getTwilioCredentials(): Promise<TwilioKeys | null> {
  try {
    const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'twilio') as TwilioKeys | null;
    return keys ?? null;
  } catch (error) {
    logger.error('Failed to fetch Twilio credentials from API key service', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

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
 * Fetches auth token from Firestore via apiKeyService.
 * Returns null if valid, or an error message if invalid.
 */
export async function validateTwilioRequest(
  signature: string | null,
  url: string,
  params: Record<string, string>
): Promise<string | null> {
  const authToken = await getTwilioAuthToken();

  if (!authToken) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Twilio auth token not configured in API keys — skipping verification in development');
      return null;
    }
    return 'Twilio auth token not configured';
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
