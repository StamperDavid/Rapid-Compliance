/**
 * CLEAN SINGLE-CHARACTER test: the real Velocity hero PORTRAIT (from brand-assets)
 * placed alone in a grocery store via happy-horse. Isolates two questions:
 *   1) does happy-horse keep his IDENTITY from a clean portrait?
 *   2) does it preserve his comic/stylized ART STYLE, or realify it?
 * Saves the result to the media library. Run: npx tsx scripts/test-velocity-hero-single.ts
 */
import { randomUUID } from 'node:crypto';
import { getHedraCatalog } from '../src/lib/video/hedra-capability-service';
import { generateWithHedra, getHedraVideoStatus } from '../src/lib/video/hedra-service';
import { createAsset } from '../src/lib/media/media-library-service';
import { adminStorage } from '../src/lib/firebase/admin';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const HERO_PATH = `organizations/${PLATFORM_ID}/brand-assets/1781034027518-20-SalesVelocity.ai_Hero.png`;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  if (!adminStorage) { throw new Error('no storage'); }
  // Signed read URL so Hedra can fetch the brand-asset portrait.
  const [heroUrl] = await adminStorage
    .bucket(BUCKET)
    .file(HERO_PATH)
    .getSignedUrl({ action: 'read', expires: Date.now() + 3600_000 });
  console.log(`Velocity hero portrait: ${HERO_PATH.split('/').pop()}`);

  const catalog = await getHedraCatalog();
  const hh = catalog.find((m) => /happy-horse-ir2v/i.test(m.slug ?? '')) ?? catalog.find((m) => /happy-horse/i.test(m.slug ?? ''));
  if (!hh) { console.log('No happy-horse model.'); process.exit(1); }

  const res = await generateWithHedra({
    modelId: hh.id,
    type: 'video',
    textPrompt:
      'The exact comic-book superhero character shown in the reference image — keep his identical face, costume, colors, and stylized comic-book art style — walking down the aisle of a realistic grocery store. Do NOT turn him into a realistic human; preserve his original illustrated art style exactly.',
    startFrameUrl: heroUrl,
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

  const resp = await fetch(videoUrl, { redirect: 'follow' });
  const buf = Buffer.from(await resp.arrayBuffer());
  const id = randomUUID();
  const path = `organizations/${PLATFORM_ID}/media/videos/${id}.mp4`;
  const token = randomUUID();
  await adminStorage.bucket(BUCKET).file(path).save(buf, {
    metadata: { contentType: 'video/mp4', metadata: { firebaseStorageDownloadTokens: token, source: 'feasibility-test' } },
  });
  const permUrl = firebaseDownloadUrl(BUCKET, path, token);
  const asset = await createAsset({
    type: 'video', category: 'final',
    name: 'TEST 3 - Velocity hero ALONE (clean single-character identity+style)',
    description: 'happy-horse single-character: clean Velocity hero portrait placed in a grocery store. Review: identity kept? comic style kept or realified?',
    url: permUrl, mimeType: 'video/mp4', fileSize: buf.length,
    source: 'ai-generated', aiProvider: 'hedra', createdBy: 'system',
    tags: ['feasibility-test', 'character-test'],
  });
  console.log(`\nSAVED to library. assetId=${asset.id} (${(buf.length / 1048576).toFixed(2)} MB)`);
  console.log(permUrl);
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
