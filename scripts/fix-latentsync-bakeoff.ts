/**
 * One-off fix: the bake-off saved the latentsync clip as an IMAGE (.jpg) because
 * fal serves its output with an image content-type header. The bytes are the video.
 * Re-save them correctly as an mp4 VIDEO asset in the library.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
function loadEnvLocal(): void {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) { return; }
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) { continue; }
    const eq = t.indexOf('='); if (eq === -1) { continue; }
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) { v = v.slice(1, -1); }
    if (!process.env[k]) { process.env[k] = v; }
  }
}
loadEnvLocal();
/* eslint-disable no-console */
const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const JPG_URL = 'https://firebasestorage.googleapis.com/v0/b/rapid-compliance-65f87.firebasestorage.app/o/organizations%2Frapid-compliance-root%2Fmedia%2Fimages%2Fbakeoff-lip-sync-bake-off-case-a-fal-ai-latentsync-6c287288-c4f3-44f1-a140-94b47f561e34.jpg?alt=media&token=28aaba0c-8bfa-4e1c-b19e-037533613dce';

async function main(): Promise<void> {
  const { randomUUID } = await import('node:crypto');
  const { adminStorage } = await import('../src/lib/firebase/admin');
  const { firebaseDownloadUrl } = await import('../src/lib/firebase/storage-utils');
  const { createAsset } = await import('../src/lib/media/media-library-service');
  const { PLATFORM_ID } = await import('../src/lib/constants/platform');
  if (!adminStorage) { throw new Error('adminStorage not initialized'); }

  const resp = await fetch(JPG_URL, { redirect: 'follow' });
  const buf = Buffer.from(await resp.arrayBuffer());
  console.log('downloaded', buf.length, 'bytes');
  const path = `organizations/${PLATFORM_ID}/media/videos/bakeoff-latentsync-fixed-${randomUUID()}.mp4`;
  const token = randomUUID();
  await adminStorage.bucket(BUCKET).file(path).save(buf, { metadata: { contentType: 'video/mp4', metadata: { firebaseStorageDownloadTokens: token } } });
  const url = firebaseDownloadUrl(BUCKET, path, token);
  await createAsset({
    type: 'video',
    category: 'final-render',
    name: 'Lip-sync bake-off — Case A: fal-ai/latentsync',
    description: 'Case A candidate: re-synced the stand-in footage to the bake-off voice line. Model fal-ai/latentsync. (Re-saved as video.)',
    url,
    mimeType: 'video/mp4',
    fileSize: buf.length,
    source: 'ai-generated',
    aiProvider: 'fal-ai/latentsync',
    createdBy: 'system',
    tags: ['lipsync-bakeoff', 'case-a', 'output'],
  });
  console.log('✅ latentsync re-saved as VIDEO:', url);
  process.exit(0);
}
main().catch((e) => { console.error('FIX FAILED:', e instanceof Error ? e.message : String(e)); process.exit(1); });
