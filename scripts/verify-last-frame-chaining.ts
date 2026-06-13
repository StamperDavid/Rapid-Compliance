/**
 * VERIFICATION (one-off): last-frame chaining produces a seamless continuous video.
 *
 * This is the backbone proof for long-form video. It dogfoods the NEW provider
 * abstraction (src/lib/video/providers) — NOT the legacy Hedra path.
 *
 *   1. CLIP 1  — provider.generateVideo (reference-to-video) from the Velocity image.
 *   2. EXTRACT — pull the LAST FRAME of clip1 as a PNG (ffmpeg, same mechanism as
 *                src/app/api/video/assemble/route.ts → ensureFfmpeg + runFfmpeg).
 *   3. UPLOAD  — push that frame to Firebase Storage, get a PUBLIC download URL.
 *   4. CLIP 2  — provider.generateFromStartFrame (image-to-video) from that frame.
 *   5. STITCH  — concat clip1 + clip2 into ONE mp4 (re-encoded for safety).
 *   6. REGISTER— upload all 4 artifacts + register each in the media library.
 *   7. PRINT   — every public URL + asset id, then "CHAINING PROOF DONE".
 *
 * The stitched video is the key deliverable: the operator watches the join to
 * judge whether last-frame chaining is seamless.
 *
 * Run: npx tsx scripts/verify-last-frame-chaining.ts
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
  // ~10 min ceiling at 5s intervals — comfortably over a 5s clip's render time.
  for (let i = 0; i < 120; i += 1) {
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
          source: 'chaining-verification',
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

async function main(): Promise<void> {
  console.log('=== Last-frame chaining verification (dogfooding the fal provider) ===\n');

  // Pre-flight: make sure ffmpeg is actually available BEFORE spending money on
  // a generation. ensureFfmpeg is the exact mechanism the assemble route uses.
  let ffmpegPath: string;
  try {
    ffmpegPath = await ensureFfmpeg();
  } catch (e) {
    fail('ffmpeg availability check', e);
  }
  console.log(`ffmpeg binary: ${ffmpegPath}\n`);

  const workDir = await createWorkDir('chaining-verify');
  console.log(`work dir: ${workDir}\n`);

  // ── STEP 1: CLIP 1 (reference-to-video from the Velocity image) ───────────────
  console.log('STEP 1: generating CLIP 1 (reference-to-video)...');
  const clip1Req: VideoGenerateRequest = {
    prompt:
      'Velocity, a stylized comic-book superhero with brown hair and full beard and a dark navy suit with glowing purple accents, rides a galloping horse across a long stone bridge toward a glowing city skyline at dusk, cinematic comic/Pixar style, wide tracking shot',
    imageUrls: [VELOCITY_IMG],
    resolution: '720p',
    aspectRatio: '16:9',
    durationSeconds: 5,
  };
  let clip1Gen: string;
  try {
    const submitted = await provider.generateVideo(clip1Req, ctx);
    clip1Gen = submitted.generationId;
  } catch (e) {
    fail('CLIP 1 submit', e);
  }
  console.log(`  submitted: ${clip1Gen}`);
  const clip1Url = await pollToCompletion(clip1Gen, 'clip1');
  console.log(`  clip1 ready: ${clip1Url}`);
  const clip1Path = join(workDir, 'clip1.mp4');
  await download(clip1Url, clip1Path, 'clip1');
  console.log(`  downloaded clip1 -> ${clip1Path}\n`);

  // ── STEP 2: EXTRACT last frame of clip1 ───────────────────────────────────────
  console.log('STEP 2: extracting LAST FRAME of clip1...');
  const lastFramePath = join(workDir, 'lastframe.png');
  // Probe the duration first so we can do a reliable duration-based seek if the
  // -sseof end-relative seek proves flaky on this build.
  let clip1Duration = 0;
  try {
    const probe = await probeVideo(clip1Path);
    clip1Duration = probe.duration;
    console.log(`  clip1 duration: ${clip1Duration.toFixed(2)}s`);
  } catch (e) {
    console.log(`  (probe failed, will rely on -sseof: ${e instanceof Error ? e.message : String(e)})`);
  }

  // Primary attempt: end-relative seek — grab the frame ~0.1s before the end.
  let frameExtracted = false;
  try {
    await runFfmpeg([
      '-sseof', '-0.1',
      '-i', clip1Path,
      '-frames:v', '1',
      '-update', '1',
      '-y',
      lastFramePath,
    ]);
    const stat = await readFile(lastFramePath);
    if (stat.length > 0) { frameExtracted = true; }
  } catch (e) {
    console.log(`  -sseof attempt failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback: duration-based seek to ~0.05s before the end.
  if (!frameExtracted) {
    if (clip1Duration <= 0) {
      fail('extract last frame', '-sseof failed and duration unknown — cannot seek');
    }
    const seekTo = Math.max(0, clip1Duration - 0.05);
    console.log(`  fallback: seeking to ${seekTo.toFixed(2)}s`);
    try {
      await runFfmpeg([
        '-ss', seekTo.toFixed(3),
        '-i', clip1Path,
        '-frames:v', '1',
        '-update', '1',
        '-y',
        lastFramePath,
      ]);
      const stat = await readFile(lastFramePath);
      if (stat.length > 0) { frameExtracted = true; }
    } catch (e) {
      fail('extract last frame (fallback)', e);
    }
  }
  if (!frameExtracted) {
    fail('extract last frame', 'no frame produced by either method');
  }
  const lastFrameBuf = await readFile(lastFramePath);
  console.log(`  last frame extracted: ${lastFramePath} (${lastFrameBuf.length} bytes)\n`);

  // ── STEP 3: UPLOAD last frame, get a PUBLIC URL ───────────────────────────────
  console.log('STEP 3: uploading last frame to Firebase Storage...');
  const frameId = randomUUID();
  const framePath = `organizations/${PLATFORM_ID}/media/images/${frameId}.png`;
  const lastFrameUrl = await uploadPublic(lastFrameBuf, framePath, 'image/png', 'lastframe');
  console.log(`  last frame URL: ${lastFrameUrl}\n`);

  // ── STEP 4: CLIP 2 (image-to-video from the last frame) ───────────────────────
  console.log('STEP 4: generating CLIP 2 (image-to-video from last frame)...');
  const clip2Req: VideoGenerateRequest = {
    prompt:
      'the same superhero on the same horse rides forward off the bridge and in through the city gate into the streets, seamless continuation of the motion, cinematic comic/Pixar style',
    resolution: '720p',
    aspectRatio: '16:9',
    durationSeconds: 5,
  };
  let clip2Gen: string;
  try {
    const submitted = await provider.generateFromStartFrame(lastFrameUrl, clip2Req, ctx);
    clip2Gen = submitted.generationId;
  } catch (e) {
    fail('CLIP 2 submit', e);
  }
  console.log(`  submitted: ${clip2Gen}`);
  const clip2Url = await pollToCompletion(clip2Gen, 'clip2');
  console.log(`  clip2 ready: ${clip2Url}`);
  const clip2Path = join(workDir, 'clip2.mp4');
  await download(clip2Url, clip2Path, 'clip2');
  console.log(`  downloaded clip2 -> ${clip2Path}\n`);

  // ── STEP 5: STITCH clip1 + clip2 into one mp4 (re-encode for safety) ──────────
  console.log('STEP 5: stitching clip1 + clip2 into one mp4...');
  const stitchedPath = join(workDir, 'stitched.mp4');
  // concat filter with a full re-encode — robust to differing SAR/fps/codecs
  // between the two clips. Normalize both to 1280x720 @ 30fps before concat.
  const filter = [
    '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0]',
    '[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1]',
    '[v0][v1]concat=n=2:v=1:a=0[outv]',
  ].join(';');
  try {
    await runFfmpeg([
      '-i', clip1Path,
      '-i', clip2Path,
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

  // ── STEP 6: UPLOAD all 4 artifacts + register each in the media library ───────
  console.log('STEP 6: uploading artifacts + registering in media library...');

  const clip1Buf = await readFile(clip1Path);
  const clip2Buf = await readFile(clip2Path);

  const stitchedStoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
  const clip1StoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
  const clip2StoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;

  const stitchedUrl = await uploadPublic(stitchedBuf, stitchedStoragePath, 'video/mp4', 'stitched');
  const clip1StoredUrl = await uploadPublic(clip1Buf, clip1StoragePath, 'video/mp4', 'clip1-stored');
  const clip2StoredUrl = await uploadPublic(clip2Buf, clip2StoragePath, 'video/mp4', 'clip2-stored');
  // last frame already uploaded in step 3 — reuse lastFrameUrl / lastFrameBuf.

  const stitchedAssetId = await register({
    type: 'video',
    category: 'final-render',
    name: 'Chaining proof — seamless continuation (Velocity bridge→city)',
    description:
      'KEY DELIVERABLE. clip1 (reference-to-video) + clip2 (image-to-video from clip1 last frame), ' +
      'stitched into one continuous mp4. Watch the join (~5s mark) to judge whether last-frame chaining is seamless.',
    url: stitchedUrl,
    mimeType: 'video/mp4',
    fileSize: stitchedBuf.length,
    tags: ['chaining-test'],
  });

  const clip1AssetId = await register({
    type: 'video',
    category: 'video-clip',
    name: 'Chaining proof — clip 1 (reference-to-video, bridge)',
    description: 'First half of the chaining proof. Reference-to-video from the Velocity image.',
    url: clip1StoredUrl,
    mimeType: 'video/mp4',
    fileSize: clip1Buf.length,
    tags: ['chaining-test'],
  });

  const clip2AssetId = await register({
    type: 'video',
    category: 'video-clip',
    name: 'Chaining proof — clip 2 (image-to-video, into the city)',
    description: 'Second half of the chaining proof. Image-to-video continued from clip 1 last frame.',
    url: clip2StoredUrl,
    mimeType: 'video/mp4',
    fileSize: clip2Buf.length,
    tags: ['chaining-test'],
  });

  const frameAssetId = await register({
    type: 'image',
    category: 'thumbnail',
    name: 'Chaining proof — splice point (clip 1 last frame)',
    description: 'The exact frame handed to clip 2 as its start frame. The splice point of the chain.',
    url: lastFrameUrl,
    mimeType: 'image/png',
    fileSize: lastFrameBuf.length,
    tags: ['chaining-test'],
  });

  // ── STEP 7: PRINT everything ──────────────────────────────────────────────────
  console.log('\n=== RESULTS ===');
  console.log('\nKEY DELIVERABLE — STITCHED VIDEO (watch the join):');
  console.log(`  assetId: ${stitchedAssetId}`);
  console.log(`  url:     ${stitchedUrl}`);
  console.log('\nClip 1 (reference-to-video):');
  console.log(`  assetId: ${clip1AssetId}`);
  console.log(`  url:     ${clip1StoredUrl}`);
  console.log('\nClip 2 (image-to-video from last frame):');
  console.log(`  assetId: ${clip2AssetId}`);
  console.log(`  url:     ${clip2StoredUrl}`);
  console.log('\nSplice point (clip 1 last frame, PNG):');
  console.log(`  assetId: ${frameAssetId}`);
  console.log(`  url:     ${lastFrameUrl}`);
  console.log('\nCHAINING PROOF DONE');
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('\nCHAINING PROOF FAILED');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
