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

  const record: UnifiedMediaAsset = {
    id: docRef.id,
    type: input.type,
    category: input.category,
    tags: input.tags ?? [],
    name: input.name,
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
