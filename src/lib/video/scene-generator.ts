/**
 * Hedra Scene Generator
 *
 * Two modes:
 *   1. **Prompt-only** (no avatar) — Hedra picks the model and generates from text prompt.
 *   2. **Avatar mode** (user selected a premium character) — uses Character 3 with portrait + TTS.
 */

import { logger } from '@/lib/logger/logger';
import {
  generateHedraAvatarVideo,
  generateHedraCharacterVideo,
  generateHedraCharacterVideoFromClip,
  generateHedraPromptVideo,
  getHedraVideoStatus,
} from '@/lib/video/hedra-service';
import type { AvatarProfile, CharacterLook } from '@/lib/video/avatar-profile-service';
import { buildPromptFromPresets } from '@/lib/ai/cinematic-presets';
import type { PipelineScene, SceneGenerationResult, VideoEngineId } from '@/types/video-pipeline';
import type { VideoAspectRatio } from '@/types/video';

// Avatar is never auto-selected — only used when the user explicitly picks one.
// Voice is used in BOTH modes:
//   - Avatar mode: Character 3 with portrait + TTS (talking head lip-sync)
//   - Prompt-only mode: Hedra generates the character from text + TTS (character speaks)
// If no voice is explicitly selected, a default Hedra voice is auto-resolved so
// the generated character speaks the script instead of being silent.

/** Treat empty/whitespace-only strings as null (no value selected). */
function nonEmpty(val: string | null | undefined): string | null {
  return val != null && val.trim().length > 0 ? val : null;
}


// ============================================================================
// Scene-to-Prompt Translator — converts storyboard data into a Hedra prompt
// ============================================================================

/**
 * Hedra has a single `text_prompt` field. This function acts as the director,
 * translating storyboard scene data into a coherent cinematic scene description
 * that a text-to-video AI can execute.
 *
 * The prompt is structured as a film direction note:
 *   SETTING → CHARACTER → ACTION → CAMERA/MOOD
 *
 * This produces far better results than raw field concatenation because
 * Hedra interprets the prompt as a single scene description, not fragments.
 */
function buildHedraTextPrompt(
  scene: PipelineScene & { _hedraOptimizedPrompt?: string },
  previousScenePrompt?: string,
): string {
  // Use the Hedra Prompt Agent's optimized prompt if available
  if (scene._hedraOptimizedPrompt) {
    return scene._hedraOptimizedPrompt;
  }

  // Shot group continuation: if this scene is part of a shot group and
  // has a previous scene's prompt, use it as the base with continuation cue
  if (previousScenePrompt && scene.shotGroupId) {
    return `CONTINUATION: Character continues speaking in the same exact location and position. ${previousScenePrompt}`;
  }

  const background = scene.backgroundPrompt?.trim() ?? '';
  const visual = scene.visualDescription?.trim() ?? '';
  const script = scene.scriptText?.trim() ?? '';
  const title = scene.title?.trim() ?? '';

  // If we have nothing to work with, return whatever exists
  if (!background && !visual && !script) {
    return title || '';
  }

  // Build a structured cinematic prompt for Hedra
  const prompt: string[] = [];

  // SETTING: environment, lighting, atmosphere
  if (background) {
    prompt.push(background);
  }

  // CHARACTER + ACTION + CAMERA: who is on screen, what they're doing, how it's shot
  if (visual) {
    prompt.push(visual);
  }

  // If we have a script but no visual description, use the script as scene context.
  // The character in the video should be presenting/delivering this content.
  if (!visual && script) {
    prompt.push(`A professional presenter confidently delivering a message on camera. Topic: "${script.slice(0, 150)}"`);
  }

  // Production quality markers — tells Hedra to aim high
  prompt.push('Cinematic quality, professional lighting, 4K film look');

  const basePrompt = prompt.join('. ');

  // If the scene has cinematic presets (shot type, camera, lighting, film stock, etc.),
  // layer them onto the prompt using the Creative Studio's preset assembly engine.
  if (scene.cinematicConfig && Object.keys(scene.cinematicConfig).length > 0) {
    return buildPromptFromPresets(basePrompt, scene.cinematicConfig);
  }

  return basePrompt;
}

// ============================================================================
// Hedra Scene Generators
// ============================================================================

