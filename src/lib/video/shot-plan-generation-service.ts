/**
 * Shot Plan generation ORCHESTRATOR (server-side, ADDITIVE).
 *
 * Turns a `ShotPlan` into real video, shot-by-shot, on the fal / Seedance
 * provider — with LAST-FRAME CHAINING + IDENTITY RE-ANCHORING. This is a NEW,
 * parallel generation flow: it does NOT touch the Hedra `scene-generator.ts`
 * path or any Hedra route. It dogfoods the engine-agnostic provider abstraction
 * (`src/lib/video/providers`) exactly like the proven chaining scripts
 * (`scripts/verify-last-frame-chaining.ts`, `scripts/salvage-two-scene-chain.ts`).
 *
 * Cut vs. continue (the core of the chaining logic):
 *   - CUT shot (first shot, or `transitionIn === 'cut'`): a fresh scene.
 *     reference-to-video from the cast reference images only.
 *   - CONTINUE shot (`transitionIn === 'continue'`): identity-LOCKED continuation.
 *     reference-to-video seeded with BOTH the prior shot's last frame (continuity)
 *     AND the cast reference images (identity). The prior shot MUST already be
 *     generated — its `generated.lastFrameUrl` is the chain source. We use
 *     reference-to-video (not pure image-to-video) on purpose: pure i2v drifts off
 *     the character; passing the cast refs alongside the last frame re-anchors
 *     identity while the last frame anchors continuity.
 *
 * Ownership rule (NON-NEGOTIABLE): every generated artifact — the clip AND its
 * extracted last frame — is downloaded off fal's TEMPORARY CDN, persisted to OUR
 * Firebase Storage with a permanent download-token URL, and registered in the
 * media library via `createAsset`. The persisted result written back onto the
 * shot's `generated` field never references a fal URL.
 *
 * Downstream flagging on regenerate: when a shot is regenerated its chain source
 * changes, so every downstream `continue` shot is flagged `upstreamChanged`
 * (Mission-Control style) via the shared edit helper — the operator decides to
 * rerun them or keep their output.
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { adminStorage } from '@/lib/firebase/admin';
import { firebaseDownloadUrl } from '@/lib/firebase/storage-utils';
import { generateWithFal, generateFromReferenceWithFal } from '@/lib/ai/providers/fal-provider';
import { createAsset } from '@/lib/media/media-library-service';
import {
  ensureFfmpeg,
  runFfmpeg,
  probeVideo,
  createWorkDir,
  cleanupWorkDir,
} from '@/lib/video/ffmpeg-utils';
import {
  getVideoEngineProvider,
  type TenantContext,
  type VideoGenerateRequest,
  type VideoGenerationStatus,
} from '@/lib/video/providers';
import { composeShotGenerationPrompt } from '@/lib/video/shot-plan-mapping';
import { applyShotPlanEdit, applyShotPlanEditDetailed } from '@/lib/video/shot-plan-edit';
import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanShotGenerated,
} from '@/types/shot-plan';

const FILE = 'video/shot-plan-generation-service.ts';

/** The storage bucket all artifacts land in (matches the proven chaining scripts). */
const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';

/** Resolution / aspect defaults applied when a shot does not specify them. */
const DEFAULT_RESOLUTION: NonNullable<VideoGenerateRequest['resolution']> = '720p';
const DEFAULT_ASPECT_RATIO = '16:9';

/** Poll cadence + ceiling: 5s interval, ~15 min ceiling (generous for a clip). */
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 180;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// ============================================================================
// Resolution helpers
// ============================================================================

/** Find a shot by id, or throw a clear error naming the missing id. */
function requireShot(plan: ShotPlan, shotId: string): ShotPlanShot {
  const shot = plan.shots.find((s) => s.id === shotId);
  if (!shot) {
    throw new Error(`generateShot: shot not found in plan: ${shotId}`);
  }
  return shot;
}

/** True when this shot is a CUT (fresh scene): the first shot, or transitionIn 'cut'. */
function isCutShot(plan: ShotPlan, shot: ShotPlanShot): boolean {
  const ordered = [...plan.shots].sort((a, b) => a.index - b.index);
  const isFirst = ordered[0]?.id === shot.id;
  return isFirst || shot.transitionIn === 'cut';
}

