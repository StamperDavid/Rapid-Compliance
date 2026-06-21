/**
 * PRE-TEST follow-up — is the WIDE pixelation a RESOLUTION problem?
 *
 * Re-runs ONLY the wide shot at 1080p (was 720p) and lip-syncs with the picked
 * model (sync-lipsync/v3), so we can compare 1080p-wide vs the earlier 720p-wide
 * and judge whether more pixels on a small face makes the speech read clearly.
 * Reuses the prior character image + voice line when still available (apples-to-
 * apples); regenerates either if its temporary URL has expired.
 *
 * Usage: npx tsx scripts/pretest-wide-1080p.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
function loadEnvLocal(): void {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) { return; }
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) { continue; }
    const eq = t.indexOf('='); if (eq === -1) { continue; }
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) { v = v.slice(1, -1); }
    if (!process.env[k]) { process.env[k] = v; }
  }
}
loadEnvLocal();
/* eslint-disable no-console */

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const LINE = "I've been waiting for you. We don't have much time, so listen carefully — everything changes tonight.";
const PRIOR_IMAGE = 'https://v3b.fal.media/files/b/0a9ec341/XwiToDT65rTD61E7NDV67.jpg';
const PRIOR_AUDIO = 'https://v3b.fal.media/files/b/0a9ec342/J-q-io92rnhb7IvDQAmt-_output.mp3';
const WIDE_PROMPT = 'Wide cinematic shot, the character walks down a rain-soaked neon city street at night, FULL BODY visible and smaller in the frame, atmospheric.';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface FalSubmit { status_url: string; response_url: string }
interface FalStatus { status: string }
async function falQueue(model: string, input: Record<string, unknown>, key: string, label: string): Promise<Record<string, unknown>> {
  const submit = await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!submit.ok) { throw new Error(`${label} submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`); }
  const sub = (await submit.json()) as FalSubmit;
  for (let i = 0; i < 300; i += 1) {
    await sleep(3000);
    const s = await fetch(sub.status_url, { headers: { Authorization: `Key ${key}` } });
    const sj = (await s.json()) as FalStatus;
    if (sj.status === 'COMPLETED') { const r = await fetch(sub.response_url, { headers: { Authorization: `Key ${key}` } }); return (await r.json()) as Record<string, unknown>; }
    if (sj.status === 'FAILED' || sj.status === 'ERROR') { throw new Error(`${label} failed: ${JSON.stringify(sj).slice(0, 300)}`); }
  }
  throw new Error(`${label} timed out`);
}
function mediaUrl(out: Record<string, unknown>, kind: 'video' | 'audio'): string {
  const node = out[kind];
  if (node && typeof node === 'object' && typeof (node as { url?: unknown }).url === 'string') { return (node as { url: string }).url; }
  throw new Error(`no ${kind}.url in output`);
}
async function urlOk(u: string): Promise<boolean> { try { const r = await fetch(u, { method: 'GET' }); return r.ok; } catch { return false; } }

