/**
 * VERIFICATION (one-off): TRUE multi-scene narrative chaining across 3 scenes.
 *
 * This extends scripts/verify-last-frame-chaining.ts from 2 clips to 3 chained
 * scenes. The backbone mechanism is identical (last-frame → start-frame chaining
 * via the provider abstraction, dogfooding the fal Seedance provider). The KEY
 * DIFFERENCE: every next-scene prompt AGGRESSIVELY
 * drives FORWARD narrative progression (new location, camera moving forward) so the
 * model EXTENDS the story rather than re-angling the same moment.
 *
 * The narrative arc:
 *   Scene 1 — Velocity sprints FORWARD across a long stone bridge toward a city.
 *   Scene 2 — He rides OFF the bridge and DASHES THROUGH the city streets to a shop.
 *   Scene 3 — He dismounts and WALKS THROUGH the shop door INTO the interior.
 *
 *   1. SCENE 1  — provider.generateVideo (reference-to-video) from the Velocity image.
 *   2. EXTRACT  — pull the LAST FRAME of scene1 as a PNG (ffmpeg).
 *   3. UPLOAD   — push that frame to Firebase Storage → frame1Url (public).
 *   4. SCENE 2  — provider.generateFromStartFrame (image-to-video) from frame1Url.
 *   5. EXTRACT  — pull the LAST FRAME of scene2 → frame2Url (public).
 *   6. SCENE 3  — provider.generateFromStartFrame (image-to-video) from frame2Url.
 *   7. STITCH   — concat scene1 + scene2 + scene3 into ONE mp4 (re-encoded).
 *   8. REGISTER — upload all artifacts + register each in the media library.
 *   9. PRINT    — every public URL + asset id, then "MULTI-SCENE CHAIN DONE".
 *
 * The stitched video is the key deliverable: the operator watches it to judge
 * whether scenes 2 and 3 PROGRESS FORWARD (new locations) vs re-angle.
 *
 * Run: npx tsx scripts/verify-multi-scene-chaining.ts
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getVideoEngineProvider } from '../src/lib/video/providers';
import type {
  TenantContext,
  VideoGenerateRequest,
  VideoGenerationStatus,
} from '../src/lib/video/providers';
import {
  ensureFfmpeg,
  runFfmpeg,
  probeVideo,
  createWorkDir,
} from '../src/lib/video/ffmpeg-utils';
import { adminStorage } from '../src/lib/firebase/admin';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { createAsset } from '../src/lib/media/media-library-service';
import { PLATFORM_ID } from '../src/lib/constants/platform';
import type { MediaAssetCategory } from '../src/types/media-library';

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const VELOCITY_IMG =
  'https://firebasestorage.googleapis.com/v0/b/rapid-compliance-65f87.firebasestorage.app/o/organizations%2Frapid-compliance-root%2Fmedia%2Fimages%2Fad5e2703-5bab-4872-aa1d-c0b11d21f7f8.png?alt=media&token=7f14e23f-f737-460a-a01a-62fe20f1f4bb';

const ctx: TenantContext = { tenantId: PLATFORM_ID };
const provider = getVideoEngineProvider('fal');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Fail loudly with a clear "where did it break" prefix. */
function fail(step: string, detail: unknown): never {
  const msg = detail instanceof Error ? detail.message : String(detail);
  throw new Error(`[STEP FAILED: ${step}] ${msg}`);
}

/** Poll a provider generation to completion. Returns the video URL or throws. */
async function pollToCompletion(generationId: string, label: string): Promise<string> {
  // ~30 min ceiling at 5s intervals — seedance-2.0 can queue for a while under load.
  for (let i = 0; i < 360; i += 1) {
    await sleep(5000);
    let status: VideoGenerationStatus;
    try {
      status = await provider.getStatus(generationId, ctx);
    } catch (e) {
      fail(`${label} poll`, e);
    }
    console.log(`  [${label}] poll ${i}: ${status.status}`);
    if (status.status === 'completed') {
      if (!status.videoUrl) {
        fail(`${label} poll`, 'status=completed but no videoUrl');
      }
      return status.videoUrl;
    }
    if (status.status === 'failed') {
      fail(`${label} poll`, status.error ?? 'generation failed');
    }
  }
  fail(`${label} poll`, 'timed out after ~10 minutes');
}

