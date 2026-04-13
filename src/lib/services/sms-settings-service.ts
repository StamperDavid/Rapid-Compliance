/**
 * SMS Settings Service
 *
 * Server-side service for reading and mutating the Firestore-backed SMS
 * configuration document. Single document, not a collection. Used by:
 *   - SMS Specialist (Task #44) — loads maxCharCap at runtime and injects
 *     it into the LLM prompt so generated messages target within the cap
 *   - SMS Settings API (`/api/sms-settings`) — powers the settings UI
 *   - Future SMS sending layer (Task #45) — enforces maxCharCap strictly
 *     before handing messages to the carrier API to prevent accidentally
 *     blowing up the SMS bill
 *
 * Document path: `organizations/{PLATFORM_ID}/settings/sms`
 * Promise-based read-through cache (30s TTL, race-safe).
 *
 * Default config: maxCharCap=480 (3 SMS segments), requireComplianceFooter=true,
 * complianceRegion=US, defaultSenderId and defaultShortenerDomain empty strings.
 * Run scripts/seed-sms-settings.js to create the default doc.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { SmsSettings, UpdateSmsSettingsInput } from '@/types/sms-settings';

const FILE = 'sms-settings-service.ts';
const COLLECTION = getSubCollection('settings');
const DOC_ID = 'sms';
const CACHE_TTL_MS = 30_000;

function getDb() {
  if (!adminDb) { throw new Error('Firebase Admin not initialized'); }
  return adminDb;
}

const DEFAULT_SETTINGS: SmsSettings = {
  maxCharCap: 480,
  defaultSenderId: '',
  complianceRegion: 'US',
  requireComplianceFooter: true,
  defaultShortenerDomain: '',
  updatedAt: new Date(0).toISOString(),
  updatedBy: 'system',
};

interface CacheEntry {
  promise: Promise<SmsSettings>;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

function invalidateCache(): void {
  cache = null;
}

interface SmsSettingsDoc {
  maxCharCap?: number;
  defaultSenderId?: string;
  complianceRegion?: SmsSettings['complianceRegion'];
  requireComplianceFooter?: boolean;
  defaultShortenerDomain?: string;
  updatedAt?: string | { toDate(): Date };
  updatedBy?: string;
}

function docToSettings(data: SmsSettingsDoc | undefined): SmsSettings {
  if (!data) { return { ...DEFAULT_SETTINGS }; }
  const updatedAt = typeof data.updatedAt === 'string'
    ? data.updatedAt
    : typeof data.updatedAt === 'object' && data.updatedAt && 'toDate' in data.updatedAt
      ? data.updatedAt.toDate().toISOString()
      : DEFAULT_SETTINGS.updatedAt;
  return {
    maxCharCap: typeof data.maxCharCap === 'number' && data.maxCharCap > 0 ? data.maxCharCap : DEFAULT_SETTINGS.maxCharCap,
    defaultSenderId: data.defaultSenderId ?? DEFAULT_SETTINGS.defaultSenderId,
    complianceRegion: data.complianceRegion ?? DEFAULT_SETTINGS.complianceRegion,
    requireComplianceFooter: typeof data.requireComplianceFooter === 'boolean' ? data.requireComplianceFooter : DEFAULT_SETTINGS.requireComplianceFooter,
    defaultShortenerDomain: data.defaultShortenerDomain ?? DEFAULT_SETTINGS.defaultShortenerDomain,
    updatedAt,
    updatedBy: data.updatedBy ?? DEFAULT_SETTINGS.updatedBy,
  };
}

/**
 * Load the current SMS settings from Firestore (with cache). If the
 * settings doc does not exist, returns the default config without
 * writing anything — the seed script is the source of truth for
 * creating the doc on first run.
 */
export async function getSmsSettings(): Promise<SmsSettings> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.promise;
  }

  const promise = (async (): Promise<SmsSettings> => {
    const ref = getDb().collection(COLLECTION).doc(DOC_ID);
    const snap = await ref.get();
    if (!snap.exists) {
      logger.warn('[SmsSettings] No settings doc found — returning defaults. Run scripts/seed-sms-settings.js to create one.', { file: FILE });
      return { ...DEFAULT_SETTINGS };
    }
    return docToSettings(snap.data() as SmsSettingsDoc);
  })();

  cache = { promise, expiresAt: now + CACHE_TTL_MS };

  try {
    return await promise;
  } catch (error) {
    cache = null;
    throw error;
  }
}

/**
 * Update the SMS settings doc. Only provided fields are updated — unset
 * fields are preserved. Invalidates the cache so the next read picks up
 * the change immediately.
 */
export async function updateSmsSettings(
  input: UpdateSmsSettingsInput,
  updatedBy: string,
): Promise<SmsSettings> {
  const update: Partial<SmsSettingsDoc> = {
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  if (typeof input.maxCharCap === 'number' && input.maxCharCap >= 160 && input.maxCharCap <= 1600) {
    update.maxCharCap = input.maxCharCap;
  }
  if (typeof input.defaultSenderId === 'string') {
    update.defaultSenderId = input.defaultSenderId.trim().slice(0, 20);
  }
  if (typeof input.complianceRegion === 'string') {
    update.complianceRegion = input.complianceRegion;
  }
  if (typeof input.requireComplianceFooter === 'boolean') {
    update.requireComplianceFooter = input.requireComplianceFooter;
  }
  if (typeof input.defaultShortenerDomain === 'string') {
    update.defaultShortenerDomain = input.defaultShortenerDomain.trim().slice(0, 80);
  }

  const ref = getDb().collection(COLLECTION).doc(DOC_ID);
  await ref.set(update, { merge: true });
  invalidateCache();

  const refreshed = await ref.get();
  const result = docToSettings(refreshed.data() as SmsSettingsDoc);
  logger.info('[SmsSettings] updated', { updatedBy, fields: Object.keys(update), file: FILE });
  return result;
}

export const __internal = {
  invalidateCache,
  COLLECTION,
  DOC_ID,
  DEFAULT_SETTINGS,
};
