/**
 * Pull a finished Hedra generation's video and save it PERMANENTLY into our media
 * library (so it's reviewable in /content/video/library, no expiring signed URL).
 * Run: npx tsx scripts/save-hedra-gen-to-library.ts
 */
import { randomUUID } from 'node:crypto';
import { getHedraVideoStatus } from '../src/lib/video/hedra-service';
import { adminStorage } from '../src/lib/firebase/admin';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { createAsset } from '../src/lib/media/media-library-service';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const GEN_ID = 'bffc2976-9f35-4a8f-a60d-32506c977e95';
const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';

async function main(): Promise<void> {
  const status = await getHedraVideoStatus(GEN_ID);
  if (status.status !== 'completed' || !status.videoUrl) {
    console.log(`Generation not ready (status=${status.status}, err=${status.error ?? '-'}).`);
    process.exit(1);
  }
  const resp = await fetch(status.videoUrl, { redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  if (!adminStorage) {
    throw new Error('Firebase Storage unavailable');
  }
  const id = randomUUID();
  const path = `organizations/${PLATFORM_ID}/media/videos/${id}.mp4`;
  const token = randomUUID();
  await adminStorage.bucket(BUCKET).file(path).save(buf, {
    metadata: {
      contentType: 'video/mp4',
      metadata: { firebaseStorageDownloadTokens: token, source: 'feasibility-test' },
    },
  });
  const url = firebaseDownloadUrl(BUCKET, path, token);
  const asset = await createAsset({
    type: 'video',
    category: 'final',
    name: 'TEST — happy-horse 2-character feasibility (Velocity + Emily/Victoria)',
    description:
      'Feasibility test: Hedra happy-horse-ir2v with two reference characters placed together in a grocery store. Review for character distinctness (no feature-blending).',
    url,
    mimeType: 'video/mp4',
    fileSize: buf.length,
    source: 'ai-generated',
    aiProvider: 'hedra',
    createdBy: 'system',
    tags: ['feasibility-test', 'character-test'],
  });
  console.log(`SAVED to library. assetId=${asset.id}`);
  console.log(`Size: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Permanent URL:\n${url}`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('ERROR:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
