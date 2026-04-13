/**
 * SMS Purpose Types Service
 *
 * Server-side service for reading and mutating the Firestore-backed SMS
 * purpose taxonomy. Parallel to email-purpose-types-service — intentionally
 * separate collection because SMS and email purposes have different use-case
 * profiles (SMS has shipping_update, appointment_reminder, etc.; email has
 * case_study, nurture, etc.).
 *
 * Used by:
 *   - SMS Specialist (Task #44) — loads active types at runtime and
 *     injects them into the LLM prompt as the valid enum list
 *   - SMS Purpose Types API (`/api/sms-purpose-types`) — powers the
 *     UI combobox and inline create-new-type flow
 *   - Campaign creation flow — reads the list for the type selector,
 *     increments usageCount when a campaign uses a type
 *
 * Collection path: `organizations/{PLATFORM_ID}/smsPurposeTypes`
 * Document id = slug. Promise-based read-through cache (30s TTL, race-safe).
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  SmsPurposeType,
  CreateSmsPurposeTypeInput,
} from '@/types/sms-purpose-types';

const FILE = 'sms-purpose-types-service.ts';
const COLLECTION = getSubCollection('smsPurposeTypes');
const CACHE_TTL_MS = 30_000;

function getDb() {
  if (!adminDb) { throw new Error('Firebase Admin not initialized'); }
  return adminDb;
}

interface CacheEntry {
  promise: Promise<SmsPurposeType[]>;
  expiresAt: number;
}

let activeTypesCache: CacheEntry | null = null;

function invalidateCache(): void {
  activeTypesCache = null;
}

export function slugifySmsPurposeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

interface FirestoreTimestamp {
  toDate(): Date;
}

interface SmsPurposeTypeDoc {
  name: string;
  slug: string;
  description: string;
  active: boolean;
  usageCount: number;
  lastUsedAt: FirestoreTimestamp | string | null;
  createdAt: FirestoreTimestamp | string;
  createdBy: string;
}

function docToType(id: string, data: SmsPurposeTypeDoc): SmsPurposeType {
  const toIso = (v: FirestoreTimestamp | string | null): string | null => {
    if (v === null) { return null; }
    if (typeof v === 'string') { return v; }
    if (typeof v === 'object' && 'toDate' in v && typeof v.toDate === 'function') {
      return v.toDate().toISOString();
    }
    return null;
  };

  return {
    id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    active: data.active,
    usageCount: data.usageCount ?? 0,
    lastUsedAt: toIso(data.lastUsedAt),
    createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
    createdBy: data.createdBy,
  };
}

export async function getActiveSmsPurposeTypes(): Promise<SmsPurposeType[]> {
  const now = Date.now();
  if (activeTypesCache && activeTypesCache.expiresAt > now) {
    return activeTypesCache.promise;
  }

  const promise = (async (): Promise<SmsPurposeType[]> => {
    const snapshot = await getDb()
      .collection(COLLECTION)
      .where('active', '==', true)
      .get();

    return snapshot.docs
      .map((doc) => docToType(doc.id, doc.data() as SmsPurposeTypeDoc))
      .sort((a, b) => b.usageCount - a.usageCount);
  })();

  activeTypesCache = {
    promise,
    expiresAt: now + CACHE_TTL_MS,
  };

  try {
    return await promise;
  } catch (error) {
    activeTypesCache = null;
    throw error;
  }
}

export async function listAllSmsPurposeTypes(): Promise<SmsPurposeType[]> {
  const snapshot = await getDb().collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => docToType(doc.id, doc.data() as SmsPurposeTypeDoc))
    .sort((a, b) => {
      if (a.active !== b.active) { return a.active ? -1 : 1; }
      return b.usageCount - a.usageCount;
    });
}

export async function getSmsPurposeTypeBySlug(slug: string): Promise<SmsPurposeType | null> {
  const doc = await getDb().collection(COLLECTION).doc(slug).get();
  if (!doc.exists) { return null; }
  return docToType(doc.id, doc.data() as SmsPurposeTypeDoc);
}

export async function createSmsPurposeType(
  input: CreateSmsPurposeTypeInput,
  createdBy: string,
): Promise<SmsPurposeType> {
  const slug = input.slug ? slugifySmsPurposeName(input.slug) : slugifySmsPurposeName(input.name);
  if (slug.length === 0) {
    throw new Error('SMS purpose type slug cannot be empty after normalization');
  }

  const ref = getDb().collection(COLLECTION).doc(slug);
  const existing = await ref.get();
  if (existing.exists) {
    const doc = docToType(existing.id, existing.data() as SmsPurposeTypeDoc);
    logger.info('[SmsPurposeTypes] create called on existing slug, returning existing doc', {
      slug,
      createdBy,
      file: FILE,
    });
    return doc;
  }

  const now = new Date();
  const record: SmsPurposeTypeDoc = {
    name: input.name.trim().slice(0, 80),
    slug,
    description: input.description.trim().slice(0, 300),
    active: true,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: now.toISOString(),
    createdBy,
  };

  await ref.set(record);
  invalidateCache();

  logger.info('[SmsPurposeTypes] created new type', {
    slug,
    name: record.name,
    createdBy,
    file: FILE,
  });

  return docToType(slug, record);
}

export async function incrementSmsPurposeTypeUsage(slug: string): Promise<void> {
  const { FieldValue } = await import('firebase-admin/firestore');
  const ref = getDb().collection(COLLECTION).doc(slug);
  await ref.update({
    usageCount: FieldValue.increment(1),
    lastUsedAt: new Date().toISOString(),
  });
  invalidateCache();
}

export async function archiveSmsPurposeType(slug: string): Promise<void> {
  await getDb().collection(COLLECTION).doc(slug).update({ active: false });
  invalidateCache();
}

export interface UpdateSmsPurposeTypeInput {
  name?: string;
  description?: string;
  active?: boolean;
}

export async function updateSmsPurposeType(
  slug: string,
  input: UpdateSmsPurposeTypeInput,
): Promise<SmsPurposeType | null> {
  const ref = getDb().collection(COLLECTION).doc(slug);
  const existing = await ref.get();
  if (!existing.exists) { return null; }

  const update: Partial<SmsPurposeTypeDoc> = {};
  if (typeof input.name === 'string' && input.name.trim().length > 0) {
    update.name = input.name.trim().slice(0, 80);
  }
  if (typeof input.description === 'string') {
    update.description = input.description.trim().slice(0, 300);
  }
  if (typeof input.active === 'boolean') {
    update.active = input.active;
  }

  if (Object.keys(update).length === 0) {
    return docToType(existing.id, existing.data() as SmsPurposeTypeDoc);
  }

  await ref.update(update);
  invalidateCache();

  const refreshed = await ref.get();
  return docToType(refreshed.id, refreshed.data() as SmsPurposeTypeDoc);
}

export const __internal = {
  invalidateCache,
  COLLECTION,
};
