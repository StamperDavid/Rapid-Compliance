/**
 * SALVAGE (one-off): rescue two already-generated clips from fal's TEMPORARY CDN.
 *
 * A 3-scene chain test (scripts/verify-multi-scene-chaining.ts) generated scenes 1
 * and 2 successfully, then failed on scene 3 (fal balance exhausted). Because that
 * script only registers artifacts at the very END — AFTER all three scenes are
 * generated — the two completed clips were never persisted. They live ONLY on fal's
 * temporary CDN and will expire.
 *
 * This script does DOWNLOAD + STITCH + PERSIST only. It DOES NOT call the fal
 * provider and DOES NOT generate anything (fal is balance-locked anyway). It reuses
 * the EXACT helpers from the source script: ffmpeg-utils (ensureFfmpeg / runFfmpeg /
 * probeVideo / createWorkDir), the normalize-to-1280x720@30fps libx264 concat, the
 * Firebase Storage uploadPublic helper, and the createAsset registration.
 *
 *   1. DOWNLOAD scene1 + scene2 from fal's temp CDN to a local work dir.
 *   2. STITCH   scene1 + scene2 into ONE mp4 (same normalize/concat as the source).
 *   3. UPLOAD   all three (stitched + scene1 + scene2) to Firebase Storage with
 *               permanent download-token URLs, and register each via createAsset.
 *   4. PRINT    every permanent URL + asset id, then "SALVAGE DONE".
 *
 * Run: npx tsx scripts/salvage-two-scene-chain.ts
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

// The two already-generated clips on fal's TEMPORARY CDN (no generation here).
const SCENE1_TEMP_URL = 'https://v3b.fal.media/files/b/0a9e1891/WUJR7T5s61zR6VQj3guuG_video.mp4';
const SCENE2_TEMP_URL = 'https://v3b.fal.media/files/b/0a9e18a1/Q5jUfToGGIUnvjzRyvv12_video.mp4';

/** Fail loudly with a clear "where did it break" prefix. */
function fail(step: string, detail: unknown): never {
  const msg = detail instanceof Error ? detail.message : String(detail);
  throw new Error(`[STEP FAILED: ${step}] ${msg}`);
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
  console.log(`  downloaded ${label} -> ${destPath} (${(buf.length / 1048576).toFixed(2)} MB)`);
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
          source: 'two-scene-chain-salvage',
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
  console.log('=== Salvage two-scene chain (download + stitch + persist; NO generation) ===\n');

  // Pre-flight: ffmpeg must be available before we attempt the stitch.
  let ffmpegPath: string;
  try {
    ffmpegPath = await ensureFfmpeg();
  } catch (e) {
    fail('ffmpeg availability check', e);
  }
  console.log(`ffmpeg binary: ${ffmpegPath}\n`);

  const workDir = await createWorkDir('two-scene-salvage');
  console.log(`work dir: ${workDir}\n`);

  // ── DOWNLOAD the two clips from fal's temporary CDN ─────────────────────────────
  console.log('DOWNLOAD: pulling scene1 + scene2 from fal temp CDN...');
  const scene1Path = join(workDir, 'scene1.mp4');
  const scene2Path = join(workDir, 'scene2.mp4');
  await download(SCENE1_TEMP_URL, scene1Path, 'scene1');
  await download(SCENE2_TEMP_URL, scene2Path, 'scene2');

  // Probe both so a corrupt/partial download surfaces here, not deep in the stitch.
  try {
    const p1 = await probeVideo(scene1Path);
    const p2 = await probeVideo(scene2Path);
    console.log(`  scene1 duration: ${p1.duration.toFixed(2)}s`);
    console.log(`  scene2 duration: ${p2.duration.toFixed(2)}s\n`);
  } catch (e) {
    fail('probe downloaded clips', e);
  }

  // ── STITCH scene1 + scene2 into one mp4 (re-encode; same normalize as source) ───
  console.log('STITCH: concatenating scene1 + scene2 into one mp4...');
  const stitchedPath = join(workDir, 'stitched.mp4');
  // Normalize both to 1280x720 @ 30fps before concat (identical to source script).
  const filter = [
    '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0]',
    '[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1]',
    '[v0][v1]concat=n=2:v=1:a=0[outv]',
  ].join(';');
  try {
    await runFfmpeg([
      '-i', scene1Path,
      '-i', scene2Path,
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

  // ── PERSIST: upload all three + register each in the media library ──────────────
  console.log('PERSIST: uploading artifacts + registering in media library...');

  const scene1Buf = await readFile(scene1Path);
  const scene2Buf = await readFile(scene2Path);

  const stitchedStoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
  const scene1StoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
  const scene2StoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;

  const stitchedUrl = await uploadPublic(stitchedBuf, stitchedStoragePath, 'video/mp4', 'stitched');
  const scene1StoredUrl = await uploadPublic(scene1Buf, scene1StoragePath, 'video/mp4', 'scene1-stored');
  const scene2StoredUrl = await uploadPublic(scene2Buf, scene2StoragePath, 'video/mp4', 'scene2-stored');

  const stitchedAssetId = await register({
    type: 'video',
    category: 'final-render',
    name: '2-scene chain (salvaged) — Velocity bridge→streets',
    description:
      'SALVAGED key deliverable. scene1 (reference-to-video, bridge) + scene2 (image-to-video from ' +
      'scene1 last frame, city streets→shop door), stitched into one continuous mp4. The original ' +
      '3-scene chain test ran out of fal balance on scene 3; these two completed clips were rescued ' +
      'from fal\'s temporary CDN and persisted here. No new generation was performed.',
    url: stitchedUrl,
    mimeType: 'video/mp4',
    fileSize: stitchedBuf.length,
    tags: ['chaining-test'],
  });

  const scene1AssetId = await register({
    type: 'video',
    category: 'video-clip',
    name: '2-scene chain (salvaged) — scene 1 (reference-to-video, bridge)',
    description: 'Scene 1 of 2 (salvaged). Reference-to-video from the Velocity image: sprint forward across the bridge.',
    url: scene1StoredUrl,
    mimeType: 'video/mp4',
    fileSize: scene1Buf.length,
    tags: ['chaining-test'],
  });

  const scene2AssetId = await register({
    type: 'video',
    category: 'video-clip',
    name: '2-scene chain (salvaged) — scene 2 (image-to-video, city streets→shop)',
    description: 'Scene 2 of 2 (salvaged). Image-to-video continued from scene 1 last frame: dash through the streets to the shop.',
    url: scene2StoredUrl,
    mimeType: 'video/mp4',
    fileSize: scene2Buf.length,
    tags: ['chaining-test'],
  });

  // ── PRINT everything ────────────────────────────────────────────────────────
  console.log('\n=== RESULTS ===');
  console.log('\nKEY DELIVERABLE — STITCHED 2-SCENE VIDEO (salvaged):');
  console.log(`  assetId: ${stitchedAssetId}`);
  console.log(`  url:     ${stitchedUrl}`);
  console.log('\nScene 1 (reference-to-video, bridge):');
  console.log(`  assetId: ${scene1AssetId}`);
  console.log(`  url:     ${scene1StoredUrl}`);
  console.log('\nScene 2 (image-to-video, city streets→shop):');
  console.log(`  assetId: ${scene2AssetId}`);
  console.log(`  url:     ${scene2StoredUrl}`);
  console.log('\nSALVAGE DONE');
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('\nSALVAGE FAILED');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
