/**
 * LIP-SYNC / AVATAR MODEL BAKE-OFF (real fal generations).
 *
 * Proves the keystone of the digital-clone feature and picks the model per case.
 * Generates shared inputs once, then runs the candidate fal models IN PARALLEL,
 * persists every output to OUR storage (permanent URLs you can watch), and prints
 * a comparison with per-model latency + documented cost.
 *
 *   Shared inputs:  TTS line (ElevenLabs on fal) · a portrait image (Flux) ·
 *                   a stand-in talking clip (Seedance image→video) as "footage".
 *   CASE A (lip-sync existing footage = your green-screen path), input {video_url,audio_url}:
 *     - fal-ai/sync-lipsync/v2/pro
 *     - fal-ai/sync-lipsync/v3        ($8/min — priciest)
 *     - fal-ai/latentsync             ($0.20/40s — cheap)
 *   CASE B (talking head from one image), input {image_url,audio_url}:
 *     - fal-ai/bytedance/omnihuman/v1.5  ($0.16/s)
 *     - fal-ai/kling-video/ai-avatar/v2/pro
 *
 * Spends a small amount of fal credits on purpose. Usage:
 *   npx tsx scripts/bakeoff-lipsync-models.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const eq = t.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}
loadEnvLocal();

/* eslint-disable no-console */

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const SAMPLE_LINE =
  "Hey — it's really great to finally meet you. Let me show you how this works; I think you're going to love it.";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface FalQueueSubmit {
  status_url: string;
  response_url: string;
}
interface FalStatus {
  status: string;
}

