/**
 * One-off recovery: restore media-library records that were deleted from the
 * Firestore `media` collection on Jun 11 2026. `deleteAsset` only removes the
 * Firestore doc — the actual files are still in Storage — so this rebuilds a
 * working record for each, pointing at the surviving file.
 *
 * The operator's typed names/descriptions/tags lived only in the deleted docs
 * and cannot be recovered; restored records use the filename as the name and a
 * `recovered` tag.
 *
 * Run check-only (default):  npx tsx scripts/restore-deleted-media-jun11.ts
 * Run for real:              npx tsx scripts/restore-deleted-media-jun11.ts --apply
 */

import { randomUUID } from 'node:crypto';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { firebaseDownloadUrl } from '@/lib/firebase/storage-utils';

// IDs captured from the dev-server DELETE log lines (the batch just removed).
const DELETED_IDS = [
  '7e8faf6e-cced-45f2-a2a1-a6165ef6b745',
  '9e5cdfec-a98d-45bb-bd49-c2bccf4cc3c8',
  '3a391fae-a4ff-44fd-b739-0f7995beedfd',
  'fd0a361f-06dc-4129-afb7-e9fc0d6a52bf',
  '4e701bbf-2dea-440f-ad93-779b65c71d64',
  'bef6be44-7ec6-4095-a660-53cee2293cf7',
  '835b6fac-05bb-4d5c-967a-9a83dc1bd728',
  '241be87d-7fcc-4920-8e89-ee0062b86916',
  '0b3b8bfb-5d74-43c7-9a66-3a816f2f01f6',
];

const APPLY = process.argv.includes('--apply');
const MEDIA_PREFIX = `organizations/${PLATFORM_ID}/media/`;

interface FoundFile {
  id: string;
  path: string;
  contentType: string;
  size: number;
  timeCreated: string;
  token: string;
}

async function main(): Promise<void> {
  if (!adminDb || !adminStorage) {
    throw new Error('Admin SDK not initialized — cannot run recovery.');
  }
  // The admin app in scripts has no default storageBucket configured, so name it
  // explicitly. This matches the bucket in the live media download URLs.
  const BUCKET_NAME =
    process.env.FIREBASE_STORAGE_BUCKET ?? 'rapid-compliance-65f87.firebasestorage.app';
  const bucket = adminStorage.bucket(BUCKET_NAME);
  console.log(`Bucket: ${bucket.name}`);
  console.log(`Mode:   ${APPLY ? 'APPLY (will write Firestore docs)' : 'CHECK-ONLY (no writes)'}`);
  console.log(`IDs:    ${DELETED_IDS.length}\n`);

  // Index every file under the media/ prefix once, keyed by the id embedded in
  // its filename, so we find the right object regardless of extension/subfolder.
  const [files] = await bucket.getFiles({ prefix: MEDIA_PREFIX });
  const byId = new Map<string, (typeof files)[number]>();
  for (const f of files) {
    const base = f.name.split('/').pop() ?? '';
    const idPart = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
    byId.set(idPart, f);
  }

  const found: FoundFile[] = [];
  const missing: string[] = [];

  for (const id of DELETED_IDS) {
    const file = byId.get(id);
    if (!file) {
      missing.push(id);
      console.log(`✗ ${id} — NO file found in storage`);
      continue;
    }
    const [meta] = await file.getMetadata();
    const existingToken =
      (meta.metadata?.firebaseStorageDownloadTokens as string | undefined) ?? '';
    const token = existingToken.split(',')[0] || randomUUID();
    found.push({
      id,
      path: file.name,
      contentType: typeof meta.contentType === 'string' ? meta.contentType : 'image/png',
      size: typeof meta.size === 'string' ? Number(meta.size) : Number(meta.size ?? 0),
      timeCreated: typeof meta.timeCreated === 'string' ? meta.timeCreated : new Date().toISOString(),
      token,
    });
    console.log(`✓ ${id} — ${file.name} (${meta.contentType}, ${meta.size} bytes)${existingToken ? '' : '  [will set new download token]'}`);
  }

  console.log(`\nFound ${found.length} file(s), ${missing.length} missing.`);

  if (!APPLY) {
    console.log('\nCHECK-ONLY: no Firestore docs written. Re-run with --apply to restore.');
    return;
  }

  let restored = 0;
  for (const f of found) {
    const file = bucket.file(f.path);
    // Ensure the object carries the download token we will publish in the URL.
    const [meta] = await file.getMetadata();
    const hasToken = typeof meta.metadata?.firebaseStorageDownloadTokens === 'string';
    if (!hasToken) {
      await file.setMetadata({
        metadata: { ...(meta.metadata ?? {}), firebaseStorageDownloadTokens: f.token },
      });
    }

    const url = firebaseDownloadUrl(bucket.name, f.path, f.token);
    const filename = f.path.split('/').pop() ?? f.id;
    const docData = {
      type: 'image' as const,
      category: 'other' as const,
      tags: ['recovered'],
      name: filename,
      url,
      mimeType: f.contentType,
      fileSize: f.size,
      source: 'ai-generated' as const,
      createdAt: f.timeCreated,
      updatedAt: new Date().toISOString(),
      createdBy: 'recovery-script-jun11',
      processingState: 'ready' as const,
    };

    await adminDb.doc(`organizations/${PLATFORM_ID}/media/${f.id}`).set(docData);
    restored += 1;
    console.log(`↻ restored media/${f.id} → ${url.slice(0, 90)}...`);
  }

  console.log(`\nDONE: restored ${restored} record(s).`);
  if (missing.length > 0) {
    console.log(`Still missing (no storage file): ${missing.join(', ')}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Recovery failed:', err);
    process.exit(1);
  });