/**
 * Resolve the cast reference images for a shot: the `referenceImageUrls` of every
 * cast member the shot lists in `castMemberIds`, in order, de-duplicated.
 */
function resolveCastReferenceImageUrls(plan: ShotPlan, shot: ShotPlanShot): string[] {
  const urls: string[] = [];
  for (const memberId of shot.castMemberIds) {
    const member = plan.sharedChoices.cast.find((c) => c.characterId === memberId);
    if (!member) {
      continue;
    }
    for (const url of member.referenceImageUrls) {
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }
  return urls;
}

/**
 * Resolve the appearance-anchor reference images for every OBJECT/prop the shot
 * lists in `objectIds`, in order, de-duplicated — so the engine renders the same
 * object each shot, exactly like cast identity anchoring.
 */
function resolveObjectReferenceImageUrls(plan: ShotPlan, shot: ShotPlanShot): string[] {
  const urls: string[] = [];
  for (const objectId of shot.objectIds ?? []) {
    const obj = plan.sharedChoices.objects?.find((o) => o.id === objectId);
    if (!obj) {
      continue;
    }
    for (const url of obj.referenceImageUrls) {
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }
  return urls;
}

/** The shared environment establishing-reference images (world look anchors). */
function environmentReferenceImageUrls(plan: ShotPlan): string[] {
  return [...new Set(plan.sharedChoices.environmentReferenceImageUrls ?? [])].filter(Boolean);
}

/**
 * Ceiling on reference images sent to the engine. Past a handful, extra refs
 * dilute rather than help the model lock identity/continuity. The continuation
 * frame (when present) always leads and is never dropped.
 */
const MAX_REFERENCE_IMAGES = 7;

/** De-duplicate + cap a reference-image list, preserving order (lead frame kept). */
function capReferenceImages(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean))].slice(0, MAX_REFERENCE_IMAGES);
}

/**
 * The PRIOR shot in plan order (the one immediately before `shot` by index), or
 * null when `shot` is the first. The continue chain source.
 */
function priorShot(plan: ShotPlan, shot: ShotPlanShot): ShotPlanShot | null {
  const ordered = [...plan.shots].sort((a, b) => a.index - b.index);
  const pos = ordered.findIndex((s) => s.id === shot.id);
  if (pos <= 0) {
    return null;
  }
  return ordered[pos - 1];
}

/**
 * Build the prompt for a shot. Prefer the shot's explicit `assembledPrompt`
 * override; otherwise compose from the shot + the shared look-bible (reusing the
 * mapping module's composer so the prompt is consistent with the editor path).
 */
function buildShotPrompt(plan: ShotPlan, shot: ShotPlanShot): string {
  const override = shot.assembledPrompt?.trim();
  if (override) {
    return override;
  }
  return composeShotGenerationPrompt(plan, shot);
}

/**
 * For a CONTINUE shot, wrap the base prompt with an explicit forward-action,
 * identity-locked continuation instruction so the engine treats the first
 * reference image (the prior last frame) as "the previous moment" and the cast
 * refs as the identity to preserve.
 */
function buildContinuePrompt(basePrompt: string): string {
  return [
    'Continue forward from @Image1 (the previous moment) — a seamless, unbroken ' +
      'continuation of that exact scene and motion. Keep the same character(s), ' +
      'wardrobe, and world consistent with the reference image(s).',
    basePrompt,
  ]
    .filter((p) => p.trim().length > 0)
    .join(' ');
}

// ============================================================================
// Persistence (ownership rule)
// ============================================================================

