/**
 * Webhook Signature Verification
 * Centralized verification for all inbound webhook providers:
 * - Twilio (SMS & Voice webhooks)
 * - SendGrid (Email event webhooks)
 * - Stripe (Payment webhooks)
 * - Generic HMAC (Custom webhooks)
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// Twilio Signature Verification (SMS & Voice)
// https://www.twilio.com/docs/usage/security#validating-requests
// ============================================================================

/**
 * Verify Twilio webhook request signature.
 * Twilio signs requests using HMAC-SHA1 with your Auth Token.
 *
 * @param authToken - Twilio Auth Token
 * @param signature - Value of the X-Twilio-Signature header
 * @param url - Full URL Twilio sent the request to
 * @param params - POST parameters as key-value pairs
 */
export function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  try {
    // Build data string: URL + sorted param key-value pairs concatenated
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const key of sortedKeys) {
      data += key + params[key];
    }

    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');

    // Timing-safe comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error(
      'Twilio signature verification error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'webhook-verification.ts' }
    );
    return false;
  }
}

// ============================================================================
// SendGrid Event Webhook Verification (ECDSA)
// https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
// ============================================================================

/**
 * Verify SendGrid Event Webhook signature using ECDSA.
 * SendGrid signs event webhook payloads with an Elliptic Curve key.
 *
 * @param publicKey - Base64-encoded ECDSA public key from SendGrid dashboard
 * @param signature - Value of X-Twilio-Email-Event-Webhook-Signature header
 * @param timestamp - Value of X-Twilio-Email-Event-Webhook-Timestamp header
 * @param payload - Raw request body as string
 */
export function verifySendGridSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  payload: string
): boolean {
  try {
    // Verify timestamp freshness (within 5 minutes to prevent replay attacks)
    const timestampInt = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(timestampInt) || Math.abs(now - timestampInt) > 300) {
      logger.warn('SendGrid webhook timestamp stale or invalid', {
        file: 'webhook-verification.ts',
        timestamp,
        now,
      });
      return false;
    }

    // Concatenate timestamp + payload for verification
    const data = timestamp + payload;

    // Verify ECDSA signature against the public key
    const verifier = crypto.createVerify('SHA256');
    verifier.update(data);

    // Wrap the base64 public key in PEM format
    const pemKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    return verifier.verify(pemKey, signature, 'base64');
  } catch (error) {
    logger.error(
      'SendGrid signature verification error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'webhook-verification.ts' }
    );
    return false;
  }
}

// ============================================================================
// Stripe Webhook Verification
// https://stripe.com/docs/webhooks/signatures
// ============================================================================

/**
 * Verify Stripe webhook signature.
 * Stripe signs payloads with HMAC-SHA256 and includes a timestamp.
 *
 * @param payload - Raw request body
 * @param signatureHeader - Value of the Stripe-Signature header
 * @param webhookSecret - Stripe webhook endpoint secret (whsec_...)
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  try {
    // Parse the Stripe-Signature header (format: t=<ts>,v1=<sig>)
    const elements = signatureHeader.split(',');
    const signatures: Record<string, string> = {};

    for (const element of elements) {
      const [key, ...rest] = element.split('=');
      if (key && rest.length > 0) {
        signatures[key.trim()] = rest.join('=').trim();
      }
    }

    const timestamp = signatures['t'];
    const v1Signature = signatures['v1'];

    if (!timestamp || !v1Signature) {
      logger.warn('Stripe signature header missing t or v1', {
        file: 'webhook-verification.ts',
      });
      return false;
    }

    // Verify timestamp freshness (within 5 minutes)
    const timestampInt = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(timestampInt) || Math.abs(now - timestampInt) > 300) {
      logger.warn('Stripe webhook timestamp stale or invalid', {
        file: 'webhook-verification.ts',
        timestamp,
        now,
      });
      return false;
    }

    // Compute expected signature: HMAC-SHA256(timestamp.payload)
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    // Timing-safe comparison
    if (v1Signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(v1Signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error(
      'Stripe signature verification error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'webhook-verification.ts' }
    );
    return false;
  }
}

// ============================================================================
// Generic HMAC Verification (for custom / third-party webhooks)
// ============================================================================

/**
 * Verify a generic HMAC webhook signature.
 *
 * @param payload - Raw request body
 * @param signature - Hex-encoded signature from the provider
 * @param secret - Shared secret
 * @param algorithm - Hash algorithm (default: sha256)
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    // Timing-safe comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error(
      'HMAC signature verification error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'webhook-verification.ts' }
    );
    return false;
  }
}

// ============================================================================
// Helper: Parse URL-encoded form body
// ============================================================================

/**
 * Parse a URL-encoded form body into a Record<string, string>.
 * Used for Twilio webhooks which send form-encoded POST data.
 */
export function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = body.split('&');
  for (const pair of pairs) {
    const [key, ...rest] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
    }
  }
  return params;
}
