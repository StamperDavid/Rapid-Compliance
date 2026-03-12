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
// Voice IS auto-selected from Hedra's catalog when the scene has narration text
// but no explicit voice. Gender is inferred from the visual description.

interface HedraVoiceOption { id: string; name: string; gender?: string }
let voicePromise: Promise<HedraVoiceOption[]> | null = null;

function fetchHedraVoices(): Promise<HedraVoiceOption[]> {
  voicePromise ??= doFetchHedraVoices();
  return voicePromise;
}

async function doFetchHedraVoices(): Promise<HedraVoiceOption[]> {
  try {
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const apiKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'hedra');
    if (!apiKey || typeof apiKey !== 'string') { return []; }
    const res = await fetch('https://api.hedra.com/web-app/public/voices', {
      headers: { 'x-api-key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) { return []; }
    const voices = (await res.json()) as HedraVoiceOption[];
    return Array.isArray(voices) ? voices : [];
  } catch {
    voicePromise = null;
    return [];
  }
}

function inferGenderFromDescription(description: string): 'male' | 'female' | null {
  const lower = description.toLowerCase();
  const maleWords = /\b(man|male|he |his |him |guy|gentleman|bald man|boy)\b/;
  const femaleWords = /\b(woman|female|she |her |lady|girl|redheaded woman)\b/;
  const hasMale = maleWords.test(lower);
  const hasFemale = femaleWords.test(lower);
  if (hasMale && !hasFemale) { return 'male'; }
  if (hasFemale && !hasMale) { return 'female'; }
  return null;
}

async function autoSelectVoice(scene: PipelineScene): Promise<string | null> {
  const voices = await fetchHedraVoices();
  if (voices.length === 0) { return null; }
  const gender = inferGenderFromDescription(scene.visualDescription ?? '');
  if (gender) {
    const match = voices.find((v) => v.gender === gender);
    if (match) {
      logger.info('Auto-selected Hedra voice by gender', {
        sceneId: scene.id, voiceId: match.id, voiceName: match.name, gender,
        file: 'scene-generator.ts',
      });
      return match.id;
    }
  }
  // Fallback: pick first available voice
  logger.info('Auto-selected first Hedra voice (no gender match)', {
    sceneId: scene.id, voiceId: voices[0].id, voiceName: voices[0].name,
    file: 'scene-generator.ts',
  });
  return voices[0].id;
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

  // If we have a script but no visual description, derive context from the script
  // so Hedra has SOMETHING about who is speaking and what's happening
  if (!visual && script) {
    prompt.push(`A person speaking to camera: "${script.slice(0, 150)}"`);
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

  logger.info('Submitting prompt-only Hedra generation', {
    sceneId: scene.id,
    hasNarration: Boolean(voiceId && script),
    promptLength: textPrompt.length,
    textPromptPreview: textPrompt.slice(0, 200),
    file: 'scene-generator.ts',
  });

  const response = await generateHedraPromptVideo({
    textPrompt,
    aspectRatio: hedraAspectRatio,
    resolution: '1080p',
    durationMs: scene.duration * 1000,
    hedraVoiceId: voiceId ?? undefined,
    speechText: (voiceId && script) ? script : undefined,
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
    const effectiveAvatarId = scene.avatarId ?? projectAvatarId;
    let resolvedVoiceId = scene.voiceId ?? projectVoiceId;

    // Auto-select a Hedra voice when the scene has narration but no voice chosen.
    // Matches gender from the visual description so a male character gets a male voice.
    if (!resolvedVoiceId && scene.scriptText?.trim()) {
      const autoVoice = await autoSelectVoice(scene);
      if (autoVoice) {
        resolvedVoiceId = autoVoice;
      }
    }

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

    // ── PROMPT MODE: no avatar — just send the prompt, Hedra picks the model ─
    logger.info('Generating prompt-only scene (Hedra auto-selects model)', {
      sceneId: scene.id,
      hasNarration: Boolean(resolvedVoiceId && scene.scriptText),
      file: 'scene-generator.ts',
    });

    return await generatePromptScene(scene, resolvedVoiceId, aspectRatio);
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
