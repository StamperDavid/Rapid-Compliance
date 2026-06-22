/**
 * Media Library Service — Admin SDK only.
 *
 * Server-side single source of truth for media CRUD. Every API route + every
 * specialist that reads/writes media MUST go through this service so that
 * the canonical `UnifiedMediaAsset` shape is enforced.
 *
 * Per `feedback_server_routes_must_use_admin_sdk`: never call this from a
 * client component, and never substitute the client SDK on the server.
 *
 * Doc path: organizations/{PLATFORM_ID}/media/{id}
 */

import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  MediaAssetCategory,
  MediaAssetSource,
  MediaAssetType,
  MediaCreateInput,
  MediaListFilters,
  MediaUpdateInput,
  UnifiedMediaAsset,
} from '@/types/media-library';

const COLLECTION = getSubCollection('media');
const FILE = 'lib/media/media-library-service.ts';

// ============================================================================
// Internal Firestore document shape (timestamps may be Date | string | Timestamp)
// ============================================================================

interface FirestoreTimestampLike {
  toDate(): Date;
}

function isFirestoreTimestamp(v: unknown): v is FirestoreTimestampLike {
  return (
    typeof v === 'object' &&
    v !== null &&
    'toDate' in v &&
    typeof (v as { toDate: unknown }).toDate === 'function'
  );
}

function toIsoString(v: unknown): string {
  if (typeof v === 'string') {
    return v;
  }
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (isFirestoreTimestamp(v)) {
    return v.toDate().toISOString();
  }
  return new Date().toISOString();
}

interface MediaDocData {
  type?: MediaAssetType;
  category?: MediaAssetCategory;
  tags?: string[];
  name?: string;
  description?: string;
  intendedUse?: string;
  url?: string;
  thumbnailUrl?: string | null;
  mimeType?: string;
  fileSize?: number;
  duration?: number | null;
  dimensions?: { width: number; height: number } | null;
  source?: MediaAssetSource;
  aiProvider?: string;
  aiPrompt?: string;
  parentAssetId?: string;
  derivedFrom?: string[];
  usedInPosts?: string[];
  characterId?: string;
  characterName?: string;
  projectId?: string;
  projectName?: string;
  folderId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  brandDnaApplied?: boolean;
  processingState?: 'pending' | 'processing' | 'ready' | 'failed';
  aiGenerationId?: string;
}

function ensureAdminDb(): NonNullable<typeof adminDb> {
  if (!adminDb) {
    throw new Error(
      'Admin Firestore not initialized — Media Library Service cannot run.',
    );
  }
  return adminDb;
}

function rowToAsset(id: string, data: MediaDocData): UnifiedMediaAsset {
  return {
    id,
    type: data.type ?? 'image',
    category: data.category ?? 'other',
    tags: Array.isArray(data.tags) ? data.tags : [],
    name: data.name ?? '',
    ...(data.description ? { description: data.description } : {}),
    ...(data.intendedUse ? { intendedUse: data.intendedUse } : {}),
    url: data.url ?? '',
    ...(data.thumbnailUrl ? { thumbnailUrl: data.thumbnailUrl } : {}),
    mimeType: data.mimeType ?? 'application/octet-stream',
    fileSize: typeof data.fileSize === 'number' ? data.fileSize : 0,
    ...(typeof data.duration === 'number' ? { duration: data.duration } : {}),
    ...(data.dimensions ? { dimensions: data.dimensions } : {}),
    source: data.source ?? 'imported',
    ...(data.aiProvider ? { aiProvider: data.aiProvider } : {}),
    ...(data.aiPrompt ? { aiPrompt: data.aiPrompt } : {}),
    ...(data.parentAssetId ? { parentAssetId: data.parentAssetId } : {}),
    ...(Array.isArray(data.derivedFrom) ? { derivedFrom: data.derivedFrom } : {}),
    ...(Array.isArray(data.usedInPosts) ? { usedInPosts: data.usedInPosts } : {}),
    ...(data.characterId ? { characterId: data.characterId } : {}),
    ...(data.characterName ? { characterName: data.characterName } : {}),
    ...(data.projectId ? { projectId: data.projectId } : {}),
    ...(data.projectName ? { projectName: data.projectName } : {}),
    ...(data.folderId ? { folderId: data.folderId } : {}),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
    createdBy: data.createdBy ?? 'unknown',
    brandDnaApplied: data.brandDnaApplied === true,
    ...(data.processingState ? { processingState: data.processingState } : {}),
    ...(data.aiGenerationId ? { aiGenerationId: data.aiGenerationId } : {}),
  };
}