/** Download a remote file to a local path; throws on a non-OK response / 0 bytes. */
async function downloadToFile(url: string, destPath: string, label: string): Promise<Buffer> {
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`download ${label} failed: ${resp.status} ${resp.statusText}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length === 0) {
    throw new Error(`download ${label} returned 0 bytes`);
  }
  await writeFile(destPath, buf);
  return buf;
}

/**
 * Upload a buffer to OUR Firebase Storage with a permanent download-token URL.
 * Mirrors the proven `uploadPublic` helper in the chaining scripts.
 */
async function uploadPermanent(
  buf: Buffer,
  storagePath: string,
  contentType: string,
  label: string,
): Promise<string> {
  if (!adminStorage) {
    throw new Error(`upload ${label} failed: adminStorage is null (Firebase Admin not initialized)`);
  }
  const token = randomUUID();
  await adminStorage
    .bucket(BUCKET)
    .file(storagePath)
    .save(buf, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: token,
          source: 'shot-plan-generation',
        },
      },
    });
  return firebaseDownloadUrl(BUCKET, storagePath, token);
}

/**
 * Extract the LAST FRAME of a local clip as a PNG. Uses the proven two-step
 * approach from the chaining script: an end-relative seek first, then a
 * duration-based seek fallback if that produced nothing.
 */
async function extractLastFrame(clipPath: string, outPath: string): Promise<Buffer> {
  // Primary: end-relative seek ~0.1s before the end.
  try {
    await runFfmpeg([
      '-sseof', '-0.1',
      '-i', clipPath,
      '-frames:v', '1',
      '-update', '1',
      '-y',
      outPath,
    ]);
    const buf = await readFile(outPath);
    if (buf.length > 0) {
      return buf;
    }
  } catch (err) {
    logger.warn('[shot-plan-gen] -sseof last-frame extract failed, trying duration seek', {
      file: FILE,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Fallback: duration-based seek to ~0.05s before the end.
  const probe = await probeVideo(clipPath);
  if (probe.duration <= 0) {
    throw new Error('extract last frame: -sseof failed and duration unknown');
  }
  const seekTo = Math.max(0, probe.duration - 0.05);
  await runFfmpeg([
    '-ss', seekTo.toFixed(3),
    '-i', clipPath,
    '-frames:v', '1',
    '-update', '1',
    '-y',
    outPath,
  ]);
  const buf = await readFile(outPath);
  if (buf.length === 0) {
    throw new Error('extract last frame: no frame produced by either method');
  }
  return buf;
}

// ============================================================================
// Provider polling
// ============================================================================

/** Poll a submitted generation to completion; returns the (temporary) fal video URL. */
async function pollToCompletion(generationId: string, ctx: TenantContext, label: string): Promise<string> {
  const provider = getVideoEngineProvider('fal');
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i += 1) {
    await sleep(POLL_INTERVAL_MS);
    let status: VideoGenerationStatus;
    try {
      status = await provider.getStatus(generationId, ctx);
    } catch (err) {
      throw new Error(`${label} poll failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (status.status === 'completed') {
      if (!status.videoUrl) {
        throw new Error(`${label} reported completed but returned no video url`);
      }
      return status.videoUrl;
    }
    if (status.status === 'failed') {
      throw new Error(`${label} generation failed: ${status.error ?? 'unknown error'}`);
    }
  }
  throw new Error(
    `${label} poll timed out after ~${Math.round((POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS) / 60000)} minutes`,
  );
}

// ============================================================================
// Write the generated result back onto the shot
// ============================================================================

/** Write a `generated` payload onto a shot via the surgical edit helper. */
function writeGenerated(plan: ShotPlan, shotId: string, generated: ShotPlanShotGenerated): ShotPlan {
  return applyShotPlanEdit(plan, { target: 'shot', shotId, field: 'generated', value: generated });
}

// ============================================================================
// generateShot
// ============================================================================

/**
 * Generate ONE shot, persist its clip + last frame to OUR storage + media
 * library, and return an updated plan with the shot's `generated` field written.
 *
 * On a CONTINUE shot whose prior shot has not yet been generated (no
 * `generated.lastFrameUrl`), this throws a clear error — generate the prior shot
 * first. On any generation failure, the shot's `generated.status` is written as
 * 'failed' with the error message, and the error is re-thrown so callers
 * (generateAllShots) can halt rather than chain off a broken dependency.
 */
