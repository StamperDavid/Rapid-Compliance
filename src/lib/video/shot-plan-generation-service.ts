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
import {
  generateWithFal,
  generateFromReferenceWithFal,
  generateFromReferencesWithFal,
} from '@/lib/ai/providers/fal-provider';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { createAsset, updateAsset } from '@/lib/media/media-library-service';
import { createAvatarProfile, getAvatarProfile, updateAvatarProfile } from '@/lib/video/avatar-profile-service';
import { getBrandKit } from '@/lib/video/brand-kit-service';
import { compositeBrandLogoCentered } from '@/lib/video/logo-compositor';
import type { BrandLogo } from '@/types/brand-kit';
import {
  ensureFfmpeg,
  runFfmpeg,
  probeVideo,
  addWatermark,
  mixAudioWithDucking,
  createWorkDir,
  cleanupWorkDir,
} from '@/lib/video/ffmpeg-utils';
import { generateMusic } from '@/lib/music/music-generation-service';
import {
  getVideoEngineProvider,
  type TenantContext,
  type VideoGenerateRequest,
  type VideoGenerationStatus,
} from '@/lib/video/providers';
import { composeShotGenerationPrompt } from '@/lib/video/shot-plan-mapping';
import { generateEnginePrompt } from '@/lib/agents/content/video-engine-prompt/specialist';
import {
  describeShotCameraGeometry,
  SET_CONSISTENCY_CLAUSE,
} from '@/lib/video/floor-plan-camera';
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
 * 1080p is Seedance's max and is the honest deliverable resolution. (An optional
 * Topaz 4K upscale exists behind the STITCH_4K_UPSCALE=1 flag but is OFF by
 * default — see Tier-1 ④: never label re-encoded, degraded footage "4K".)
 */
const DEFAULT_RESOLUTION: NonNullable<VideoGenerateRequest['resolution']> = '1080p';
const DEFAULT_ASPECT_RATIO = '16:9';

/**
 * Clip timing. Each rendered shot is pure ACTION — the engine-rendered motion.
 * We floor it at 5s (the engine also only accepts 4–15s, so a too-short planner
 * value can't break the render) and cap at 15s. Longer authored shots are
 * preserved within the cap.
 *
 * NOTE (Jun 29 2026): we no longer append a frozen tail. The freeze was meant to
 * be an "invisible overlap the editor trims within," but nothing ever trimmed it —
 * the stitch hard-concatenates and the editor plays it — so every clip carried a
 * 2s held-frame + 2s silence that read as a stutter at every join. Continuity
 * across clips does NOT need it: the next clip is chained to start on the prior
 * clip's extracted last FRAME (`generated.lastFrameUrl`), so motion now flows
 * straight from one clip into the next instead of pausing on a freeze.
 */
const ACTION_FLOOR_SECONDS = 5;
const ACTION_CEIL_SECONDS = 15;