function applyClientSideFilters(
  assets: UnifiedMediaAsset[],
  filters: MediaListFilters,
): UnifiedMediaAsset[] {
  let result = assets;
  // Character images LIVE WITH their character in the Character Library — they must
  // never appear in the general media library. Exclude category 'character' UNLESS
  // the caller explicitly asked for character assets (by category or by characterId,
  // e.g. the Character Library itself). This is the read-side of "characters own
  // their images": every image generated for a character is tagged category
  // 'character' + characterId, so it's tied to the character and kept out of here.
  const wantsCharacters = filters.category === 'character' || Boolean(filters.characterId);
  if (!wantsCharacters) {
    result = result.filter((a) => a.category !== 'character');
  }
  // "Unfiled" root: assets not filed under any library folder. (Firestore can't
  // query for an absent field cheaply, so it's an in-memory filter.)
  if (filters.unfiledOnly) {
    result = result.filter((a) => !a.folderId);
  }
  if (filters.tags && filters.tags.length > 0) {
    const wanted = new Set(filters.tags.map((t) => t.toLowerCase()));
    result = result.filter((a) =>
      a.tags.some((tag) => wanted.has(tag.toLowerCase())),
    );
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description?.toLowerCase().includes(q) ?? false) ||
        (a.intendedUse?.toLowerCase().includes(q) ?? false) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        (a.aiPrompt?.toLowerCase().includes(q) ?? false),
    );
  }
  if (filters.createdAfter) {
    const lower = filters.createdAfter;
    result = result.filter((a) => a.createdAt >= lower);
  }
  if (filters.createdBefore) {
    const upper = filters.createdBefore;
    result = result.filter((a) => a.createdAt <= upper);
  }
  return result;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List assets with filters. Equality filters (type, category, source) are
 * applied at the Firestore layer; tag-array, free-text search, and date
 * ranges are applied in memory because Firestore can't combine
 * `array-contains` with multiple equality filters without a composite
 * index per combination.
 */
export async function listAssets(
  filters: MediaListFilters = {},
): Promise<{ assets: UnifiedMediaAsset[]; total: number }> {
  const db = ensureAdminDb();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  let query: FirebaseFirestore.Query = db.collection(COLLECTION);
  if (filters.type) {
    query = query.where('type', '==', filters.type);
  }
  if (filters.category) {
    query = query.where('category', '==', filters.category);
  }
  if (filters.source) {
    query = query.where('source', '==', filters.source);
  }
  if (filters.characterId) {
    query = query.where('characterId', '==', filters.characterId);
  }
  if (filters.projectId) {
    query = query.where('projectId', '==', filters.projectId);
  }
  if (filters.folderId) {
    query = query.where('folderId', '==', filters.folderId);
  }

  let snapshot: FirebaseFirestore.QuerySnapshot;
  try {
    snapshot = await query.orderBy('createdAt', 'desc').get();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (
      msg.includes('FAILED_PRECONDITION') ||
      msg.includes('requires an index')
    ) {
      logger.warn(
        'Media query missing composite index — falling back to unordered scan',
        { file: FILE },
      );
      snapshot = await query.get();
    } else {
      throw err;
    }
  }

  const all = snapshot.docs.map((doc) =>
    rowToAsset(doc.id, doc.data() as MediaDocData),
  );

  const filtered = applyClientSideFilters(all, filters);
  // Re-sort defensively — fallback path may have lost ordering.
  filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const page = filtered.slice(offset, offset + limit);

  return { assets: page, total: filtered.length };
}

export async function getAsset(id: string): Promise<UnifiedMediaAsset | null> {
  if (!id) {
    return null;
  }
  const data = await AdminFirestoreService.get<MediaDocData & { id: string }>(
    COLLECTION,
    id,
  );
  if (!data) {
    return null;
  }
  return rowToAsset(id, data);
}

