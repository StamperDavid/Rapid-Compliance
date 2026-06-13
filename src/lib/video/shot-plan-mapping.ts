/**
 * Shot Plan ↔ Pipeline Scene mapping (ADDITIVE, pure functions).
 *
 * The existing generation pipeline + editor consume `PipelineScene[]`. A Shot Plan
 * is the new authoring model. These pure functions translate between the two so a
 * plan can drive the established pipeline WITHOUT any change to how scenes generate.
 *
 * Direction:
 *   - `shotPlanToScenes(plan)`        — the primary direction; one shot → one scene.
 *   - `sceneToShotPlanShot(scene, …)` — best-effort reverse, for round-tripping a
 *                                       scene edited in the existing storyboard back
 *                                       into a plan shot.
 *
 * No I/O, no generation, no fal calls — data only.
 */

import type { PipelineScene, SceneStatus } from '@/types/video-pipeline';
import type { CinematicConfig } from '@/types/creative-studio';
import { buildPromptFromPresets } from '@/lib/ai/cinematic-presets';
import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanShotGenerationStatus,
  FloorPlanPoint,
  FloorPlanElement,
} from '@/types/shot-plan';

/**
 * Soft ceiling on the composed generation prompt. Past this, piling on more
 * cinematic detail produces muddy, self-contradictory prompts the engine just
 * averages out — so we cap by dropping the LOWEST-priority trailing anchors
 * (cinematography notes, palette) before ever touching the core action + look.
 */
const MAX_PROMPT_CHARS = 1500;

/**
 * Join prompt fragments into one string: trim, drop empties, de-duplicate
 * (case-insensitive, exact-fragment), then enforce MAX_PROMPT_CHARS by dropping
 * trailing fragments (never the first — that's the action + preset core) until
 * under budget, with a final hard clip as a backstop.
 */
function joinPromptFragments(fragments: string[]): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of fragments) {
    const f = raw.trim();
    if (!f) {
      continue;
    }
    const key = f.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    kept.push(f);
  }
  while (kept.length > 1 && kept.join('. ').length > MAX_PROMPT_CHARS) {
    kept.pop();
  }
  const result = kept.join('. ');
  return result.length > MAX_PROMPT_CHARS
    ? result.slice(0, MAX_PROMPT_CHARS).replace(/[\s,.;]+$/, '')
    : result;
}

// ============================================================================
// Status mapping
// ============================================================================

/** Map a Shot Plan shot generation status onto the pipeline's SceneStatus. */
function shotStatusToSceneStatus(status?: ShotPlanShotGenerationStatus): SceneStatus {
  switch (status) {
    case 'processing':
      return 'generating';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'pending':
    default:
      return 'draft';
  }
}

/** Map a pipeline SceneStatus back onto a Shot Plan shot generation status. */
function sceneStatusToShotStatus(status: SceneStatus): ShotPlanShotGenerationStatus {
  switch (status) {
    case 'generating':
    case 'persisting':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'draft':
    case 'approved':
    default:
      return 'pending';
  }
}

// ============================================================================
// Prompt assembly
// ============================================================================

/**
 * Build the shot-plan-UNIQUE text anchors — the shared look-bible facts that have
 * NO slot in `CinematicConfig` and so are not produced by `buildPromptFromPresets`:
 * the environment (shot setting + world fingerprint), color palette, shared mood
 * keywords, and cinematography notes. Lighting / atmosphere / art style now flow
 * through the effective `CinematicConfig` instead, so they are deliberately NOT
 * repeated here (that would double them in the prompt).
 *
 * Ordered most→least important so the length cap drops notes/palette first.
 */
function buildBackgroundPrompt(plan: ShotPlan, shot: ShotPlanShot): string {
  const { sharedChoices } = plan;
  const parts: string[] = [];

  if (shot.environment.trim()) {
    parts.push(shot.environment.trim());
    if (sharedChoices.environmentFingerprint.trim()) {
      // Keep the world signature as a consistency anchor alongside this shot's setting.
      parts.push(`Consistent with: ${sharedChoices.environmentFingerprint.trim()}`);
    }
  } else if (sharedChoices.environmentFingerprint.trim()) {
    parts.push(sharedChoices.environmentFingerprint.trim());
  }

  if (sharedChoices.moodKeywords.length > 0) {
    parts.push(`Mood: ${sharedChoices.moodKeywords.join(', ')}`);
  }

  if (sharedChoices.colorPalette.length > 0) {
    parts.push(
      `Palette: ${sharedChoices.colorPalette
        .map((c) => `${c.name} (${c.hex})`)
        .join(', ')}`,
    );
  }

  if (sharedChoices.cinematographyNotes.length > 0) {
    parts.push(sharedChoices.cinematographyNotes.join('. '));
  }

  return parts.filter(Boolean).join('. ');
}

