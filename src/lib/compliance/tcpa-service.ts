/**
 * TCPA Compliance Service
 * Handles consent verification, suppression lists, and time-of-day restrictions
 * for outbound calls and SMS messages.
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

const SUPPRESSION_COLLECTION = getSubCollection('tcpa_suppression');
const CONSENT_COLLECTION = getSubCollection('tcpa_consent');

interface ConsentRecord {
  phoneNumber: string;
  channel: 'sms' | 'call';
  consentGiven: boolean;
  consentType: 'express_written' | 'express_oral' | 'implied';
  consentDate: string;
  source: string;
  revokedAt?: string;
}

interface SuppressionRecord {
  phoneNumber: string;
  channel: 'sms' | 'call';
  suppressedAt: string;
  reason: string;
}

/** STOP keywords that trigger SMS opt-out per TCPA */
const STOP_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit', 'optout', 'opt-out'];

/**
 * Check if a phone number has TCPA consent for the given channel
 */
export async function checkTCPAConsent(
  phoneNumber: string,
  messageType: 'sms' | 'call'
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check suppression list first
    const suppressed = await isOnSuppressionList(phoneNumber, messageType);
    if (suppressed) {
      return { allowed: false, reason: `Phone number is on ${messageType} suppression list` };
    }

    // Check for consent record
    const consentId = `${normalizePhone(phoneNumber)}_${messageType}`;
    const consent = await FirestoreService.get<ConsentRecord>(CONSENT_COLLECTION, consentId);

    if (!consent) {
      return { allowed: false, reason: `No TCPA consent on file for ${messageType}` };
    }

    if (!consent.consentGiven) {
      return { allowed: false, reason: 'Consent has been revoked' };
    }

    if (consent.revokedAt) {
      return { allowed: false, reason: 'Consent has been revoked' };
    }

    // For SMS marketing, require express written consent
    if (messageType === 'sms' && consent.consentType !== 'express_written') {
      return { allowed: false, reason: 'SMS marketing requires express written consent' };
    }

    return { allowed: true };
  } catch (error) {
    logger.error('TCPA consent check failed', error instanceof Error ? error : new Error(String(error)));
    // Fail closed - if we can't verify consent, don't send
    return { allowed: false, reason: 'Unable to verify TCPA consent' };
  }
}

/**
 * Add a phone number to the suppression list
 */
export async function addToSuppressionList(
  phoneNumber: string,
  channel: 'sms' | 'call',
  reason = 'User opt-out'
): Promise<void> {
  const normalizedPhone = normalizePhone(phoneNumber);
  const suppressionId = `${normalizedPhone}_${channel}`;

  const record: SuppressionRecord = {
    phoneNumber: normalizedPhone,
    channel,
    suppressedAt: new Date().toISOString(),
    reason,
  };

  await FirestoreService.set(SUPPRESSION_COLLECTION, suppressionId, record);

  // Also revoke consent
  const consentId = `${normalizedPhone}_${channel}`;
  try {
    await FirestoreService.update(CONSENT_COLLECTION, consentId, {
      consentGiven: false,
      revokedAt: new Date().toISOString(),
    });
  } catch {
    // Consent record may not exist
  }

  logger.info('Added to TCPA suppression list', { phoneNumber: normalizedPhone, channel, reason });
}

/**
 * Check if a phone number is on the suppression list
 */
export async function isOnSuppressionList(
  phoneNumber: string,
  channel: 'sms' | 'call'
): Promise<boolean> {
  try {
    const normalizedPhone = normalizePhone(phoneNumber);
    const suppressionId = `${normalizedPhone}_${channel}`;
    const record = await FirestoreService.get<SuppressionRecord>(SUPPRESSION_COLLECTION, suppressionId);
    return record !== null;
  } catch {
    // Fail closed
    return true;
  }
}

/**
 * Check if a call can be made based on time-of-day restrictions
 * TCPA prohibits calls before 8am and after 9pm in the recipient's local time
 */
export function checkCallTimeRestrictions(
  _phoneNumber: string,
  timezone = 'America/New_York'
): { allowed: boolean; reason?: string } {
  try {
    const now = new Date();
    // Convert to recipient timezone
    const recipientTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const hour = recipientTime.getHours();

    if (hour < 8) {
      return { allowed: false, reason: `TCPA: Cannot call before 8:00 AM recipient local time (currently ${hour}:00)` };
    }

    if (hour >= 21) {
      return { allowed: false, reason: `TCPA: Cannot call after 9:00 PM recipient local time (currently ${hour}:00)` };
    }

    return { allowed: true };
  } catch (error) {
    logger.error('Time restriction check failed', error instanceof Error ? error : new Error(String(error)));
    return { allowed: false, reason: 'Unable to verify time restrictions' };
  }
}

/**
 * Check if an inbound SMS message contains a STOP keyword
 */
export function isStopKeyword(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return STOP_KEYWORDS.includes(normalized);
}

/**
 * Record TCPA consent for a phone number
 */
export async function recordConsent(
  phoneNumber: string,
  channel: 'sms' | 'call',
  consentType: 'express_written' | 'express_oral' | 'implied',
  source: string
): Promise<void> {
  const normalizedPhone = normalizePhone(phoneNumber);
  const consentId = `${normalizedPhone}_${channel}`;

  const record: ConsentRecord = {
    phoneNumber: normalizedPhone,
    channel,
    consentGiven: true,
    consentType,
    consentDate: new Date().toISOString(),
    source,
  };

  await FirestoreService.set(CONSENT_COLLECTION, consentId, record);
  logger.info('TCPA consent recorded', { phoneNumber: normalizedPhone, channel, consentType, source });
}

/** Normalize phone number to digits only */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