/** The action length sent to the engine: authored value floored to 5s, capped at 15s. */
function actionDurationSeconds(durationSeconds: number | undefined): number {
  const raw = typeof durationSeconds === 'number' && durationSeconds > 0 ? durationSeconds : ACTION_FLOOR_SECONDS;
  return Math.min(ACTION_CEIL_SECONDS, Math.max(ACTION_FLOOR_SECONDS, Math.round(raw)));
}

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
    // ONE identity anchor per character — the primary reference photo. A saved
    // character accumulates many photos over time (Velocity had 13); sending them ALL
    // blows past the engine's image-input limit (fal Kontext caps at 4) AND dilutes the
    // likeness rather than strengthening it. One clean photo per person is what the
    // engine needs to lock the face. Multi-character shots then stay within the limit.
    const primary = member.referenceImageUrls.find((url) => Boolean(url));
    if (primary && !urls.includes(primary)) {
      urls.push(primary);
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

/**
 * fal's Flux Kontext Max (multi) — the keyframe-still model — HARD-REJECTS more than
 * 4 image_urls with a 422 ("image_urls must be between 1 and 4"). The reference-to-video
 * path tolerates the wider ceiling, so this tighter limit applies ONLY to the keyframe
 * still. Exceeding it fails every shot's still and breaks the whole shot doc.
 */
const KONTEXT_MAX_MULTI_REFS = 4;

/** De-duplicate + cap a reference-image list, preserving order (lead frame kept). */
function capReferenceImages(urls: string[], limit: number = MAX_REFERENCE_IMAGES): string[] {
  return [...new Set(urls.filter(Boolean))].slice(0, limit);
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
 * The most recent saved last frame BEFORE this shot (walking backwards), for a
 * `continue` shot to chain from. Unlike `priorShot` this skips any earlier shot
 * that failed / has no last frame, so a single failed shot does not break the
 * whole continue chain — the next continue simply anchors to the last good frame.
 * Returns null when no earlier shot has a frame (then the caller treats it as a cut).
 */
function priorChainFrame(plan: ShotPlan, shot: ShotPlanShot): { shotId: string; url: string } | null {
  const ordered = [...plan.shots].sort((a, b) => a.index - b.index);
  const pos = ordered.findIndex((s) => s.id === shot.id);
  for (let i = pos - 1; i >= 0; i -= 1) {
    const url = ordered[i].generated?.lastFrameUrl;
    if (url) {
      return { shotId: ordered[i].id, url };
    }
  }
  return null;
}

/**
 * Build the engine prompt for a shot — the LAST MILE before the fal call.
 *
 * The full captured detail (the shot's `assembledPrompt` override, or the composed
 * mapper output) is the INTENT. We hand that intent to the Video Engine Prompt
 * Specialist (a real LLM agent, Brand DNA baked) which distills it into an
 * engine-optimal, front-loaded prompt for the chosen engine. If the specialist
 * fails for any reason, we fall back to the static composed prompt so generation
 * never breaks.
 */
async function buildShotPrompt(plan: ShotPlan, shot: ShotPlanShot): Promise<string> {
  const override = shot.assembledPrompt?.trim();
  const baseIntent = override && override.length > 0 ? override : composeShotGenerationPrompt(plan, shot);

  try {
    const castRefs = resolveCastReferenceImageUrls(plan, shot);
    const result = await generateEnginePrompt({
      shotIntent: baseIntent,
      hasCharacterReferences: castRefs.length > 0,
      hasContinuationFrame: !isCutShot(plan, shot),
      hasDialogue: Boolean(shot.dialogue?.trim()),
      ...(plan.sharedChoices.lookBible?.aspectRatio
        ? { aspectRatio: plan.sharedChoices.lookBible.aspectRatio }
        : {}),
      ...(typeof shot.durationSeconds === 'number' ? { durationSec: shot.durationSeconds } : {}),
    });
    logger.info('[shot-plan-gen] engine prompt specialist applied', {
      file: FILE,
      shotId: shot.id,
      engine: result.engine,
      generationType: result.generationType,
      promptChars: result.prompt.length,
    });
    return result.prompt;
  } catch (err) {
    logger.warn('[shot-plan-gen] engine prompt specialist failed; using static composed prompt', {
      file: FILE,
      shotId: shot.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return baseIntent;
  }
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
    ctx: TenantContext;
    /** The clip's real (probed) duration in seconds. The spoken line is padded
     *  with trailing silence up to this length so lip-sync doesn't collapse the
     *  shot to the length of the line. */
    clipDurationSeconds?: number;
    /** When given, UPDATE this existing clip asset in place instead of creating a
     *  second (duplicate) library card for the lip-synced version. */
    mediaAssetId?: string;
  },
): Promise<LipSyncResult> {
  const { shotId, clipUrl, dialogue, voice, falKey, workDir, ctx, clipDurationSeconds, mediaAssetId } = args;

  // 1. TTS the line in the character's voice.
  logger.info('[shot-plan-gen] lip-sync: synthesizing line', { file: FILE, shotId, voice });
  const ttsOut = await falQueue(FAL_TTS_MODEL, { text: dialogue, voice }, falKey, `shot ${shotId} tts`);
  let audioUrl = falMediaUrl(ttsOut, 'audio');

  // 1b. Hold the shot to its planned length. sync-lipsync trims the output clip
  //     down to the AUDIO length, so a ~2s spoken line collapses a 5s cinematic
  //     shot to 2s (a whole dialogue film ends up a few seconds long). Pad the
  //     line with trailing silence up to the clip's real duration → the character
  //     delivers the line, then the shot breathes for the rest of its length.
  if (typeof clipDurationSeconds === 'number' && clipDurationSeconds > 0) {
    try {
      const ttsPath = join(workDir, `tts-${shotId}.mp3`);
      await downloadToFile(audioUrl, ttsPath, `shot ${shotId} tts audio`);
      const ttsProbe = await probeVideo(ttsPath);
      if (ttsProbe.duration > 0 && ttsProbe.duration < clipDurationSeconds - 0.15) {
        const paddedPath = join(workDir, `tts-padded-${shotId}.mp3`);
        await runFfmpeg([
          '-i', ttsPath,
          '-af', `apad=whole_dur=${clipDurationSeconds.toFixed(2)}`,
          '-c:a', 'libmp3lame', '-q:a', '2',
          '-y', paddedPath,
        ]);
        const paddedBuf = await readFile(paddedPath);
        audioUrl = await uploadPermanent(
          paddedBuf,
          `organizations/${PLATFORM_ID}/media/audio/${randomUUID()}.mp3`,
          'audio/mpeg',
          `shot ${shotId} padded line`,
        );
        logger.info('[shot-plan-gen] lip-sync: padded line to shot length', {
          file: FILE,
          shotId,
          lineSeconds: Number(ttsProbe.duration.toFixed(2)),
          shotSeconds: Number(clipDurationSeconds.toFixed(2)),
        });
      }
    } catch (padErr) {
      // Best-effort: fall back to the raw line rather than failing the shot.
      logger.warn('[shot-plan-gen] lip-sync: could not pad line to shot length; using raw line', {
        file: FILE,
        shotId,
        error: padErr instanceof Error ? padErr.message : String(padErr),
      });
    }
  }

  // 2. Lip-sync the persisted clip to that (padded) audio.
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

  if (mediaAssetId) {
    // Update the existing shot clip in place: ONE library card per shot, keeping its
    // human-readable name, now pointing at the speaking clip + its talking-frame
    // thumbnail. No second, raw-id-named duplicate.
    await updateAsset(mediaAssetId, {
      url: syncedVideoUrl,
      thumbnailUrl: talkingFrameUrl,
      fileSize: syncedBuf.length,
      aiProvider: FAL_LIPSYNC_MODEL,
      description: 'Lip-synced (speaking) clip — re-synced to the character voice.',
    });
  } else {
    await createAsset({
      type: 'video',
      category: 'video-clip',
      name: `Shot ${shotId} — lip-synced`,
      description: 'Lip-synced (speaking) clip — the silent shot re-synced to the character voice.',
      url: syncedVideoUrl,
      thumbnailUrl: talkingFrameUrl,
      mimeType: 'video/mp4',
      fileSize: syncedBuf.length,
      source: 'ai-generated',
      aiProvider: FAL_LIPSYNC_MODEL,
      createdBy: 'system',
      tags: ['shot-plan', 'lip-sync'],
      ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
    });
  }

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
  // A continue shot chains from the most recent good last frame. If none exists yet
  // (e.g. every earlier shot failed), we degrade to a cut rather than throwing — a
  // failed shot must not be able to break the rest of the build.
  const chainFrame = cut ? null : priorChainFrame(plan, shot);
  const castRefs = resolveCastReferenceImageUrls(plan, shot);
  const objectRefs = resolveObjectReferenceImageUrls(plan, shot);
  // Environment anchors for the room: the operator's uploaded world refs PLUS the
  // generated, LOCKED perspective room hero (this shot's zone hero, else the world
  // hero) — the same image the keyframe still anchors on — so the video keeps the
  // SAME location (walls/windows/furniture) as every other shot. Hero leads so it is
  // never dropped by the reference cap. The top-down blocking image is NEVER added
  // here (it would push the video toward an overhead look); the blocking reaches the
  // video as TEXT only, via the composed prompt's camera geometry.
  const roomHeroUrl = resolveShotEnvironmentHeroUrl(plan, shot);
  const envRefs = [
    ...(roomHeroUrl ? [roomHeroUrl] : []),
    ...environmentReferenceImageUrls(plan),
  ];
  // A brand-logo moment (logo resolve / end card): render a CLEAN backdrop now (no
  // invented logo), then composite the operator's REAL logo onto the final clip below.
  const isLogoMoment = shotIsBrandLogoMoment(shot);
  const rawPrompt = await buildShotPrompt(plan, shot);
  const basePrompt = isLogoMoment ? rawPrompt + LOGO_MOMENT_CLEAN_INSTRUCTION : rawPrompt;

  // Pre-flight: ffmpeg must be available before we spend money on a generation.
  await ensureFfmpeg();

  const workDir = await createWorkDir('shot-plan-gen');

  try {
    // ── Submit the generation (cut vs. identity-locked continue) ──────────────
    // A continue shot with no good frame to chain from (e.g. every earlier shot
    // failed) degrades to a cut rather than throwing — a failed shot must not be
    // able to break the rest of the build.
    let generationId: string;
    if (cut || !chainFrame) {
      // CUT = fresh scene: cast identity first, then object + environment anchors.
      const cutRefs = capReferenceImages([...castRefs, ...objectRefs, ...envRefs]);
      const req: VideoGenerateRequest = {
        prompt: basePrompt,
        imageUrls: cutRefs,
        resolution: DEFAULT_RESOLUTION,
        aspectRatio: DEFAULT_ASPECT_RATIO,
        durationSeconds: actionDurationSeconds(shot.durationSeconds),
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
      // Reached only when chainFrame is present (narrowed by the `if` above).
      const priorLastFrame = chainFrame.url;
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
        durationSeconds: actionDurationSeconds(shot.durationSeconds),
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
        chainFromShotId: chainFrame.shotId,
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

    // ── Register the clip in the media library (with its last frame as the
    //    thumbnail). Capture the asset so a later lip-sync can UPDATE this one card
    //    in place instead of creating a second, raw-id-named duplicate. ───────────
    const clipAsset = await createAsset({
      type: 'video',
      category: 'video-clip',
      name: `Shot ${shot.index + 1}${shot.title ? ` — ${shot.title}` : ''}`,
      description:
        `Generated shot (${cut ? 'cut' : 'continue'}) from Shot Plan "${plan.title || plan.id}".`,
      url: permanentVideoUrl,
      thumbnailUrl: permanentLastFrameUrl,
      mimeType: 'video/mp4',
      fileSize: clipBuf.length,
      source: 'ai-generated',
      aiProvider: 'fal-seedance',
      aiPrompt: cut ? basePrompt : buildContinuePrompt(basePrompt),
      createdBy: 'system',
      tags: ['shot-plan'],
      ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
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
          // Real clip length (Seedance clamps to an integer 4–15s), so the spoken
          // line is padded to THIS, keeping the shot from collapsing to the line.
          const clipProbe = await probeVideo(clipPath);
          const synced = await lipSyncShotClip({
            shotId,
            clipUrl: permanentVideoUrl,
            dialogue,
            voice,
            falKey,
            workDir,
            ctx,
            clipDurationSeconds: clipProbe.duration,
            mediaAssetId: clipAsset.id,
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

    // ── (Removed Jun 29 2026: frozen-tail stitch beat) ────────────────────────
    // We used to hold the final frame for 2s on the end of every clip as an
    // "overlap the editor trims within." Nothing trimmed it, so it played as a
    // stutter at every join. Continuity is preserved by chaining the next clip to
    // this clip's extracted last frame (`finalLastFrameUrl`, already set above) —
    // not by padding the video — so the clip now ends on real motion.

    // ── Brand-logo moment: stamp the operator's REAL logo onto the final clip ──
    // The engine rendered a clean backdrop (LOGO_MOMENT_CLEAN_INSTRUCTION), so this
    // composites the ACTUAL brand asset onto the center — pixel-exact, never an AI
    // interpretation. Best-effort: a failure keeps the un-stamped clip.
    if (isLogoMoment) {
      const logo = await loadCompositableLogo();
      if (logo) {
        const stamped = await overlayRealLogoOntoClip(finalVideoUrl, logo, shotId, workDir);
        if (stamped) {
          finalVideoUrl = stamped;
          await updateAsset(clipAsset.id, { url: finalVideoUrl }).catch(() => {
            /* best-effort — the shot still carries the right URL */
          });
          logger.info('[shot-plan-gen] real brand logo composited onto logo-moment shot', {
            file: FILE,
            shotId,
          });
        }
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
 * Generate every shot IN ORDER (continue shots chain from the most recent good
 * last frame, so order matters). The plan is accumulated shot-by-shot.
 *
 * RESILIENT: a shot that fails is retried ONCE (fal content-policy false-positives
 * and transient fetch errors often clear on a second attempt); if it still fails
 * it is FLAGGED (`generated.status = 'failed'` + reason) and the run CONTINUES — a
 * single bad shot must not abort the whole video. The clip is simply missing and
 * the operator can regenerate just that shot. A later continue shot anchors to the
 * last good frame (see `priorChainFrame`), so one failure does not cascade.
 *
 * `onShotComplete` (optional) fires with the accumulated plan after EVERY shot
 * (success or failure) so the caller can persist progress incrementally — partial
 * work survives a later failure or interruption instead of being lost at the end.
 *
 * NOTE: this is long-running (one synchronous fal generation + persist per shot).
 * That is acceptable for now; a queue/poll split can come later (see the route).
 */
export async function generateAllShots(
  plan: ShotPlan,
  ctx: TenantContext,
  onProgress?: (progress: ShotPlanGenerationProgress) => void,
  onShotComplete?: (plan: ShotPlan) => Promise<void> | void,
): Promise<ShotPlan> {
  const ordered = [...plan.shots].sort((a, b) => a.index - b.index);
  let current = plan;

  for (let i = 0; i < ordered.length; i += 1) {
    const shotId = ordered[i].id;

    // One generation, with a single retry.
    let lastErr: unknown;
    let ok = false;
    for (let attempt = 1; attempt <= 2 && !ok; attempt += 1) {
      try {
        current = await generateShot(current, shotId, ctx);
        ok = true;
      } catch (err) {
        lastErr = err;
        logger.warn('[shot-plan-gen] shot attempt failed', {
          file: FILE,
          shotId,
          index: i,
          total: ordered.length,
          attempt,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (ok) {
      onProgress?.({ shotId, index: i, total: ordered.length, status: 'completed' });
    } else {
      // Flag the shot failed (with reason) and KEEP GOING.
      const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
      current = writeGenerated(current, shotId, {
        ...requireShot(current, shotId).generated,
        status: 'failed',
        error: message.slice(0, 2000),
      });
      onProgress?.({ shotId, index: i, total: ordered.length, status: 'failed', error: message });
      logger.error(
        '[shot-plan-gen] shot failed after retry — flagged and continuing',
        lastErr instanceof Error ? lastErr : new Error(message),
        { file: FILE, shotId, index: i, total: ordered.length },
      );
    }

    // Persist after EVERY shot so partial work survives — never all-or-nothing.
    if (onShotComplete) {
      try {
        await onShotComplete(current);
      } catch (persistErr) {
        logger.warn('[shot-plan-gen] onShotComplete persist failed (continuing)', {
          file: FILE,
          shotId,
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        });
      }
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

/** Music-bed level under dialogue (sidechaincompress ducks it further when voice plays). */
const MUSIC_BED_VOLUME = 0.18;
/** Bed length we request from MusicGen (its quality ceiling); looped to cover the film. */
const MUSIC_BED_SECONDS = 30;

/**
 * Tier-1 ③ — cross-clip NORMALIZATION (each Seedance clip is generated
 * independently, so exposure/contrast and dialogue volume jump shot-to-shot).
 * Applied per clip during the stitch so the film reads as ONE continuous piece.
 * This is an assembly normalization pass only — it does NOT touch the planner /
 * cinematic-controls "look" (the creative grade is the brain's job, left alone).
 *
 * Video: `normalize` stretches each clip's black/white points to a common range.
 * `independence=0` maps all RGB channels with the SAME curve (no colour cast
 * introduced — hue relationships preserved); high `smoothing` averages the
 * adjustment over many frames so it cannot pump/flicker within a clip. Net: gross
 * exposure/contrast differences between clips are evened out. (Colour-temperature
 * matching — warm vs cool — needs reference histogram matching and is out of scope.)
 */
const CLIP_NORMALIZE_SMOOTHING = 50;
/** Per-clip dialogue loudness target so volume doesn't jump between shots (final mix re-normalizes to -14). */
const CLIP_AUDIO_LUFS = -16;

/**
 * Tier-1 ④ — do NOT auto-upscale the stitched master to "4K" by default.
 * The stitch is a multi-re-encode of already-degraded Seedance clips
 * (generate → lip-sync → concat); enlarging that to 3840x2160 produces fake-4K
 * mush labelled "4K". Only a CLEAN single-pass master should ever be upscaled,
 * which this assembly path does not produce. The Topaz upscale capability is
 * preserved (not deleted) behind an explicit opt-in env flag so it can be
 * re-enabled the day a clean-master path exists. Default: deliver honest 1080p.
 */
const ENABLE_STITCH_4K_UPSCALE = process.env.STITCH_4K_UPSCALE === '1';

/**
 * Compose the MusicGen brief for a film's background score from the plan's own
 * look bible (genre, mood keywords, art style, title). Instrumental + loopable,
 * so it can sit under dialogue and repeat to any length.
 */
function buildMusicBedPrompt(plan: ShotPlan): { prompt: string; genre?: string; mood?: string } {
  const sc = plan.sharedChoices;
  const moods = (sc.moodKeywords ?? []).map((m) => m.trim()).filter((m) => m.length > 0);
  const mood = moods.length > 0 ? moods.join(', ') : undefined;
  const genre = firstText(sc.genre);
  const artStyle = firstText(sc.artStyle, sc.lookBible?.artStyle);
  const title = plan.title?.trim();

  const bits = [
    'Instrumental background score for a short film',
    title ? `titled "${title}"` : '',
    genre ? `in a ${genre} style` : '',
    artStyle ? `with a ${artStyle} visual aesthetic` : '',
    mood ? `evoking a ${mood} mood` : '',
    'no vocals, seamless and loopable, sits gently under spoken dialogue',
  ].filter((s) => s.length > 0);

  return { prompt: `${bits.join(', ')}.`, genre, mood };
}

/**
 * Concatenate EVERY generated shot of a plan, IN ORDER, into ONE deliverable
 * video on OUR storage — the missing "final stitch" that turns a pile of clips
 * into a watchable film.
 *
 * Audio-preserving by design (the generic concat helper drops audio): each clip
 * is normalized to a uniform video frame (scale/pad/fps/sar) AND a uniform audio
 * stream (44.1 kHz stereo). Cross-clip normalization (Tier-1 ③) also runs here so
 * the film reads as one piece: per-clip exposure/contrast `normalize` (colour-safe)
 * and per-clip dialogue `loudnorm` so brightness and volume don't jump shot-to-shot.
 * A clip with no audio track (a silent shot with no dialogue) gets a SILENT track
 * synthesized at its exact duration, so the concat's stream counts line up and
 * dialogue clips keep their sound.
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
      // Video: scale → NORMALIZE exposure/contrast toward a common range (Tier-1 ③,
      // colour-safe via independence=0, flicker-safe via high smoothing) → letterbox/pad
      // to the exact target frame + uniform fps/sar. The normalize runs on the real
      // picture (before the black pad) so the synthesized bars never skew the histogram.
      filterParts.push(
        `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,` +
          `normalize=smoothing=${CLIP_NORMALIZE_SMOOTHING}:independence=0,` +
          `pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`,
      );
      // Audio: keep the real track when present and loudness-match it to a common
      // target (Tier-1 ③ — stops dialogue volume jumping shot-to-shot); otherwise
      // synthesize silence of the clip's duration (an extra lavfi input) so every
      // concat segment has audio.
      if (probes[i].hasAudio) {
        // loudnorm resamples internally (→192k), so re-lock the rate AFTER it:
        // every concat segment (incl. synthesized-silence clips at 44.1k) MUST
        // share one sample rate or the concat filter rejects them.
        filterParts.push(
          `[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
            `loudnorm=I=${CLIP_AUDIO_LUFS}:TP=-1.5:LRA=11,` +
            `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`,
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

    // 2b. Cinematic music bed (best-effort). The stitched video already carries the
    //     dialogue/lip-sync audio (and synthesized silence on wordless shots). Lay a
    //     mood-matched INSTRUMENTAL bed under it: ducked beneath any dialogue via
    //     sidechaincompress and loudness-normalized to -14 LUFS. One bed is generated
    //     for the whole film and LOOPED to cover its full length. A failure here keeps
    //     the un-scored stitch — music is an enhancement, never a blocker on delivery.
    //     Flows into BOTH the 1080p deliverable and the 4K upscale (mixed before upload).
    let deliverablePath = outputPath;
    try {
      const totalDuration = probes.reduce((sum, p) => sum + (p.duration > 0 ? p.duration : 0), 0);
      const bed = buildMusicBedPrompt(plan);
      const music = await generateMusic({
        prompt: bed.prompt,
        ...(bed.genre ? { genre: bed.genre } : {}),
        ...(bed.mood ? { mood: bed.mood } : {}),
        durationSeconds: MUSIC_BED_SECONDS,
      });
      const musicPath = join(workDir, 'music-bed.mp3');
      await downloadToFile(music.url, musicPath, 'shot-plan music bed');
      const scoredPath = join(workDir, 'final-scored.mp4');
      await mixAudioWithDucking(outputPath, musicPath, scoredPath, {
        musicVolume: MUSIC_BED_VOLUME,
        targetLUFS: -14,
        loopMusic: true,
      });
      deliverablePath = scoredPath;
      logger.info('[shot-plan-gen] music bed mixed under dialogue', {
        file: FILE,
        clips: clips.length,
        videoSeconds: Number(totalDuration.toFixed(1)),
        bedSeconds: music.duration,
      });
    } catch (err) {
      logger.error(
        '[shot-plan-gen] music bed failed (delivering un-scored stitch)',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE },
      );
    }

    const finalBuf = await readFile(deliverablePath);
    if (finalBuf.length === 0) {
      throw new Error('stitchShotPlan: ffmpeg produced an empty final video');
    }

    // 3. Persist the stitched 1080p deliverable to OUR storage (ownership rule).
    //    This is the upscaler's source AND our guaranteed fallback.
    const storagePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
    const stitched1080Url = await uploadPermanent(finalBuf, storagePath, 'video/mp4', 'shot-plan stitched 1080p video');

    // 4. 4K upscale pass — DISABLED BY DEFAULT (Tier-1 ④). Upscaling the
    //    multi-re-encoded stitch enlarges already-degraded footage into fake-4K
    //    mush labelled "4K"; only a clean single-pass master should be upscaled,
    //    which this path doesn't produce. The capability is preserved behind the
    //    STITCH_4K_UPSCALE=1 opt-in env flag (not deleted). Default: honest 1080p.
    let finalUrl = stitched1080Url;
    let finalBytes = finalBuf.length;
    let upscaledTo4K = false;
    if (ENABLE_STITCH_4K_UPSCALE) {
      // Topaz factor-2 on a 1080p source → exactly 3840x2160. Best-effort: if it
      // fails we deliver the 1080p stitch + log, never losing the work.
      try {
        const falKey = await requireFalKey();
        logger.info('[shot-plan-gen] upscaling stitched video to 4K (Topaz, opt-in)', { file: FILE, clips: clips.length });
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
    } else {
      logger.info('[shot-plan-gen] 4K upscale skipped — delivering honest 1080p master (Tier-1 ④)', { file: FILE, clips: clips.length });
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
      ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
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

  // ── Generate path: a fresh still from the prompt + room anchor + cast refs ──
  const castRefs = resolveCastReferenceImageUrls(plan, shot);
  // On a brand-logo moment the still must be a CLEAN plate — empty brand-colored space
  // where the operator's REAL logo gets composited onto the rendered clip later. Without
  // this guard (same one the video path uses) the image model invents a fake logo (e.g.
  // an Apple logo) to fill the endcard.
  const rawKeyframePrompt = await buildShotPrompt(plan, shot);
  const basePrompt = shotIsBrandLogoMoment(shot)
    ? rawKeyframePrompt + LOGO_MOMENT_CLEAN_INSTRUCTION
    : rawKeyframePrompt;
  // The ROOM ANCHOR: the shot's environment-zone hero (or the world hero) — a wide,
  // peopleless PERSPECTIVE render of the location. This is the single locked image
  // that pins furniture/walls/windows so the room does NOT reinvent itself between
  // shots. It is the FIRST visual reference; the cast identity follows it. (The
  // top-down blocking image is NEVER used as a visual reference — that would make
  // the still render top-down; the blocking drives composition through TEXT only.)
  const envHeroUrl = resolveShotEnvironmentHeroUrl(plan, shot);
  const envProse = shotEnvironmentProse(plan, shot);
  // The per-shot camera geometry from the blocking diagram → perspective direction
  // (where the camera sits, which way it looks, what's in frame, eye-level NOT
  // top-down). '' when this shot has no floor-plan camera node.
  const cameraGeometry = describeShotCameraGeometry(plan, shot);
  const workDir = await createWorkDir('shot-plan-keyframe');

  try {
    // ctx is referenced explicitly: these fal image helpers resolve the key from
    // the platform credential store (single-tenant), so there is no per-call ctx
    // arg, but we log it so the multi-tenant metering seam is visible here too.
    const seed = typeof shot.generated?.seed === 'number' ? shot.generated.seed : undefined;

    // Ordered visual references: ROOM ANCHOR first (environment consistency), then
    // cast identity. Flux Kontext Max (multi) conditions on both at once when both
    // exist; with only one it degrades to single-image Kontext; with none, text-to-
    // image. The room anchor leading is what holds the LOCATION constant across shots.
    let visualRefs = capReferenceImages([...(envHeroUrl ? [envHeroUrl] : []), ...castRefs], KONTEXT_MAX_MULTI_REFS);

    // Build the keyframe prompt. The leading instruction names WHICH reference is the
    // room and which is the cast, so the model keeps the set from @Image1 and the
    // people from the later refs. The camera geometry + set-consistency clause make
    // the still read FROM the marked angle, inside the SAME location.
    const cameraDirection = cameraGeometry ? ` ${cameraGeometry}.` : '';
    const setConsistency = ` ${SET_CONSISTENCY_CLAUSE}`;
    // The production art style (Pixar/anime/photoreal) leads + closes the prompt, so the
    // WHOLE still — character AND room — renders in ONE consistent look. Replaces the old
    // hardcoded "Cinematic film still / Photographic, film-grade" that forced realism onto
    // a stylized character (the Pixar-in-a-photo clash).
    const { lead: styleLead, clause: styleClause } = characterStyleDirective(plan);
    let keyframePrompt: string;
    let mode: 'kontext-room+cast' | 'kontext-room' | 'kontext-cast' | 'text-to-image';
    if (shotIsBrandLogoMoment(shot)) {
      // Brand-logo END-CARD: just the logo on a clean solid backdrop — NO room, NO
      // character, NO scene. We render a plain solid background, then composite the
      // operator's REAL logo centered (the compositing step below). Drop all scene refs
      // so the model can't pull the room/character back in.
      mode = 'text-to-image';
      visualRefs = [];
      keyframePrompt =
        `A clean, smooth solid dark charcoal studio background — completely empty: ` +
        `no people, no characters, no objects, no room, no furniture, no text, and no logo. ` +
        `Even, soft, neutral studio lighting with a subtle vignette. A plain end-card backdrop.`;
    } else if (envHeroUrl && castRefs.length > 0) {
      mode = 'kontext-room+cast';
      keyframePrompt =
        `${styleLead} A still frame set INSIDE the room shown in the first reference image — keep ` +
        `that exact location (same walls, windows, doors, and furniture in the same places). ` +
        `Place the EXACT same character(s) from the other reference image(s) — identical ` +
        `face(s), hair, and wardrobe — into that room. ${basePrompt}${cameraDirection}${setConsistency} ` +
        `${styleClause} Sharp focus, on-model recognizable cast in the actual set, ` +
        `no text. No invented brand logos, brand names, or fake signage text in frame.`;
    } else if (envHeroUrl) {
      mode = 'kontext-room';
      keyframePrompt =
        `${styleLead} A still frame set INSIDE the room shown in the reference image — keep that exact ` +
        `location (same walls, windows, doors, and furniture in the same places). ` +
        `${basePrompt}${cameraDirection}${setConsistency} ${styleClause} Sharp focus, ` +
        `no text. No invented brand logos, brand names, or fake signage text in frame.`;
    } else if (castRefs.length > 0) {
      mode = 'kontext-cast';
      keyframePrompt =
        `${styleLead} A still frame: keep the EXACT same character(s) from the reference image — ` +
        `identical face(s), hair, and wardrobe — placed inside ${envProse || 'the scene environment'}. ` +
        `${basePrompt}${cameraDirection}${setConsistency} ${styleClause} Sharp focus, ` +
        `on-model recognizable cast in the actual set, no text. No invented brand logos, brand ` +
        `names, or fake signage text in frame.`;
    } else {
      mode = 'text-to-image';
      keyframePrompt =
        `${styleLead} A still frame in ${envProse || 'the scene environment'}. ${basePrompt}${cameraDirection} ` +
        `${styleClause} Sharp focus, no text. No invented brand logos, brand names, or ` +
        `fake signage text in frame.`;
    }

    logger.info('[shot-plan-gen] submitting keyframe still', {
      file: FILE,
      shotId,
      tenantId: ctx.tenantId,
      mode,
      castRefCount: castRefs.length,
      // The room anchor is now a real VISUAL reference (lead), not prose-only.
      roomAnchorResolved: envHeroUrl ? 1 : 0,
      visualRefCount: visualRefs.length,
      hasCameraGeometry: cameraGeometry.length > 0,
      envZone: resolveShotEnvironmentZone(plan, shot)?.label ?? null,
    });

    const result =
      visualRefs.length > 1
        ? await generateFromReferencesWithFal(keyframePrompt, visualRefs, {
            aspectRatio: '16:9',
            ...(seed !== undefined ? { seed } : {}),
          })
        : visualRefs.length === 1
          ? await generateFromReferenceWithFal(keyframePrompt, visualRefs[0], {
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
    let frameBuf = await downloadToFile(falImageUrl, framePath, `shot ${shotId} keyframe`);

    // Brand-logo moment: the model rendered a CLEAN plate (no painted logo, per the
    // clean-plate guard above); stamp the operator's REAL logo onto it, pixel-exact —
    // never an AI-painted guess. Same real asset the final video composites. Best-effort:
    // keep the clean plate if compositing fails.
    if (shotIsBrandLogoMoment(shot)) {
      const logo = await loadCompositableLogo();
      const stamped = logo ? await compositeBrandLogoCentered(falImageUrl, logo) : null;
      if (stamped) {
        frameBuf = stamped;
        logger.info('[shot-plan-gen] stamped REAL brand logo onto keyframe still', {
          file: FILE,
          shotId,
        });
      }
    }

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
      ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
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
      ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
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
  const style = firstText(look.artStyle, plan.sharedChoices.artStyle) ?? '';
  const isPhoto = /photo|realis|live[\s-]?action|cinematic|documentary|\bfilm\b/i.test(style);
  // movieLook + filmStock are live-action photography concepts — they drag a stylized
  // (Pixar/anime) room back toward realism, so include them ONLY for photographic styles.
  const bits = isPhoto
    ? [look.movieLook, look.filmStock, look.lighting, look.atmosphere, look.artStyle]
    : [look.lighting, look.atmosphere, look.artStyle];
  return bits
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
  // Lead + close with the production art style so the ROOM renders in the SAME look as the
  // cast (a Pixar room for a Pixar cast). Without this the env hero rendered photoreal and
  // the keyframe — conditioned on that realistic room image — produced a Pixar-character-in-
  // a-real-room clash. The old "cinematic / film-still quality" wording is dropped here
  // because it forced photography regardless of the art style.
  const { lead, clause } = characterStyleDirective(plan);
  const prompt =
    `${lead} A wide establishing shot of ${description}. ${lookBits}. ` +
    `${clause} Atmospheric, no people, no text. No invented brand logos, brand names, or fake signage text on any sign, screen, or surface.`;
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
      ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
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
        ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
      });
      // The schema caps a swatch label at 200 chars; the model's lighting `setup`
      // can run longer, so clamp it (the full setup still drives the image prompt).
      const label = setup.length > 200 ? `${setup.slice(0, 197)}…` : setup;
      swatches.push({ label, imageUrl: url });
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
    framing: 'full body head-to-toe, relaxed natural standing pose, arms at the sides',
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

/**
 * The production's art style + how to FRAME it for an image model. Image models
 * strongly associate "character model sheet / turnaround / A-pose / character
 * reference" with 3D-animation production art, so a photoreal cast was rendering
 * Pixar/CGI-looking even when the style word was "photorealistic". We counter that by
 * (a) leading with the medium and (b) when the style is photographic, explicitly
 * forbidding the 3D/illustrated look. Same style is applied to EVERY character so the
 * cast never drifts (one photoreal, one Pixar).
 */
function characterStyleDirective(plan: ShotPlan): { lead: string; clause: string } {
  const sc = plan.sharedChoices;
  const style = firstText(sc.lookBible?.artStyle, sc.artStyle) ?? 'photorealistic';
  const isPhoto = /photo|realis|live[\s-]?action|cinematic|documentary|\bfilm\b/i.test(style);
  if (isPhoto) {
    return {
      lead: `A real photograph in ${style} style.`,
      clause:
        `This is a PHOTOGRAPH of a real human being — true-to-life skin texture, pores and fine detail. ` +
        `It is NOT a 3D render, NOT CGI, NOT an illustration, NOT a cartoon, and NOT a Pixar/animated look.`,
    };
  }
  return {
    lead: `Rendered entirely in ${style}.`,
    clause: `Use this EXACT same ${style} look for every character in this production — no other medium.`,
  };
}

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
  const { lead, clause } = characterStyleDirective(plan);
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
  // The production's art style is the AUTHORITATIVE, FINAL instruction and is
  // applied IDENTICALLY to every character — so the cast can't drift (one person
  // photoreal, another Pixar/3D). Stated last so it dominates any stray style words
  // that slipped into the casting notes.
  return (
    `${lead} A full-length studio portrait of ${subject}${bits.length > 0 ? `, ${bits.join(', ')}` : ''}.` +
    `${notes ? ` ${notes}` : ''} The subject stands naturally facing the camera, head to toe, ` +
    `arms relaxed at the sides, on a seamless light-grey (#d9d9d9) studio backdrop, even soft ` +
    `studio lighting, sharp focus, no props, no text. ${clause} Use this EXACT same art style for ` +
    `EVERY character in this production. Single subject, full body visible.`
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
    // Render style is pinned to the PRODUCTION'S art style (same as the base + every
    // other character) so a turnaround never drifts to a different look.
    const { lead, clause } = characterStyleDirective(plan);
    const prompt =
      `Keep the EXACT same person from the reference image — identical face, hairstyle, and wardrobe — ` +
      `now shown ${viewDir}, ${framing}, full body, on the same seamless light-grey (#d9d9d9) ` +
      `studio backdrop, even soft studio lighting, consistent identity. ${lead} ${clause} ` +
      `Sharp focus, no props, no text.`;
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
/**
 * "Characters own their images": when a SAVED character (its `characterId` is an
 * existing Character-Library profile) gets NEW images generated for a video, attach
 * them to that profile's gallery so the character accumulates its looks over time.
 * Best-effort + idempotent: deduped, drops the frontal, capped at 12, and a no-op for
 * invented characters (no profile) or when nothing new was produced.
 */
async function attachGeneratedViewsToSavedProfile(
  member: ShotPlanCastMember,
  newUrls: string[],
): Promise<void> {
  const urls = newUrls.filter((u) => typeof u === 'string' && u.length > 0);
  if (urls.length === 0) {
    return;
  }
  const existing = await getAvatarProfile(member.characterId).catch(() => null);
  if (!existing) {
    return; // invented character — not a saved profile, nothing to attach to
  }
  const current = existing.additionalImageUrls ?? [];
  const merged = Array.from(new Set([...current, ...urls]))
    .filter((u) => u !== existing.frontalImageUrl)
    .slice(0, 12);
  // Skip the write when nothing actually changed.
  if (merged.length === current.length && merged.every((u, i) => u === current[i])) {
    return;
  }
  try {
    await updateAvatarProfile(member.characterId, { additionalImageUrls: merged });
    logger.info('[shot-plan-gen] attached new images to saved character profile', {
      file: FILE,
      character: member.name,
      added: urls.length,
    });
  } catch (err) {
    logger.warn('[shot-plan-gen] could not attach images to saved profile (continuing)', {
      file: FILE,
      character: member.name,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

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
  // If this is a SAVED character, attach the freshly-rendered views to its profile
  // so the character accumulates its images (best-effort; no-op for invented cast).
  if (sheet.length > 0) {
    await attachGeneratedViewsToSavedProfile(member, sheet.map((s) => s.imageUrl));
  }

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
 * A prop is a BRANDED SURFACE only when its name/description shows EXPLICIT brand
 * intent — the company's OWN logo wall, packaging, merch, signage, or product. We do
 * NOT slap the logo onto every generic screen / monitor / cup / laptop (that was
 * over-eager and put the logo on random props); a plain monitor or coffee cup is left
 * alone. Only an explicitly-branded surface gets (a) a clean/unbranded render then
 * (b) the operator's REAL logo composited on top.
 */
const BRANDED_SURFACE_REGEX =
  /\b(branded|brand[- ]?logo|company[- ]?(logo|sign|signage|booth|banner|merch\w*|packaging|product)|our[- ]?(logo|brand|product|packaging|merch\w*|app|dashboard)|logo[- ]?wall|brand(ed)?[- ]?wall|step[- ]?and[- ]?repeat|packaging|merchandise|signage|storefront)\b/i;

function isBrandedSurfaceProp(obj: { name: string; description?: string }): boolean {
  return BRANDED_SURFACE_REGEX.test(`${obj.name} ${obj.description ?? ''}`);
}

/** Appended to branded-surface prop prompts so the AI leaves the surface logo-free. */
const CLEAN_SURFACE_INSTRUCTION =
  ', clean unbranded surface, no text, no logos, no brand marks, blank screen';

/**
 * A SHOT whose PURPOSE is the brand's own logo on screen (logo resolve / end card /
 * reveal). Distinct from a branded prop: here the logo IS the shot, so we render a
 * clean backdrop (no invented logo) and composite the operator's REAL logo onto the
 * CENTER of the final clip — pixel-exact, never an AI interpretation.
 */
const BRAND_LOGO_MOMENT_REGEX =
  /\b(logo[- ]?(resolve|reveal|lock[- ]?up|lockup|sting|animation|end[- ]?card|card)|(brand|company|our)[- ]?logo|logo[- ]?(fades?|appears?|animates?|reveals?|locks?|rises?|forms?)|closing[- ]?logo|final[- ]?logo)\b/i;

function shotIsBrandLogoMoment(shot: { title?: string; action?: string }): boolean {
  return BRAND_LOGO_MOMENT_REGEX.test(`${shot.title ?? ''} ${shot.action ?? ''}`);
}

/** Appended to a brand-logo shot's prompt so the engine renders a CLEAN backdrop only —
 *  the real logo is composited in post, never invented by the model. */
const LOGO_MOMENT_CLEAN_INSTRUCTION =
  ' — render ONLY a clean, simple background (a tasteful gradient or minimal scene); NO ' +
  'text, NO logos, NO brand marks, NO invented logo of any kind. The real brand logo is ' +
  'composited onto the center in post-production.';

/**
 * Stamp the operator's REAL logo (pixel-exact) onto the CENTER of a finished clip, for a
 * brand-logo moment. Downloads the clip + the real logo asset, overlays via ffmpeg,
 * persists the result. Best-effort: returns null on any failure so the clip is kept. A
 * non-https logo (e.g. a static '/logo.png') cannot be downloaded → null.
 */
async function overlayRealLogoOntoClip(
  clipUrl: string,
  logo: BrandLogo,
  shotId: string,
  workDir: string,
): Promise<string | null> {
  if (!/^https?:\/\//i.test(logo.url)) {
    return null;
  }
  try {
    const clipPath = join(workDir, 'logo-base.mp4');
    await downloadToFile(clipUrl, clipPath, `shot ${shotId} clip for logo overlay`);
    const logoPath = join(workDir, 'brand-logo.png');
    await downloadToFile(logo.url, logoPath, 'brand logo');
    const outPath = join(workDir, 'logo-resolved.mp4');
    // Centered, prominent (35% of width), near-full opacity — the focal logo, not a watermark.
    await addWatermark(clipPath, logoPath, outPath, 'center', 0.96, 0.35);
    const buf = await readFile(outPath);
    return await uploadPermanent(
      buf,
      `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`,
      'video/mp4',
      `shot ${shotId} clip + real brand logo`,
    );
  } catch (err) {
    logger.warn('[shot-plan-gen] real-logo overlay failed (keeping clip)', {
      file: FILE,
      shotId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

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
  ctx: TenantContext,
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
      ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
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
          ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
        });
        // Keep the CLEAN base for view generation; composite our logo only onto the
        // displayed reference.
        cleanBaseUrl = url;
        let refUrl = url;
        if (branded && brandLogo) {
          refUrl = await compositeLogoOntoPropImage(url, brandLogo, obj, plan, 'reference', ctx);
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
              ...(ctx.projectId ? { projectId: ctx.projectId, projectName: ctx.projectName } : {}),
            });
            // Branded surface → composite the operator's REAL logo onto this view too.
            let refUrl = url;
            if (branded && brandLogo) {
              refUrl = await compositeLogoOntoPropImage(url, brandLogo, obj, plan, label, ctx);
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
 * Save ONE cast member into the CHARACTER LIBRARY (not the media library). Used by
 * the one-click "Add to Character Library" button on a shot doc AND by the batch
 * `saveInventedCharactersToLibrary` below. AUTOFILLS the profile card from the cast
 * member's authored identity and REUSES the images already generated for the doc
 * (the model-sheet/turnaround views), so nothing is regenerated. A character that is
 * already a saved profile is treated as success (`alreadySaved`). The new profile
 * gets its own Character-Library id; the plan's cast id is unchanged.
 */
export async function saveCastMemberToLibrary(
  member: ShotPlanCastMember,
  userId: string,
): Promise<{ success: boolean; profileId?: string; alreadySaved?: boolean; error?: string }> {
  // The hero/front view is the first reference image; the rest become additional views.
  // Prefer the rendered model-sheet views when present (they were made for this doc).
  const sheetUrls = (member.modelSheet ?? []).map((v) => v.imageUrl).filter((u) => u.length > 0);
  const allUrls = Array.from(new Set([...member.referenceImageUrls, ...sheetUrls]));
  const base = allUrls[0];
  if (!base) {
    return {
      success: false,
      error: 'This character has no generated image yet — generate the shot doc first.',
    };
  }
  // Already a saved profile (e.g. a library-sourced character) → nothing to do.
  const existing = await getAvatarProfile(member.characterId).catch(() => null);
  if (existing) {
    return { success: true, profileId: existing.id, alreadySaved: true };
  }
  try {
    const result = await createAvatarProfile(userId, {
      name: member.name,
      frontalImageUrl: base,
      additionalImageUrls: allUrls.slice(1, 5),
      styleTag: 'real',
      description: buildCharacterDescription(member),
      source: 'custom',
    });
    if (!result.success) {
      logger.warn('[shot-plan-gen] could not save character to library', {
        file: FILE,
        character: member.name,
        error: result.error,
      });
      return { success: false, error: result.error ?? 'Could not save the character.' };
    }
    logger.info('[shot-plan-gen] saved character to Character Library', {
      file: FILE,
      character: member.name,
      profileId: result.profile?.id,
    });
    return { success: true, profileId: result.profile?.id };
  } catch (err) {
    logger.error(
      '[shot-plan-gen] save character to library threw',
      err instanceof Error ? err : new Error(String(err)),
      { file: FILE, character: member.name },
    );
    return { success: false, error: err instanceof Error ? err.message : 'Could not save the character.' };
  }
}

/**
 * Persist every cast member the operator opted to keep (`saveToLibrary`) into the
 * Character Library — AFTER its reference art exists. Runs at generation time (the
 * route holds the userId). Delegates each member to `saveCastMemberToLibrary` so the
 * batch path and the one-click button share identical mapping. On success the
 * member's `saveToLibrary` flag is cleared so it is never double-saved.
 */
export async function saveInventedCharactersToLibrary(plan: ShotPlan, userId: string): Promise<ShotPlan> {
  const cast = plan.sharedChoices.cast;
  if (!cast.some((c) => c.saveToLibrary)) {
    return plan;
  }

  const updated: ShotPlanCastMember[] = [];
  let changed = false;
  for (const member of cast) {
    if (!member.saveToLibrary) {
      updated.push(member);
      continue;
    }
    const res = await saveCastMemberToLibrary(member, userId);
    if (res.success) {
      // Clear the flag so it never double-saves; alreadySaved counts as done.
      updated.push({ ...member, saveToLibrary: false });
      changed = true;
    } else {
      // Keep the flag set so a later run can retry (e.g. image not ready yet).
      updated.push(member);
    }
  }

  if (!changed) {
    return plan;
  }
  return applyShotPlanEdit(plan, { target: 'shared', field: 'cast', value: updated });
}
