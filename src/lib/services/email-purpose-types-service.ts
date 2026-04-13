/**
 * Email Purpose Types Service
 *
 * Server-side service for reading and mutating the Firestore-backed email
 * purpose taxonomy. Used by:
 *   - Email Specialist (Task #43) — loads active types at runtime and
 *     injects them into the LLM prompt as the valid enum list
 *   - Email Purpose Types API (`/api/email-purpose-types`) — powers the
 *     UI combobox and inline create-new-type flow
 *   - Campaign creation flow (Task #43b) — reads the list for the type
 *     selector, increments usageCount when a campaign uses a type
 *
 * Design notes:
 * - Collection path: `organizations/{PLATFORM_ID}/emailPurposeTypes`
 * - Document id = slug (stable, readable in Firestore console)
 * - Short in-memory cache (30 seconds) to avoid refetching on every
 *   Email Specialist invocation while still picking up UI-created types
 *   within seconds
 * - Slug normalization is deterministic (lowercase, snake_case, stripped
 *   of non-alphanumerics) so two callers creating the same display name
 *   collide on the same id — duplicates become idempotent upserts
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  EmailPurposeType,
  CreateEmailPurposeTypeInput,
} from '@/types/email-purpose-types';

const FILE = 'email-purpose-types-service.ts';
const COLLECTION = getSubCollection('emailPurposeTypes');
const CACHE_TTL_MS = 30_000; // 30 seconds

function getDb() {
  if (!adminDb) { throw new Error('Firebase Admin not initialized'); }
  return adminDb;
}

// ============================================================================
// IN-MEMORY CACHE (promise-based, race-safe)
// ============================================================================
//
// We store the in-flight Promise rather than the resolved value. That way
// two concurrent callers during cache miss share the same Firestore query
// (single request goes out, both callers await the same promise) and no
// read-then-write interleaving can create a stale state. The promise is
// kept until its TTL expires; on expiry the next caller kicks off a fresh
// fetch.

interface CacheEntry {
  promise: Promise<EmailPurposeType[]>;
  expiresAt: number;
}

let activeTypesCache: CacheEntry | null = null;

function invalidateCache(): void {
  activeTypesCache = null;
}

// ============================================================================
// SLUG NORMALIZATION
// ============================================================================

/**
 * Convert a display name to a stable snake_case slug.
 * "Win-Back After Churn!" -> "win_back_after_churn"
 */
export function slugifyEmailPurposeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

// ============================================================================
// FIRESTORE DOCUMENT SHAPE
// ============================================================================

interface FirestoreTimestamp {
  toDate(): Date;
}

interface EmailPurposeTypeDoc {
  name: string;
  slug: string;
  description: string;
  active: boolean;
  usageCount: number;
  lastUsedAt: FirestoreTimestamp | string | null;
  createdAt: FirestoreTimestamp | string;
  createdBy: string;
}

