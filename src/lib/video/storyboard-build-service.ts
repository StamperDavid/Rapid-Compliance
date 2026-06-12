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
import { pickSubjectForScene } from '@/lib/video/storyboard-thumbnail';
import {
  getAvatarProfile,
  type AvatarProfile,
  type CharacterLook,
} from '@/lib/video/avatar-profile-service';
import { logger } from '@/lib/logger/logger';
import type { AgentMessage } from '@/lib/agents/types';
import type { IntentSubject } from '@/lib/content/content-intent';
import type { CinematicConfig } from '@/types/creative-studio';
import type { SceneReference } from '@/types/video-pipeline';

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
  /** Uploaded reference material seeded onto the scene (e.g. the operator's attached photo). */
  references?: SceneReference[];
  /** Saved Character Library character bound to this scene (per-scene avatar override). */
  avatarId?: string | null;
  /** Display name for the bound saved character (Cast group). */
  avatarName?: string | null;
}

/** A reference file the operator attached in the Content Assistant chat. */
export interface BriefAttachment {
  url: string;
  fileName?: string;
  contentType?: string;
  /** Coarse asset kind from the upload route; image/video get distinct handling. */
  kind?: 'image' | 'video' | 'document' | 'other';
  /** The AI's read of the file (vision for images, transcript for A/V, text for docs). */
  aiSummary?: string;
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
  /**
   * Files the operator attached in the chat (permanent Storage URLs), images
   * and/or videos. All are mentioned in the brief the specialist sees; the IMAGE
   * attachments are also seeded onto the first storyboard's `references` so they
   * reach the canvas as real scene references. (Video-to-video deep wiring is
   * deferred — videos are threaded into the brief prose and, where applicable,
   * attached as `video` references, but no clip is decomposed into scenes.)
   */
  attachments?: BriefAttachment[];
  /**
   * The CONFIRMED intent subjects. Subjects bound to a saved Character Library
   * character (`characterId`) are resolved here to their face anchor + chosen
   * Look's wardrobe images, seeded onto the storyboard's references, and matched
   * to the scenes that feature them (sets `avatarId`/`avatarName` + wardrobe).
   */
  subjects?: IntentSubject[];
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
// Saved Character Library binding
// ────────────────────────────────────────────────────────────────────────────

/** A subject bound to a saved character, resolved to its profile + chosen Look. */
interface BoundCharacter {
  subject: IntentSubject;
  profile: AvatarProfile;
  look: CharacterLook | null;
}

/**
 * Resolve every subject bound to a saved Character Library character
 * (`subject.characterId`) into its profile + the chosen Look (explicit `lookId`,
 * else the primary Look, else the first). A characterId that doesn't resolve is
 * skipped with a warning — the build degrades to text / attached references rather
 * than failing.
 */
async function resolveBoundCharacters(subjects: IntentSubject[]): Promise<BoundCharacter[]> {
  const bound: BoundCharacter[] = [];
  for (const subject of subjects) {
    if (!subject.characterId) {
      continue;
    }
    const profile = await getAvatarProfile(subject.characterId);
    if (!profile) {
      logger.warn('[StoryboardBuild] bound characterId did not resolve', {
        file: 'storyboard-build-service.ts',
        characterId: subject.characterId,
        subject: subject.name,
      });
      continue;
    }
    const looks = profile.looks ?? [];
    const look =
      (subject.lookId ? looks.find((l) => l.id === subject.lookId) : undefined) ??
      looks.find((l) => l.isPrimary) ??
      looks[0] ??
      null;
    bound.push({ subject, profile, look });
  }
  return bound;
}

/**
 * The saved characters' face anchor + chosen Look images as scene references, NAMED
 * by the subject so the per-scene reference matcher (matchSubjectForScene) links them
 * to the scenes that feature the character. The frontal image is the identity anchor;
 * the Look images carry wardrobe/styling.
 */
function characterReferences(bound: BoundCharacter[]): SceneReference[] {
  const refs: SceneReference[] = [];
  for (const { subject, profile, look } of bound) {
    if (profile.frontalImageUrl) {
      refs.push({
        id: randomUUID(),
        type: 'image',
        name: `${subject.name} (face)`,
        url: profile.frontalImageUrl,
        purpose: 'character',
        usage: `Saved character "${profile.name}" — face / identity anchor. Keep this person's face exact across every scene; the scene and Look supply wardrobe, pose, and setting.`,
      });
    }
    for (const url of look?.imageUrls ?? []) {
      if (!url) {
        continue;
      }
      refs.push({
        id: randomUUID(),
        type: 'image',
        name: subject.name,
        url,
        purpose: 'character',
        usage: `Saved character "${profile.name}"${look ? ` — Look "${look.name}"` : ''}: wardrobe / styling reference.`,
      });
    }
  }
  return refs;
}

/**
 * Bind each scene to the saved character it features: match the scene's text to a
 * bound subject by name and set the scene's `avatarId` / `avatarName` + adopt the
 * chosen Look's wardrobe. Mutates the storyboards in place; returns the match count.
 */
function applyBoundCharactersToScenes(
  storyboards: AssistantStoryboard[],
  bound: BoundCharacter[],
): number {
  if (bound.length === 0) {
    return 0;
  }
  const subjects = bound.map((b) => b.subject);
  let matched = 0;
  for (const sb of storyboards) {
    const subject = pickSubjectForScene(sb, subjects);
    if (!subject) {
      continue;
    }
    const hit = bound.find((b) => b.subject === subject);
    if (!hit) {
      continue;
    }
    sb.avatarId = hit.profile.id;
    sb.avatarName = hit.profile.name;
    const outfit = hit.look?.outfitDescription?.trim();
    if (outfit) {
      // The chosen Look IS this character's wardrobe for the video — it wins over the
      // specialist's generic guess so the character stays on-model across scenes.
      sb.wardrobe = outfit;
    }
    matched += 1;
  }
  return matched;
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

  // Split the operator's attachments by medium. Images anchor the visual look;
  // videos are reference clips (vibe / motion); audio + documents + other files
  // carry substance (script, transcript, copy, data) the storyboard builds from.
  const attachments = input.attachments ?? [];
  const imageAttachments = attachments.filter((a) => a.kind === 'image');
  const videoAttachments = attachments.filter((a) => a.kind === 'video');
  const isAudio = (a: BriefAttachment): boolean =>
    (a.contentType ?? '').toLowerCase().startsWith('audio/');
  const substanceAttachments = attachments.filter(
    (a) => a.kind !== 'image' && a.kind !== 'video',
  );

  // Append each attachment's AI summary (the read of its actual contents) when present.
  const withSummary = (a: BriefAttachment, fallbackLabel: string): string => {
    const head = `- ${a.fileName ?? fallbackLabel}: ${a.url}`;
    return a.aiSummary ? `${head}\n  What it contains: ${a.aiSummary}` : head;
  };

  // Make the specialist aware of every attachment in the brief text, INCLUDING
  // the AI's read of each file so it builds from the real content. (The
  // specialist's LLM contract has no structured media input, so references are
  // communicated in prose AND — for images, plus videos where a slot fits —
  // seeded onto scene 1's references below for the operator to use on the canvas.)
  const refLines: string[] = [];
  if (imageAttachments.length > 0) {
    const list = imageAttachments.map((a) => withSummary(a, 'image')).join('\n');
    refLines.push(
      `Reference image(s) the operator attached:\n${list}\nTreat the image(s) as the primary visual reference — match their subject, look, and styling across the storyboard, and feature them prominently in the opening scenes.`,
    );
  }
  if (videoAttachments.length > 0) {
    const list = videoAttachments.map((a) => withSummary(a, 'video')).join('\n');
    refLines.push(
      `Reference video clip(s) the operator attached:\n${list}\nUse them as motion / pacing / vibe references for the storyboard — match their energy and visual language.`,
    );
  }
  if (substanceAttachments.length > 0) {
    const list = substanceAttachments
      .map((a) => withSummary(a, isAudio(a) ? 'audio' : 'document'))
      .join('\n');
    refLines.push(
      `Reference audio / document(s) the operator attached:\n${list}\nThese carry substance — script, transcript, copy, or data. Build the storyboard's narrative, voiceover, and on-screen message FROM this content where it fits.`,
    );
  }
  const briefWithReference =
    refLines.length > 0 ? `${input.brief}\n\n${refLines.join('\n\n')}` : input.brief;

  const message: AgentMessage = {
    id: `content-mgr-delegate-${randomUUID()}`,
    timestamp: new Date(),
    from: 'CONTENT_MANAGER',
    to: 'VIDEO_SPECIALIST',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      action: 'script_to_storyboard',
      brief: briefWithReference,
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

  // Resolve any saved Character Library characters bound in the intent, bind them to
  // the scenes that feature them (avatarId/avatarName + Look wardrobe), and collect
  // their face + Look images to seed onto the storyboard references below.
  const boundCharacters = await resolveBoundCharacters(input.subjects ?? []);
  const charRefs = characterReferences(boundCharacters);
  if (boundCharacters.length > 0) {
    const matchedScenes = applyBoundCharactersToScenes(storyboards, boundCharacters);
    logger.info('[StoryboardBuild] saved characters bound', {
      file: 'storyboard-build-service.ts',
      characters: boundCharacters.length,
      matchedScenes,
      characterReferences: charRefs.length,
    });
  }

  // Seed the operator's attached images (and reference videos) onto the first
  // storyboard as real scene references so they reach the canvas (third context
  // channel alongside structured fields + the chat conversation). Images are the
  // primary visual reference; videos ride along as `video` references the
  // operator can reuse — deep video-to-video decomposition is deferred.
  if (storyboards.length > 0) {
    // Saved-character anchors lead the pool (identity first), then the operator's
    // attached images and reference videos.
    const references: SceneReference[] = [...charRefs];
    for (const img of imageAttachments) {
      references.push({
        id: randomUUID(),
        type: 'image',
        name: img.fileName ?? 'Attached photo',
        url: img.url,
        purpose: 'style',
        usage:
          'Operator attached this image in the Content Assistant chat as a primary visual reference for the video.',
      });
    }
    for (const vid of videoAttachments) {
      references.push({
        id: randomUUID(),
        type: 'video',
        name: vid.fileName ?? 'Attached clip',
        url: vid.url,
        purpose: 'style',
        usage:
          'Operator attached this clip in the Content Assistant chat as a motion / pacing / vibe reference for the video.',
      });
    }
    if (references.length > 0) {
      storyboards[0] = { ...storyboards[0], references };
    }
  }

  return { storyboards };
}
