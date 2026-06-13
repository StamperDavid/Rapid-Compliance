/**
 * CLEAN multi-character feasibility test: Velocity hero + Pipedrive Businessman
 * together in a grocery store via happy-horse-ir2v. Generates AND saves the result
 * to the media library for review. Run: npx tsx scripts/test-happyhorse-velocity-pipedrive.ts
 */
import { randomUUID } from 'node:crypto';
import { getHedraCatalog } from '../src/lib/video/hedra-capability-service';
import { generateWithHedra, getHedraVideoStatus } from '../src/lib/video/hedra-service';
import { listAssets, createAsset } from '../src/lib/media/media-library-service';
import { adminStorage } from '../src/lib/firebase/admin';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const { assets } = await listAssets({ limit: 300 });
  const imgs = assets.filter((a) => a.type === 'image' && typeof a.url === 'string' && a.url.length > 0);
  const nameOf = (a: { name?: string }): string => (a.name ?? '').toLowerCase();
  const notStoryboard = (a: { name?: string }): boolean => !/storyboard/i.test(a.name ?? '');

  console.log('Velocity-ish candidates:');
  imgs.filter((a) => /velocity|hero/i.test(nameOf(a))).forEach((a) => console.log(`  - ${a.name}`));
  console.log('Pipedrive-ish candidates:');
  imgs.filter((a) => /pipedrive|businessman/i.test(nameOf(a))).forEach((a) => console.log(`  - ${a.name}`));

  const velocity =
    imgs.find((a) => /hero/i.test(nameOf(a)) && notStoryboard(a)) ??
    imgs.find((a) => /velocity/i.test(nameOf(a)) && notStoryboard(a)) ??
    imgs.find((a) => /velocity/i.test(nameOf(a)));
  const pipedrive =
    imgs.find((a) => /pipedrive.*businessman|businessman/i.test(nameOf(a)) && notStoryboard(a)) ??
    imgs.find((a) => /pipedrive/i.test(nameOf(a)));

  if (!velocity || !pipedrive) {
    console.log(`\nMissing a clean image — velocity=${velocity?.name ?? 'NONE'} pipedrive=${pipedrive?.name ?? 'NONE'}`);
    process.exit(1);
  }
  console.log(`\nUsing START (Velocity): ${velocity.name}`);
  console.log(`Using REFERENCE (Pipedrive): ${pipedrive.name}`);

  const catalog = await getHedraCatalog();
  const hh = catalog.find((m) => /happy-horse-ir2v/i.test(m.slug ?? '')) ?? catalog.find((m) => /happy-horse/i.test(m.slug ?? ''));
  if (!hh) { console.log('No happy-horse model.'); process.exit(1); }
  console.log(`Model: ${hh.slug}`);

  const res = await generateWithHedra({
    modelId: hh.id,
    type: 'video',
    textPrompt:
      'The superhero from the first reference image and the businessman from the second reference image standing together in a real grocery store aisle, facing each other in conversation. BOTH characters fully visible as two clearly distinct, separate individuals — do not merge or blend them. Photorealistic, cinematic lighting, shallow depth of field.',
    startFrameUrl: velocity.url,
    referenceImageUrls: [pipedrive.url],
    resolution: '720p',
    aspectRatio: '16:9',
    durationMs: 5000,
  });
  console.log(`Submitted. generationId=${res.generationId}`);

  let videoUrl: string | null = null;
  for (let i = 0; i < 90; i += 1) {
    await sleep(5000);
    const s = await getHedraVideoStatus(res.generationId);
    console.log(`[${i}] ${s.status} ${s.progress ?? ''}`);
    if (s.status === 'completed') { videoUrl = s.videoUrl; break; }
    if (s.status === 'failed') { console.log(`FAILED: ${s.error ?? ''}`); process.exit(1); }
  }
  if (!videoUrl) { console.log('Timed out.'); process.exit(1); }

  // Save to library.
  const resp = await fetch(videoUrl, { redirect: 'follow' });
  const buf = Buffer.from(await resp.arrayBuffer());
  if (!adminStorage) { throw new Error('no storage'); }
  const id = randomUUID();
  const path = `organizations/${PLATFORM_ID}/media/videos/${id}.mp4`;
  const token = randomUUID();
  await adminStorage.bucket(BUCKET).file(path).save(buf, {
    metadata: { contentType: 'video/mp4', metadata: { firebaseStorageDownloadTokens: token, source: 'feasibility-test' } },
  });
  const permUrl = firebaseDownloadUrl(BUCKET, path, token);
  const asset = await createAsset({
    type: 'video', category: 'final',
    name: 'TEST 2 — Velocity + Pipedrive Businessman (clean 2-character)',
    description: 'happy-horse-ir2v: Velocity hero (start) + Pipedrive Businessman (reference) together in a grocery store. Review for character distinctness.',
    url: permUrl, mimeType: 'video/mp4', fileSize: buf.length,
    source: 'ai-generated', aiProvider: 'hedra', createdBy: 'system',
    tags: ['feasibility-test', 'character-test'],
  });
  console.log(`\n✅ SAVED to library. assetId=${asset.id} (${(buf.length / 1048576).toFixed(2)} MB)`);
  console.log(permUrl);
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
