/**
 * VERIFICATION (real infra): `stitchShotPlan` combines a Shot Plan's generated
 * shots into ONE deliverable video on OUR Firebase Storage — the P4 "final stitch"
 * that turns loose clips into a watchable film.
 *
 * This proves the STITCH on real infrastructure WITHOUT any fal/Seedance spend:
 * we synthesize two short test clips locally with ffmpeg, upload them to OUR
 * storage as if they were generated shots, run the real `stitchShotPlan`, then
 * download + probe the result.
 *
 *   Clip A — 2s, 1280x720, WITH audio (a 440 Hz tone).
 *   Clip B — 2s, 640x480, NO audio  → exercises BOTH the silence-synthesis path
 *            (so the dialogue clip keeps its sound) AND scale/pad to the target frame.
 *
 * Asserts: plan.finalVideoUrl is set + lives on OUR storage; the file downloads;
 * its duration ≈ 4s (A+B); it has a video AND an audio stream; its frame is the
 * first clip's size (1280x720). Cleans up the temp working dir.
 *
 * Run: npx tsx scripts/verify-shot-plan-stitch.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local into process.env BEFORE importing anything that initializes the
// Firebase Admin SDK (src/lib/firebase/admin reads env at module-load time, and
// exports adminDb/adminStorage as init-time constants). Hence: sync env load here,
// then DYNAMIC imports of every module that transitively touches Admin.
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}
loadEnvLocal();

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';

function fail(step: string, detail: unknown): never {
  const msg = detail instanceof Error ? detail.message : String(detail);
  throw new Error(`[STEP FAILED: ${step}] ${msg}`);
}

function assert(cond: boolean, label: string, detail?: unknown): void {
  if (!cond) {
    fail(label, detail ?? 'assertion failed');
  }
  console.log(`  ✓ ${label}`);
}

async function main(): Promise<void> {
  const { randomUUID } = await import('node:crypto');
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');

  const { ensureFfmpeg, runFfmpeg, probeVideo, createWorkDir, cleanupWorkDir } = await import(
    '../src/lib/video/ffmpeg-utils'
  );
  const { adminStorage } = await import('../src/lib/firebase/admin');
  const { firebaseDownloadUrl } = await import('../src/lib/firebase/storage-utils');
  const { stitchShotPlan } = await import('../src/lib/video/shot-plan-generation-service');
  const { makeBlankShotPlan, makeBlankShot } = await import('../src/lib/video/shot-plan-blank');
  const { ShotPlanSchema } = await import('../src/types/shot-plan');
  const { PLATFORM_ID } = await import('../src/lib/constants/platform');

  if (!adminStorage) {
    fail('init', 'adminStorage is null — Firebase Admin not initialized (check .env.local)');
  }

  console.log('STEP 1 — ffmpeg + work dir');
  await ensureFfmpeg();
  const workDir = await createWorkDir('verify-stitch');

  /** Upload a local file to OUR storage with a permanent download-token URL. */
  async function uploadPermanent(localPath: string, storagePath: string): Promise<string> {
    const buf = await readFile(localPath);
    const token = randomUUID();
    await adminStorage!
      .bucket(BUCKET)
      .file(storagePath)
      .save(buf, {
        metadata: {
          contentType: 'video/mp4',
          metadata: { firebaseStorageDownloadTokens: token, source: 'verify-shot-plan-stitch' },
        },
      });
    return firebaseDownloadUrl(BUCKET, storagePath, token);
  }

  try {
    console.log('STEP 2 — synthesize two test clips (A: 1280x720 + audio · B: 640x480 no audio)');
    const clipAPath = join(workDir, 'clipA.mp4');
    const clipBPath = join(workDir, 'clipB.mp4');

    await runFfmpeg([
      '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest', '-y', clipAPath,
    ]).catch((e) => fail('synthesize clip A', e));

    await runFfmpeg([
      '-f', 'lavfi', '-i', 'testsrc2=size=640x480:rate=30:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', clipBPath,
    ]).catch((e) => fail('synthesize clip B', e));

    const probeA = await probeVideo(clipAPath);
    const probeB = await probeVideo(clipBPath);
    assert(probeA.hasAudio, 'clip A has audio (the dialogue clip)');
    assert(!probeB.hasAudio, 'clip B has NO audio (silence-synthesis path)');

    console.log('STEP 3 — upload both clips to OUR storage');
    const clipAUrl = await uploadPermanent(
      clipAPath,
      `organizations/${PLATFORM_ID}/media/videos/verify-${randomUUID()}.mp4`,
    );
    const clipBUrl = await uploadPermanent(
      clipBPath,
      `organizations/${PLATFORM_ID}/media/videos/verify-${randomUUID()}.mp4`,
    );
    assert(clipAUrl.includes('firebasestorage'), 'clip A uploaded to OUR storage', clipAUrl);
    assert(clipBUrl.includes('firebasestorage'), 'clip B uploaded to OUR storage', clipBUrl);

    console.log('STEP 4 — build a schema-valid plan with two GENERATED shots');
    const base = makeBlankShotPlan('Stitch Verification');
    const shot0 = { ...makeBlankShot(0), durationSeconds: 2, generated: { videoUrl: clipAUrl, lastFrameUrl: clipAUrl, status: 'completed' as const } };
    const shot1 = { ...makeBlankShot(1), durationSeconds: 2, generated: { videoUrl: clipBUrl, lastFrameUrl: clipBUrl, status: 'completed' as const } };
    const plan = ShotPlanSchema.parse({ ...base, shots: [shot0, shot1] });

    console.log('STEP 5 — run the real stitchShotPlan');
    const stitched = await stitchShotPlan(plan, { tenantId: PLATFORM_ID }).catch((e) =>
      fail('stitchShotPlan', e),
    );

    assert(Boolean(stitched.finalVideoUrl), 'plan.finalVideoUrl is set');
    const finalUrl = stitched.finalVideoUrl ?? '';
    assert(finalUrl.includes('firebasestorage'), 'final video lives on OUR storage', finalUrl);

    console.log('STEP 6 — download + probe the final video');
    const finalPath = join(workDir, 'final.mp4');
    const resp = await fetch(finalUrl, { redirect: 'follow' });
    assert(resp.ok, `final video downloads (HTTP ${resp.status})`);
    const finalBuf = Buffer.from(await resp.arrayBuffer());
    assert(finalBuf.length > 0, `final video is non-empty (${finalBuf.length} bytes)`);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(finalPath, finalBuf);

    const finalProbe = await probeVideo(finalPath);
    console.log('  final probe:', JSON.stringify(finalProbe));
    assert(finalProbe.duration >= 3.5 && finalProbe.duration <= 4.6, `final duration ≈ 4s (got ${finalProbe.duration.toFixed(2)}s)`);
    assert(finalProbe.hasAudio, 'final video HAS an audio stream (silence-padding worked)');
    assert(finalProbe.width === 1280 && finalProbe.height === 720, `final frame = first clip size 1280x720 (got ${finalProbe.width}x${finalProbe.height})`);

    console.log('\nSTITCH PROOF DONE ✅  finalVideoUrl =', finalUrl);
  } finally {
    await cleanupWorkDir(workDir);
  }
}

main().catch((err) => {
  console.error('\n❌ VERIFY FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