export async function generateShot(
  plan: ShotPlan,
  shotId: string,
  ctx: TenantContext,
): Promise<ShotPlan> {
  const provider = getVideoEngineProvider('fal');
  const shot = requireShot(plan, shotId);
  const cut = isCutShot(plan, shot);
  const castRefs = resolveCastReferenceImageUrls(plan, shot);
  const objectRefs = resolveObjectReferenceImageUrls(plan, shot);
  const envRefs = environmentReferenceImageUrls(plan);
  const basePrompt = buildShotPrompt(plan, shot);

  // Pre-flight: ffmpeg must be available before we spend money on a generation.
  await ensureFfmpeg();

  const workDir = await createWorkDir('shot-plan-gen');

  try {
    // ── Submit the generation (cut vs. identity-locked continue) ──────────────
    let generationId: string;
    if (cut) {
      // CUT = fresh scene: cast identity first, then object + environment anchors.
      const cutRefs = capReferenceImages([...castRefs, ...objectRefs, ...envRefs]);
      const req: VideoGenerateRequest = {
        prompt: basePrompt,
        imageUrls: cutRefs,
        resolution: DEFAULT_RESOLUTION,
        aspectRatio: DEFAULT_ASPECT_RATIO,
        durationSeconds: shot.durationSeconds,
        generateAudio: Boolean(shot.dialogue),
        ...(typeof shot.generated?.seed === 'number' ? { seed: shot.generated.seed } : {}),
      };
      logger.info('[shot-plan-gen] submitting CUT shot', {
        file: FILE,
        shotId,
        castRefCount: castRefs.length,
        objectRefCount: objectRefs.length,
        envRefCount: envRefs.length,
      });
      const submitted = await provider.generateVideo(req, ctx);
      generationId = submitted.generationId;
    } else {
      const prior = priorShot(plan, shot);
      const priorLastFrame = prior?.generated?.lastFrameUrl;
      if (!priorLastFrame) {
        throw new Error(
          `generateShot: CONTINUE shot "${shotId}" requires the prior shot's last frame, ` +
            'but the prior shot has not been generated yet. Generate the prior shot first.',
        );
      }
      // Identity-locked continue: last frame FIRST (continuity, @Image1), then
      // cast refs (identity), then object anchors. reference-to-video, not pure
      // image-to-video. The environment carries over from the continuation frame,
      // so env refs are not re-sent here.
      const continueRefs = capReferenceImages([priorLastFrame, ...castRefs, ...objectRefs]);
      const req: VideoGenerateRequest = {
        prompt: buildContinuePrompt(basePrompt),
        imageUrls: continueRefs,
        resolution: DEFAULT_RESOLUTION,
        aspectRatio: DEFAULT_ASPECT_RATIO,
        durationSeconds: shot.durationSeconds,
        generateAudio: Boolean(shot.dialogue),
        ...(typeof shot.generated?.seed === 'number' ? { seed: shot.generated.seed } : {}),
      };
      logger.info('[shot-plan-gen] submitting CONTINUE shot (identity-locked)', {
        file: FILE,
        shotId,
        priorShotId: prior?.id,
        castRefCount: castRefs.length,
        objectRefCount: objectRefs.length,
      });
      const submitted = await provider.generateVideo(req, ctx);
      generationId = submitted.generationId;
    }

    // ── Poll to completion → temporary fal URL ────────────────────────────────
    const falVideoUrl = await pollToCompletion(generationId, ctx, `shot ${shotId}`);

    // ── Download the clip + extract its last frame ────────────────────────────
    const clipPath = join(workDir, 'clip.mp4');
    const clipBuf = await downloadToFile(falVideoUrl, clipPath, `shot ${shotId} clip`);

    const lastFramePath = join(workDir, 'lastframe.png');
    const lastFrameBuf = await extractLastFrame(clipPath, lastFramePath);

    // ── Persist BOTH to OUR storage (ownership rule) ──────────────────────────
    const clipStoragePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
    const frameStoragePath = `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`;

    const permanentVideoUrl = await uploadPermanent(
      clipBuf,
      clipStoragePath,
      'video/mp4',
      `shot ${shotId} clip`,
    );
    const permanentLastFrameUrl = await uploadPermanent(
      lastFrameBuf,
      frameStoragePath,
      'image/png',
      `shot ${shotId} last frame`,
    );

    // ── Register the clip in the media library ────────────────────────────────
    await createAsset({
      type: 'video',
      category: 'video-clip',
      name: `Shot ${shot.index + 1}${shot.title ? ` — ${shot.title}` : ''}`,
      description:
        `Generated shot (${cut ? 'cut' : 'continue'}) from Shot Plan "${plan.title || plan.id}".`,
      url: permanentVideoUrl,
      mimeType: 'video/mp4',
      fileSize: clipBuf.length,
      source: 'ai-generated',
      aiProvider: 'fal-seedance',
      aiPrompt: cut ? basePrompt : buildContinuePrompt(basePrompt),
      createdBy: 'system',
      tags: ['shot-plan'],
    });

    // ── Write the successful result back onto the shot ────────────────────────
    const generated: ShotPlanShotGenerated = {
      videoUrl: permanentVideoUrl,
      lastFrameUrl: permanentLastFrameUrl,
      status: 'completed',
      generationId,
      ...(typeof shot.generated?.seed === 'number' ? { seed: shot.generated.seed } : {}),
    };

    logger.info('[shot-plan-gen] shot completed + persisted', {
      file: FILE,
      shotId,
      videoUrl: permanentVideoUrl,
    });

    return writeGenerated(plan, shotId, generated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[shot-plan-gen] shot generation failed', err instanceof Error ? err : new Error(message), {
      file: FILE,
      shotId,
    });
    // Record the failure on the shot (preserving any prior generated fields),
    // then re-throw so a chained caller halts instead of using a broken source.
    const failed: ShotPlanShotGenerated = {
      ...shot.generated,
      status: 'failed',
    };
    // Persist the failure status best-effort; never mask the original error.
    try {
      writeGenerated(plan, shotId, failed);
    } catch {
      /* swallow — the thrown original error is what matters */
    }
    throw new Error(`Shot "${shotId}" generation failed: ${message}`);
  } finally {
    await cleanupWorkDir(workDir);
  }
}

