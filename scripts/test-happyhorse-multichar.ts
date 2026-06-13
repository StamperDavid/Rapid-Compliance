/**
 * LIVE FEASIBILITY TEST: does Hedra's happy-horse model keep TWO distinct
 * characters distinct (no feature-blending) when given them as start-frame +
 * reference + a "place them together in a scene" prompt?
 *
 * This is the one capability we cannot verify by inspection — only a real render.
 * Run: npx tsx scripts/test-happyhorse-multichar.ts
 * Outputs a video URL to open + eyeball.
 */
import { getHedraCatalog } from '../src/lib/video/hedra-capability-service';
import { generateWithHedra, getHedraVideoStatus } from '../src/lib/video/hedra-service';
import { listAssets } from '../src/lib/media/media-library-service';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  // 1. Find two distinct, character-ish images from the media library.
  const { assets } = await listAssets({ limit: 200 });
  const skip = /logo|icon|thumbnail|screenshot|chart|graph|outro|background/i;
  const images = assets.filter(
    (a) => a.type === 'image' && typeof a.url === 'string' && a.url.length > 0 && !skip.test(a.name ?? ''),
  );
  console.log(`Image candidates (non-logo): ${images.length}`);
  for (const im of images.slice(0, 12)) { console.log(`  - ${im.name}`); }
  if (images.length < 2) {
    console.log('NOT ENOUGH character images in the library to test. Provide 2 image URLs.');
    process.exit(1);
  }
  const charA = images[0];
  const charB = images.find((x) => x.url !== charA.url) ?? images[1];
  console.log(`\nCharacter A (start frame): ${charA.name}\n  ${charA.url}`);
  console.log(`Character B (reference):   ${charB.name}\n  ${charB.url}`);

  // 2. Resolve the happy-horse model id from the live catalog.
  const catalog = await getHedraCatalog();
  const hh =
    catalog.find((m) => /happy-horse-ir2v/i.test(m.slug ?? '')) ??
    catalog.find((m) => /happy-horse/i.test(m.slug ?? ''));
  if (!hh) {
    console.log('No happy-horse model in catalog.');
    process.exit(1);
  }
  console.log(`\nModel: ${hh.slug} (${hh.id})`);

  // 3. Submit a real generation: both characters together in a grocery store.
  const res = await generateWithHedra({
    modelId: hh.id,
    type: 'video',
    textPrompt:
      'The two distinct people shown in the reference images standing together in a real grocery store aisle, talking to each other, both clearly visible as two separate individuals, photorealistic, cinematic lighting, shallow depth of field',
    startFrameUrl: charA.url,
    referenceImageUrls: [charB.url],
    resolution: '720p',
    aspectRatio: '16:9',
    durationMs: 5000,
  });
  console.log(`\nSubmitted. generationId = ${res.generationId}`);

  // 4. Poll until complete (≈ up to 7.5 min).
  for (let i = 0; i < 90; i += 1) {
    await sleep(5000);
    const s = await getHedraVideoStatus(res.generationId);
    console.log(`[${i}] status=${s.status} progress=${s.progress ?? '-'}`);
    if (s.status === 'completed') {
      console.log(`\n✅ DONE — open and eyeball this:\n${s.videoUrl}`);
      return;
    }
    if (s.status === 'failed') {
      console.log(`\n❌ FAILED: ${s.error ?? 'unknown'}`);
      return;
    }
  }
  console.log('\n⏱ Timed out polling (still generating). generationId above.');
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('ERROR:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
