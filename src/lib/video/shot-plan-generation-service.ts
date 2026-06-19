/**
 * Shot Plan generation ORCHESTRATOR (server-side, ADDITIVE).
 *
 * Turns a `ShotPlan` into real video, shot-by-shot, on the fal / Seedance
 * provider — with LAST-FRAME CHAINING + IDENTITY RE-ANCHORING. It dogfoods the
 * engine-agnostic provider abstraction (`src/lib/video/providers`) exactly like
 * the proven chaining scripts
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
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { createAsset } from '@/lib/media/media-library-service';
import { createAvatarProfile, getAvatarProfile } from '@/lib/video/avatar-profile-service';
import { getBrandKit } from '@/lib/video/brand-kit-service';
import { compositeBrandLogoCentered } from '@/lib/video/logo-compositor';
import type { BrandLogo } from '@/types/brand-kit';
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
  ShotPlanFloorPlan,
  ShotPlanCastMember,
  ShotPlanObject,
  ShotPlanEnvironmentZone,
} from '@/types/shot-plan';

const FILE = 'video/shot-plan-generation-service.ts';

/** The storage bucket all artifacts land in (matches the proven chaining scripts). */
const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';

/**
 * Resolution / aspect defaults applied when a shot does not specify them.
 * 1080p is Seedance's max — generating at full 1080p is the source the final
 * stitch then upscales to 4K (3840x2160) via Topaz (upscale_factor 2).
 */
const DEFAULT_RESOLUTION: NonNullable<VideoGenerateRequest['resolution']> = '1080p';
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
 * Resolve the SPEAKER of a shot: the lead cast member present in the shot. We walk
 * `shot.castMemberIds` in order, resolving each to its `ShotPlanCastMember`, and
 * return the first one billed `lead`; if none is billed lead, the first resolvable
 * member. Returns null when the shot lists no resolvable cast (e.g. a scenery shot).
 */
function resolveSpeakingCastMember(plan: ShotPlan, shot: ShotPlanShot): ShotPlanCastMember | null {
  const present: ShotPlanCastMember[] = [];
  for (const memberId of shot.castMemberIds) {
    const member = plan.sharedChoices.cast.find((c) => c.characterId === memberId);
    if (member) {
      present.push(member);
    }
  }
  if (present.length === 0) {
    return null;
  }
  return present.find((m) => m.billing === 'lead') ?? present[0];
}

/**
 * Premade ElevenLabs voices, split by presentation. These are used ONLY to give an
 * AI-invented character (a speaker with no saved/recorded voice) a voice the system
 * "creates" for it. A Character-Library member that has a recorded voice always uses
 * that recorded voice and never one of these.
 */
// These MUST be names in the fal `eleven-v3` voice library (FAL_TTS_MODEL). The
// legacy ElevenLabs names (Rachel, Bella, Antoni, Arnold, Adam, Elli, Dorothy, Sam,
// Josh) are NOT in v3 and fail with "Voice not found". Only v3-valid names here.
const AI_FEMALE_VOICES: string[] = ['Aria', 'Sarah', 'Laura', 'Charlotte', 'Alice', 'Matilda', 'Jessica', 'Lily'];
const AI_MALE_VOICES: string[] = ['Roger', 'Charlie', 'George', 'Callum', 'Liam', 'Will', 'Eric', 'Brian', 'Daniel', 'Bill'];

/**
 * Stable 32-bit FNV-1a hash so the SAME character maps to the SAME voice on every
 * shot — an invented character must not change voice between shots.
 */
function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Give a speaker WITHOUT an assigned voice an AI-created voice: a premade ElevenLabs
 * voice chosen by gender presentation, keyed off `characterId` so the same invented
 * character keeps the same voice across every shot. Library characters with a
 * recorded voice never reach here — they always speak in their own voice.
 */