/** Download a remote mp4 to a local path. */
async function download(url: string, destPath: string, label: string): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch(url, { redirect: 'follow' });
  } catch (e) {
    fail(`download ${label}`, e);
  }
  if (!resp.ok) {
    fail(`download ${label}`, `${resp.status} ${resp.statusText}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length === 0) {
    fail(`download ${label}`, 'downloaded 0 bytes');
  }
  await writeFile(destPath, buf);
}

/** Upload a local file buffer to Firebase Storage; return a permanent public URL. */
async function uploadPublic(
  buf: Buffer,
  storagePath: string,
  contentType: string,
  label: string,
): Promise<string> {
  if (!adminStorage) {
    fail(`upload ${label}`, 'adminStorage is null (Firebase Admin not initialized)');
  }
  const token = randomUUID();
  try {
    await adminStorage.bucket(BUCKET).file(storagePath).save(buf, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: token,
          source: 'multi-scene-chaining-verification',
        },
      },
    });
  } catch (e) {
    fail(`upload ${label}`, e);
  }
  return firebaseDownloadUrl(BUCKET, storagePath, token);
}

/** Register an asset in the media library; return the asset id. */
async function register(args: {
  type: 'video' | 'image';
  category: MediaAssetCategory;
  name: string;
  description: string;
  url: string;
  mimeType: string;
  fileSize: number;
  tags: string[];
}): Promise<string> {
  try {
    const asset = await createAsset({
      type: args.type,
      category: args.category,
      name: args.name,
      description: args.description,
      url: args.url,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      source: 'ai-generated',
      aiProvider: 'fal-seedance',
      createdBy: 'system',
      tags: args.tags,
    });
    return asset.id;
  } catch (e) {
    return fail(`register ${args.name}`, e);
  }
}

/**
 * Extract the LAST frame of a clip as a PNG. Mirrors the dual-strategy extraction
 * in verify-last-frame-chaining.ts: primary end-relative -sseof seek, fallback to a
 * duration-based seek if -sseof proves flaky on this ffmpeg build.
 */
async function extractLastFrame(
  clipPath: string,
  outPath: string,
  label: string,
): Promise<Buffer> {
  let duration = 0;
  try {
    const probe = await probeVideo(clipPath);
    duration = probe.duration;
    console.log(`  ${label} duration: ${duration.toFixed(2)}s`);
  } catch (e) {
    console.log(`  (probe failed for ${label}, will rely on -sseof: ${e instanceof Error ? e.message : String(e)})`);
  }

  // Primary attempt: end-relative seek — grab the frame ~0.1s before the end.
  let frameExtracted = false;
  try {
    await runFfmpeg([
      '-sseof', '-0.1',
      '-i', clipPath,
      '-frames:v', '1',
      '-update', '1',
      '-y',
      outPath,
    ]);
    const stat = await readFile(outPath);
    if (stat.length > 0) { frameExtracted = true; }
  } catch (e) {
    console.log(`  -sseof attempt failed for ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback: duration-based seek to ~0.05s before the end.
  if (!frameExtracted) {
    if (duration <= 0) {
      fail(`extract last frame (${label})`, '-sseof failed and duration unknown — cannot seek');
    }
    const seekTo = Math.max(0, duration - 0.05);
    console.log(`  fallback: seeking to ${seekTo.toFixed(2)}s for ${label}`);
    try {
      await runFfmpeg([
        '-ss', seekTo.toFixed(3),
        '-i', clipPath,
        '-frames:v', '1',
        '-update', '1',
        '-y',
        outPath,
      ]);
      const stat = await readFile(outPath);
      if (stat.length > 0) { frameExtracted = true; }
    } catch (e) {
      fail(`extract last frame (${label}, fallback)`, e);
    }
  }
  if (!frameExtracted) {
    fail(`extract last frame (${label})`, 'no frame produced by either method');
  }
  const buf = await readFile(outPath);
  console.log(`  ${label} last frame extracted: ${outPath} (${buf.length} bytes)`);
  return buf;
}

async function main(): Promise<void> {
  console.log('=== Multi-scene chaining verification (3 chained scenes, fal provider) ===\n');

  // Pre-flight: make sure ffmpeg is actually available BEFORE spending money on
  // generations. ensureFfmpeg is the exact mechanism the assemble route uses.
  let ffmpegPath: string;
  try {
    ffmpegPath = await ensureFfmpeg();
  } catch (e) {
    fail('ffmpeg availability check', e);
  }
  console.log(`ffmpeg binary: ${ffmpegPath}\n`);

  const workDir = await createWorkDir('multi-scene-verify');
  console.log(`work dir: ${workDir}\n`);

  // ── SCENE 1: reference-to-video — establish Velocity, sprint forward over bridge ─
  console.log('SCENE 1: generating (reference-to-video)...');
  const scene1Req: VideoGenerateRequest = {
    prompt:
      '@Image1 is Velocity, a stylized comic-book superhero with brown hair, full beard, ' +
      'and a dark navy suit with glowing purple accents. He springs into action on a galloping ' +
      'horse and SPRINTS FORWARD across a long stone bridge toward a glowing city skyline at dusk. ' +
      'The camera TRACKS FORWARD following him. The shot ENDS as he reaches the far end of the ' +
      'bridge at the city edge. Cinematic comic / Pixar style.',
    imageUrls: [VELOCITY_IMG],
    resolution: '720p',
    aspectRatio: '16:9',
    durationSeconds: 5,
  };
  let scene1Gen: string;
  try {
    const submitted = await provider.generateVideo(scene1Req, ctx);
    scene1Gen = submitted.generationId;
  } catch (e) {
    fail('SCENE 1 submit', e);
  }
  console.log(`  submitted: ${scene1Gen}`);
  const scene1Url = await pollToCompletion(scene1Gen, 'scene1');
  console.log(`  scene1 ready: ${scene1Url}`);
  const scene1Path = join(workDir, 'scene1.mp4');
  await download(scene1Url, scene1Path, 'scene1');
  console.log(`  downloaded scene1 -> ${scene1Path}\n`);

  // ── EXTRACT last frame of scene1 → frame1Url ──────────────────────────────────
  console.log('Extracting LAST FRAME of scene1...');
  const frame1Path = join(workDir, 'frame1.png');
  const frame1Buf = await extractLastFrame(scene1Path, frame1Path, 'scene1');
  const frame1Id = randomUUID();
  const frame1StoragePath = `organizations/${PLATFORM_ID}/media/images/${frame1Id}.png`;
  const frame1Url = await uploadPublic(frame1Buf, frame1StoragePath, 'image/png', 'frame1');
  console.log(`  frame1 URL: ${frame1Url}\n`);

  // ── SCENE 2: image-to-video from frame1Url — ride into the city to the shop ─────
  console.log('SCENE 2: generating (image-to-video from frame1)...');
  const scene2Req: VideoGenerateRequest = {
    prompt:
      'Continuing FORWARD from this exact frame: the same superhero on the same horse rides OFF ' +
      'the bridge and DASHES THROUGH the busy city streets, tall buildings rushing past on both ' +
      'sides, the camera TRACKING FORWARD with him, until he arrives and reins to a stop at the ' +
      'storefront door of a small business. New location, forward motion, NOT a re-angle of the ' +
      'bridge. The shot ENDS with him stopped at the shop door. Same character, seamless ' +
      'continuation, cinematic comic / Pixar style.',
    resolution: '720p',
    aspectRatio: '16:9',
    durationSeconds: 5,
  };
  let scene2Gen: string;
  try {
    const submitted = await provider.generateFromStartFrame(frame1Url, scene2Req, ctx);
    scene2Gen = submitted.generationId;
  } catch (e) {
    fail('SCENE 2 submit', e);
  }
  console.log(`  submitted: ${scene2Gen}`);
  const scene2Url = await pollToCompletion(scene2Gen, 'scene2');
  console.log(`  scene2 ready: ${scene2Url}`);
  const scene2Path = join(workDir, 'scene2.mp4');
  await download(scene2Url, scene2Path, 'scene2');
  console.log(`  downloaded scene2 -> ${scene2Path}\n`);

  // ── EXTRACT last frame of scene2 → frame2Url ──────────────────────────────────
  console.log('Extracting LAST FRAME of scene2...');
  const frame2Path = join(workDir, 'frame2.png');
  const frame2Buf = await extractLastFrame(scene2Path, frame2Path, 'scene2');
  const frame2Id = randomUUID();
  const frame2StoragePath = `organizations/${PLATFORM_ID}/media/images/${frame2Id}.png`;
  const frame2Url = await uploadPublic(frame2Buf, frame2StoragePath, 'image/png', 'frame2');
  console.log(`  frame2 URL: ${frame2Url}\n`);

  // ── SCENE 3: image-to-video from frame2Url — walk into the shop interior ────────
  console.log('SCENE 3: generating (image-to-video from frame2)...');
  const scene3Req: VideoGenerateRequest = {
    prompt:
      'Continuing FORWARD from this exact frame: the same superhero dismounts and WALKS THROUGH ' +
      'the shop front door INTO the warm interior, the camera following him inside, approaching a ' +
      'nervous small-business owner seated at a computer. New interior location, forward motion. ' +
      'Same character, seamless continuation, cinematic comic / Pixar style.',
    resolution: '720p',
    aspectRatio: '16:9',
    durationSeconds: 5,
  };
  let scene3Gen: string;
  try {
    const submitted = await provider.generateFromStartFrame(frame2Url, scene3Req, ctx);
    scene3Gen = submitted.generationId;
  } catch (e) {
    fail('SCENE 3 submit', e);
  }
  console.log(`  submitted: ${scene3Gen}`);
  const scene3Url = await pollToCompletion(scene3Gen, 'scene3');
  console.log(`  scene3 ready: ${scene3Url}`);
  const scene3Path = join(workDir, 'scene3.mp4');
  await download(scene3Url, scene3Path, 'scene3');
  console.log(`  downloaded scene3 -> ${scene3Path}\n`);

  // ── STITCH scene1 + scene2 + scene3 into one mp4 (re-encode for safety) ─────────
  console.log('STITCH: concatenating scene1 + scene2 + scene3 into one mp4...');
  const stitchedPath = join(workDir, 'stitched.mp4');
  // concat filter with a full re-encode — robust to differing SAR/fps/codecs.
  // Normalize all three to 1280x720 @ 30fps before concat (same as prior script).
  const filter = [
    '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0]',
    '[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1]',
    '[2:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v2]',
    '[v0][v1][v2]concat=n=3:v=1:a=0[outv]',
  ].join(';');
  try {
    await runFfmpeg([
      '-i', scene1Path,
      '-i', scene2Path,
      '-i', scene3Path,
      '-filter_complex', filter,
      '-map', '[outv]',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-y',
      stitchedPath,
    ]);
  } catch (e) {
    fail('stitch', e);
  }
  const stitchedBuf = await readFile(stitchedPath);
  if (stitchedBuf.length === 0) {
    fail('stitch', 'ffmpeg produced an empty stitched file');
  }
  console.log(`  stitched: ${stitchedPath} (${(stitchedBuf.length / 1048576).toFixed(2)} MB)\n`);

  // ── REGISTER: upload all artifacts + register each in the media library ─────────
  console.log('REGISTER: uploading artifacts + registering in media library...');

  const scene1Buf = await readFile(scene1Path);
  const scene2Buf = await readFile(scene2Path);
  const scene3Buf = await readFile(scene3Path);

  const stitchedStoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
  const scene1StoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
  const scene2StoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
  const scene3StoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;

  const stitchedUrl = await uploadPublic(stitchedBuf, stitchedStoragePath, 'video/mp4', 'stitched');
  const scene1StoredUrl = await uploadPublic(scene1Buf, scene1StoragePath, 'video/mp4', 'scene1-stored');
  const scene2StoredUrl = await uploadPublic(scene2Buf, scene2StoragePath, 'video/mp4', 'scene2-stored');
  const scene3StoredUrl = await uploadPublic(scene3Buf, scene3StoragePath, 'video/mp4', 'scene3-stored');
  // frame1 / frame2 already uploaded above — reuse frame1Url / frame2Url.

  const stitchedAssetId = await register({
    type: 'video',
    category: 'final-render',
    name: 'Multi-scene chain test — Velocity bridge→streets→shop',
    description:
      'KEY DELIVERABLE. scene1 (reference-to-video, bridge) + scene2 (image-to-video from scene1 ' +
      'last frame, city streets→shop door) + scene3 (image-to-video from scene2 last frame, into ' +
      'the shop interior), stitched into one continuous mp4. Watch for FORWARD narrative ' +
      'progression (new locations) vs re-angling the same moment.',
    url: stitchedUrl,
    mimeType: 'video/mp4',
    fileSize: stitchedBuf.length,
    tags: ['chaining-test'],
  });

  const scene1AssetId = await register({
    type: 'video',
    category: 'video-clip',
    name: 'Multi-scene chain — scene 1 (reference-to-video, bridge)',
    description: 'Scene 1 of 3. Reference-to-video from the Velocity image: sprint forward across the bridge.',
    url: scene1StoredUrl,
    mimeType: 'video/mp4',
    fileSize: scene1Buf.length,
    tags: ['chaining-test'],
  });

  const scene2AssetId = await register({
    type: 'video',
    category: 'video-clip',
    name: 'Multi-scene chain — scene 2 (image-to-video, city streets→shop)',
    description: 'Scene 2 of 3. Image-to-video continued from scene 1 last frame: dash through the streets to the shop.',
    url: scene2StoredUrl,
    mimeType: 'video/mp4',
    fileSize: scene2Buf.length,
    tags: ['chaining-test'],
  });

  const scene3AssetId = await register({
    type: 'video',
    category: 'video-clip',
    name: 'Multi-scene chain — scene 3 (image-to-video, into the shop)',
    description: 'Scene 3 of 3. Image-to-video continued from scene 2 last frame: walk into the shop interior.',
    url: scene3StoredUrl,
    mimeType: 'video/mp4',
    fileSize: scene3Buf.length,
    tags: ['chaining-test'],
  });

  const frame1AssetId = await register({
    type: 'image',
    category: 'thumbnail',
    name: 'Multi-scene chain — splice 1 (scene 1 last frame)',
    description: 'The exact frame handed to scene 2 as its start frame. Splice point 1 → 2.',
    url: frame1Url,
    mimeType: 'image/png',
    fileSize: frame1Buf.length,
    tags: ['chaining-test'],
  });

  const frame2AssetId = await register({
    type: 'image',
    category: 'thumbnail',
    name: 'Multi-scene chain — splice 2 (scene 2 last frame)',
    description: 'The exact frame handed to scene 3 as its start frame. Splice point 2 → 3.',
    url: frame2Url,
    mimeType: 'image/png',
    fileSize: frame2Buf.length,
    tags: ['chaining-test'],
  });

  // ── PRINT everything ────────────────────────────────────────────────────────
  console.log('\n=== RESULTS ===');
  console.log('\nKEY DELIVERABLE — STITCHED 3-SCENE VIDEO (watch for forward progression):');
  console.log(`  assetId: ${stitchedAssetId}`);
  console.log(`  url:     ${stitchedUrl}`);
  console.log('\nScene 1 (reference-to-video, bridge):');
  console.log(`  assetId: ${scene1AssetId}`);
  console.log(`  url:     ${scene1StoredUrl}`);
  console.log('\nScene 2 (image-to-video, city streets→shop):');
  console.log(`  assetId: ${scene2AssetId}`);
  console.log(`  url:     ${scene2StoredUrl}`);
  console.log('\nScene 3 (image-to-video, into the shop):');
  console.log(`  assetId: ${scene3AssetId}`);
  console.log(`  url:     ${scene3StoredUrl}`);
  console.log('\nSplice 1 (scene 1 last frame, PNG → scene 2 start):');
  console.log(`  assetId: ${frame1AssetId}`);
  console.log(`  url:     ${frame1Url}`);
  console.log('\nSplice 2 (scene 2 last frame, PNG → scene 3 start):');
  console.log(`  assetId: ${frame2AssetId}`);
  console.log(`  url:     ${frame2Url}`);
  console.log('\nMULTI-SCENE CHAIN DONE');
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('\nMULTI-SCENE CHAIN FAILED');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