/**
 * Build the EFFECTIVE `CinematicConfig` for a shot: the shared Look Bible (the
 * deep, set-once project look) with the shot's own per-shot choices layered on
 * top. The Look Bible supplies the consistency anchors (movie look, film stock,
 * camera body, color grade/filters, photographer/videographer style, color
 * temperature, aspect ratio, baseline lighting/atmosphere); the per-shot camera
 * package + lighting/mood accents OVERRIDE the baseline where set.
 *
 * EXPORTED so the UI per-shot live preview and the generation prompt are built
 * from the exact same effective config (what you see is what gets generated).
 */
export function buildEffectiveCinematicConfig(
  plan: ShotPlan,
  shot: ShotPlanShot,
): CinematicConfig {
  const { camera } = shot;
  // Start from the shared Look Bible (inherited), then layer per-shot overrides.
  const config: CinematicConfig = { ...(plan.sharedChoices.lookBible ?? {}) };

  if (camera.shotType?.trim()) {
    config.shotType = camera.shotType.trim();
  }
  if (camera.lensType?.trim()) {
    config.lensType = camera.lensType.trim();
  }
  if (camera.focalLength?.trim()) {
    config.focalLength = camera.focalLength.trim();
  }
  if (camera.composition?.trim()) {
    config.composition = camera.composition.trim();
  }
  if (camera.viewingDirection) {
    config.viewingDirection = camera.viewingDirection;
  }
  if (camera.subjectUnawareOfCamera) {
    config.subjectUnawareOfCamera = true;
  }
  // Per-shot lighting / mood accents override the Look Bible baseline.
  if (shot.lighting?.trim()) {
    config.lighting = shot.lighting.trim();
  }
  if (shot.mood?.trim()) {
    config.atmosphere = shot.mood.trim();
  }
  // Legacy plan-level art style still feeds the config when the Look Bible has none.
  if (!config.artStyle && plan.sharedChoices.artStyle?.trim()) {
    config.artStyle = plan.sharedChoices.artStyle.trim();
  }

  return config;
}

// ============================================================================
// Floor-plan → camera-direction language (the blocking DRIVES the camera)
// ============================================================================

/** Coarse left/center/right band for a normalized x. */
function horizontalBand(x: number): string {
  return x < 0.34 ? 'left' : x > 0.66 ? 'right' : 'centre';
}

/** Coarse foreground/midground/background band for a normalized y (y→down). */
function depthBand(y: number): string {
  return y < 0.34 ? 'background' : y > 0.66 ? 'foreground' : 'midground';
}