function docToType(id: string, data: EmailPurposeTypeDoc): EmailPurposeType {
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

// ============================================================================
// READ: LIST ACTIVE TYPES (used by the Email Specialist at runtime)
// ============================================================================

/**
 * Return the list of currently-active email purpose types, sorted by
 * usageCount descending (most-used float to the top).
 *
 * Short in-memory cache keeps the Email Specialist from hammering
 * Firestore on every invocation while still picking up new UI-created
 * types within ~30 seconds.
 */
export async function getActiveEmailPurposeTypes(): Promise<EmailPurposeType[]> {
  const now = Date.now();
  if (activeTypesCache && activeTypesCache.expiresAt > now) {
    return activeTypesCache.promise;
  }

  const promise = (async (): Promise<EmailPurposeType[]> => {
    const snapshot = await getDb()
      .collection(COLLECTION)
      .where('active', '==', true)
      .get();

    return snapshot.docs
      .map((doc) => docToType(doc.id, doc.data() as EmailPurposeTypeDoc))
      .sort((a, b) => b.usageCount - a.usageCount);
  })();

  activeTypesCache = {
    promise,
    expiresAt: now + CACHE_TTL_MS,
  };

  try {
    return await promise;
  } catch (error) {
    // On failure, evict so the next caller retries instead of re-throwing
    // the cached rejection forever.
    activeTypesCache = null;
    throw error;
  }
}

// ============================================================================
// READ: LIST ALL TYPES (UI admin view — includes archived)
// ============================================================================

export async function listAllEmailPurposeTypes(): Promise<EmailPurposeType[]> {
  const snapshot = await getDb().collection(COLLECTION).get();
  return snapshot.docs
    .map((doc) => docToType(doc.id, doc.data() as EmailPurposeTypeDoc))
    .sort((a, b) => {
      if (a.active !== b.active) { return a.active ? -1 : 1; }
      return b.usageCount - a.usageCount;
    });
}

// ============================================================================
// READ: SINGLE TYPE
// ============================================================================

export async function getEmailPurposeTypeBySlug(slug: string): Promise<EmailPurposeType | null> {
  const doc = await getDb().collection(COLLECTION).doc(slug).get();
  if (!doc.exists) { return null; }
  return docToType(doc.id, doc.data() as EmailPurposeTypeDoc);
}

// ============================================================================
// WRITE: CREATE NEW TYPE (from UI inline-create flow or Jasper)
// ============================================================================

/**
 * Create a new email purpose type. Idempotent on slug collision — if a
 * type with the same slug already exists, the call returns the existing
 * one without overwriting it (so two users racing on the same type name
 * end up with a single document, not a mutation war).
 */
export async function createEmailPurposeType(
  input: CreateEmailPurposeTypeInput,
  createdBy: string,
): Promise<EmailPurposeType> {
  const slug = input.slug ? slugifyEmailPurposeName(input.slug) : slugifyEmailPurposeName(input.name);
  if (slug.length === 0) {
    throw new Error('Email purpose type slug cannot be empty after normalization');
  }

  const ref = getDb().collection(COLLECTION).doc(slug);
  const existing = await ref.get();
  if (existing.exists) {
    const doc = docToType(existing.id, existing.data() as EmailPurposeTypeDoc);
    logger.info('[EmailPurposeTypes] create called on existing slug, returning existing doc', {
      slug,
      createdBy,
      file: FILE,
    });
    return doc;
  }

  const now = new Date();
  const record: EmailPurposeTypeDoc = {
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

  logger.info('[EmailPurposeTypes] created new type', {
    slug,
    name: record.name,
    createdBy,
    file: FILE,
  });

  return docToType(slug, record);
}

// ============================================================================
// WRITE: INCREMENT USAGE (called by the campaign creation flow)
// ============================================================================

/**
 * Atomically bump usageCount and refresh lastUsedAt. Called when a
 * campaign or send uses a type so the UI combobox sort order reflects
 * real activity.
 */
export async function incrementEmailPurposeTypeUsage(slug: string): Promise<void> {
  const { FieldValue } = await import('firebase-admin/firestore');
  const ref = getDb().collection(COLLECTION).doc(slug);
  await ref.update({
    usageCount: FieldValue.increment(1),
    lastUsedAt: new Date().toISOString(),
  });
  invalidateCache();
}

// ============================================================================
// WRITE: ARCHIVE / UNARCHIVE
// ============================================================================

/**
 * Soft-archive a type. Archived types remain in Firestore for historical
 * resolution but are hidden from the active list. Unarchive by passing
 * `active: true` through updateEmailPurposeType.
 */
export async function archiveEmailPurposeType(slug: string): Promise<void> {
  await getDb().collection(COLLECTION).doc(slug).update({ active: false });
  invalidateCache();
}

// ============================================================================
// WRITE: EDIT NAME / DESCRIPTION / ACTIVE FLAG (admin settings page)
// ============================================================================

export interface UpdateEmailPurposeTypeInput {
  name?: string;
  description?: string;
  active?: boolean;
}

export async function updateEmailPurposeType(
  slug: string,
  input: UpdateEmailPurposeTypeInput,
): Promise<EmailPurposeType | null> {
  const ref = getDb().collection(COLLECTION).doc(slug);
  const existing = await ref.get();
  if (!existing.exists) { return null; }

  const update: Partial<EmailPurposeTypeDoc> = {};
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
    return docToType(existing.id, existing.data() as EmailPurposeTypeDoc);
  }

  await ref.update(update);
  invalidateCache();

  const refreshed = await ref.get();
  return docToType(refreshed.id, refreshed.data() as EmailPurposeTypeDoc);
}

// ============================================================================
// CACHE MANAGEMENT (exported for tests)
// ============================================================================

export const __internal = {
  invalidateCache,
  COLLECTION,
};
