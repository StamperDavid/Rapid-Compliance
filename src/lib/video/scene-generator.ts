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
  generateHedraPromptVideo,
  getHedraVideoStatus,
} from '@/lib/video/hedra-service';
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
function buildHedraTextPrompt(scene: PipelineScene & { _hedraOptimizedPrompt?: string }): string {
  // Use the Hedra Prompt Agent's optimized prompt if available
  if (scene._hedraOptimizedPrompt) {
    return scene._hedraOptimizedPrompt;
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

  return prompt.join('. ');
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

      try {
        const { getAvatarProfile, getDefaultProfile } = await import('@/lib/video/avatar-profile-service');
        const profile = await getAvatarProfile(effectiveAvatarId) ?? await getDefaultProfile(effectiveAvatarId);
        if (profile) {
          photoUrl = profile.frontalImageUrl ?? null;

          if (!resolvedVoiceId && profile.voiceId) {
            resolvedVoiceId = profile.voiceId;
          }

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

      if (photoUrl && resolvedVoiceId) {
        logger.info('Generating avatar scene (Character 3)', {
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

    logger.info('Batch scene generation completed', {
      totalScenes: scenes.length,
      successfulScenes: results.filter((r) => r.status !== 'failed').length,
      failedScenes: results.filter((r) => r.status === 'failed').length,
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
