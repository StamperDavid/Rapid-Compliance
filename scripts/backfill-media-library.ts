/**
 * Backfill — migrate legacy `media` records to the canonical
 * `UnifiedMediaAsset` shape.
 *
 * Background: before the unified rebuild, media records were stored with
 * shorter category names (`voice`, `music`, `clip`, ...) and without
 * `tags`, `source`, `brandDnaApplied`. The new
 * `src/lib/media/media-library-service.ts` reads the unified shape, so any
 * record missing these fields needs a one-shot upgrade.
 *
 * Idempotent: rerunning is safe — records already in the unified shape are
 * skipped untouched.
 *
 * Author runs this manually:
 *   npx ts-node scripts/backfill-media-library.ts
 *   (or via the project's existing tsx runner)
 *
 * The owner of this script is responsible for invoking it. No automatic
 * scheduling, no production cron.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

import {
  MEDIA_CATEGORIES,
  legacyCategoryToUnified,
  type MediaAssetCategory,
  type MediaAssetSource,
  type MediaAssetType,
  type MediaCategory,
  type UnifiedMediaAsset,
} from '../src/types/media-library';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) {
        process.env[m[1]] = v;
      }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) {
    return;
  }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(sakPath)) {
    throw new Error(
      'No serviceAccountKey.json — required for Firestore Admin access',
    );
  }
  const sa = JSON.parse(
    fs.readFileSync(sakPath, 'utf-8'),
  ) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const db = admin.firestore();
const mediaCollection = db.collection(
  `organizations/${PLATFORM_ID}/media`,
);

// ---------------------------------------------------------------------------
// Field inference helpers
// ---------------------------------------------------------------------------

const LEGACY_CATEGORIES: ReadonlySet<string> = new Set<MediaCategory>([
  'sound',
  'voice',
  'music',
  'photo',
  'graphic',
  'screenshot',
  'thumbnail',
  'clip',
  'final',
  'scene',
]);

const UNIFIED_CATEGORIES_SET: ReadonlySet<string> = new Set(MEDIA_CATEGORIES);

const ASSET_TYPES: ReadonlySet<string> = new Set<MediaAssetType>([
  'image',
  'video',
  'audio',
  'document',
]);

const ASSET_SOURCES: ReadonlySet<string> = new Set<MediaAssetSource>([
  'ai-generated',
  'user-upload',
  'imported',
  'derived',
]);

function inferTypeFromMime(mimeType: string | undefined): MediaAssetType {
  if (!mimeType) {
    return 'image';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('document') ||
    mimeType === 'text/plain'
  ) {
    return 'document';
  }
  return 'image';
}

function defaultCategoryForType(type: MediaAssetType): MediaAssetCategory {
  switch (type) {
    case 'audio':
      return 'sound';
    case 'video':
      return 'video-clip';
    case 'document':
      return 'other';
    case 'image':
    default:
      return 'photo';
  }
}

function normalizeCategory(
  rawCategory: unknown,
  type: MediaAssetType,
): MediaAssetCategory {
  if (typeof rawCategory === 'string' && rawCategory.length > 0) {
    if (UNIFIED_CATEGORIES_SET.has(rawCategory)) {
      return rawCategory as MediaAssetCategory;
    }
    if (LEGACY_CATEGORIES.has(rawCategory)) {
      return legacyCategoryToUnified(rawCategory as MediaCategory);
    }
  }
  return defaultCategoryForType(type);
}

function toIso(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Per-record migration
// ---------------------------------------------------------------------------

interface BackfillStats {
  totalRead: number;
  alreadyUnified: number;
  upgraded: number;
  errored: number;
}

interface RawMediaDoc {
  id: string;
  type?: unknown;
  category?: unknown;
  tags?: unknown;
  name?: unknown;
  url?: unknown;
  thumbnailUrl?: unknown;
  mimeType?: unknown;
  fileSize?: unknown;
  duration?: unknown;
  dimensions?: unknown;
  source?: unknown;
  aiProvider?: unknown;
  aiPrompt?: unknown;
  parentAssetId?: unknown;
  derivedFrom?: unknown;
  usedInPosts?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: unknown;
  brandDnaApplied?: unknown;
  metadata?: unknown;
}

function isAlreadyUnified(doc: RawMediaDoc): boolean {
  // A record is "already unified" if it has tags as array, source as a
  // valid enum, brandDnaApplied as boolean, AND its category is in the
  // unified set.
  if (!Array.isArray(doc.tags)) {
    return false;
  }
  if (typeof doc.source !== 'string' || !ASSET_SOURCES.has(doc.source)) {
    return false;
  }
  if (typeof doc.brandDnaApplied !== 'boolean') {
    return false;
  }
  if (
    typeof doc.category !== 'string' ||
    !UNIFIED_CATEGORIES_SET.has(doc.category)
  ) {
    return false;
  }
  if (
    typeof doc.type !== 'string' ||
    !ASSET_TYPES.has(doc.type)
  ) {
    return false;
  }
  return true;
}

function buildUpgradedRecord(doc: RawMediaDoc): UnifiedMediaAsset {
  const mimeType =
    typeof doc.mimeType === 'string' && doc.mimeType.length > 0
      ? doc.mimeType
      : 'application/octet-stream';

  const type: MediaAssetType =
    typeof doc.type === 'string' && ASSET_TYPES.has(doc.type)
      ? (doc.type as MediaAssetType)
      : inferTypeFromMime(mimeType);

  const category: MediaAssetCategory = normalizeCategory(doc.category, type);

  const source: MediaAssetSource =
    typeof doc.source === 'string' && ASSET_SOURCES.has(doc.source)
      ? (doc.source as MediaAssetSource)
      : 'imported';

  const tags: string[] = Array.isArray(doc.tags)
    ? (doc.tags as unknown[]).filter((t): t is string => typeof t === 'string')
    : [];

  const fileSize =
    typeof doc.fileSize === 'number' && doc.fileSize >= 0 ? doc.fileSize : 0;

  const upgraded: UnifiedMediaAsset = {
    id: doc.id,
    type,
    category,
    tags,
    name: typeof doc.name === 'string' && doc.name.length > 0 ? doc.name : 'Untitled',
    url: typeof doc.url === 'string' ? doc.url : '',
    mimeType,
    fileSize,
    source,
    createdAt: toIso(doc.createdAt),
    updatedAt: new Date().toISOString(),
    createdBy: typeof doc.createdBy === 'string' ? doc.createdBy : 'unknown',
    brandDnaApplied: doc.brandDnaApplied === true,
  };

  if (typeof doc.thumbnailUrl === 'string' && doc.thumbnailUrl.length > 0) {
    upgraded.thumbnailUrl = doc.thumbnailUrl;
  }
  if (typeof doc.duration === 'number' && doc.duration > 0) {
    upgraded.duration = doc.duration;
  }
  if (
    doc.dimensions &&
    typeof doc.dimensions === 'object' &&
    'width' in doc.dimensions &&
    'height' in doc.dimensions
  ) {
    const dims = doc.dimensions as { width: unknown; height: unknown };
    if (typeof dims.width === 'number' && typeof dims.height === 'number') {
      upgraded.dimensions = { width: dims.width, height: dims.height };
    }
  }
  if (typeof doc.aiProvider === 'string' && doc.aiProvider.length > 0) {
    upgraded.aiProvider = doc.aiProvider;
    if (upgraded.source === 'imported') {
      upgraded.source = 'ai-generated';
    }
  }
  if (typeof doc.aiPrompt === 'string' && doc.aiPrompt.length > 0) {
    upgraded.aiPrompt = doc.aiPrompt;
    if (upgraded.source === 'imported') {
      upgraded.source = 'ai-generated';
    }
  }
  if (typeof doc.parentAssetId === 'string' && doc.parentAssetId.length > 0) {
    upgraded.parentAssetId = doc.parentAssetId;
  }
  if (Array.isArray(doc.derivedFrom)) {
    upgraded.derivedFrom = (doc.derivedFrom as unknown[]).filter(
      (v): v is string => typeof v === 'string',
    );
  }
  if (Array.isArray(doc.usedInPosts)) {
    upgraded.usedInPosts = (doc.usedInPosts as unknown[]).filter(
      (v): v is string => typeof v === 'string',
    );
  }

  return upgraded;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('--- Media Library Backfill ---');
  console.log(`Reading: organizations/${PLATFORM_ID}/media`);

  const stats: BackfillStats = {
    totalRead: 0,
    alreadyUnified: 0,
    upgraded: 0,
    errored: 0,
  };

  const snapshot = await mediaCollection.get();
  stats.totalRead = snapshot.size;
  console.log(`Found ${stats.totalRead} records.`);

  const writer = db.bulkWriter();

  for (const docSnap of snapshot.docs) {
    try {
      const data = docSnap.data() as Omit<RawMediaDoc, 'id'>;
      const raw: RawMediaDoc = { id: docSnap.id, ...data };

      if (isAlreadyUnified(raw)) {
        stats.alreadyUnified++;
        continue;
      }

      const upgraded = buildUpgradedRecord(raw);

      // Use set with merge:false so the doc is fully canonical going forward.
      // The legacy `metadata` field is intentionally NOT carried over —
      // unified shape stores its info in tags / aiProvider / aiPrompt.
      writer.set(docSnap.ref, upgraded);
      stats.upgraded++;
      console.log(
        `  upgraded ${docSnap.id} (type=${upgraded.type}, category=${upgraded.category}, source=${upgraded.source})`,
      );
    } catch (err) {
      stats.errored++;
      console.error(
        `  FAILED to upgrade ${docSnap.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  await writer.close();

  console.log('--- Done ---');
  console.log(`Total read:       ${stats.totalRead}`);
  console.log(`Already unified:  ${stats.alreadyUnified}`);
  console.log(`Upgraded:         ${stats.upgraded}`);
  console.log(`Errored:          ${stats.errored}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill crashed:', err);
    process.exit(1);
  });