/** Submit to fal's queue, poll to completion, return the raw output JSON. */
async function falQueue(model: string, input: Record<string, unknown>, key: string, label: string): Promise<Record<string, unknown>> {
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!submit.ok) {
    throw new Error(`${label} submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  }
  const sub = (await submit.json()) as FalQueueSubmit;
  for (let i = 0; i < 300; i += 1) {
    await sleep(3000);
    const s = await fetch(sub.status_url, { headers: { Authorization: `Key ${key}` } });
    const sj = (await s.json()) as FalStatus;
    if (sj.status === 'COMPLETED') {
      const r = await fetch(sub.response_url, { headers: { Authorization: `Key ${key}` } });
      return (await r.json()) as Record<string, unknown>;
    }
    if (sj.status === 'FAILED' || sj.status === 'ERROR') {
      throw new Error(`${label} failed: ${JSON.stringify(sj).slice(0, 300)}`);
    }
  }
  throw new Error(`${label} timed out`);
}

/** Pull `video.url` (or `audio.url`) out of a fal output object. */
function mediaUrl(out: Record<string, unknown>, kind: 'video' | 'audio'): string {
  const node = out[kind];
  if (node && typeof node === 'object' && typeof (node as { url?: unknown }).url === 'string') {
    return (node as { url: string }).url;
  }
  throw new Error(`no ${kind}.url in output: ${JSON.stringify(out).slice(0, 200)}`);
}

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
  if (!key) {
    throw new Error('No fal API key in Firestore.');
  }
  if (!adminStorage) {
    throw new Error('adminStorage not initialized.');
  }

  /** Download a fal URL, persist to OUR storage (content-type detected), AND register
   *  it in the media library so it's watchable in-app. Returns the permanent URL. */
  async function saveToLibrary(
    srcUrl: string,
    name: string,
    description: string,
    tags: string[],
    aiProvider: string,
  ): Promise<string> {
    const resp = await fetch(srcUrl, { redirect: 'follow' });
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get('content-type') ?? 'application/octet-stream';
    const isVideo = ct.includes('video') || ct.includes('mp4');
    const isAudio = ct.includes('audio') || ct.includes('mpeg') || ct.includes('mp3') || ct.includes('wav');
    const ext = isVideo ? 'mp4' : isAudio ? 'mp3' : ct.includes('png') ? 'png' : 'jpg';
    const folder = isVideo ? 'videos' : isAudio ? 'audio' : 'images';
    const contentType = isVideo ? 'video/mp4' : isAudio ? 'audio/mpeg' : ct.includes('png') ? 'image/png' : 'image/jpeg';
    const slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const path = `organizations/${PLATFORM_ID}/media/${folder}/bakeoff-${slug}-${randomUUID()}.${ext}`;
    const token = randomUUID();
    await adminStorage!
      .bucket(BUCKET)
      .file(path)
      .save(buf, { metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } });
    const url = firebaseDownloadUrl(BUCKET, path, token);
    await createAsset({
      type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
      category: isVideo ? 'final-render' : isAudio ? 'voiceover' : 'photo',
      name,
      description,
      url,
      mimeType: contentType,
      fileSize: buf.length,
      source: 'ai-generated',
      aiProvider,
      createdBy: 'system',
      tags: ['lipsync-bakeoff', ...tags],
    });
    return url;
  }

  // ── Shared inputs ─────────────────────────────────────────────────────────
  console.log('STEP 1 — TTS audio (ElevenLabs on fal)…');
  const ttsOut = await falQueue('fal-ai/elevenlabs/tts/eleven-v3', { text: SAMPLE_LINE }, key, 'tts');
  const audioUrl = mediaUrl(ttsOut, 'audio');
  console.log('  audio:', audioUrl);
  await saveToLibrary(audioUrl, 'Lip-sync bake-off — voice line', 'The voice line every bake-off model lip-syncs to.', ['input', 'audio'], 'fal-elevenlabs');

  console.log('STEP 2 — portrait image (Flux)…');
  const portrait = await generateWithFal(
    'Photorealistic front-facing portrait of a friendly professional person in their 30s, head and shoulders, neutral studio background, looking directly at camera, sharp detail, soft even lighting.',
    { aspectRatio: '9:16' },
  );
  const imageUrl = portrait.url;
  if (!imageUrl) {
    throw new Error('portrait generation returned no url');
  }
  console.log('  image:', imageUrl);
  await saveToLibrary(imageUrl, 'Lip-sync bake-off — Case B input (portrait)', 'The single reference image fed to the talking-head models.', ['input', 'image', 'case-b'], 'fal-flux');

  console.log('STEP 3 — stand-in talking clip (Seedance image→video, the "footage")…');
  const provider = getVideoEngineProvider('fal');
  const submitted = await provider.generateVideo(
    {
      prompt: 'The same person looks directly at the camera and speaks naturally, subtle head movement, friendly expression.',
      imageUrls: [imageUrl],
      resolution: '720p',
      aspectRatio: '9:16',
      durationSeconds: 5,
      generateAudio: false,
    },
    { tenantId: PLATFORM_ID },
  );
  let footageUrl = '';
  for (let i = 0; i < 240; i += 1) {
    await sleep(3000);
    const st = await provider.getStatus(submitted.generationId, { tenantId: PLATFORM_ID });
    if (st.status === 'completed' && st.videoUrl) {
      footageUrl = st.videoUrl;
      break;
    }
    if (st.status === 'failed') {
      throw new Error(`Seedance stand-in failed: ${st.error ?? 'unknown'}`);
    }
  }
  if (!footageUrl) {
    throw new Error('Seedance stand-in did not complete');
  }
  console.log('  footage:', footageUrl);
  await saveToLibrary(footageUrl, 'Lip-sync bake-off — Case A input (stand-in footage)', 'The stand-in talking clip (the "green-screen footage") the lip-sync models re-sync.', ['input', 'video', 'case-a'], 'fal-seedance');

  // ── Run all candidate models IN PARALLEL ──────────────────────────────────
  console.log('\nSTEP 4 — running 5 models in parallel (this is the spend)…\n');

  interface Candidate { caseLabel: string; model: string; input: Record<string, unknown>; cost: string }
  const candidates: Candidate[] = [
    { caseLabel: 'A', model: 'fal-ai/sync-lipsync/v2/pro', input: { video_url: footageUrl, audio_url: audioUrl }, cost: 'tiered' },
    { caseLabel: 'A', model: 'fal-ai/sync-lipsync/v3', input: { video_url: footageUrl, audio_url: audioUrl }, cost: '$8/min' },
    { caseLabel: 'A', model: 'fal-ai/latentsync', input: { video_url: footageUrl, audio_url: audioUrl }, cost: '$0.20/40s' },
    { caseLabel: 'B', model: 'fal-ai/bytedance/omnihuman/v1.5', input: { image_url: imageUrl, audio_url: audioUrl }, cost: '$0.16/s' },
    { caseLabel: 'B', model: 'fal-ai/kling-video/ai-avatar/v2/pro', input: { image_url: imageUrl, audio_url: audioUrl }, cost: 'per-page' },
  ];

  const results = await Promise.all(
    candidates.map(async (c) => {
      const started = Date.now();
      try {
        const out = await falQueue(c.model, c.input, key, c.model);
        const rawUrl = mediaUrl(out, 'video');
        const desc = c.caseLabel === 'A'
          ? `Case A candidate: re-synced the stand-in footage to the bake-off voice line. Model ${c.model}.`
          : `Case B candidate: talking head generated from one reference image + the bake-off voice line. Model ${c.model}.`;
        const ourUrl = await saveToLibrary(rawUrl, `Lip-sync bake-off — Case ${c.caseLabel}: ${c.model}`, desc, [`case-${c.caseLabel.toLowerCase()}`, 'output'], c.model);
        return { ...c, ok: true as const, url: ourUrl, seconds: Math.round((Date.now() - started) / 1000) };
      } catch (err) {
        return { ...c, ok: false as const, error: err instanceof Error ? err.message : String(err), seconds: Math.round((Date.now() - started) / 1000) };
      }
    }),
  );

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════ BAKE-OFF RESULTS ══════════════════');
  console.log('Shared inputs:');
  console.log('  audio  :', audioUrl);
  console.log('  image  :', imageUrl);
  console.log('  footage:', footageUrl);
  console.log('');
  for (const caseLabel of ['A', 'B'] as const) {
    console.log(caseLabel === 'A' ? 'CASE A — lip-sync existing footage (your green-screen path):' : 'CASE B — talking head from one image:');
    for (const r of results.filter((x) => x.caseLabel === caseLabel)) {
      if (r.ok) {
        console.log(`  ✓ ${r.model.padEnd(38)} ${String(r.seconds).padStart(4)}s  ${r.cost.padEnd(10)}  ${r.url}`);
      } else {
        console.log(`  ✗ ${r.model.padEnd(38)} ${String(r.seconds).padStart(4)}s  FAILED: ${r.error}`);
      }
    }
    console.log('');
  }
  const okCount = results.filter((r) => r.ok).length;
  console.log(`${okCount}/${results.length} models produced a clip. Watch the URLs above side-by-side to judge.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ BAKE-OFF ERROR:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