export async function createAsset(
  input: MediaCreateInput,
): Promise<UnifiedMediaAsset> {
  const db = ensureAdminDb();
  const docRef = db.collection(COLLECTION).doc();
  const now = new Date();

  // Auto-file: an asset generated for a video project (has projectId, no explicit
  // folder) lands in that project's folder, which is created on first use — so
  // project folders fill themselves. Best-effort: a folder failure never blocks the
  // asset write. Character assets (own their own library section) are left unfiled.
  let folderId = input.folderId;
  if (!folderId && input.projectId && input.category !== 'character') {
    try {
      const { getOrCreateProjectFolder } = await import('@/lib/media/media-folders-service');
      folderId = await getOrCreateProjectFolder(input.projectId, input.projectName ?? 'Project');
    } catch (err) {
      logger.warn('Auto-file to project folder failed (asset will be unfiled)', {
        file: FILE,
        projectId: input.projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const record: UnifiedMediaAsset = {
    id: docRef.id,
    type: input.type,
    category: input.category,
    tags: input.tags ?? [],
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ...(input.intendedUse ? { intendedUse: input.intendedUse } : {}),
    url: input.url,
    ...(input.thumbnailUrl ? { thumbnailUrl: input.thumbnailUrl } : {}),
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    ...(typeof input.duration === 'number' ? { duration: input.duration } : {}),
    ...(input.dimensions ? { dimensions: input.dimensions } : {}),
    source: input.source,
    ...(input.aiProvider ? { aiProvider: input.aiProvider } : {}),
    ...(input.aiPrompt ? { aiPrompt: input.aiPrompt } : {}),
    ...(input.parentAssetId ? { parentAssetId: input.parentAssetId } : {}),
    ...(input.derivedFrom ? { derivedFrom: input.derivedFrom } : {}),
    ...(input.usedInPosts ? { usedInPosts: input.usedInPosts } : {}),
    ...(input.characterId ? { characterId: input.characterId } : {}),
    ...(input.characterName ? { characterName: input.characterName } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.projectName ? { projectName: input.projectName } : {}),
    ...(folderId ? { folderId } : {}),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: input.createdBy,
    brandDnaApplied: input.brandDnaApplied === true,
  };

  await AdminFirestoreService.set<UnifiedMediaAsset>(
    COLLECTION,
    docRef.id,
    record,
  );

  logger.info('Media asset created', {
    file: FILE,
    id: docRef.id,
    type: record.type,
    category: record.category,
    source: record.source,
  });

  return record;
}

export async function updateAsset(
  id: string,
  patch: MediaUpdateInput,
): Promise<UnifiedMediaAsset | null> {
  const existing = await getAsset(id);
  if (!existing) {
    return null;
  }

  const updates: Record<string, unknown> = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  // Never let the patch overwrite identity / audit fields.
  delete updates.id;
  delete updates.createdAt;
  delete updates.createdBy;

  await AdminFirestoreService.update(COLLECTION, id, updates);

  logger.info('Media asset updated', {
    file: FILE,
    id,
    fields: Object.keys(patch),
  });

  const refreshed = await getAsset(id);
  return refreshed;
}

export async function deleteAsset(id: string): Promise<boolean> {
  const existing = await getAsset(id);
  if (!existing) {
    return false;
  }
  await AdminFirestoreService.delete(COLLECTION, id);
  logger.info('Media asset deleted', { file: FILE, id });
  return true;
}

/**
 * File an asset into a library folder, or move it to Unfiled (pass null — which
 * DELETES the field so the asset disappears from every folder). Uses a direct
 * Admin update because clearing a field needs FieldValue.delete(), which the typed
 * `updateAsset` path can't express. Returns the refreshed asset, or null if missing.
 */
export async function setAssetFolder(
  id: string,
  folderId: string | null,
): Promise<UnifiedMediaAsset | null> {
  const db = ensureAdminDb();
  const existing = await getAsset(id);
  if (!existing) {
    return null;
  }
  await db.collection(COLLECTION).doc(id).update(
    folderId
      ? { folderId, updatedAt: new Date().toISOString() }
      : { folderId: FieldValue.delete(), updatedAt: new Date().toISOString() },
  );
  logger.info('Media asset folder set', { file: FILE, id, folderId: folderId ?? 'unfiled' });
  return getAsset(id);
}

/**
 * "Move" regular-library images onto a character: remove the general-library
 * records for these image URLs so they no longer pollute the media browse. The
 * underlying Storage files are NOT touched — the character now references the same
 * URLs (this mirrors the single-image `moveImageToCharacter` move, applied at
 * character-creation time so library images don't get left behind as duplicates).
 *
 * SCOPED FOR SAFETY: records already in the character section (category
 * 'character') are skipped, so AI-generated character sheets are never deleted.
 * URLs with no matching library record are ignored. Returns the count removed.
 */
export async function removeLibraryRecordsByUrls(urls: string[]): Promise<number> {
  const db = ensureAdminDb();
  const unique = Array.from(
    new Set(urls.filter((u): u is string => typeof u === 'string' && u.length > 0)),
  );
  let removed = 0;
  for (const url of unique) {
    const snap = await db.collection(COLLECTION).where('url', '==', url).get();
    for (const doc of snap.docs) {
      if (doc.get('category') === 'character') {
        continue; // never delete the character section's own sheets
      }
      await doc.ref.delete();
      removed += 1;
      logger.info('Library image moved onto character (record removed)', {
        file: FILE,
        id: doc.id,
      });
    }
  }
  return removed;
}

/**
 * Replace the asset's tag list. Use this instead of `updateAsset({ tags })`
 * when the call site only cares about tags — keeps the audit log readable
 * and gives us a single hook point if tag normalization (lowercase / dedup)
 * lands later.
 */
export async function tagAsset(
  id: string,
  tags: string[],
): Promise<UnifiedMediaAsset | null> {
  const normalized = Array.from(
    new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0)),
  );
  return updateAsset(id, { tags: normalized });
}

// Re-export the canonical type so call sites can import service + type
// from the same module if they prefer.
export type { UnifiedMediaAsset };