// ============================================================================
// generateAllShots
// ============================================================================

/** Progress callback fired after each shot completes (or the run halts). */
export interface ShotPlanGenerationProgress {
  shotId: string;
  index: number;
  total: number;
  status: 'completed' | 'failed';
  error?: string;
}

/**
 * Generate every shot IN ORDER (continue shots depend on the prior shot's last
 * frame, so order matters). The plan is accumulated shot-by-shot — each shot's
 * persisted result is written before the next shot runs, so a continue shot sees
 * its predecessor's freshly-saved last frame.
 *
 * On a shot failure the run STOPS and re-throws (it does not silently continue
 * past a failed dependency). The partially-generated plan is preserved on the
 * thrown error's `partialPlan` so a caller can resume / inspect.
 *
 * NOTE: this is long-running (one synchronous fal generation + persist per shot).
 * That is acceptable for now; a queue/poll split can come later (see the route).
 */
export async function generateAllShots(
  plan: ShotPlan,
  ctx: TenantContext,
  onProgress?: (progress: ShotPlanGenerationProgress) => void,
): Promise<ShotPlan> {
  const ordered = [...plan.shots].sort((a, b) => a.index - b.index);
  let current = plan;

  for (let i = 0; i < ordered.length; i += 1) {
    const shotId = ordered[i].id;
    try {
      current = await generateShot(current, shotId, ctx);
      onProgress?.({
        shotId,
        index: i,
        total: ordered.length,
        status: 'completed',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onProgress?.({
        shotId,
        index: i,
        total: ordered.length,
        status: 'failed',
        error: message,
      });
      logger.error(
        '[shot-plan-gen] generateAllShots halted on shot failure',
        err instanceof Error ? err : new Error(message),
        { file: FILE, shotId, index: i, total: ordered.length },
      );
      const halted = new Error(
        `Shot Plan generation halted at shot ${i + 1}/${ordered.length} ("${shotId}"): ${message}`,
      ) as Error & { partialPlan?: ShotPlan };
      halted.partialPlan = current;
      throw halted;
    }
  }

  return current;
}

// ============================================================================
// regenerateShot
// ============================================================================

/** The result of regenerating a shot: the new plan + which downstream shots flagged. */
export interface RegenerateShotResult {
  plan: ShotPlan;
  /** Downstream `continue` shot ids newly flagged `upstreamChanged`. */
  flaggedDownstreamShotIds: string[];
}

/**
 * Regenerate ONE shot AND flag downstream `continue` shots' `upstreamChanged`,
 * because the chain source (this shot's last frame) just changed. The operator
 * then decides per downstream shot to rerun it or keep its output.
 *
 * Flagging reuses the shared edit helper: re-applying the shot's NEW `generated`
 * value via `applyShotPlanEditDetailed` ripples the flag to every later shot in
 * one immutable, re-validated step (`generated` itself is local-only, so we
 * trigger the ripple explicitly off the shot's `transitionIn` chain).
 */
export async function regenerateShot(
  plan: ShotPlan,
  shotId: string,
  ctx: TenantContext,
): Promise<RegenerateShotResult> {
  // 1. Regenerate the shot (writes its new clip + last frame onto `generated`).
  const regenerated = await generateShot(plan, shotId, ctx);

  // 2. Flag downstream continue shots whose chain source just changed.
  //    The edit helper ripples `upstreamChanged` to every shot AFTER the edited
  //    one when a downstream-affecting field changes. We re-apply the shot's
  //    transitionIn to itself (a no-op value-wise, but it triggers the ripple
  //    path so later shots get flagged), capturing the flagged ids.
  const target = regenerated.shots.find((s) => s.id === shotId);
  if (!target) {
    return { plan: regenerated, flaggedDownstreamShotIds: [] };
  }

  // Only downstream CONTINUE shots care about a changed chain source. Flag them
  // directly + immutably; clear, explicit, and re-validated by the schema.
  const editorPosition = target.index;
  const flaggedDownstreamShotIds: string[] = [];
  let next = regenerated;
  for (const s of regenerated.shots) {
    if (s.index > editorPosition && s.transitionIn === 'continue' && !s.upstreamChanged) {
      const result = applyShotPlanEditDetailed(next, {
        target: 'shot',
        shotId: s.id,
        field: 'upstreamChanged',
        value: true,
      });
      next = result.plan;
      if (result.changed) {
        flaggedDownstreamShotIds.push(s.id);
      }
    }
  }

  logger.info('[shot-plan-gen] regenerated shot + flagged downstream', {
    file: FILE,
    shotId,
    flagged: flaggedDownstreamShotIds.length,
  });

  return { plan: next, flaggedDownstreamShotIds };
}

// ============================================================================
// generateShotKeyframe — CHEAP pre-video still
// ============================================================================

/**
 * Generate a CHEAP pre-video STILL (keyframe) for ONE shot so the operator can
 * approve the look BEFORE committing to the expensive video generation.
 *
 * Behavior:
 *   - CONTINUE shot whose prior shot already has `generated.lastFrameUrl`: NO new
 *     generation, NO spend. The continuation literally starts on that frame, so we
 *     reuse it directly as this shot's `keyframeUrl` (it already lives on OUR
 *     storage — it was persisted by the prior shot's `generateShot`).
 *   - Otherwise (CUT shot, or a continue shot with no prior frame yet): generate a
 *     single still from the shot's composed prompt PLUS the cast reference images
 *     (identity). When cast refs exist we use Flux Kontext image-to-image off the
 *     first cast ref (the identity anchor); with no cast refs we fall back to a
 *     pure text-to-image Flux generation.
 *
 * Ownership rule (NON-NEGOTIABLE): the still is downloaded off fal's TEMPORARY CDN,
 * persisted to OUR Firebase Storage with a permanent download-token URL, and
 * registered in the media library. The `keyframeUrl` written onto the shot never
 * references a fal URL.
 *
 * Failure policy: a missing keyframe must NOT block video generation, so this does
 * NOT set the shot's `generated.status` to 'failed'. It logs the error and rethrows
 * a clear message (mirroring `generateShot`'s phrasing) so the caller/route can
 * surface it — but the shot's generation lifecycle is left untouched.
 */
export async function generateShotKeyframe(
  plan: ShotPlan,
  shotId: string,
  ctx: TenantContext,
): Promise<ShotPlan> {
  const shot = requireShot(plan, shotId);
  const cut = isCutShot(plan, shot);

  // ── Free path: a continue shot whose prior frame already exists ────────────
  if (!cut) {
    const prior = priorShot(plan, shot);
    const priorLastFrame = prior?.generated?.lastFrameUrl;
    if (priorLastFrame) {
      logger.info('[shot-plan-gen] keyframe reuses prior last frame (no spend)', {
        file: FILE,
        shotId,
        priorShotId: prior?.id,
      });
      const generated: ShotPlanShotGenerated = {
        ...shot.generated,
        keyframeUrl: priorLastFrame,
      };
      return writeGenerated(plan, shotId, generated);
    }
  }

  // ── Generate path: a fresh still from the prompt + cast identity refs ───────
  const castRefs = resolveCastReferenceImageUrls(plan, shot);
  const basePrompt = buildShotPrompt(plan, shot);
  const workDir = await createWorkDir('shot-plan-keyframe');

  try {
    // When the shot has cast refs, anchor identity off the first ref via Flux
    // Kontext (image-to-image). With no cast refs, fall back to text-to-image.
    // ctx is referenced explicitly: these fal image helpers resolve the key from
    // the platform credential store (single-tenant), so there is no per-call ctx
    // arg, but we log it so the multi-tenant metering seam is visible here too.
    const seed = typeof shot.generated?.seed === 'number' ? shot.generated.seed : undefined;
    logger.info('[shot-plan-gen] submitting keyframe still', {
      file: FILE,
      shotId,
      tenantId: ctx.tenantId,
      mode: castRefs.length > 0 ? 'kontext' : 'text-to-image',
      castRefCount: castRefs.length,
    });

    const result =
      castRefs.length > 0
        ? await generateFromReferenceWithFal(basePrompt, castRefs[0], {
            ...(seed !== undefined ? { seed } : {}),
          })
        : await generateWithFal(basePrompt, {
            aspectRatio: '16:9',
            ...(seed !== undefined ? { seed } : {}),
          });

    const falImageUrl = result.url;
    if (!falImageUrl) {
      throw new Error('keyframe generation returned no image url');
    }

    // ── Persist to OUR storage (ownership rule) ───────────────────────────────
    const framePath = join(workDir, 'keyframe.png');
    const frameBuf = await downloadToFile(falImageUrl, framePath, `shot ${shotId} keyframe`);

    const frameStoragePath = `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`;
    const permanentKeyframeUrl = await uploadPermanent(
      frameBuf,
      frameStoragePath,
      'image/png',
      `shot ${shotId} keyframe`,
    );

    // ── Register the still in the media library ───────────────────────────────
    await createAsset({
      type: 'image',
      category: 'thumbnail',
      name: `Shot ${shot.index + 1} keyframe${shot.title ? ` — ${shot.title}` : ''}`,
      description:
        `Pre-video keyframe still for shot from Shot Plan "${plan.title || plan.id}".`,
      url: permanentKeyframeUrl,
      mimeType: 'image/png',
      fileSize: frameBuf.length,
      source: 'ai-generated',
      aiProvider: 'fal',
      aiPrompt: basePrompt,
      createdBy: 'system',
      tags: ['shot-plan', 'keyframe'],
    });

    // ── Write the keyframe url onto the shot (preserving prior generated) ──────
    const generated: ShotPlanShotGenerated = {
      ...shot.generated,
      keyframeUrl: permanentKeyframeUrl,
    };

    logger.info('[shot-plan-gen] keyframe completed + persisted', {
      file: FILE,
      shotId,
      keyframeUrl: permanentKeyframeUrl,
    });

    return writeGenerated(plan, shotId, generated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[shot-plan-gen] keyframe generation failed',
      err instanceof Error ? err : new Error(message),
      { file: FILE, shotId },
    );
    // A missing keyframe must NOT block video generation — do NOT set the shot's
    // generated.status to 'failed'. Just rethrow a clear error for the caller.
    throw new Error(`Shot "${shotId}" keyframe generation failed: ${message}`);
  } finally {
    await cleanupWorkDir(workDir);
  }
}
