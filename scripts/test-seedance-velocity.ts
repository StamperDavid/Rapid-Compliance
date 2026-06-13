/**
 * LIVE TEST: Seedance 2.0 reference-to-video via fal — place the saved Velocity
 * character (his reference sheet) into a grocery store, preserving identity + comic
 * style. Saves the result to the media library. Run: npx tsx scripts/test-seedance-velocity.ts
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
const PROFILE_ID = '7c1171f7-d8b1-4dbe-863c-26a485b4f317';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface SubmitResp { request_id?: string; status_url?: string; response_url?: string }
interface StatusResp { status?: string }
interface ResultResp { video?: { url?: string } }

async function main(): Promise<void> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  if (typeof key !== 'string' || key.length === 0) { throw new Error('fal key not configured'); }

  const profile = await getAvatarProfile(PROFILE_ID);
  if (!profile) { throw new Error('Velocity profile not found'); }
  const images = [profile.frontalImageUrl, ...(profile.additionalImageUrls ?? [])].filter((u): u is string => Boolean(u)).slice(0, 9);
  console.log(`Velocity reference images: ${images.length}`);

  const input = {
    prompt:
      '@Image1 is "Velocity", a stylized comic-book superhero. Keep his EXACT face, brown hair and full beard, his dark navy/black tactical suit with glowing purple accents and the emblem on his chest, and his illustrated COMIC / Pixar art style. Show Velocity walking down the aisle of a realistic grocery store, looking around, cinematic lighting, shallow depth of field. Preserve the comic/illustrated art style — do NOT make him photorealistic.',
    image_urls: images,
    resolution: '720p',
    aspect_ratio: '16:9',
    duration: 'auto',
    generate_audio: false,
  };

  const auth = { Authorization: `Key ${key}` };
  const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!submit.ok) { throw new Error(`submit failed (${submit.status}): ${(await submit.text()).slice(0, 500)}`); }
  const sub = (await submit.json()) as SubmitResp;
  if (!sub.status_url || !sub.response_url) { throw new Error(`no status/response url: ${JSON.stringify(sub).slice(0, 300)}`); }
  console.log(`submitted: ${sub.request_id}`);

  let result: ResultResp | null = null;
  for (let i = 0; i < 120; i += 1) {
    await sleep(5000);
    const st = await fetch(sub.status_url, { headers: auth });
    const sj = (await st.json()) as StatusResp;
    console.log(`[${i}] ${sj.status}`);
    if (sj.status === 'COMPLETED') {
      const r = await fetch(sub.response_url, { headers: auth });
      result = (await r.json()) as ResultResp;
      break;
    }
    if (sj.status && /FAILED|ERROR/i.test(sj.status)) { throw new Error(`generation ${sj.status}`); }
  }
  if (!result) { throw new Error('timed out polling'); }
  const videoUrl = result.video?.url;
  if (!videoUrl) { throw new Error(`no video url: ${JSON.stringify(result).slice(0, 300)}`); }
  console.log(`video: ${videoUrl}`);

  const resp = await fetch(videoUrl);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (!adminStorage) { throw new Error('no storage'); }
  const id = randomUUID();
  const path = `organizations/${PLATFORM_ID}/media/videos/${id}.mp4`;
  const token = randomUUID();
  await adminStorage.bucket(BUCKET).file(path).save(buf, {
    metadata: { contentType: 'video/mp4', metadata: { firebaseStorageDownloadTokens: token, source: 'seedance-test' } },
  });
  const permUrl = firebaseDownloadUrl(BUCKET, path, token);
  const asset = await createAsset({
    type: 'video', category: 'final',
    name: 'Seedance test - Velocity (reference-to-video)',
    description: 'Seedance 2.0 reference-to-video: Velocity reference sheet -> grocery store. Review: identity + comic style held?',
    url: permUrl, mimeType: 'video/mp4', fileSize: buf.length,
    source: 'ai-generated', aiProvider: 'fal-seedance', createdBy: 'system',
    tags: ['seedance-test', 'character-test'],
  });
  console.log(`\nSAVED to library. assetId=${asset.id} (${(buf.length / 1048576).toFixed(2)} MB)`);
  console.log(permUrl);
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