async function main(): Promise<void> {
  const { randomUUID } = await import('node:crypto');
  const { apiKeyService } = await import('../src/lib/api-keys/api-key-service');
  const { generateWithFal } = await import('../src/lib/ai/providers/fal-provider');
  const { getVideoEngineProvider } = await import('../src/lib/video/providers');
  const { adminStorage } = await import('../src/lib/firebase/admin');
  const { firebaseDownloadUrl } = await import('../src/lib/firebase/storage-utils');
  const { createAsset } = await import('../src/lib/media/media-library-service');
  const { PLATFORM_ID } = await import('../src/lib/constants/platform');
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  if (!key || !adminStorage) { throw new Error('fal key or adminStorage missing'); }

  async function save(srcUrl: string, name: string, description: string, tags: string[], aiProvider: string): Promise<string> {
    const resp = await fetch(srcUrl, { redirect: 'follow' });
    const buf = Buffer.from(await resp.arrayBuffer());
    const path = `organizations/${PLATFORM_ID}/media/videos/clonetest-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${randomUUID()}.mp4`;
    const token = randomUUID();
    await adminStorage!.bucket(BUCKET).file(path).save(buf, { metadata: { contentType: 'video/mp4', metadata: { firebaseStorageDownloadTokens: token } } });
    const url = firebaseDownloadUrl(BUCKET, path, token);
    await createAsset({ type: 'video', category: 'final-render', name, description, url, mimeType: 'video/mp4', fileSize: buf.length, source: 'ai-generated', aiProvider, createdBy: 'system', tags: ['clone-inscene-pretest', ...tags] });
    return url;
  }

  // Reuse prior image/audio if still live, else regenerate.
  let imageUrl = PRIOR_IMAGE;
  if (!(await urlOk(imageUrl))) {
    console.log('  prior image expired — regenerating…');
    const p = await generateWithFal('Full-body photorealistic portrait of a striking woman in her early 30s with dark wavy hair, wearing a charcoal trench coat, standing, sharp facial detail, neutral studio background, cinematic lighting.', { aspectRatio: '9:16' });
    imageUrl = p.url ?? '';
    if (!imageUrl) { throw new Error('image regen failed'); }
  }
  let audioUrl = PRIOR_AUDIO;
  if (!(await urlOk(audioUrl))) {
    console.log('  prior audio expired — regenerating…');
    const a = await falQueue('fal-ai/elevenlabs/tts/eleven-v3', { text: LINE }, key, 'tts');
    audioUrl = mediaUrl(a, 'audio');
  }
  console.log('image:', imageUrl, '\naudio:', audioUrl);

  console.log('STEP 1 — WIDE scene at 1080p (Seedance)…');
  const provider = getVideoEngineProvider('fal');
  const submitted = await provider.generateVideo({ prompt: WIDE_PROMPT, imageUrls: [imageUrl], resolution: '1080p', aspectRatio: '16:9', durationSeconds: 5, generateAudio: false }, { tenantId: PLATFORM_ID });
  let sceneUrl = '';
  for (let i = 0; i < 240; i += 1) {
    await sleep(3000);
    const st = await provider.getStatus(submitted.generationId, { tenantId: PLATFORM_ID });
    if (st.status === 'completed' && st.videoUrl) { sceneUrl = st.videoUrl; break; }
    if (st.status === 'failed') { throw new Error(`scene failed: ${st.error ?? 'unknown'}`); }
  }
  if (!sceneUrl) { throw new Error('scene timed out'); }
  console.log('  scene WIDE 1080p:', sceneUrl);
  await save(sceneUrl, 'Clone pre-test — scene WIDE 1080p (before lip-sync)', 'Seedance wide scene at 1080p (vs 720p) — does the face read clearly?', ['wide', '1080p', 'scene'], 'fal-seedance');

  console.log('STEP 2 — lip-sync WIDE 1080p with sync-lipsync/v3…');
  const v3out = await falQueue('fal-ai/sync-lipsync/v3', { video_url: sceneUrl, audio_url: audioUrl }, key, 'v3-wide-1080p');
  const v3Url = mediaUrl(v3out, 'video');
  const lipUrl = await save(v3Url, 'Clone pre-test — WIDE 1080p — sync-lipsync/v3', 'In-scene lip-sync, WIDE framing at 1080p, model sync-lipsync/v3. Compare vs the 720p wide.', ['wide', '1080p', 'output'], 'fal-ai/sync-lipsync/v3');

  console.log('STEP 3 — upscale to 4K (Topaz, x2 → 3840x2160)…');
  const upOut = await falQueue('fal-ai/topaz/upscale/video', { video_url: v3Url, upscale_factor: 2 }, key, 'topaz-4k');
  const up4kUrl = await save(mediaUrl(upOut, 'video'), 'Clone pre-test — WIDE 4K — v3 + Topaz upscale', 'FINAL 4K: 1080p Seedance wide -> v3 lip-sync -> Topaz x2 upscale (3840x2160). The real delivery pipeline.', ['wide', '4k', 'output'], 'fal-ai/topaz/upscale/video');

  console.log('\n✅ DONE — saved to library (tag clone-inscene-pretest):');
  console.log('  WIDE 1080p before  :', sceneUrl);
  console.log('  WIDE 1080p v3      :', lipUrl);
  console.log('  WIDE 4K (v3+Topaz) :', up4kUrl);
  process.exit(0);
}
main().catch((e) => { console.error('\n❌ ERROR:', e instanceof Error ? e.message : String(e)); process.exit(1); });