/**
 * Generate a scene using just a text prompt — Hedra picks the model.
 * Used when no avatar is selected. Narration audio is generated via TTS
 * and attached to the video if a voice is available.
 */
async function generatePromptScene(
  scene: PipelineScene,
  voiceId: string | null,
  aspectRatio: VideoAspectRatio,
): Promise<SceneGenerationResult> {
  const script = scene.scriptText?.trim() || '';
  const hedraAspectRatio = aspectRatio === '4:3' ? '16:9' : aspectRatio;
  const textPrompt = buildHedraTextPrompt(scene);

  // Normalize empty string to undefined — '' is "no voice", not a valid ID
  const effectiveVoice = voiceId && voiceId.trim().length > 0 ? voiceId : undefined;

  logger.info('Submitting prompt-only Hedra generation', {
    sceneId: scene.id,
    hasVoice: Boolean(effectiveVoice),
    hasScript: Boolean(script),
    willGenerateTTS: Boolean(effectiveVoice && script),
    voiceId: effectiveVoice ?? 'none',
    promptLength: textPrompt.length,
    textPromptPreview: textPrompt.slice(0, 200),
    file: 'scene-generator.ts',
  });

  const response = await generateHedraPromptVideo({
    textPrompt,
    aspectRatio: hedraAspectRatio,
    resolution: '1080p',
    durationMs: scene.duration * 1000,
    hedraVoiceId: effectiveVoice,
    speechText: (effectiveVoice && script) ? script : undefined,
  });

  return {
    sceneId: scene.id,
    providerVideoId: response.generationId,
    provider: 'hedra',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
}

/**
 * Generate a talking-head scene using Character 3 with a portrait image.
 * Used when the user explicitly selected a premium avatar.
 */
async function generateAvatarScene(
  scene: PipelineScene,
  photoUrl: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
): Promise<SceneGenerationResult> {
  const script = scene.scriptText.trim() || ' ';
  const hedraAspectRatio = aspectRatio === '4:3' ? '16:9' : aspectRatio;
  const textPrompt = buildHedraTextPrompt(scene);

  logger.info('Submitting avatar Hedra generation (Character 3)', {
    sceneId: scene.id,
    voiceId,
    scriptLength: script.length,
    textPromptPreview: textPrompt.slice(0, 200),
    file: 'scene-generator.ts',
  });

  const response = await generateHedraAvatarVideo(photoUrl, null, {
    textPrompt,
    aspectRatio: hedraAspectRatio,
    resolution: '1080p',
    durationMs: scene.duration * 1000,
    hedraVoiceId: voiceId,
    speechText: script,
  });

  return {
    sceneId: scene.id,
    providerVideoId: response.generationId,
    provider: 'hedra',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
}

// ============================================================================
// Character Reference Assembly — turn a saved character into Hedra conditioning
// ============================================================================

/** Lowercase word tokens (length ≥ 3) for case-insensitive overlap matching. */
function wardrobeTokens(text: string | null | undefined): Set<string> {
  if (!text) {
    return new Set<string>();
  }
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

/**
 * Pick the character Look that best fits the scene's wardrobe:
 *   1. The Look whose `outfitDescription` shares the most word tokens with
 *      `scene.wardrobe` (case-insensitive). Ties / zero-overlap fall through.
 *   2. The Look flagged `isPrimary`.
 *   3. The first Look.
 *   4. None.
 */
function pickLook(looks: CharacterLook[], wardrobe: string | undefined): CharacterLook | null {
  if (looks.length === 0) {
    return null;
  }

  const wanted = wardrobeTokens(wardrobe);
  if (wanted.size > 0) {
    let best: CharacterLook | null = null;
    let bestScore = 0;
    for (const look of looks) {
      const tokens = wardrobeTokens(look.outfitDescription);
      let score = 0;
      for (const t of wanted) {
        if (tokens.has(t)) { score++; }
      }
      if (score > bestScore) {
        bestScore = score;
        best = look;
      }
    }
    if (best && bestScore > 0) {
      return best;
    }
  }

  return looks.find((l) => l.isPrimary) ?? looks[0];
}

/** Max reference images we assemble for a character (the model may cap lower). */
const MAX_CHARACTER_REFERENCES = 4;

/**
 * Assemble a character's reference image URLs for conditioning, in priority order:
 * matched Look images → additional angles → full-body → upper-body. The frontal
 * portrait is the start frame and is excluded. De-duped and capped.
 */
function assembleCharacterReferences(profile: AvatarProfile, wardrobe: string | undefined): string[] {
  const look = pickLook(profile.looks ?? [], wardrobe);

  const ordered: string[] = [
    ...(look?.imageUrls ?? []),
    ...(profile.additionalImageUrls ?? []),
    ...(profile.fullBodyImageUrl ? [profile.fullBodyImageUrl] : []),
    ...(profile.upperBodyImageUrl ? [profile.upperBodyImageUrl] : []),
  ];

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const url of ordered) {
    if (!url || url === profile.frontalImageUrl || seen.has(url)) {
      continue;
    }
    seen.add(url);
    deduped.push(url);
  }

  return deduped.slice(0, MAX_CHARACTER_REFERENCES);
}

/**
 * Resolve the character's chroma-key (green-screen) motion clip for the PRIMARY
 * video-driven path. Preference:
 *   1. The first usable `greenScreenClips[].videoUrl` (the trained character clip).
 *   2. Else the matched Look's first `videoUrls[]` entry (same Look `pickLook`
 *      chooses for the scene wardrobe).
 * Returns null when the character has no chroma clip — the caller then falls back
 * to the image-reference path.
 */
function resolveChromaClipUrl(profile: AvatarProfile, wardrobe: string | undefined): string | null {
  for (const clip of profile.greenScreenClips ?? []) {
    const url = clip?.videoUrl?.trim();
    if (url) {
      return url;
    }
  }

  const look = pickLook(profile.looks ?? [], wardrobe);
  for (const url of look?.videoUrls ?? []) {
    const trimmed = url?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

/**
 * PRIMARY character path: cast the bound character into the scene by driving the
 * render with the character's chroma-key motion clip (`input_video`) + a text
 * scene prompt. Works SPEAKING (voice + script → inline TTS) or SILENT (clip +
 * prompt, no audio).
 *
 * Returns the scene result on success, or `null` when the video-driven path is
 * unavailable (no input-video-capable model, catalog failure, or clip upload
 * failure) so the caller can fall back to the image-reference path.
 */
async function generateCharacterClipScene(
  scene: PipelineScene,
  sourceVideoUrl: string,
  voiceId: string | null,
  aspectRatio: VideoAspectRatio,
): Promise<SceneGenerationResult | null> {
  const hedraAspectRatio = aspectRatio === '4:3' ? '16:9' : aspectRatio;
  const textPrompt = buildHedraTextPrompt(scene);
  const script = scene.scriptText?.trim() || '';
  const speaking = Boolean(voiceId && script);

  logger.info('Submitting video-driven character Hedra generation (chroma clip → input_video)', {
    sceneId: scene.id,
    mode: speaking ? 'speaking' : 'silent',
    file: 'scene-generator.ts',
  });

  const response = await generateHedraCharacterVideoFromClip({
    sourceVideoUrl,
    textPrompt,
    aspectRatio: hedraAspectRatio,
    resolution: '1080p',
    durationMs: scene.duration * 1000,
    hedraVoiceId: speaking && voiceId ? voiceId : undefined,
    speechText: speaking ? script : undefined,
  });

  if (!response) {
    return null;
  }

  return {
    sceneId: scene.id,
    providerVideoId: response.generationId,
    provider: 'hedra',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
}

/**
 * Generate a scene conditioned on the FULL identity of a bound character:
 * portrait (start frame) + reference images (matched Look + body angles) + voice.
 * Works whether the character is SPEAKING (voice + script → inline TTS) or SILENT
 * (start frame + references, no audio).
 *
 * Returns the scene result on success, or `null` when the character-conditioned
 * path is unavailable (no reference-capable model, catalog failure, or no
 * references) so the caller can fall back to the portrait-only / prompt path.
 */
async function generateCharacterScene(
  scene: PipelineScene,
  portraitUrl: string,
  references: string[],
  voiceId: string | null,
  aspectRatio: VideoAspectRatio,
): Promise<SceneGenerationResult | null> {
  const hedraAspectRatio = aspectRatio === '4:3' ? '16:9' : aspectRatio;
  const textPrompt = buildHedraTextPrompt(scene);
  const script = scene.scriptText?.trim() || '';
  const speaking = Boolean(voiceId && script);

  logger.info('Submitting character-conditioned Hedra generation', {
    sceneId: scene.id,
    references: references.length,
    mode: speaking ? 'speaking' : 'silent',
    file: 'scene-generator.ts',
  });

  const response = await generateHedraCharacterVideo({
    // MULTI-CHARACTER EXTENSION POINT: push more entries for background extras /
    // a second speaker. Only the lead is wired today.
    characters: [{ portraitUrl, referenceImageUrls: references }],
    textPrompt,
    aspectRatio: hedraAspectRatio,
    resolution: '1080p',
    durationMs: scene.duration * 1000,
    hedraVoiceId: speaking && voiceId ? voiceId : undefined,
    speechText: speaking ? script : undefined,
  });

  if (!response) {
    return null;
  }

  return {
    sceneId: scene.id,
    providerVideoId: response.generationId,
    provider: 'hedra',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
}

// ============================================================================
// Scene Generation
// ============================================================================

/**
 * Generate a single scene via Hedra.
 *
 * Two modes:
 *   - **Avatar selected** → Character 3 with portrait + TTS (talking head)
 *   - **No avatar** → prompt-only, Hedra picks the model (cinematic video)
 *
 * Voice is auto-resolved from Hedra's catalog when not explicitly set.
 */
export async function generateScene(
  scene: PipelineScene,
  projectAvatarId: string,
  projectVoiceId: string,
  aspectRatio: VideoAspectRatio,
  _projectVoiceProvider?: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra'
): Promise<SceneGenerationResult> {
  try {
    // Normalize empty strings to null — '' means "no selection", not a valid ID
    const effectiveAvatarId = nonEmpty(scene.avatarId) ?? nonEmpty(projectAvatarId);
    let resolvedVoiceId = nonEmpty(scene.voiceId) ?? nonEmpty(projectVoiceId);

    // ── AVATAR MODE: user selected a premium character ───────────────────
    if (effectiveAvatarId) {
      let photoUrl: string | null = null;
      let characterReferences: string[] = [];
      let chromaClipUrl: string | null = null;

      try {
        const { getAvatarProfile, getDefaultProfile } = await import('@/lib/video/avatar-profile-service');
        const profile = await getAvatarProfile(effectiveAvatarId) ?? await getDefaultProfile(effectiveAvatarId);
        if (profile) {
          photoUrl = profile.frontalImageUrl ?? null;

          if (!resolvedVoiceId && profile.voiceId) {
            resolvedVoiceId = profile.voiceId;
          }

          // PRIMARY conditioning material: the character's chroma-key motion clip
          // (green-screen clip → matched Look video). Drives the video-driven path.
          chromaClipUrl = resolveChromaClipUrl(profile, scene.wardrobe);

          // Assemble the character's identity reference images (matched Look +
          // body angles) so the bound character renders consistently — used for
          // both speaking and silent scenes.
          characterReferences = assembleCharacterReferences(profile, scene.wardrobe);

          // Enhance visual description with character metadata
          try {
            const { translatePromptForHedra } = await import('@/lib/video/hedra-prompt-translator');
            scene = {
              ...scene,
              visualDescription: translatePromptForHedra(
                scene.visualDescription ?? '',
                { characterName: profile.name, role: profile.role, styleTag: profile.styleTag, source: profile.source }
              ),
            };
          } catch { /* non-critical */ }
        }
      } catch { /* profile load failed */ }

      // ── (a) PRIMARY: video-driven path (chroma-key clip → input_video) ──
      // Casting the character into the scene = the green-screen motion clip as
      // the model's input_video + a text scene prompt, so Hedra places the same
      // character (motion + identity preserved) into the new environment. Runs
      // SPEAKING (voice + script → inline TTS) or SILENT (clip + prompt, no
      // audio). Returns null when there is no input-video-capable model / catalog
      // fetch fails / clip upload fails — then we fall through to the image-
      // reference path (b) below.
      if (chromaClipUrl) {
        logger.info('Generating video-driven character scene (chroma clip → input_video)', {
          sceneId: scene.id,
          avatarId: effectiveAvatarId,
          hasVoice: Boolean(resolvedVoiceId),
          file: 'scene-generator.ts',
        });
        const clipResult = await generateCharacterClipScene(
          scene,
          chromaClipUrl,
          resolvedVoiceId,
          aspectRatio,
        );
        if (clipResult) {
          return clipResult;
        }
        logger.info('Video-driven character path unavailable — falling back to image references', {
          sceneId: scene.id,
          avatarId: effectiveAvatarId,
          file: 'scene-generator.ts',
        });
      }

      // ── (b) Image-reference path: condition the render on the character's FULL
      // identity (portrait start frame + reference images + voice). This runs
      // whether the character is SPEAKING (voice + script → inline TTS) or SILENT
      // (start frame + references, no audio). Returns null when no reference-
      // capable model is in the catalog / catalog fetch fails / no references —
      // then we fall back to the portrait-only or prompt path below.
      if (photoUrl && characterReferences.length > 0) {
        logger.info('Generating character-conditioned scene (start frame + references)', {
          sceneId: scene.id,
          avatarId: effectiveAvatarId,
          references: characterReferences.length,
          hasVoice: Boolean(resolvedVoiceId),
          file: 'scene-generator.ts',
        });
        const characterResult = await generateCharacterScene(
          scene,
          photoUrl,
          characterReferences,
          resolvedVoiceId,
          aspectRatio,
        );
        if (characterResult) {
          return characterResult;
        }
        logger.info('Character-conditioned path unavailable — falling back', {
          sceneId: scene.id,
          avatarId: effectiveAvatarId,
          file: 'scene-generator.ts',
        });
      }

      // Fallback: portrait-only Character 3 (talking head) when we have a photo
      // and a voice but couldn't condition on references.
      if (photoUrl && resolvedVoiceId) {
        logger.info('Generating avatar scene (Character 3, portrait-only)', {
          sceneId: scene.id,
          avatarId: effectiveAvatarId,
          file: 'scene-generator.ts',
        });
        return await generateAvatarScene(scene, photoUrl, resolvedVoiceId, aspectRatio);
      }

      // Avatar was selected but profile missing/incomplete — fall through to prompt mode
      logger.warn('Avatar profile incomplete, falling back to prompt-only mode', {
        sceneId: scene.id,
        avatarId: effectiveAvatarId,
        hasPhoto: Boolean(photoUrl),
        hasVoice: Boolean(resolvedVoiceId),
        file: 'scene-generator.ts',
      });
    }

    // ── PROMPT MODE: no avatar — text-to-video with TTS ──────────────────
    // Hedra generates the character from the text prompt. If script text exists,
    // we generate TTS audio so the character speaks the script on camera.
    // If no voice is set, auto-resolve a default Hedra voice.
    let promptVoiceId = nonEmpty(scene.voiceId) ?? nonEmpty(projectVoiceId);

    if (!promptVoiceId && scene.scriptText?.trim()) {
      // Auto-resolve default voice from video settings or Hedra catalog
      try {
        const { getVideoDefaults } = await import('@/lib/video/video-defaults-service');
        const defaults = await getVideoDefaults();
        if (defaults.voiceId && defaults.voiceProvider === 'hedra') {
          promptVoiceId = defaults.voiceId;
          logger.info('Auto-resolved default Hedra voice for prompt-only scene', {
            sceneId: scene.id,
            voiceId: defaults.voiceId,
            voiceName: defaults.voiceName,
            file: 'scene-generator.ts',
          });
        }
      } catch { /* defaults unavailable */ }
    }

    // If we still have no voice but there IS a Hedra voice catalog, fetch the first male voice
    if (!promptVoiceId && scene.scriptText?.trim()) {
      try {
        const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
        const { PLATFORM_ID: platId } = await import('@/lib/constants/platform');
        const hedraKey = await apiKeyService.getServiceKey(platId, 'hedra');
        if (typeof hedraKey === 'string' && hedraKey.length > 0) {
          const voicesRes = await fetch('https://api.hedra.com/web-app/public/voices', {
            headers: { 'x-api-key': hedraKey, 'Accept': 'application/json' },
          });
          if (voicesRes.ok) {
            const voices = (await voicesRes.json()) as Array<{ id: string; name: string; asset?: { labels?: Array<{ name: string; value: string }> } }>;
            // Prefer a male English voice for default
            const maleVoice = voices.find((v) =>
              v.asset?.labels?.some((l) => l.name === 'gender' && l.value === 'male') &&
              v.asset?.labels?.some((l) => l.name === 'language' && l.value.toLowerCase().includes('english'))
            );
            promptVoiceId = maleVoice?.id ?? voices[0]?.id ?? null;
            if (promptVoiceId) {
              logger.info('Auto-resolved Hedra catalog voice for prompt-only scene', {
                sceneId: scene.id,
                voiceId: promptVoiceId,
                voiceName: maleVoice?.name ?? voices[0]?.name,
                file: 'scene-generator.ts',
              });
            }
          }
        }
      } catch { /* voice catalog unavailable — proceed without TTS */ }
    }

    logger.info(`Generating prompt-only scene ${promptVoiceId ? '(with TTS — character speaks)' : '(no TTS — silent)'}`, {
      sceneId: scene.id,
      hasVoice: Boolean(promptVoiceId),
      file: 'scene-generator.ts',
    });

    return await generatePromptScene(scene, promptVoiceId, aspectRatio);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scene generation failed', error as Error, {
      sceneId: scene.id,
      file: 'scene-generator.ts',
    });
    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: 'hedra',
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Scene Status Polling
// ============================================================================

/**
 * Poll Hedra for scene status.
 * The provider parameter is retained for backward compatibility but is
 * ignored — Hedra is the sole engine.
 */
export async function pollSceneStatus(
  providerVideoId: string,
  _provider: VideoEngineId | null = 'hedra'
): Promise<{
  status: 'generating' | 'completed' | 'failed';
  videoUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  progress: number;
}> {
  try {
    const hedraStatus = await getHedraVideoStatus(providerVideoId);

    if (hedraStatus.status === 'completed') {
      return {
        status: 'completed',
        videoUrl: hedraStatus.videoUrl,
        thumbnailUrl: null,
        error: null,
        progress: 100,
      };
    }

    if (hedraStatus.status === 'failed') {
      return {
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        error: hedraStatus.error ?? 'Hedra video generation failed',
        progress: 0,
      };
    }

    return {
      status: 'generating',
      videoUrl: null,
      thumbnailUrl: null,
      error: null,
      progress: hedraStatus.progress ?? (hedraStatus.status === 'processing' ? 40 : 10),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to poll Hedra scene status', error as Error, {
      generationId: providerVideoId,
      file: 'scene-generator.ts',
    });
    return { status: 'failed', videoUrl: null, thumbnailUrl: null, error: errorMessage, progress: 0 };
  }
}

// ============================================================================
// Batch Scene Generation
// ============================================================================

/**
 * Generate all scenes with a concurrency limit of 3.
 * All scenes are staggered by 1.5 s to avoid Hedra rate limits.
 */
export async function generateAllScenes(
  scenes: PipelineScene[],
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  onSceneUpdate?: (result: SceneGenerationResult) => void,
  voiceProvider?: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra'
): Promise<SceneGenerationResult[]> {
  try {
    const CONCURRENCY = 3;
    const results: SceneGenerationResult[] = [];

    // ── Hedra Prompt Agent: translate storyboard into optimized prompts ──
    // Runs ONCE for all scenes so it can see the full storyboard and ensure
    // character consistency across scenes.
    const optimizedPrompts: Map<string, string> = new Map();
    try {
      const { translateStoryboardToHedraPrompts } = await import('@/lib/video/hedra-prompt-agent');
      const hedraPrompts = await translateStoryboardToHedraPrompts(scenes);
      for (const hp of hedraPrompts) {
        optimizedPrompts.set(hp.sceneId, hp.textPrompt);
      }
      logger.info('Hedra Prompt Agent produced optimized prompts', {
        promptCount: optimizedPrompts.size,
        file: 'scene-generator.ts',
      });
    } catch (agentError) {
      logger.warn('Hedra Prompt Agent failed — using fallback prompts', {
        error: agentError instanceof Error ? agentError.message : String(agentError),
        file: 'scene-generator.ts',
      });
      // optimizedPrompts stays empty — generateScene will use buildHedraTextPrompt
    }

    // Inject optimized prompts into scenes so generateScene uses them
    const enhancedScenes = scenes.map((scene) => {
      const optimized = optimizedPrompts.get(scene.id);
      if (optimized) {
        return { ...scene, _hedraOptimizedPrompt: optimized };
      }
      return scene;
    });

    // Track establishing scene prompts for shot group continuity
    const shotGroupPrompts = new Map<string, string>();
    for (const scene of enhancedScenes) {
      if (scene.shotGroupId) {
        if (!shotGroupPrompts.has(scene.shotGroupId)) {
          // First scene in the group — record its prompt as the establishing prompt
          const sceneWithOptimized = scene as typeof scene & { _hedraOptimizedPrompt?: string };
          const prompt = sceneWithOptimized._hedraOptimizedPrompt
            ?? [scene.backgroundPrompt, scene.visualDescription].filter(Boolean).join('. ');
          shotGroupPrompts.set(scene.shotGroupId, prompt);
        } else {
          // Continuation scene — inject the establishing scene's prompt
          const establishingPrompt = shotGroupPrompts.get(scene.shotGroupId);
          const sceneWithOptimized = scene as typeof scene & { _hedraOptimizedPrompt?: string };
          if (establishingPrompt && !sceneWithOptimized._hedraOptimizedPrompt) {
            sceneWithOptimized._hedraOptimizedPrompt =
              `CONTINUATION: Character continues speaking in the same exact location and position. ${establishingPrompt}`;
          }
        }
      }
    }

    logger.info('Starting batch scene generation', {
      totalScenes: scenes.length,
      concurrency: CONCURRENCY,
      hasOptimizedPrompts: optimizedPrompts.size > 0,
      engines: scenes.map(() => 'hedra'),
      file: 'scene-generator.ts',
    });

    for (let i = 0; i < enhancedScenes.length; i += CONCURRENCY) {
      const batch = enhancedScenes.slice(i, i + CONCURRENCY);

      logger.info('Processing scene batch', {
        batchNumber: Math.floor(i / CONCURRENCY) + 1,
        batchSize: batch.length,
        file: 'scene-generator.ts',
      });

      // Stagger all starts by 1.5 s each to avoid TTS rate limits
      const batchResults = await Promise.all(
        batch.map(async (scene, batchIndex) => {
          if (batchIndex > 0) {
            await new Promise<void>((resolve) => { setTimeout(resolve, batchIndex * 1500); });
          }
          return generateScene(scene, avatarId, voiceId, aspectRatio, voiceProvider);
        })
      );

      for (const result of batchResults) {
        results.push(result);
        if (onSceneUpdate) {
          onSceneUpdate(result);
        }
      }
    }

    // Detect duplicate providerVideoIds — Hedra can return the same generation ID
    // for two different API calls made close together. Re-submit any duplicates.
    const seenIds = new Map<string, number>(); // providerVideoId → first index
    const duplicateIndices: number[] = [];

    for (let idx = 0; idx < results.length; idx++) {
      const id = results[idx].providerVideoId;
      if (!id || results[idx].status === 'failed') {continue;}

      const firstIdx = seenIds.get(id);
      if (firstIdx !== undefined) {
        logger.warn('Duplicate Hedra generation ID detected — will re-submit', {
          duplicateId: id,
          sceneId: results[idx].sceneId,
          firstSceneId: results[firstIdx].sceneId,
          file: 'scene-generator.ts',
        });
        duplicateIndices.push(idx);
      } else {
        seenIds.set(id, idx);
      }
    }

    // Re-submit duplicates one at a time with a 3-second gap
    for (const idx of duplicateIndices) {
      const originalScene = enhancedScenes[idx];
      if (!originalScene) {continue;}

      await new Promise<void>((resolve) => { setTimeout(resolve, 3000); });

      logger.info('Re-submitting scene with duplicate generation ID', {
        sceneId: originalScene.id,
        file: 'scene-generator.ts',
      });

      const retryResult = await generateScene(originalScene, avatarId, voiceId, aspectRatio, voiceProvider);
      results[idx] = retryResult;

      if (onSceneUpdate) {
        onSceneUpdate(retryResult);
      }
    }

    logger.info('Batch scene generation completed', {
      totalScenes: scenes.length,
      successfulScenes: results.filter((r) => r.status !== 'failed').length,
      failedScenes: results.filter((r) => r.status === 'failed').length,
      duplicatesResubmitted: duplicateIndices.length,
      file: 'scene-generator.ts',
    });

    return results;
  } catch (error) {
    logger.error('Batch scene generation failed', error as Error, {
      file: 'scene-generator.ts',
    });
    throw error;
  }
}