function pickAiVoiceForCharacter(member: ShotPlanCastMember): string {
  const gender = member.gender?.toLowerCase() ?? '';
  const isFemale = gender.includes('female') || gender.includes('woman') || gender.includes('girl');
  const isMale = !isFemale && (gender.includes('male') || gender.includes('man') || gender.includes('boy'));
  const pool = isFemale ? AI_FEMALE_VOICES : isMale ? AI_MALE_VOICES : [...AI_FEMALE_VOICES, ...AI_MALE_VOICES];
  return pool[stableHash(member.characterId) % pool.length];
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
 * The environment ZONE a shot belongs to: the zone whose `cutIds` lists the shot id.
 * Multi-location plans group shots into `environmentZones[]`; each zone carries its
 * own `heroImageUrl` (the establishing render of that set) + `setDesign[]`. A shot
 * with no zone match (single-environment plan, or unzoned shot) returns null and
 * the caller falls back to the top-level `environmentHeroImageUrl`.
 */
function resolveShotEnvironmentZone(plan: ShotPlan, shot: ShotPlanShot): ShotPlanEnvironmentZone | null {
  const zones = plan.sharedChoices.environmentZones ?? [];
  return zones.find((z) => (z.cutIds ?? []).includes(shot.id)) ?? null;
}

/**
 * The environment-hero image to condition a shot's keyframe on: the shot's zone hero
 * when it belongs to a zone that has one rendered, else the shared world hero. Null
 * when neither exists yet (the prompt then carries the environment in prose only).
 */
function resolveShotEnvironmentHeroUrl(plan: ShotPlan, shot: ShotPlanShot): string | null {
  const zone = resolveShotEnvironmentZone(plan, shot);
  const zoneHero = zone?.heroImageUrl?.trim();
  if (zoneHero) {
    return zoneHero;
  }
  const worldHero = plan.sharedChoices.environmentHeroImageUrl?.trim();
  return worldHero && worldHero.length > 0 ? worldHero : null;
}

/**
 * The set-detail prose for a shot's environment, woven into the keyframe prompt so
 * the still reads as the CORRECT set even when only a single reference image (the
 * cast identity anchor) can be passed to Kontext. Prefers the zone's label +
 * set-design bullets, falls back to the shot's own `environment` + the world
 * fingerprint, so the environment is always described regardless of zone authoring.
 */
function shotEnvironmentProse(plan: ShotPlan, shot: ShotPlanShot): string {
  const zone = resolveShotEnvironmentZone(plan, shot);
  const setDesign = (zone?.setDesign ?? []).map((s) => s.trim()).filter(Boolean).join(', ');
  const parts = [
    zone?.label?.trim(),
    setDesign,
    shot.environment?.trim(),
    plan.sharedChoices.environmentFingerprint?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));
  // De-duplicate while preserving order (label/fingerprint can overlap).
  return [...new Set(parts)].join('. ');
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

// ============================================================================
// fal queue helpers (lip-sync / TTS / upscale) — proven pattern reused from
// scripts/pretest-inscene-lipsync.ts + scripts/bakeoff-lipsync-models.ts:
//   POST queue.fal.run/{model} → {status_url, response_url} → poll → GET response.
// ============================================================================

/** fal lip-sync model: re-sync existing footage to an audio track. */
const FAL_LIPSYNC_MODEL = 'fal-ai/sync-lipsync/v3';
/** fal TTS model: synthesize a voice line (default voice "Rachel"). */
const FAL_TTS_MODEL = 'fal-ai/elevenlabs/tts/eleven-v3';
/** fal 4K upscaler: factor 2 on a 1080p source → exactly 3840x2160. */
const FAL_UPSCALE_MODEL = 'fal-ai/topaz/upscale/video';

/** fal queue submit response shape (the two URLs we poll / read). */
interface FalQueueSubmit {
  status_url: string;
  response_url: string;
}
/** fal queue status shape (only `status` matters for our poll loop). */
interface FalQueueStatus {
  status: string;
}

/**
 * Submit to fal's queue, poll to completion, return the raw output JSON.
 * Mirrors the proven `falQueue(model, input, key, label)` helper in the pretest
 * scripts: POST → {status_url,response_url}, poll status_url every 3s, GET
 * response_url on COMPLETED.
 */
async function falQueue(
  model: string,
  input: Record<string, unknown>,
  key: string,
  label: string,
): Promise<Record<string, unknown>> {
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!submit.ok) {
    throw new Error(`${label} submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  }
  const sub = (await submit.json()) as FalQueueSubmit;
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i += 1) {
    await sleep(POLL_INTERVAL_MS);
    const statusResp = await fetch(sub.status_url, { headers: { Authorization: `Key ${key}` } });
    const statusJson = (await statusResp.json()) as FalQueueStatus;
    if (statusJson.status === 'COMPLETED') {
      const resp = await fetch(sub.response_url, { headers: { Authorization: `Key ${key}` } });
      return (await resp.json()) as Record<string, unknown>;
    }
    if (statusJson.status === 'FAILED' || statusJson.status === 'ERROR') {
      throw new Error(`${label} failed: ${JSON.stringify(statusJson).slice(0, 300)}`);
    }
  }
  throw new Error(`${label} timed out`);
}

/** Pull `video.url` (or `audio.url`) out of a fal output object, or throw. */
function falMediaUrl(out: Record<string, unknown>, kind: 'video' | 'audio'): string {
  const node = out[kind];
  if (node && typeof node === 'object' && typeof (node as { url?: unknown }).url === 'string') {
    return (node as { url: string }).url;
  }
  throw new Error(`no ${kind}.url in fal output: ${JSON.stringify(out).slice(0, 200)}`);
}

/** Resolve the platform fal API key (a string), or throw a clear error. */
async function requireFalKey(): Promise<string> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('no fal API key in Firestore (apiKeyService.getServiceKey)');
  }
  return key;
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
// In-scene lip-sync (speaking characters)
// ============================================================================

/** The lip-synced result for a shot: new persisted clip + re-extracted last frame. */
interface LipSyncResult {
  videoUrl: string;
  lastFrameUrl: string;
}

/**
 * Lip-sync a shot's already-persisted silent clip to a SPOKEN line in the
 * character's assigned voice, persist the talking clip + its re-extracted last
 * frame to OUR storage (ownership rule), and return both URLs.
 *
 *   1. TTS the line in the character's voice  (fal-ai/elevenlabs/tts/eleven-v3)
 *   2. lip-sync the clip to that audio        (fal-ai/sync-lipsync/v3)
 *   3. download → persist clip + re-extract & persist last frame (talking frame)
 *
 * The last frame is re-extracted off the TALKING clip so a downstream `continue`
 * shot chains off the speaking frame, not the silent one. Caller owns the workDir.
 */
async function lipSyncShotClip(
  args: {
    shotId: string;
    clipUrl: string;
    dialogue: string;
    voice: string;
    falKey: string;
    workDir: string;
  },
): Promise<LipSyncResult> {
  const { shotId, clipUrl, dialogue, voice, falKey, workDir } = args;

  // 1. TTS the line in the character's voice.
  logger.info('[shot-plan-gen] lip-sync: synthesizing line', { file: FILE, shotId, voice });
  const ttsOut = await falQueue(FAL_TTS_MODEL, { text: dialogue, voice }, falKey, `shot ${shotId} tts`);
  const audioUrl = falMediaUrl(ttsOut, 'audio');

  // 2. Lip-sync the persisted clip to that audio.
  logger.info('[shot-plan-gen] lip-sync: re-syncing clip to voice', { file: FILE, shotId });
  const syncOut = await falQueue(
    FAL_LIPSYNC_MODEL,
    { video_url: clipUrl, audio_url: audioUrl },
    falKey,
    `shot ${shotId} lip-sync`,
  );
  const syncedFalUrl = falMediaUrl(syncOut, 'video');

  // 3. Download → persist the talking clip + re-extract & persist its last frame.
  const syncedPath = join(workDir, 'lipsynced.mp4');
  const syncedBuf = await downloadToFile(syncedFalUrl, syncedPath, `shot ${shotId} lip-synced clip`);
  const syncedVideoUrl = await uploadPermanent(
    syncedBuf,
    `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`,
    'video/mp4',
    `shot ${shotId} lip-synced clip`,
  );

  const talkingFramePath = join(workDir, 'lipsynced-lastframe.png');
  const talkingFrameBuf = await extractLastFrame(syncedPath, talkingFramePath);
  const talkingFrameUrl = await uploadPermanent(
    talkingFrameBuf,
    `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`,
    'image/png',
    `shot ${shotId} talking last frame`,
  );

  await createAsset({
    type: 'video',
    category: 'video-clip',
    name: `Shot ${shotId} — lip-synced`,
    description: 'Lip-synced (speaking) clip — the silent shot re-synced to the character voice.',
    url: syncedVideoUrl,
    mimeType: 'video/mp4',
    fileSize: syncedBuf.length,
    source: 'ai-generated',
    aiProvider: FAL_LIPSYNC_MODEL,
    createdBy: 'system',
    tags: ['shot-plan', 'lip-sync'],
  });

  return { videoUrl: syncedVideoUrl, lastFrameUrl: talkingFrameUrl };
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
        // No Seedance-generated audio: dialogue comes ONLY from the cloned-voice
        // lip-sync (a coherent single voice), never a competing voice the engine
        // invents. Non-speaking shots are silent here (music/ambient added in the
        // editor); the stitch silence-pads them so the final has one clean voice track.
        generateAudio: false,
        ...(typeof shot.generated?.seed === 'number' ? { seed: shot.generated.seed } : {}),
      };
      logger.info('[shot-plan-gen] submitting CUT shot', {
        file: FILE,
        shotId,
        castRefCount: castRefs.length,
        objectRefCount: objectRefs.length,
        envRefCount: envRefs.length,
        mode: cutRefs.length > 0 ? 'reference-to-video' : 'text-to-video',
      });
      // No references at all (e.g. a pure landscape / scenery shot with no cast,
      // objects or env images) → text-to-video. Otherwise reference-to-video.
      const submitted =
        cutRefs.length > 0
          ? await provider.generateVideo(req, ctx)
          : await provider.generateTextToVideo(req, ctx);
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
        // No Seedance-generated audio: dialogue comes ONLY from the cloned-voice
        // lip-sync (a coherent single voice), never a competing voice the engine
        // invents. Non-speaking shots are silent here (music/ambient added in the
        // editor); the stitch silence-pads them so the final has one clean voice track.
        generateAudio: false,
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

    // ── Speaking lip-sync (best-effort) ───────────────────────────────────────
    // Every spoken line is lip-synced to its speaker's voice. Voice resolution
    // follows the operator rule:
    //   • A Character-Library member with a RECORDED/assigned voice uses ONLY that
    //     voice, always (e.g. Velocity once his voice is recorded).
    //   • Any other speaker — a character the AI invented for the scene, or a
    //     library member that has no voice yet — gets an AI-CREATED voice: a premade
    //     voice picked by gender, keyed off characterId so the same character keeps
    //     the same voice every shot.
    // Seedance never generates a competing voice (generateAudio is false), so the
    // ONLY dialogue audio in the final is the recorded/AI voice we sync here.
    let finalVideoUrl = permanentVideoUrl;
    let finalLastFrameUrl = permanentLastFrameUrl;
    const dialogue = shot.dialogue?.trim();
    if (dialogue) {
      const speaker = resolveSpeakingCastMember(plan, shot);
      const profile = speaker ? await getAvatarProfile(speaker.characterId).catch(() => null) : null;
      // Prefer the display voiceName, fall back to voiceId; empty/whitespace = none.
      const voiceName = profile?.voiceName?.trim();
      const voiceId = profile?.voiceId?.trim();
      const recordedVoice =
        voiceName && voiceName.length > 0 ? voiceName : voiceId && voiceId.length > 0 ? voiceId : '';
      // Recorded voice wins; otherwise the AI assigns one (only if there is a speaker).
      const voice =
        recordedVoice.length > 0 ? recordedVoice : speaker ? pickAiVoiceForCharacter(speaker) : '';
      const voiceSource = recordedVoice.length > 0 ? 'recorded' : 'ai-created';
      if (voice) {
        try {
          const falKey = await requireFalKey();
          const synced = await lipSyncShotClip({
            shotId,
            clipUrl: permanentVideoUrl,
            dialogue,
            voice,
            falKey,
            workDir,
          });
          finalVideoUrl = synced.videoUrl;
          finalLastFrameUrl = synced.lastFrameUrl;
          logger.info('[shot-plan-gen] shot lip-synced to character voice', {
            file: FILE,
            shotId,
            character: speaker?.name,
            voice,
            voiceSource,
          });
        } catch (err) {
          // Best-effort: keep the original silent clip + frame; never fail the shot.
          logger.error(
            '[shot-plan-gen] lip-sync failed (keeping original clip)',
            err instanceof Error ? err : new Error(String(err)),
            { file: FILE, shotId },
          );
        }
      } else {
        // Dialogue with no resolvable speaker (e.g. an off-screen/scenery line).
        logger.info('[shot-plan-gen] shot has dialogue but no resolvable speaker — skipping lip-sync', {
          file: FILE,
          shotId,
        });
      }
    }

    // ── Write the successful result back onto the shot ────────────────────────
    const generated: ShotPlanShotGenerated = {
      videoUrl: finalVideoUrl,
      lastFrameUrl: finalLastFrameUrl,
      status: 'completed',
      generationId,
      ...(typeof shot.generated?.seed === 'number' ? { seed: shot.generated.seed } : {}),
    };

    logger.info('[shot-plan-gen] shot completed + persisted', {
      file: FILE,
      shotId,
      videoUrl: finalVideoUrl,
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
// stitchShotPlan — concatenate every generated shot into ONE deliverable video
// ============================================================================

/** A generated shot's persisted clip, ready to stitch (in plan order). */
interface StitchableClip {
  shotId: string;
  index: number;
  videoUrl: string;
}

/**
 * The generated clips in plan order, ready to stitch: every shot whose generation
 * COMPLETED and has a persisted `videoUrl`, sorted by `index`. Shots that are not
 * yet generated (or failed) are skipped — the stitch is over what actually exists.
 */
function collectStitchableClips(plan: ShotPlan): StitchableClip[] {
  const out: StitchableClip[] = [];
  for (const s of [...plan.shots].sort((a, b) => a.index - b.index)) {
    const url = s.generated?.videoUrl;
    if (s.generated?.status === 'completed' && url) {
      out.push({ shotId: s.id, index: s.index, videoUrl: url });
    }
  }
  return out;
}

/** Fallback frame size when the first clip cannot be probed (Seedance 720p · 16:9). */
const STITCH_FALLBACK_WIDTH = 1280;
const STITCH_FALLBACK_HEIGHT = 720;

/**
 * Concatenate EVERY generated shot of a plan, IN ORDER, into ONE deliverable
 * video on OUR storage — the missing "final stitch" that turns a pile of clips
 * into a watchable film.
 *
 * Audio-preserving by design (the generic concat helper drops audio): each clip
 * is normalized to a uniform video frame (scale/pad/fps/sar) AND a uniform audio
 * stream (44.1 kHz stereo). A clip with no audio track (a silent shot with no
 * dialogue) gets a SILENT track synthesized at its exact duration, so the concat's
 * stream counts line up and dialogue clips keep their sound.
 *
 * Ownership rule (NON-NEGOTIABLE): the stitched file is uploaded to OUR Firebase
 * Storage with a permanent download-token URL and registered in the media library;
 * `plan.finalVideoUrl` never references a temporary CDN URL.
 *
 * Throws a clear error when there is nothing generated to stitch. LONG-RUNNING:
 * one ffmpeg re-encode over all clips (10-minute ceiling).
 */
export async function stitchShotPlan(plan: ShotPlan, ctx: TenantContext): Promise<ShotPlan> {
  const clips = collectStitchableClips(plan);
  if (clips.length === 0) {
    throw new Error(
      'stitchShotPlan: no generated shots to stitch — generate the shots first.',
    );
  }

  await ensureFfmpeg();
  const workDir = await createWorkDir('shot-plan-stitch');

  try {
    // 1. Download every clip locally; probe each for frame size + audio presence.
    const localPaths: string[] = [];
    const probes: { hasAudio: boolean; duration: number }[] = [];
    let targetW = 0;
    let targetH = 0;
    for (let i = 0; i < clips.length; i += 1) {
      const clipPath = join(workDir, `clip-${i}.mp4`);
      await downloadToFile(clips[i].videoUrl, clipPath, `stitch clip ${i} (shot ${clips[i].shotId})`);
      const probe = await probeVideo(clipPath);
      localPaths.push(clipPath);
      probes.push({ hasAudio: probe.hasAudio, duration: probe.duration });
      if (i === 0 && probe.width > 0 && probe.height > 0) {
        targetW = probe.width;
        targetH = probe.height;
      }
    }
    if (targetW === 0 || targetH === 0) {
      targetW = STITCH_FALLBACK_WIDTH;
      targetH = STITCH_FALLBACK_HEIGHT;
    }

    // 2. Build a single concat pass: real clip inputs first (indices 0..N-1), then
    //    one synthesized-silence lavfi input per audio-less clip (indices after N).
    const outputPath = join(workDir, 'final.mp4');
    const inputArgs: string[] = [];
    for (let i = 0; i < clips.length; i += 1) {
      inputArgs.push('-i', localPaths[i]);
    }

    const filterParts: string[] = [];
    const concatLabels: string[] = [];
    let nextInputIndex = clips.length;
    for (let i = 0; i < clips.length; i += 1) {
      // Video: letterbox/pad each clip to the exact target frame + uniform fps/sar.
      filterParts.push(
        `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,` +
          `pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`,
      );
      // Audio: keep the real track when present; otherwise synthesize silence of the
      // clip's duration (an extra lavfi input) so every concat segment has audio.
      if (probes[i].hasAudio) {
        filterParts.push(
          `[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`,
        );
      } else {
        const dur = probes[i].duration > 0 ? probes[i].duration : 1;
        inputArgs.push('-f', 'lavfi', '-t', dur.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
        const silentIdx = nextInputIndex;
        nextInputIndex += 1;
        filterParts.push(
          `[${silentIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`,
        );
      }
      concatLabels.push(`[v${i}][a${i}]`);
    }
    filterParts.push(`${concatLabels.join('')}concat=n=${clips.length}:v=1:a=1[outv][outa]`);

    const args = [
      ...inputArgs,
      '-filter_complex', filterParts.join(';'),
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];

    logger.info('[shot-plan-gen] stitching final video', {
      file: FILE,
      clips: clips.length,
      targetW,
      targetH,
      tenantId: ctx.tenantId,
    });
    await runFfmpeg(args, 600_000);

    const finalBuf = await readFile(outputPath);
    if (finalBuf.length === 0) {
      throw new Error('stitchShotPlan: ffmpeg produced an empty final video');
    }

    // 3. Persist the stitched 1080p deliverable to OUR storage (ownership rule).
    //    This is the upscaler's source AND our guaranteed fallback.
    const storagePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
    const stitched1080Url = await uploadPermanent(finalBuf, storagePath, 'video/mp4', 'shot-plan stitched 1080p video');

    // 4. Topaz 4K upscale pass (best-effort). factor 2 on a 1080p source →
    //    exactly 3840x2160. If it fails we deliver the 1080p stitch + log, never
    //    losing the work. The 4K result is downloaded → persisted (ownership rule).
    let finalUrl = stitched1080Url;
    let finalBytes = finalBuf.length;
    let upscaledTo4K = false;
    try {
      const falKey = await requireFalKey();
      logger.info('[shot-plan-gen] upscaling stitched video to 4K (Topaz)', { file: FILE, clips: clips.length });
      const upscaleOut = await falQueue(
        FAL_UPSCALE_MODEL,
        { video_url: stitched1080Url, upscale_factor: 2 },
        falKey,
        'shot-plan 4K upscale',
      );
      const upscaledFalUrl = falMediaUrl(upscaleOut, 'video');
      const upscaledPath = join(workDir, 'final-4k.mp4');
      const upscaledBuf = await downloadToFile(upscaledFalUrl, upscaledPath, 'shot-plan 4K video');
      finalUrl = await uploadPermanent(
        upscaledBuf,
        `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`,
        'video/mp4',
        'shot-plan 4K final video',
      );
      finalBytes = upscaledBuf.length;
      upscaledTo4K = true;
      logger.info('[shot-plan-gen] 4K upscale completed + persisted', { file: FILE, finalUrl, bytes: finalBytes });
    } catch (err) {
      // Best-effort: fall back to the 1080p stitch; never lose the work.
      logger.error(
        '[shot-plan-gen] 4K upscale failed (delivering 1080p stitch)',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE },
      );
    }

    // 5. Register the delivered video in the media library (ownership rule).
    await createAsset({
      type: 'video',
      category: 'final-render',
      name: `${plan.title || 'Shot Plan'} — final video${upscaledTo4K ? ' (4K)' : ''}`,
      description:
        `Final stitched video (${clips.length} shot${clips.length === 1 ? '' : 's'}, ` +
        `${upscaledTo4K ? '4K upscaled' : '1080p'}) from Shot Plan "${plan.title || plan.id}".`,
      url: finalUrl,
      mimeType: 'video/mp4',
      fileSize: finalBytes,
      source: 'ai-generated',
      aiProvider: upscaledTo4K ? `fal-seedance + ${FAL_UPSCALE_MODEL}` : 'fal-seedance',
      createdBy: 'system',
      tags: upscaledTo4K ? ['shot-plan', 'final-video', '4k'] : ['shot-plan', 'final-video'],
    });

    logger.info('[shot-plan-gen] final video persisted', {
      file: FILE,
      finalUrl,
      bytes: finalBytes,
      clips: clips.length,
      upscaledTo4K,
    });

    return applyShotPlanEdit(plan, { target: 'plan', field: 'finalVideoUrl', value: finalUrl });
  } finally {
    await cleanupWorkDir(workDir);
  }
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
  // The shot's environment-zone hero (or the world hero) — the SET the on-model
  // cast must appear inside, so the frame is the real cast in the real environment.
  const envHeroUrl = resolveShotEnvironmentHeroUrl(plan, shot);
  const envProse = shotEnvironmentProse(plan, shot);
  const workDir = await createWorkDir('shot-plan-keyframe');

  try {
    // ctx is referenced explicitly: these fal image helpers resolve the key from
    // the platform credential store (single-tenant), so there is no per-call ctx
    // arg, but we log it so the multi-tenant metering seam is visible here too.
    const seed = typeof shot.generated?.seed === 'number' ? shot.generated.seed : undefined;

    // STORYBOARD KEYFRAME = a cinematic photographic still of the ACTUAL on-model
    // cast INSIDE the ACTUAL set for this shot. Two reference signals matter: the
    // cast identity (kept exact) AND the environment hero (the set look). Flux Pro
    // Kontext (`generateFromReferenceWithFal`) accepts a SINGLE source image only —
    // there is no multi-image / additionalImageUrls path on the fal provider — so we
    // anchor on the cast ref for identity (the single biggest quality differentiator)
    // and fold the environment hero in through strong prose, naming the set
    // explicitly. Without cast refs we fall back to a pure text-to-image still.
    const mode = castRefs.length > 0 ? 'kontext' : 'text-to-image';
    const keyframePrompt =
      castRefs.length > 0
        ? `Cinematic film still: keep the EXACT same person/people from the reference image — ` +
          `identical face(s), hair, and wardrobe — placed inside ${envProse || 'the scene environment'}. ` +
          `${basePrompt} Photographic, film-grade, sharp focus, on-model recognizable cast in the ` +
          `actual set, no text.`
        : `Cinematic film still in ${envProse || 'the scene environment'}. ${basePrompt} ` +
          `Photographic, film-grade, sharp focus, no text.`;

    logger.info('[shot-plan-gen] submitting keyframe still', {
      file: FILE,
      shotId,
      tenantId: ctx.tenantId,
      mode,
      castRefCount: castRefs.length,
      // Multi-ref readout: cast identity ref + environment hero. The provider is
      // single-reference, so envHero rides in prose (envHeroResolved) — both counts
      // are logged so the owner can confirm the keyframe saw the right set.
      envHeroResolved: envHeroUrl ? 1 : 0,
      envZone: resolveShotEnvironmentZone(plan, shot)?.label ?? null,
    });

    const result =
      castRefs.length > 0
        ? await generateFromReferenceWithFal(keyframePrompt, castRefs[0], {
            aspectRatio: '16:9',
            ...(seed !== undefined ? { seed } : {}),
          })
        : await generateWithFal(keyframePrompt, {
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
      aiPrompt: keyframePrompt,
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

// ============================================================================
// generateFloorPlanImage — the rendered top-down backdrop for the blocking map
// ============================================================================

/**
 * Render a BEAUTIFUL top-down floor-plan image of the scene (the OpenArt-style
 * overhead set render) and store it on `plan.floorPlan.backdropImageUrl`. The
 * interactive FloorPlanCanvas draws the camera/route/actor markers ON TOP of this
 * image — so the operator sees a real rendered set from above, not a blank grid.
 *
 * Text-to-image via Flux from the environment fingerprint. Ownership rule applies:
 * the render is persisted to OUR storage + media library; never a fal URL on the
 * plan. The structured blocking itself is authored by the planner, not here.
 */
export async function generateFloorPlanImage(plan: ShotPlan, ctx: TenantContext): Promise<ShotPlan> {
  const fingerprint = plan.sharedChoices.environmentFingerprint?.trim() || 'the scene environment';
  const prompt =
    `Top-down overhead floor-plan view of ${fingerprint}. A clean architectural ` +
    'overhead map of the set seen from directly above — ground layout, key set ' +
    'pieces, and open staging areas clearly readable. Muted, high-contrast, ' +
    'schematic-but-rendered look so bright camera markers read clearly on top. ' +
    'No text, no labels, no numbers.';

  const workDir = await createWorkDir('shot-plan-floorplan');
  try {
    logger.info('[shot-plan-gen] submitting floor-plan image', { file: FILE, tenantId: ctx.tenantId });
    const result = await generateWithFal(prompt, { aspectRatio: '16:9' });
    const falUrl = result.url;
    if (!falUrl) {
      throw new Error('floor-plan image generation returned no image url');
    }

    const imgPath = join(workDir, 'floorplan.png');
    const buf = await downloadToFile(falUrl, imgPath, 'floor-plan image');

    const storagePath = `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`;
    const permanentUrl = await uploadPermanent(buf, storagePath, 'image/png', 'floor-plan image');

    await createAsset({
      type: 'image',
      category: 'graphic',
      name: `Floor plan — ${plan.title || plan.id}`,
      description: `Top-down floor-plan render for Shot Plan "${plan.title || plan.id}".`,
      url: permanentUrl,
      mimeType: 'image/png',
      fileSize: buf.length,
      source: 'ai-generated',
      aiProvider: 'fal',
      aiPrompt: prompt,
      createdBy: 'system',
      tags: ['shot-plan', 'floor-plan'],
    });

    const nextFloorPlan: ShotPlanFloorPlan = {
      ...(plan.floorPlan ?? { elements: [], cameras: [], subjectPaths: [] }),
      backdropImageUrl: permanentUrl,
    };
    logger.info('[shot-plan-gen] floor-plan image persisted', { file: FILE, url: permanentUrl });
    return applyShotPlanEdit(plan, { target: 'plan', field: 'floorPlan', value: nextFloorPlan });
  } finally {
    await cleanupWorkDir(workDir);
  }
}

// ============================================================================
// generateEnvironmentHero — the establishing render of the world
// ============================================================================

/** The shared look-bible descriptor bits, woven into every environment-hero prompt. */
function environmentLookBits(plan: ShotPlan): string {
  const look = plan.sharedChoices.lookBible ?? {};
  return [look.movieLook, look.filmStock, look.lighting, look.atmosphere, look.artStyle]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .join(', ');
}

/**
 * Render + persist ONE wide establishing "hero" image for an environment from a
 * description string (the world fingerprint, or a single zone's look), and return
 * its permanent URL on OUR storage. Ownership rule applies. Throws on a missing url.
 */
async function renderEnvironmentHeroImage(
  plan: ShotPlan,
  description: string,
  lookBits: string,
  label: string,
  ctx: TenantContext,
): Promise<string> {
  const prompt =
    `Wide cinematic establishing shot of ${description}. ${lookBits}. ` +
    'Atmospheric, film-still quality, no people, no text.';
  const workDir = await createWorkDir('shot-plan-envhero');
  try {
    logger.info('[shot-plan-gen] submitting environment hero', { file: FILE, tenantId: ctx.tenantId, label });
    const result = await generateWithFal(prompt, { aspectRatio: '16:9' });
    if (!result.url) {
      throw new Error(`environment hero generation returned no image url (${label})`);
    }
    const buf = await downloadToFile(result.url, join(workDir, 'envhero.png'), `environment hero ${label}`);
    const url = await uploadPermanent(
      buf,
      `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`,
      'image/png',
      `environment hero ${label}`,
    );
    await createAsset({
      type: 'image',
      category: 'photo',
      name: `Environment (${label}) — ${plan.title || plan.id}`,
      description: `Establishing environment render (${label}) for Shot Plan "${plan.title || plan.id}".`,
      url,
      mimeType: 'image/png',
      fileSize: buf.length,
      source: 'ai-generated',
      aiProvider: 'fal',
      aiPrompt: prompt,
      createdBy: 'system',
      tags: ['shot-plan', 'environment'],
    });
    return url;
  } finally {
    await cleanupWorkDir(workDir);
  }
}

/**
 * Render a wide establishing "hero" image of the environment (the production-sheet
 * env render) from the environment fingerprint + look bible, and store it on
 * `sharedChoices.environmentHeroImageUrl`.
 *
 * For a MULTI-ZONE plan this ALSO renders one hero per `sharedChoices.environmentZones[]`
 * and writes each `zone.heroImageUrl` — the doc renders a hero per zone from that
 * field, so without this every zone after the first stays blank. Each zone hero is
 * best-effort (a single zone failure never loses the others or the top-level hero).
 * With no zones, behaves exactly as before. Ownership rule applies.
 */
export async function generateEnvironmentHero(plan: ShotPlan, ctx: TenantContext): Promise<ShotPlan> {
  const sc = plan.sharedChoices;
  const fingerprint = sc.environmentFingerprint?.trim() || 'the scene environment';
  const lookBits = environmentLookBits(plan);

  // 1. Top-level world hero (unchanged behavior).
  const topUrl = await renderEnvironmentHeroImage(plan, fingerprint, lookBits, 'world', ctx);
  let current = applyShotPlanEdit(plan, {
    target: 'shared',
    field: 'environmentHeroImageUrl',
    value: topUrl,
  });

  // 2. Per-zone heroes — one render per zone, written back onto zone.heroImageUrl.
  const zones = current.sharedChoices.environmentZones ?? [];
  if (zones.length === 0) {
    return current;
  }

  const updatedZones = [...zones];
  let zonesChanged = false;
  for (let i = 0; i < updatedZones.length; i += 1) {
    const zone = updatedZones[i];
    // Describe the zone by its set-design + label, falling back to the world
    // fingerprint so a sparsely-authored zone still gets a coherent render.
    const setDesign = (zone.setDesign ?? []).map((s) => s.trim()).filter(Boolean).join(', ');
    const description =
      [zone.label?.trim(), setDesign].filter(Boolean).join(' — ') || fingerprint;
    try {
      const zoneUrl = await renderEnvironmentHeroImage(plan, description, lookBits, zone.label || `zone ${i + 1}`, ctx);
      updatedZones[i] = { ...zone, heroImageUrl: zoneUrl };
      zonesChanged = true;
    } catch (err) {
      logger.error(
        '[shot-plan-gen] environment zone hero failed (continuing)',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE, zoneId: zone.id, label: zone.label },
      );
    }
  }

  if (zonesChanged) {
    current = applyShotPlanEdit(current, {
      target: 'shared',
      field: 'environmentZones',
      value: updatedZones,
    });
  }
  return current;
}

// ============================================================================
// generateLightingSwatches — the rendered lighting/mood board tiles
// ============================================================================

/** Distinct lighting setups to render as swatches: the look-bible baseline + per-shot accents (capped). */
function resolveLightingSetups(plan: ShotPlan): string[] {
  const setups: string[] = [];
  const push = (v: string | undefined): void => {
    const t = v?.trim();
    if (t && !setups.some((s) => s.toLowerCase() === t.toLowerCase())) {
      setups.push(t);
    }
  };
  push(plan.sharedChoices.lookBible?.lighting);
  for (const shot of plan.shots) {
    push(shot.lighting);
  }
  // Fallback: derive from mood keywords if no explicit lighting anywhere.
  if (setups.length === 0) {
    for (const k of plan.sharedChoices.moodKeywords) {
      push(`${k} lighting`);
    }
  }
  return setups.slice(0, 4);
}

/**
 * Render a small grid of lighting-setup swatches (the mood board) — one comparable
 * tile per distinct lighting condition — and store them on `sharedChoices.lightingSwatches`.
 * Best-effort per tile. Ownership rule applies.
 */
export async function generateLightingSwatches(plan: ShotPlan, ctx: TenantContext): Promise<ShotPlan> {
  const setups = resolveLightingSetups(plan);
  if (setups.length === 0) {
    return plan;
  }
  const fingerprint = plan.sharedChoices.environmentFingerprint?.trim() || 'a cinematic set';
  const swatches: { label: string; imageUrl: string }[] = [];

  for (const setup of setups) {
    const workDir = await createWorkDir('shot-plan-lighting');
    try {
      const prompt =
        `Cinematic lighting study tile: ${setup}. The same simple subject lit by this setup ` +
        `in ${fingerprint}. Moody, atmospheric, clear directional light, film still, no text.`;
      logger.info('[shot-plan-gen] submitting lighting swatch', { file: FILE, tenantId: ctx.tenantId, setup });
      const result = await generateWithFal(prompt, { aspectRatio: '1:1' });
      if (!result.url) {
        continue;
      }
      const buf = await downloadToFile(result.url, join(workDir, 'swatch.png'), `lighting swatch ${setup}`);
      const url = await uploadPermanent(
        buf,
        `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`,
        'image/png',
        `lighting swatch ${setup}`,
      );
      await createAsset({
        type: 'image',
        category: 'graphic',
        name: `Lighting — ${setup.slice(0, 60)}`,
        description: `Lighting swatch for Shot Plan "${plan.title || plan.id}".`,
        url,
        mimeType: 'image/png',
        fileSize: buf.length,
        source: 'ai-generated',
        aiProvider: 'fal',
        aiPrompt: prompt,
        createdBy: 'system',
        tags: ['shot-plan', 'lighting'],
      });
      swatches.push({ label: setup, imageUrl: url });
    } finally {
      await cleanupWorkDir(workDir);
    }
  }

  if (swatches.length === 0) {
    return plan;
  }
  return applyShotPlanEdit(plan, { target: 'shared', field: 'lightingSwatches', value: swatches });
}

// ============================================================================
// generateCharacterSheets — a rendered model/turnaround sheet per cast member
// ============================================================================

/** The turnaround views rendered for each character's model sheet. */
const CHARACTER_VIEWS: { label: string; view: string; framing: string }[] = [
  {
    label: 'FRONT',
    view: 'front view, facing the camera directly',
    framing: 'full body head-to-toe, neutral standing A-pose',
  },
  {
    label: 'SIDE',
    view: 'full side profile view',
    framing: 'full body head-to-toe, neutral standing pose',
  },
  {
    label: 'BACK',
    view: 'back view, facing away from camera',
    framing: 'full body head-to-toe, neutral standing pose',
  },
  {
    label: 'FACE CLOSE-UP',
    view: 'front-facing head-and-shoulders portrait',
    framing: 'tight close-up on the face, head and shoulders only, sharp facial detail',
  },
  {
    label: 'COSTUME DETAIL',
    view: 'three-quarter view emphasising signature wardrobe, props and accessories',
    framing: 'medium close-up on the costume, wardrobe textures and accessory detail',
  },
];

/** First non-empty (trimmed) value, or undefined. */
function firstText(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    if (v?.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

/**
 * Build a text-to-image prompt for an INVENTED character's BASE reference from its
 * casting card (no uploaded source image exists). Reads the full identity the
 * planner authored — age, ethnicity, gender, build, hair, wardrobe, accessories,
 * notes — so the generated person matches the written profile.
 */
function inventedCharacterBasePrompt(plan: ShotPlan, member: ShotPlanCastMember): string {
  const sc = plan.sharedChoices;
  const style = firstText(sc.lookBible?.artStyle, sc.artStyle) ?? 'photorealistic';
  const subject = firstText(member.name) ?? 'a character';
  const identity = [member.apparentAge, member.ethnicity, member.gender]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .join(' ');
  const bits: string[] = [];
  if (identity) {
    bits.push(`a ${identity}`);
  }
  const build = firstText(member.build);
  if (build) {
    bits.push(`${build} build`);
  }
  const hair = [member.hairColor, member.hairStyle].map((s) => s?.trim()).filter(Boolean).join(' ');
  if (hair) {
    bits.push(`${hair} hair`);
  }
  const wardrobe = firstText(member.wardrobe);
  if (wardrobe) {
    bits.push(`wearing ${wardrobe}`);
  }
  if (member.accessories && member.accessories.length > 0) {
    bits.push(`with ${member.accessories.join(', ')}`);
  }
  const notes = firstText(member.notes);
  return (
    `Full-body character reference of ${subject}${bits.length > 0 ? `, ${bits.join(', ')}` : ''}.` +
    `${notes ? ` ${notes}` : ''} A single neutral standing full-body subject, head to toe, ` +
    `front-facing in a neutral A-pose, isolated on a seamless light-grey (#d9d9d9) photographic ` +
    `studio background, even soft studio lighting, photorealistic, sharp focus, no props, no text. ` +
    `${style}. Single character, full body visible.`
  );
}

/**
 * Generate + persist a BASE reference image for an invented character (text-to-image
 * via Flux from its casting card). Returns the permanent URL on OUR storage, or null
 * on failure (best-effort — a missing base just means no model sheet for this one).
 */
async function generateInventedCharacterBase(
  plan: ShotPlan,
  member: ShotPlanCastMember,
  ctx: TenantContext,
): Promise<string | null> {
  const prompt = inventedCharacterBasePrompt(plan, member);
  const workDir = await createWorkDir('shot-plan-charbase');
  try {
    logger.info('[shot-plan-gen] generating invented character base', {
      file: FILE,
      character: member.name,
      tenantId: ctx.tenantId,
    });
    const result = await generateWithFal(prompt, { aspectRatio: '9:16' });
    if (!result.url) {
      return null;
    }
    const buf = await downloadToFile(result.url, join(workDir, 'base.png'), `char ${member.name} base`);
    const url = await uploadPermanent(
      buf,
      `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`,
      'image/png',
      `char ${member.name} base`,
    );
    await createAsset({
      type: 'image',
      category: 'character',
      name: `${member.name} — base reference`,
      description: `Generated base reference for invented character in Shot Plan "${plan.title || plan.id}".`,
      url,
      mimeType: 'image/png',
      fileSize: buf.length,
      source: 'ai-generated',
      aiProvider: 'fal',
      aiPrompt: prompt,
      createdBy: 'system',
      characterId: member.characterId,
      characterName: member.name,
      tags: ['shot-plan', 'character', 'base-reference'],
    });
    return url;
  } catch (err) {
    logger.error(
      '[shot-plan-gen] invented character base failed (continuing)',
      err instanceof Error ? err : new Error(String(err)),
      { file: FILE, character: member.name },
    );
    return null;
  } finally {
    await cleanupWorkDir(workDir);
  }
}

/** Render ONE turnaround view off a reference image; returns its persisted URL or null. */
async function renderCharacterView(
  plan: ShotPlan,
  member: ShotPlanCastMember,
  ref: string,
  view: { label: string; view: string; framing: string },
  ctx: TenantContext,
): Promise<{ label: string; imageUrl: string } | null> {
  const { label, view: viewDir, framing } = view;
  const workDir = await createWorkDir('shot-plan-charsheet');
  try {
    // Kontext edit OFF THE SAME BASE: hard identity lock. The instruction names the
    // base subject as "the EXACT same person" so face/hair/wardrobe carry over while
    // only the camera angle changes — a real production turnaround, same backdrop.
    const prompt =
      `Keep the EXACT same person from the reference image — identical face, hairstyle, and wardrobe — ` +
      `${viewDir}, ${framing}, full body, isolated on the same seamless light-grey (#d9d9d9) ` +
      `photographic studio background, even soft studio lighting, consistent identity, ` +
      `photorealistic, sharp focus, no props, no text. Character turnaround model sheet.`;
    logger.info('[shot-plan-gen] submitting character view (identity-locked off base)', { file: FILE, tenantId: ctx.tenantId, character: member.name, label });
    const result = await generateFromReferenceWithFal(prompt, ref, {});
    if (!result.url) {
      return null;
    }
    const buf = await downloadToFile(result.url, join(workDir, 'view.png'), `char ${member.name} ${label}`);
    const url = await uploadPermanent(
      buf,
      `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`,
      'image/png',
      `char ${member.name} ${label}`,
    );
    await createAsset({
      type: 'image',
      category: 'character',
      name: `${member.name} — ${label}`,
      description: `Character model-sheet view for Shot Plan "${plan.title || plan.id}".`,
      url,
      mimeType: 'image/png',
      fileSize: buf.length,
      source: 'ai-generated',
      aiProvider: 'fal',
      aiPrompt: prompt,
      createdBy: 'system',
      characterId: member.characterId,
      characterName: member.name,
      tags: ['shot-plan', 'character-sheet', 'character', label.toLowerCase()],
    });
    return { label, imageUrl: url };
  } catch (err) {
    logger.error('[shot-plan-gen] character view failed (continuing)', err instanceof Error ? err : new Error(String(err)), { file: FILE, character: member.name, label });
    return null;
  } finally {
    await cleanupWorkDir(workDir);
  }
}

/**
 * Render ONE cast member's full model sheet (base + every turnaround view) and
 * return the updated member, or `null` when nothing could be produced (no ref and
 * the base synth failed). For an INVENTED character (no uploads) a base portrait is
 * FIRST synthesized from the casting card and written back onto referenceImageUrls
 * (so video identity-anchoring uses it too). The 5 views are rendered in PARALLEL
 * via `Promise.allSettled` so one failed view never loses the others, and the views
 * are emitted in the canonical CHARACTER_VIEWS order. Best-effort per view.
 */
async function renderCastMemberSheet(
  plan: ShotPlan,
  member: ShotPlanCastMember,
  ctx: TenantContext,
): Promise<ShotPlanCastMember | null> {
  let ref = member.referenceImageUrls[0];
  // Invented character (no uploaded refs): synthesize a base portrait from the
  // casting card FIRST, so the model sheet + video identity-anchoring have a
  // consistent source. The base is written back onto referenceImageUrls below.
  let generatedBase: string | undefined;
  if (!ref) {
    const base = await generateInventedCharacterBase(plan, member, ctx);
    if (base) {
      ref = base;
      generatedBase = base;
    }
  }
  if (!ref) {
    return null;
  }

  // Parallelize the views off the (now-guaranteed) reference; one failed view does
  // not lose the rest. Re-order the settled results back into CHARACTER_VIEWS order.
  const anchor = ref;
  const settled = await Promise.allSettled(
    CHARACTER_VIEWS.map((v) => renderCharacterView(plan, member, anchor, v, ctx)),
  );
  const sheet: { label: string; imageUrl: string }[] = [];
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled' && outcome.value) {
      sheet.push(outcome.value);
    }
  }

  // Persist a generated base into referenceImageUrls (lead position) so video
  // generation anchors identity on it — for both the sheet-succeeded and
  // sheet-failed-but-base-made cases.
  const refs = generatedBase ? [generatedBase, ...member.referenceImageUrls] : member.referenceImageUrls;
  if (sheet.length > 0) {
    return { ...member, referenceImageUrls: refs, modelSheet: sheet };
  }
  if (generatedBase) {
    return { ...member, referenceImageUrls: refs };
  }
  return null;
}

/**
 * Render a clean model/turnaround sheet via Flux Kontext, so the production sheet
 * shows a rich character reference like a real model sheet. For a SAVED character
 * the source is the operator's uploaded reference; for an INVENTED character (no
 * uploads) a base portrait is FIRST synthesized from the casting card and written
 * back onto the member's referenceImageUrls. Best-effort per view + per character.
 * Ownership rule applies.
 *
 * When `castMemberId` is given, renders ONLY that one member's base + views and
 * writes its `modelSheet` back — the per-member contract that keeps each HTTP
 * request short so the client reliably receives the updated plan. When omitted,
 * renders EVERY cast member (the original all-at-once behavior, kept for callers
 * like `renderShotPlanAssets`).
 */
export async function generateCharacterSheets(
  plan: ShotPlan,
  ctx: TenantContext,
  castMemberId?: string,
): Promise<ShotPlan> {
  const cast = plan.sharedChoices.cast;
  if (cast.length === 0) {
    return plan;
  }

  // ── Per-member path: render exactly the requested member, write it back ────────
  if (castMemberId) {
    const member = cast.find((c) => c.characterId === castMemberId);
    if (!member) {
      throw new Error(`generateCharacterSheets: cast member not found in plan: ${castMemberId}`);
    }
    const rendered = await renderCastMemberSheet(plan, member, ctx);
    if (!rendered) {
      return plan;
    }
    const updated = cast.map((c) => (c.characterId === castMemberId ? rendered : c));
    return applyShotPlanEdit(plan, { target: 'shared', field: 'cast', value: updated });
  }

  // ── All-members path (backward compatible) ─────────────────────────────────────
  const updated: ShotPlanCastMember[] = [];
  let changed = false;
  for (const member of cast) {
    const rendered = await renderCastMemberSheet(plan, member, ctx);
    if (rendered) {
      updated.push(rendered);
      changed = true;
    } else {
      updated.push(member);
    }
  }

  if (!changed) {
    return plan;
  }
  return applyShotPlanEdit(plan, { target: 'shared', field: 'cast', value: updated });
}

// ============================================================================
// generateObjectSheets — reference art for invented OBJECTS (creatures/vehicles)
// ============================================================================

/** Alternate views rendered (via Kontext off the base) for an object's reference set. */
const OBJECT_VIEWS: { label: string; view: string }[] = [
  { label: 'SIDE', view: 'full side profile view, same subject' },
  { label: 'DETAIL', view: 'close-up detail of materials, surface texture and distinguishing features, same subject' },
];

/**
 * A prop is a BRANDED SURFACE when its name or description names a surface that, in
 * the real world, carries the company's logo (a screen, packaging, merch, signage…).
 * For these props we (a) tell the generator to leave the surface clean/unbranded so it
 * does NOT invent a fake logo, then (b) composite the operator's REAL logo on top.
 */
const BRANDED_SURFACE_REGEX = /dashboard|screen|display|monitor|branded|logo|app\b|tablet|laptop|mug|cup|bottle|merch|packaging|sign|banner/i;

function isBrandedSurfaceProp(obj: { name: string; description?: string }): boolean {
  return BRANDED_SURFACE_REGEX.test(`${obj.name} ${obj.description ?? ''}`);
}

/** Appended to branded-surface prop prompts so the AI leaves the surface logo-free. */
const CLEAN_SURFACE_INSTRUCTION =
  ', clean unbranded surface, no text, no logos, no brand marks, blank screen';

/** Text-to-image prompt for an invented object's BASE reference from its description. */
function inventedObjectBasePrompt(plan: ShotPlan, obj: { name: string; subjectKind?: 'object' | 'creature'; description?: string }): string {
  const sc = plan.sharedChoices;
  const style = firstText(sc.lookBible?.artStyle, sc.artStyle) ?? 'photorealistic';
  const kind = obj.subjectKind === 'creature' ? 'creature' : 'object';
  const descr = firstText(obj.description);
  const cleanSurface = isBrandedSurfaceProp(obj) ? CLEAN_SURFACE_INSTRUCTION : '';
  return (
    `Hero reference of ${obj.name}, a ${kind}.${descr ? ` ${descr}.` : ''} ` +
    `Front three-quarter view, isolated on a clean light-grey studio background, even soft ` +
    `studio lighting, sharp detail, ${style}. Single subject, full subject visible, no text${cleanSurface}.`
  );
}

/**
 * Load the operator's real brand logo once per generation pass. Returns a usable
 * `BrandLogo` (with a non-empty url) or null when there's no logo to composite.
 * Best-effort — any error means "no logo", never a thrown failure.
 */
async function loadCompositableLogo(): Promise<BrandLogo | null> {
  try {
    const kit = await getBrandKit();
    if (kit.logo?.url) {
      return kit.logo;
    }
    return null;
  } catch (err) {
    logger.warn('[shot-plan-gen] could not load brand logo for prop compositing (continuing)', {
      file: FILE,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * For a branded-surface prop image: composite the operator's REAL logo onto the
 * generated (clean-surface) image, persist the result to our storage + media library,
 * and return the COMPOSITED url. Best-effort — returns the original url on any failure
 * so prop generation never breaks. Non-branded props never call this.
 */
async function compositeLogoOntoPropImage(
  generatedUrl: string,
  logo: BrandLogo,
  obj: { name: string; subjectKind?: 'object' | 'creature' },
  plan: ShotPlan,
  label: string,
): Promise<string> {
  const workDir = await createWorkDir('shot-plan-objlogo');
  try {
    const composited = await compositeBrandLogoCentered(generatedUrl, logo);
    if (!composited) {
      return generatedUrl;
    }
    const url = await uploadPermanent(
      composited,
      `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`,
      'image/png',
      `object ${obj.name} ${label} (branded)`,
    );
    await createAsset({
      type: 'image',
      category: 'graphic',
      name: `${obj.name} — ${label} (branded)`,
      description: `Branded ${label} for ${obj.subjectKind ?? 'object'} in Shot Plan "${plan.title || plan.id}" — real brand logo composited.`,
      url,
      mimeType: 'image/png',
      fileSize: composited.length,
      source: 'ai-generated',
      aiProvider: 'fal',
      createdBy: 'system',
      tags: ['shot-plan', 'object', 'brand-logo'],
    });
    return url;
  } catch (err) {
    logger.warn('[shot-plan-gen] prop logo composite failed (using clean image)', {
      file: FILE,
      object: obj.name,
      label,
      error: err instanceof Error ? err.message : String(err),
    });
    return generatedUrl;
  } finally {
    await cleanupWorkDir(workDir);
  }
}

/**
 * Generate reference art for every INVENTED object (one with no referenceImageUrls):
 * a base hero render from its description, plus a couple of alternate views off that
 * base (Kontext). The images fill the object/props block AND anchor the object's
 * appearance in video generation (resolveObjectReferenceImageUrls). Best-effort per
 * object/view. Ownership rule applies. Saved objects (already with refs) are untouched.
 */
export async function generateObjectSheets(plan: ShotPlan, ctx: TenantContext): Promise<ShotPlan> {
  const objects = plan.sharedChoices.objects ?? [];
  if (objects.length === 0) {
    return plan;
  }

  const updated: ShotPlanObject[] = [];
  let changed = false;

  // Real brand logo for compositing onto branded-surface props. Load it ONCE up front,
  // but only when at least one prop without refs is actually a branded surface. null =
  // no usable logo (compositing is skipped entirely, props keep their clean render).
  const anyBrandedProp = objects.some(
    (o) => o.referenceImageUrls.length === 0 && isBrandedSurfaceProp(o),
  );
  const brandLogo: BrandLogo | null = anyBrandedProp ? await loadCompositableLogo() : null;

  for (const obj of objects) {
    if (obj.referenceImageUrls.length > 0) {
      updated.push(obj);
      continue;
    }
    const refs: string[] = [];
    // The CLEAN (un-composited) base — used as the anchor for the alternate VIEWS so
    // Kontext never re-renders our composited logo (which would warp it and double-
    // stack with the clean overlay we add to each view). Views anchor on THIS, not refs[0].
    let cleanBaseUrl: string | null = null;
    const branded = isBrandedSurfaceProp(obj) && brandLogo !== null;

    // 1. Base hero render (text-to-image from the description).
    const baseWorkDir = await createWorkDir('shot-plan-objbase');
    try {
      const basePrompt = inventedObjectBasePrompt(plan, obj);
      logger.info('[shot-plan-gen] generating invented object base', { file: FILE, object: obj.name, tenantId: ctx.tenantId });
      const result = await generateWithFal(basePrompt, { aspectRatio: '1:1' });
      if (result.url) {
        const buf = await downloadToFile(result.url, join(baseWorkDir, 'base.png'), `object ${obj.name} base`);
        const url = await uploadPermanent(buf, `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`, 'image/png', `object ${obj.name} base`);
        await createAsset({
          type: 'image',
          category: 'graphic',
          name: `${obj.name} — reference`,
          description: `Generated reference for ${obj.subjectKind ?? 'object'} in Shot Plan "${plan.title || plan.id}".`,
          url,
          mimeType: 'image/png',
          fileSize: buf.length,
          source: 'ai-generated',
          aiProvider: 'fal',
          aiPrompt: basePrompt,
          createdBy: 'system',
          tags: ['shot-plan', 'object', obj.subjectKind ?? 'object'],
        });
        // Keep the CLEAN base for view generation; composite our logo only onto the
        // displayed reference.
        cleanBaseUrl = url;
        let refUrl = url;
        if (branded && brandLogo) {
          refUrl = await compositeLogoOntoPropImage(url, brandLogo, obj, plan, 'reference');
        }
        refs.push(refUrl);
      }
    } catch (err) {
      logger.error('[shot-plan-gen] invented object base failed (continuing)', err instanceof Error ? err : new Error(String(err)), { file: FILE, object: obj.name });
    } finally {
      await cleanupWorkDir(baseWorkDir);
    }

    // 2. Alternate views off the base (best-effort each), only if a base exists.
    if (refs.length > 0) {
      for (const { label, view } of OBJECT_VIEWS) {
        const viewWorkDir = await createWorkDir('shot-plan-objview');
        try {
          const cleanSurface = branded ? CLEAN_SURFACE_INSTRUCTION : '';
          const prompt = `The exact same subject, ${view}, isolated on a clean light-grey studio background, even soft studio lighting, consistent identity, sharp detail${cleanSurface}.`;
          const result = await generateFromReferenceWithFal(prompt, cleanBaseUrl ?? refs[0], {});
          if (result.url) {
            const buf = await downloadToFile(result.url, join(viewWorkDir, 'view.png'), `object ${obj.name} ${label}`);
            const url = await uploadPermanent(buf, `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`, 'image/png', `object ${obj.name} ${label}`);
            await createAsset({
              type: 'image',
              category: 'graphic',
              name: `${obj.name} — ${label}`,
              description: `Generated ${label} view for ${obj.subjectKind ?? 'object'} in Shot Plan "${plan.title || plan.id}".`,
              url,
              mimeType: 'image/png',
              fileSize: buf.length,
              source: 'ai-generated',
              aiProvider: 'fal',
              aiPrompt: prompt,
              createdBy: 'system',
              tags: ['shot-plan', 'object', label.toLowerCase()],
            });
            // Branded surface → composite the operator's REAL logo onto this view too.
            let refUrl = url;
            if (branded && brandLogo) {
              refUrl = await compositeLogoOntoPropImage(url, brandLogo, obj, plan, label);
            }
            refs.push(refUrl);
          }
        } catch (err) {
          logger.error('[shot-plan-gen] invented object view failed (continuing)', err instanceof Error ? err : new Error(String(err)), { file: FILE, object: obj.name, label });
        } finally {
          await cleanupWorkDir(viewWorkDir);
        }
      }
    }

    if (refs.length > 0) {
      updated.push({ ...obj, referenceImageUrls: refs });
      changed = true;
    } else {
      updated.push(obj);
    }
  }

  if (!changed) {
    return plan;
  }
  return applyShotPlanEdit(plan, { target: 'shared', field: 'objects', value: updated });
}

// ============================================================================
// renderShotPlanAssets — make the document COMPLETE for review (the "preview" step)
// ============================================================================

/** Progress for the full-sheet asset render (floor-plan image + every keyframe). */
export interface ShotPlanAssetProgress {
  phase: 'floor-plan' | 'environment-hero' | 'lighting-swatches' | 'character-sheets' | 'object-sheets' | 'keyframe';
  shotId?: string;
  index?: number;
  total?: number;
  status: 'completed' | 'failed';
  error?: string;
}

/**
 * Render EVERY image the production sheet needs so the operator reviews a COMPLETE
 * document, not a skeleton: the top-down floor-plan backdrop + a keyframe still for
 * every shot. This is the OpenArt "Preview Shot Plan" step — planning already
 * happened; here we render the stills before review (video comes later, on demand).
 *
 * Best-effort PER ASSET: a single failed image is reported via onProgress and
 * skipped, never aborting the whole sheet — the operator can regenerate that one
 * piece individually. Returns the plan with every successful asset persisted.
 *
 * LONG-RUNNING: one image generation per shot + one for the floor plan. Acceptable
 * for a preview step; a queue/poll split can come later without changing this API.
 */
export async function renderShotPlanAssets(
  plan: ShotPlan,
  ctx: TenantContext,
  onProgress?: (progress: ShotPlanAssetProgress) => void,
): Promise<ShotPlan> {
  let current = plan;

  // 1. Floor-plan backdrop render (best-effort).
  try {
    current = await generateFloorPlanImage(current, ctx);
    onProgress?.({ phase: 'floor-plan', status: 'completed' });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('[shot-plan-gen] floor-plan image render failed (continuing)', err instanceof Error ? err : new Error(error), { file: FILE });
    onProgress?.({ phase: 'floor-plan', status: 'failed', error });
  }

  // 2. Environment hero render (best-effort).
  try {
    current = await generateEnvironmentHero(current, ctx);
    onProgress?.({ phase: 'environment-hero', status: 'completed' });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('[shot-plan-gen] environment hero render failed (continuing)', err instanceof Error ? err : new Error(error), { file: FILE });
    onProgress?.({ phase: 'environment-hero', status: 'failed', error });
  }

  // 3. Lighting-mood swatch grid (best-effort; itself per-tile best-effort).
  try {
    current = await generateLightingSwatches(current, ctx);
    onProgress?.({ phase: 'lighting-swatches', status: 'completed' });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('[shot-plan-gen] lighting swatches render failed (continuing)', err instanceof Error ? err : new Error(error), { file: FILE });
    onProgress?.({ phase: 'lighting-swatches', status: 'failed', error });
  }

  // 4. Character model/turnaround sheets (best-effort per character/view).
  try {
    current = await generateCharacterSheets(current, ctx);
    onProgress?.({ phase: 'character-sheets', status: 'completed' });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('[shot-plan-gen] character sheets render failed (continuing)', err instanceof Error ? err : new Error(error), { file: FILE });
    onProgress?.({ phase: 'character-sheets', status: 'failed', error });
  }

  // 4b. Object/creature reference art (best-effort per object/view).
  try {
    current = await generateObjectSheets(current, ctx);
    onProgress?.({ phase: 'object-sheets', status: 'completed' });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('[shot-plan-gen] object sheets render failed (continuing)', err instanceof Error ? err : new Error(error), { file: FILE });
    onProgress?.({ phase: 'object-sheets', status: 'failed', error });
  }

  // 5. A keyframe still for every shot, in order (best-effort each).
  const ordered = [...current.shots].sort((a, b) => a.index - b.index);
  for (let i = 0; i < ordered.length; i += 1) {
    const shotId = ordered[i].id;
    try {
      current = await generateShotKeyframe(current, shotId, ctx);
      onProgress?.({ phase: 'keyframe', shotId, index: i, total: ordered.length, status: 'completed' });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error('[shot-plan-gen] keyframe render failed (continuing)', err instanceof Error ? err : new Error(error), { file: FILE, shotId });
      onProgress?.({ phase: 'keyframe', shotId, index: i, total: ordered.length, status: 'failed', error });
    }
  }

  return current;
}

// ============================================================================
// saveInventedCharactersToLibrary — opt-in persist of invented cast (the checkbox)
// ============================================================================

/** A one-paragraph character DNA description from the casting card (for the profile). */
function buildCharacterDescription(member: ShotPlanCastMember): string {
  const hair = [member.hairColor, member.hairStyle].map((s) => s?.trim()).filter(Boolean).join(' ');
  return [
    member.notes?.trim(),
    member.apparentAge?.trim(),
    member.ethnicity?.trim(),
    member.gender?.trim(),
    member.build?.trim() ? `${member.build.trim()} build` : '',
    hair ? `${hair} hair` : '',
    member.wardrobe?.trim() ? `wearing ${member.wardrobe.trim()}` : '',
  ]
    .filter((s): s is string => Boolean(s && s.length > 0))
    .join('. ');
}

/**
 * Persist every cast member the operator opted to keep (`saveToLibrary`) into the
 * Character Library — AFTER its reference art exists, so the saved profile has a
 * real frontal image. Runs at generation time (called by the route, which holds the
 * userId). A character that is already a saved profile is skipped. On success the
 * member's `saveToLibrary` flag is cleared so it is never double-saved. Best-effort
 * per character; the saved profile gets a NEW library id (the plan keeps its own id).
 */
export async function saveInventedCharactersToLibrary(plan: ShotPlan, userId: string): Promise<ShotPlan> {
  const cast = plan.sharedChoices.cast;
  if (!cast.some((c) => c.saveToLibrary)) {
    return plan;
  }

  const updated: ShotPlanCastMember[] = [];
  let changed = false;
  for (const member of cast) {
    const base = member.referenceImageUrls[0];
    if (!member.saveToLibrary || !base) {
      updated.push(member);
      continue;
    }
    // Already a saved profile (e.g. a library-sourced character) → just clear the flag.
    const existing = await getAvatarProfile(member.characterId).catch(() => null);
    if (existing) {
      updated.push({ ...member, saveToLibrary: false });
      changed = true;
      continue;
    }
    try {
      const result = await createAvatarProfile(userId, {
        name: member.name,
        frontalImageUrl: base,
        additionalImageUrls: member.referenceImageUrls.slice(1, 5),
        styleTag: 'real',
        description: buildCharacterDescription(member),
        source: 'custom',
      });
      if (result.success) {
        logger.info('[shot-plan-gen] saved invented character to library', {
          file: FILE,
          character: member.name,
          profileId: result.profile?.id,
        });
        updated.push({ ...member, saveToLibrary: false });
        changed = true;
      } else {
        logger.warn('[shot-plan-gen] could not save invented character', {
          file: FILE,
          character: member.name,
          error: result.error,
        });
        updated.push(member);
      }
    } catch (err) {
      logger.error(
        '[shot-plan-gen] save invented character threw (continuing)',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE, character: member.name },
      );
      updated.push(member);
    }
  }

  if (!changed) {
    return plan;
  }
  return applyShotPlanEdit(plan, { target: 'shared', field: 'cast', value: updated });
}
