/**
 * MULTI-CHARACTER capability test: can Seedance 2.0 reference-to-video hold TWO
 * distinct characters consistent in one cinematic shot? Feeds Velocity (@Image1) +
 * Pipedrive Businessman (@Image2) as SEPARATE solo reference portraits and asks for
 * an action standoff. Saves the result to the media library for review.
 * Run: npx tsx scripts/test-seedance-velocity-pipedrive.ts
 */
import { randomUUID } from 'node:crypto';
import { apiKeyService } from '../src/lib/api-keys/api-key-service';
import { adminStorage } from '../src/lib/firebase/admin';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { createAsset } from '../src/lib/media/media-library-service';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const MODEL = 'bytedance/seedance-2.0/reference-to-video';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Clean SOLO portraits — one per character, so @Image1=Velocity, @Image2=Pipedrive maps cleanly.
const VELOCITY_IMG =
  'https://firebasestorage.googleapis.com/v0/b/rapid-compliance-65f87.firebasestorage.app/o/organizations%2Frapid-compliance-root%2Fmedia%2Fimages%2Fad5e2703-5bab-4872-aa1d-c0b11d21f7f8.png?alt=media&token=7f14e23f-f737-460a-a01a-62fe20f1f4bb';
const PIPEDRIVE_IMG =
  'https://firebasestorage.googleapis.com/v0/b/rapid-compliance-65f87.firebasestorage.app/o/organizations%2Frapid-compliance-root%2Fmedia%2Fimages%2Fb8768ba9-8b25-435b-a3eb-27da8c4bb851.png?alt=media&token=fedddbb1-954c-407c-a24e-5d879724cc6d';

interface SubmitResp { request_id?: string; status_url?: string; response_url?: string }
interface StatusResp { status?: string }
interface ResultResp { video?: { url?: string } }

async function main(): Promise<void> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  if (typeof key !== 'string' || key.length === 0) { throw new Error('fal key not configured'); }

  const input = {
    prompt:
      '@Image1 is "Velocity", a stylized comic-book superhero — keep his EXACT face, brown hair and full beard, and his dark navy/black tactical suit with glowing purple accents and chest emblem. ' +
      '@Image2 is the "Pipedrive Businessman" villain — keep his EXACT face and business suit. ' +
      'The two face off in a dramatic action standoff inside a small retail shop: Velocity raises a glowing purple energy hand toward the smirking businessman, who clutches a stack of paperwork. ' +
      'BOTH characters fully visible as two clearly distinct, separate individuals — do NOT merge, blend, or duplicate them. ' +
      'Cinematic comic / Pixar illustrated art style (NOT photorealistic), dynamic lighting, shallow depth of field, slight camera push-in.',
    image_urls: [VELOCITY_IMG, PIPEDRIVE_IMG],
    resolution: '720p',
    aspect_ratio: '16:9',
    duration: 'auto',
    generate_audio: false,
  };

  const auth = { Authorization: `Key ${key}` };
  console.log(`Submitting ${MODEL} with 2 character refs...`);
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
  for (let i = 0; i < 150; i += 1) {
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
    metadata: { contentType: 'video/mp4', metadata: { firebaseStorageDownloadTokens: token, source: 'seedance-multichar-test' } },
  });
  const permUrl = firebaseDownloadUrl(BUCKET, path, token);
  const asset = await createAsset({
    type: 'video', category: 'final',
    name: 'Seedance MULTI-CHARACTER test — Velocity vs Pipedrive Businessman',
    description: 'Seedance 2.0 reference-to-video, two SEPARATE solo refs (@Image1 Velocity, @Image2 Pipedrive). Review: two distinct characters? each identity held? cinematic quality?',
    url: permUrl, mimeType: 'video/mp4', fileSize: buf.length,
    source: 'ai-generated', aiProvider: 'fal-seedance', createdBy: 'system',
    tags: ['seedance-test', 'multichar-test', 'character-test'],
  });
  console.log(`\n✅ SAVED to library. assetId=${asset.id} (${(buf.length / 1048576).toFixed(2)} MB)`);
  console.log(permUrl);
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
