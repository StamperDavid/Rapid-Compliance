/**
 * CROSS-SHOT PROGRESSION test: can Seedance 2.0 keep Velocity CONSISTENT while the
 * STORY ADVANCES across separate shots (different environment + action each beat)?
 * Three independent reference-to-video generations, same Velocity refs (@Image1),
 * progressing narrative beats. Each saved to the library labeled Beat 1/2/3 so they
 * can be reviewed as a sequence. Run: npx tsx scripts/test-seedance-crossshot-progression.ts
 */
import { randomUUID } from 'node:crypto';
import { apiKeyService } from '../src/lib/api-keys/api-key-service';
import { getAvatarProfile } from '../src/lib/video/avatar-profile-service';
import { adminStorage } from '../src/lib/firebase/admin';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { createAsset } from '../src/lib/media/media-library-service';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const MODEL = 'bytedance/seedance-2.0/reference-to-video';
const VELOCITY_PROFILE = '7c1171f7-d8b1-4dbe-863c-26a485b4f317';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const STYLE =
  'Keep his EXACT face, brown hair and full beard, and his dark navy/black tactical suit with glowing purple accents and chest emblem. ' +
  'Consistent comic / Pixar illustrated art style (NOT photorealistic), cinematic lighting, shallow depth of field.';

const BEATS = [
  {
    label: 'Beat 1 — Bridge charge',
    prompt:
      '@Image1 is "Velocity", a stylized comic-book superhero. He charges on horseback across a long stone bridge toward a glowing city skyline at dusk, cape and hair flowing, heroic wide tracking shot. ' + STYLE,
  },
  {
    label: 'Beat 2 — Arriving in the city',
    prompt:
      '@Image1 is "Velocity", a stylized comic-book superhero. He rides the same horse through the busy streets of the modern city, tall buildings rising around him, slowing as he arrives, medium tracking shot. ' + STYLE,
  },
  {
    label: 'Beat 3 — Entering the business',
    prompt:
      '@Image1 is "Velocity", a stylized comic-book superhero. He has dismounted and strides up to a small storefront business, pushing open the glass door to help the worried small-business owner inside, warm interior light, medium shot. ' + STYLE,
  },
];

interface SubmitResp { request_id?: string; status_url?: string; response_url?: string }
interface StatusResp { status?: string }
interface ResultResp { video?: { url?: string } }

async function runBeat(
  beat: { label: string; prompt: string },
  images: string[],
  auth: Record<string, string>,
): Promise<void> {
  const input = {
    prompt: beat.prompt,
    image_urls: images,
    resolution: '720p',
    aspect_ratio: '16:9',
    duration: 'auto',
    generate_audio: false,
  };
  const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!submit.ok) { throw new Error(`${beat.label}: submit failed (${submit.status}): ${(await submit.text()).slice(0, 300)}`); }
  const sub = (await submit.json()) as SubmitResp;
  if (!sub.status_url || !sub.response_url) { throw new Error(`${beat.label}: no status/response url`); }
  console.log(`${beat.label}: submitted ${sub.request_id}`);

  let result: ResultResp | null = null;
  for (let i = 0; i < 150; i += 1) {
    await sleep(5000);
    const st = await fetch(sub.status_url, { headers: auth });
    const sj = (await st.json()) as StatusResp;
    if (sj.status === 'COMPLETED') {
      const r = await fetch(sub.response_url, { headers: auth });
      result = (await r.json()) as ResultResp;
      break;
    }
    if (sj.status && /FAILED|ERROR/i.test(sj.status)) { throw new Error(`${beat.label}: generation ${sj.status}`); }
  }
  if (!result) { throw new Error(`${beat.label}: timed out polling`); }
  const videoUrl = result.video?.url;
  if (!videoUrl) { throw new Error(`${beat.label}: no video url`); }

  const resp = await fetch(videoUrl);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (!adminStorage) { throw new Error('no storage'); }
  const id = randomUUID();
  const path = `organizations/${PLATFORM_ID}/media/videos/${id}.mp4`;
  const token = randomUUID();
  await adminStorage.bucket(BUCKET).file(path).save(buf, {
    metadata: { contentType: 'video/mp4', metadata: { firebaseStorageDownloadTokens: token, source: 'seedance-crossshot-test' } },
  });
  const permUrl = firebaseDownloadUrl(BUCKET, path, token);
  const asset = await createAsset({
    type: 'video', category: 'final',
    name: `Cross-shot progression test — ${beat.label}`,
    description: `Seedance cross-shot consistency w/ scene progression. ${beat.label}. Review: does Velocity's identity hold across all 3 beats while the scene advances?`,
    url: permUrl, mimeType: 'video/mp4', fileSize: buf.length,
    source: 'ai-generated', aiProvider: 'fal-seedance', createdBy: 'system',
    tags: ['seedance-test', 'crossshot-test', 'character-test'],
  });
  console.log(`✅ ${beat.label}: SAVED assetId=${asset.id} (${(buf.length / 1048576).toFixed(2)} MB)\n   ${permUrl}`);
}

async function main(): Promise<void> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  if (typeof key !== 'string' || key.length === 0) { throw new Error('fal key not configured'); }
  const profile = await getAvatarProfile(VELOCITY_PROFILE);
  if (!profile) { throw new Error('Velocity profile not found'); }
  const images = [profile.frontalImageUrl, ...(profile.additionalImageUrls ?? [])].filter((u): u is string => Boolean(u)).slice(0, 4);
  console.log(`Velocity reference images: ${images.length}. Submitting ${BEATS.length} progressing beats concurrently...\n`);

  const auth = { Authorization: `Key ${key}` };
  // Run all three concurrently — same Velocity refs, different progressing scenes.
  const results = await Promise.allSettled(BEATS.map((b) => runBeat(b, images, auth)));
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    failed.forEach((f) => { if (f.status === 'rejected') { console.error('FAILED:', f.reason instanceof Error ? f.reason.message : f.reason); } });
    process.exit(1);
  }
  console.log('\n✅ All 3 progression beats saved to the library.');
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