/** Describe the net direction of a polyline as plain motion language, or ''. */
function describePathDirection(path: FloorPlanPoint[] | undefined): string {
  if (!path || path.length < 2) {
    return '';
  }
  const a = path[0];
  const b = path[path.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const moves: string[] = [];
  // 0.12 ≈ a meaningful 12% of the stage; below that it's noise, not a move.
  if (Math.abs(dx) > 0.12) {
    moves.push(dx > 0 ? 'left to right' : 'right to left');
  }
  if (Math.abs(dy) > 0.12) {
    moves.push(dy < 0 ? 'deeper into the scene' : 'toward the camera');
  }
  return moves.join(' and ');
}

/**
 * Translate the plan's floor-plan blocking for THIS shot into concrete
 * camera-direction prompt language: where the camera sits, how it moves along its
 * route, and how the subjects move. Returns '' when there is no floor plan or no
 * camera node for the shot. This is what makes the top-down map actually drive the
 * generated camera instead of being a decorative diagram.
 */
export function describeBlockingForShot(plan: ShotPlan, shot: ShotPlanShot): string {
  const fp = plan.floorPlan;
  if (!fp) {
    return '';
  }
  const cam = fp.cameras.find((c) => c.shotId === shot.id);
  if (!cam) {
    return '';
  }

  const parts: string[] = [];
  parts.push(`camera positioned ${horizontalBand(cam.x)}-${depthBand(cam.y)} of the stage`);

  const route = describePathDirection(cam.route);
  if (route) {
    parts.push(`camera moves ${route}`);
  }

  for (const sp of fp.subjectPaths) {
    const dir = describePathDirection(sp.path);
    if (!dir) {
      continue;
    }
    const el: FloorPlanElement | undefined = fp.elements.find((e) => e.id === sp.elementId);
    const elLabel = el?.label?.trim();
    parts.push(`${elLabel && elLabel.length > 0 ? elLabel : 'the subject'} moves ${dir}`);
  }

  return parts.join('; ');
}

/**
 * Compose the FULL generation prompt for a shot — the forward-action subject run
 * through the shared cinematic-preset composer (`buildPromptFromPresets`, the same
 * one powering the UI live preview), with the effective Look Bible + per-shot
 * config applied, then the shot-plan-unique text anchors (environment, palette,
 * mood keywords, cinematography notes) and the camera MOVEMENT (which has no
 * `CinematicConfig` slot) appended. De-duplicated and length-capped.
 *
 * EXPORTED + pure: no I/O, no generation. Used when a shot has no explicit
 * `assembledPrompt` override; the override always wins upstream when present.
 */
export function composeShotGenerationPrompt(plan: ShotPlan, shot: ShotPlanShot): string {
  const subject = shot.action.trim() || shot.title.trim();
  const config = buildEffectiveCinematicConfig(plan, shot);

  // Core: action + cinematic presets, ordered + phrased by the shared composer.
  const fragments: string[] = [buildPromptFromPresets(subject, config)];

  // Featured objects/props this shot references — name them so the engine renders
  // the SAME object, anchored by the object reference images passed at gen time.
  const objectBits = (shot.objectIds ?? [])
    .map((id) => {
      const obj = plan.sharedChoices.objects?.find((o) => o.id === id);
      if (!obj) {
        return '';
      }
      return obj.description?.trim() ? `${obj.name} (${obj.description.trim()})` : obj.name;
    })
    .filter((s) => s.length > 0);
  if (objectBits.length > 0) {
    fragments.push(`Featuring ${objectBits.join(', ')}`);
  }

  // Camera movement has no CinematicConfig slot — append it explicitly.
  if (shot.camera.movement?.trim()) {
    fragments.push(`camera movement: ${shot.camera.movement.trim()}`);
  }
  // Legacy free-text lens, only when no preset lens type was chosen.
  if (shot.camera.lens?.trim() && !shot.camera.lensType?.trim()) {
    fragments.push(`${shot.camera.lens.trim()} lens`);
  }

  // Floor-plan blocking → camera position/route + subject motion (drives camera).
  const blocking = describeBlockingForShot(plan, shot);
  if (blocking) {
    fragments.push(blocking);
  }

  // Shot-plan-unique shared anchors (environment, palette, mood keywords, notes).
  fragments.push(buildBackgroundPrompt(plan, shot));

  return joinPromptFragments(fragments);
}

// ============================================================================
// Shot Plan → Pipeline Scenes
// ============================================================================

/**
 * Resolve the avatar for a scene: the first cast member referenced by the shot.
 * Returns the AvatarProfile id + display name (or nulls when no cast on the shot).
 */
function resolveSceneAvatar(
  plan: ShotPlan,
  shot: ShotPlanShot,
): { avatarId: string | null; avatarName: string | null } {
  const firstId = shot.castMemberIds[0];
  if (!firstId) {
    return { avatarId: null, avatarName: null };
  }
  const member = plan.sharedChoices.cast.find((c) => c.characterId === firstId);
  return {
    avatarId: firstId,
    avatarName: member?.name ?? null,
  };
}

/**
 * Convert a Shot Plan into the `PipelineScene[]` the existing generation pipeline
 * + editor consume. One shot → one scene. The shot's `assembledPrompt` override
 * (when present) is used verbatim as the background prompt; otherwise it is built
 * from the shot + the shared look-bible.
 *
 * Shots are emitted in ascending `index` order so scene numbering matches the plan.
 */
export function shotPlanToScenes(plan: ShotPlan): PipelineScene[] {
  const ordered = [...plan.shots].sort((a, b) => a.index - b.index);

  return ordered.map((shot, i) => {
    const { avatarId, avatarName } = resolveSceneAvatar(plan, shot);
    const backgroundPrompt = shot.assembledPrompt?.trim()
      ? shot.assembledPrompt.trim()
      : buildBackgroundPrompt(plan, shot);
    const effectiveConfig = buildEffectiveCinematicConfig(plan, shot);
    const cinematicConfig = Object.keys(effectiveConfig).length > 0 ? effectiveConfig : undefined;

    const scene: PipelineScene = {
      id: shot.id,
      sceneNumber: i + 1,
      title: shot.title || undefined,
      visualDescription: shot.action || undefined,
      scriptText: shot.dialogue ?? '',
      screenshotUrl: shot.generated?.lastFrameUrl ?? null,
      avatarId,
      avatarName,
      voiceId: null,
      voiceProvider: null,
      duration: shot.durationSeconds,
      engine: null,
      backgroundPrompt: backgroundPrompt || null,
      ...(cinematicConfig ? { cinematicConfig } : {}),
      status: shotStatusToSceneStatus(shot.generated?.status),
      location: shot.environment || undefined,
      // Shot Plan bridge fields (additive, optional on PipelineScene).
      transitionIn: shot.transitionIn,
      castMemberIds: shot.castMemberIds,
      lastFrameUrl: shot.generated?.lastFrameUrl,
      seed: shot.generated?.seed,
      sourcePlanShotId: shot.id,
    };

    return scene;
  });
}

// ============================================================================
// Pipeline Scene → Shot Plan Shot (reverse, best-effort)
// ============================================================================

/**
 * Convert a `PipelineScene` (edited in the existing storyboard) back into a
 * `ShotPlanShot`, preserving the plan's existing values for fields the scene
 * does not carry. Used to round-trip an edit made in the legacy storyboard back
 * into the plan.
 *
 * `index` defaults to `sceneNumber - 1` but can be overridden, and `existing`
 * (the prior shot, if any) supplies fields the scene has no representation for
 * (e.g. `mood`, `assembledPrompt` override, `generationId`).
 */
export function sceneToShotPlanShot(
  scene: PipelineScene,
  existing?: ShotPlanShot,
): ShotPlanShot {
  const camera: ShotPlanShot['camera'] = {
    shotType: scene.cinematicConfig?.shotType ?? existing?.camera.shotType,
    movement: existing?.camera.movement,
    lens: existing?.camera.lens,
    lensType: scene.cinematicConfig?.lensType ?? existing?.camera.lensType,
    focalLength: scene.cinematicConfig?.focalLength ?? existing?.camera.focalLength,
    composition: scene.cinematicConfig?.composition ?? existing?.camera.composition,
    viewingDirection: scene.cinematicConfig?.viewingDirection ?? existing?.camera.viewingDirection,
    subjectUnawareOfCamera:
      scene.cinematicConfig?.subjectUnawareOfCamera ?? existing?.camera.subjectUnawareOfCamera,
  };

  const generated: ShotPlanShot['generated'] = {
    ...existing?.generated,
    ...(scene.lastFrameUrl !== undefined ? { lastFrameUrl: scene.lastFrameUrl } : {}),
    ...(scene.seed !== undefined ? { seed: scene.seed } : {}),
    status: sceneStatusToShotStatus(scene.status),
  };

  const hasGenerated = Object.values(generated).some((v) => v !== undefined);

  return {
    id: scene.sourcePlanShotId ?? scene.id,
    index: existing?.index ?? Math.max(0, scene.sceneNumber - 1),
    title: scene.title ?? existing?.title ?? '',
    action: scene.visualDescription ?? existing?.action ?? '',
    castMemberIds: scene.castMemberIds ?? existing?.castMemberIds ?? [],
    environment: scene.location ?? existing?.environment ?? '',
    camera,
    lighting: scene.cinematicConfig?.lighting ?? existing?.lighting,
    mood: scene.cinematicConfig?.atmosphere ?? existing?.mood,
    durationSeconds: scene.duration,
    transitionIn: scene.transitionIn ?? existing?.transitionIn ?? 'cut',
    dialogue: scene.scriptText.trim() ? scene.scriptText : existing?.dialogue,
    assembledPrompt: existing?.assembledPrompt,
    ...(hasGenerated ? { generated } : {}),
    upstreamChanged: existing?.upstreamChanged,
  };
}
