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
import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanShotGenerationStatus,
} from '@/types/shot-plan';

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
 * Build the background/environment prompt for a scene from a shot + the plan's
 * shared look-bible. Used only when the shot has no explicit `assembledPrompt`
 * override. The shot's own `assembledPrompt` always wins when present.
 */
function buildBackgroundPrompt(plan: ShotPlan, shot: ShotPlanShot): string {
  const { sharedChoices } = plan;
  const parts: string[] = [];

  if (shot.environment.trim()) {
    parts.push(shot.environment.trim());
  } else if (sharedChoices.environmentFingerprint.trim()) {
    parts.push(sharedChoices.environmentFingerprint.trim());
  }

  if (sharedChoices.environmentFingerprint.trim() && shot.environment.trim()) {
    // Keep the world signature as a consistency anchor alongside this shot's setting.
    parts.push(`Consistent with: ${sharedChoices.environmentFingerprint.trim()}`);
  }

  if (shot.lighting?.trim()) {
    parts.push(`Lighting: ${shot.lighting.trim()}`);
  }
  if (shot.mood?.trim()) {
    parts.push(`Mood: ${shot.mood.trim()}`);
  } else if (sharedChoices.moodKeywords.length > 0) {
    parts.push(`Mood: ${sharedChoices.moodKeywords.join(', ')}`);
  }

  if (sharedChoices.artStyle?.trim()) {
    parts.push(`Style: ${sharedChoices.artStyle.trim()}`);
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

/** Map a shot's camera package onto a CinematicConfig (only the fields we carry). */
function buildCinematicConfig(shot: ShotPlanShot): CinematicConfig | undefined {
  const config: CinematicConfig = {};
  if (shot.camera.shotType?.trim()) {
    config.shotType = shot.camera.shotType.trim();
  }
  if (shot.camera.lens?.trim()) {
    config.lensType = shot.camera.lens.trim();
  }
  if (shot.lighting?.trim()) {
    config.lighting = shot.lighting.trim();
  }
  if (shot.mood?.trim()) {
    config.atmosphere = shot.mood.trim();
  }
  return Object.keys(config).length > 0 ? config : undefined;
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
    const cinematicConfig = buildCinematicConfig(shot);

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
    lens: scene.cinematicConfig?.lensType ?? existing?.camera.lens,
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
