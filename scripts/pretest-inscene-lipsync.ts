/**
 * PRE-TEST — speaking clone IN A SCENE (the real use case).
 *
 * Generates a character, a stock voice line, and TWO Seedance scene clips at
 * different framings (MEDIUM = face clear, WIDE = full body / face small), then
 * lip-syncs EACH scene with the three Case-A models. Saves everything to the media
 * library so you can judge, in-app, where in-scene lip-sync holds vs breaks.
 *
 *   image (Flux) · voice line (ElevenLabs on fal) ·
 *   scene MEDIUM + scene WIDE (Seedance ref-to-video) ·
 *   lip-sync each scene with: sync-lipsync/v2/pro, sync-lipsync/v3, latentsync
 *
 * Spends fal credits on purpose. Usage: npx tsx scripts/pretest-inscene-lipsync.ts
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
const LINE = "I've been waiting for you. We don't have much time, so listen carefully — everything changes tonight.";
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface FalSubmit { status_url: string; response_url: string }
interface FalStatus { status: string }

async function falQueue(model: string, input: Record<string, unknown>, key: string, label: string): Promise<Record<string, unknown>> {
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!submit.ok) { throw new Error(`${label} submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`); }
  const sub = (await submit.json()) as FalSubmit;
  for (let i = 0; i < 300; i += 1) {
    await sleep(3000);
    const s = await fetch(sub.status_url, { headers: { Authorization: `Key ${key}` } });
    const sj = (await s.json()) as FalStatus;
    if (sj.status === 'COMPLETED') {
      const r = await fetch(sub.response_url, { headers: { Authorization: `Key ${key}` } });
      return (await r.json()) as Record<string, unknown>;
    }
    if (sj.status === 'FAILED' || sj.status === 'ERROR') { throw new Error(`${label} failed: ${JSON.stringify(sj).slice(0, 300)}`); }
  }
  throw new Error(`${label} timed out`);
}

function mediaUrl(out: Record<string, unknown>, kind: 'video' | 'audio'): string {
  const node = out[kind];
  if (node && typeof node === 'object' && typeof (node as { url?: unknown }).url === 'string') { return (node as { url: string }).url; }
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
  if (!key) { throw new Error('No fal API key in Firestore.'); }
  if (!adminStorage) { throw new Error('adminStorage not initialized'); }

  /** Persist + register in the library. forceKind overrides content-type detection
   *  (lip-sync outputs are videos even when fal mislabels their content-type). */
  async function save(srcUrl: string, name: string, description: string, tags: string[], aiProvider: string, forceKind?: 'video'): Promise<string> {
    const resp = await fetch(srcUrl, { redirect: 'follow' });
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get('content-type') ?? '';
    const isVideo = forceKind === 'video' || ct.includes('video') || ct.includes('mp4');
    const isAudio = !isVideo && (ct.includes('audio') || ct.includes('mpeg') || ct.includes('mp3') || ct.includes('wav'));
    const ext = isVideo ? 'mp4' : isAudio ? 'mp3' : ct.includes('png') ? 'png' : 'jpg';
    const folder = isVideo ? 'videos' : isAudio ? 'audio' : 'images';
    const contentType = isVideo ? 'video/mp4' : isAudio ? 'audio/mpeg' : ct.includes('png') ? 'image/png' : 'image/jpeg';
    const slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const path = `organizations/${PLATFORM_ID}/media/${folder}/clonetest-${slug}-${randomUUID()}.${ext}`;
    const token = randomUUID();
    await adminStorage!.bucket(BUCKET).file(path).save(buf, { metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } });
    const url = firebaseDownloadUrl(BUCKET, path, token);
    await createAsset({
      type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
      category: isVideo ? 'final-render' : isAudio ? 'voiceover' : 'photo',
      name, description, url, mimeType: contentType, fileSize: buf.length,
      source: 'ai-generated', aiProvider, createdBy: 'system', tags: ['clone-inscene-pretest', ...tags],
    });
    return url;
  }

  const provider = getVideoEngineProvider('fal');
  async function seedanceScene(prompt: string, imageUrl: string, aspect: string, label: string): Promise<string> {
    const submitted = await provider.generateVideo(
      { prompt, imageUrls: [imageUrl], resolution: '720p', aspectRatio: aspect, durationSeconds: 5, generateAudio: false },
      { tenantId: PLATFORM_ID },
    );
    for (let i = 0; i < 240; i += 1) {
      await sleep(3000);
      const st = await provider.getStatus(submitted.generationId, { tenantId: PLATFORM_ID });
      if (st.status === 'completed' && st.videoUrl) { return st.videoUrl; }
      if (st.status === 'failed') { throw new Error(`${label} scene failed: ${st.error ?? 'unknown'}`); }
    }
    throw new Error(`${label} scene timed out`);
  }

  // ── Inputs ────────────────────────────────────────────────────────────────
  console.log('STEP 1 — character image (Flux)…');
  const portrait = await generateWithFal(
    'Full-body photorealistic portrait of a striking woman in her early 30s with dark wavy hair, wearing a charcoal trench coat, standing, sharp facial detail, neutral studio background, cinematic lighting.',
    { aspectRatio: '9:16' },
  );
  const imageUrl = portrait.url;
  if (!imageUrl) { throw new Error('no portrait url'); }
  console.log('  image:', imageUrl);
  await save(imageUrl, 'Clone pre-test — character reference', 'The character whose identity anchors the scenes.', ['input', 'image'], 'fal-flux');

  console.log('STEP 2 — voice line (ElevenLabs on fal, stock voice)…');
  const ttsOut = await falQueue('fal-ai/elevenlabs/tts/eleven-v3', { text: LINE }, key, 'tts');
  const audioUrl = mediaUrl(ttsOut, 'audio');
  console.log('  audio:', audioUrl);
  await save(audioUrl, 'Clone pre-test — voice line', 'The line the in-scene clone lip-syncs to.', ['input', 'audio'], 'fal-elevenlabs');

  console.log('STEP 3 — Seedance scene clips (MEDIUM + WIDE)…');
  const sceneMedium = await seedanceScene(
    'Medium shot, the character stands in a moody neon-lit alley at night and speaks directly to camera, head and upper body clearly visible, cinematic.',
    imageUrl, '16:9', 'medium',
  );
  console.log('  scene MEDIUM:', sceneMedium);
  await save(sceneMedium, 'Clone pre-test — scene MEDIUM (before lip-sync)', 'Seedance scene, medium framing, face clearly visible.', ['input', 'scene', 'medium'], 'fal-seedance', 'video');

  const sceneWide = await seedanceScene(
    'Wide cinematic shot, the character walks down a rain-soaked neon city street at night, FULL BODY visible and smaller in the frame, atmospheric.',
    imageUrl, '16:9', 'wide',
  );
  console.log('  scene WIDE:', sceneWide);
  await save(sceneWide, 'Clone pre-test — scene WIDE (before lip-sync)', 'Seedance scene, wide framing, full body / face small.', ['input', 'scene', 'wide'], 'fal-seedance', 'video');

  // ── Lip-sync each framing with the 3 Case-A models, in parallel ─────────────
  console.log('\nSTEP 4 — lip-syncing both framings with 3 models (the spend)…\n');
  const models = ['fal-ai/sync-lipsync/v2/pro', 'fal-ai/sync-lipsync/v3', 'fal-ai/latentsync'];
  const framings: { key: string; url: string }[] = [
    { key: 'MEDIUM', url: sceneMedium },
    { key: 'WIDE', url: sceneWide },
  ];
  const jobs = framings.flatMap((f) => models.map((m) => ({ framing: f.key, model: m, sceneUrl: f.url })));

  const results = await Promise.all(jobs.map(async (j) => {
    const started = Date.now();
    try {
      const out = await falQueue(j.model, { video_url: j.sceneUrl, audio_url: audioUrl }, key, `${j.framing}/${j.model}`);
      const raw = mediaUrl(out, 'video');
      const url = await save(
        raw, `Clone pre-test — ${j.framing} — ${j.model}`,
        `In-scene lip-sync. Framing ${j.framing}. Model ${j.model}.`,
        [j.framing.toLowerCase(), 'output'], j.model, 'video',
      );
      return { ...j, ok: true as const, url, seconds: Math.round((Date.now() - started) / 1000) };
    } catch (err) {
      return { ...j, ok: false as const, error: err instanceof Error ? err.message : String(err), seconds: Math.round((Date.now() - started) / 1000) };
    }
  }));

  console.log('\n══════════ IN-SCENE LIP-SYNC PRE-TEST RESULTS ══════════');
  for (const f of ['MEDIUM', 'WIDE']) {
    console.log(`\n${f} framing:`);
    for (const r of results.filter((x) => x.framing === f)) {
      console.log(r.ok ? `  ✓ ${r.model.padEnd(30)} ${String(r.seconds).padStart(4)}s  ${r.url}` : `  ✗ ${r.model.padEnd(30)} FAILED: ${r.error}`);
    }
  }
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} clips produced — all in the library under tag "clone-inscene-pretest". Judge MEDIUM vs WIDE per model.`);
  process.exit(0);
}
main().catch((e) => { console.error('\n❌ PRE-TEST ERROR:', e instanceof Error ? e.message : String(e)); process.exit(1); });
