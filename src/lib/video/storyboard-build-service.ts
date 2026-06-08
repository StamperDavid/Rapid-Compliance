/**
 * Shared storyboard-build service.
 *
 * ONE governed path that turns a creative brief into a reviewable storyboard:
 * it delegates to the REAL, Golden-Master-governed Video Specialist
 * (script_to_storyboard), then maps each returned scene onto the canvas shape
 * through the shared "fill every field + continuity" backstop
 * (lib/video/storyboard-completeness.ts).
 *
 * Both entry points call this so neither can drift from the other:
 *  - app/api/content/assistant/route.ts   (Content Assistant chat → "build it")
 *  - app/api/video/decompose/route.ts      ("Draft with AI" button)
 *
 * Standing Rule #1 — Brand DNA: the Video Specialist loads its own GM with
 * Brand DNA baked in. No runtime Brand DNA merge happens here.
 */

import { randomUUID } from 'crypto';

import { VideoSpecialist, type StoryboardResult, type StoryboardScene } from '@/lib/agents/content/video/specialist';
import {
  completeCinematicConfig,
  completeStructuredFields,
  defaultStructuredFields,
  type StructuredDefaults,
} from '@/lib/video/storyboard-completeness';
import type { AgentMessage } from '@/lib/agents/types';
import type { CinematicConfig } from '@/types/creative-studio';

// ────────────────────────────────────────────────────────────────────────────
// Storyboard shape the Video tab applies to its pipeline store.
// ────────────────────────────────────────────────────────────────────────────

export interface AssistantStoryboard {
  title: string;
  visualDescription: string;
  scriptText: string;
  duration: number;
  location?: string;
  timeOfDay?: string;
  weather?: string;
  ambience?: string;
  musicCue?: string;
  wardrobe?: string;
  backgroundPrompt?: string;
  cinematicConfig?: Partial<CinematicConfig>;
}

// ────────────────────────────────────────────────────────────────────────────
// Input contract — mirrors the Video Specialist's script_to_storyboard request.
// ────────────────────────────────────────────────────────────────────────────

export interface BuildStoryboardInput {
  brief: string;
  platform: 'youtube' | 'tiktok' | 'instagram_reels' | 'shorts' | 'linkedin' | 'generic';
  style: 'talking_head' | 'documentary' | 'energetic' | 'cinematic';
  targetDuration: number;
  targetAudience?: string;
  callToAction?: string;
  tone?: string;
  script?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Scene mapping
// ────────────────────────────────────────────────────────────────────────────

function humanizeEnum(value: string): string {
  return value.replace(/_/g, ' ').trim();
}

/**
 * Map one Video Specialist scene onto the storyboard canvas shape.
 *
 * Runs the scene through the SHARED "fill every field + continuity" guarantee so
 * every path stays identical:
 *  - Camera & Look names → real preset ids; blanks inherit the previous scene's look
 *    (continuity) and otherwise fall back to a curated default, incl. artStyle (which
 *    the specialist doesn't emit).
 *  - Setting / Cast / Sound fields inherit the previous scene then a brief default.
 * `prev` is the previous mapped scene (undefined for scene 1); `defaults` are the
 * brief-derived fallbacks shared across the whole storyboard.
 */
function mapSpecialistScene(
  scene: StoryboardScene,
  prev: AssistantStoryboard | undefined,
  defaults: StructuredDefaults,
): AssistantStoryboard {
  // Camera movement has no preset category, so keep it in the action text.
  // Shot type now populates the cinematic panel below, so it's not doubled here.
  const action = [scene.visualDescription, scene.cameraMovement ? `(${humanizeEnum(scene.cameraMovement)})` : '']
    .filter(Boolean)
    .join(' ');

  const cc = scene.cinematicConfig;
  const cinematicConfig: CinematicConfig = completeCinematicConfig(
    {
      shotType: humanizeEnum(scene.shotType),
      camera: cc.camera,
      focalLength: cc.focalLength,
      lensType: cc.lensType,
      lighting: cc.lighting,
      filmStock: cc.filmStock,
      videographerStyle: cc.videographerStyle,
      movieLook: cc.movieLook,
      composition: cc.composition,
    },
    prev?.cinematicConfig,
  );

  const structured = completeStructuredFields(scene, prev, defaults);

  return {
    title: scene.title,
    visualDescription: action,
    scriptText: scene.scriptText,
    duration: scene.duration,
    cinematicConfig,
    ...structured,
    ...(scene.backgroundPrompt ? { backgroundPrompt: scene.backgroundPrompt } : {}),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry point — delegate the build to the real Video Specialist.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a reviewable storyboard from a creative brief by delegating to the
 * Golden-Master-governed Video Specialist, then mapping its scenes onto the
 * canvas shape through the shared completeness backstop.
 */
export async function buildStoryboardFromBrief(
  input: BuildStoryboardInput,
): Promise<{ storyboards: AssistantStoryboard[] } | { error: string }> {
  const specialist = new VideoSpecialist();
  const message: AgentMessage = {
    id: `content-mgr-delegate-${randomUUID()}`,
    timestamp: new Date(),
    from: 'CONTENT_MANAGER',
    to: 'VIDEO_SPECIALIST',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      action: 'script_to_storyboard',
      brief: input.brief,
      platform: input.platform,
      style: input.style,
      targetDuration: input.targetDuration,
      ...(input.script ? { script: input.script } : {}),
      ...(input.targetAudience ? { targetAudience: input.targetAudience } : {}),
      ...(input.callToAction ? { callToAction: input.callToAction } : {}),
      ...(input.tone ? { tone: input.tone } : {}),
    },
    requiresResponse: true,
    traceId: `content-mgr-${randomUUID()}`,
  };

  const report = await specialist.execute(message);
  if (report.status !== 'COMPLETED' || !report.data) {
    const reason = report.errors?.[0] ?? 'The Video Specialist could not build the storyboards.';
    return { error: reason };
  }
  const result = report.data as StoryboardResult;

  // Map scenes in order, threading the previous mapped scene through so blank fields
  // inherit the prior scene's look (continuity) and the whole storyboard obeys the
  // shared "every field filled" guarantee.
  const defaults = defaultStructuredFields({ energetic: input.style === 'energetic' });
  const storyboards: AssistantStoryboard[] = [];
  let prev: AssistantStoryboard | undefined;
  for (const scene of result.scenes) {
    const mapped = mapSpecialistScene(scene, prev, defaults);
    storyboards.push(mapped);
    prev = mapped;
  }
  return { storyboards };
}
