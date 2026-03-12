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

// ============================================================================
// Hedra API Key Helper
// ============================================================================

async function getHedraApiKey(): Promise<string | null> {
  try {
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const { PLATFORM_ID } = await import('@/lib/constants/platform');
    const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'hedra');
    return (rawKey && typeof rawKey === 'string') ? rawKey : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Default Hedra Voice Fallback
// ============================================================================

interface HedraVoiceFallback { id: string; name: string }

let defaultHedraVoicePromise: Promise<HedraVoiceFallback | null> | null = null;

function getDefaultHedraVoice(): Promise<HedraVoiceFallback | null> {
  defaultHedraVoicePromise ??= fetchDefaultHedraVoice();
  return defaultHedraVoicePromise;
}

async function fetchDefaultHedraVoice(): Promise<HedraVoiceFallback | null> {
  try {
    const apiKey = await getHedraApiKey();
    if (!apiKey) { return null; }

    const response = await fetch('https://api.hedra.com/web-app/public/voices', {
      headers: { 'x-api-key': apiKey, 'Accept': 'application/json' },
    });

    if (!response.ok) { return null; }

    const voices = (await response.json()) as { id: string; name: string }[];
    if (!Array.isArray(voices) || voices.length === 0) { return null; }

    const defaultVoice = { id: voices[0].id, name: voices[0].name };
    logger.info('Cached default Hedra voice for fallback', {
      voiceId: defaultVoice.id,
      voiceName: defaultVoice.name,
      file: 'scene-generator.ts',
    });
    return defaultVoice;
  } catch {
    defaultHedraVoicePromise = null;
    return null;
  }
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

  logger.info('Submitting prompt-only Hedra generation', {
    sceneId: scene.id,
    hasNarration: Boolean(voiceId && script),
    promptLength: scene.visualDescription?.length ?? 0,
    file: 'scene-generator.ts',
  });

  const response = await generateHedraPromptVideo({
    textPrompt: scene.visualDescription?.trim() ?? scene.scriptText?.trim() ?? '',
    aspectRatio: hedraAspectRatio,
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

  logger.info('Submitting avatar Hedra generation (Character 3)', {
    sceneId: scene.id,
    voiceId,
    scriptLength: script.length,
    file: 'scene-generator.ts',
  });

  const response = await generateHedraAvatarVideo(photoUrl, null, {
    textPrompt: scene.visualDescription?.trim() ?? '',
    aspectRatio: hedraAspectRatio,
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

    // ── Resolve voice (needed for both modes — TTS narration) ────────────
    if (!resolvedVoiceId) {
      const fallback = await getDefaultHedraVoice();
      if (fallback) {
        resolvedVoiceId = fallback.id;
        logger.info('Auto-selected Hedra voice', {
          sceneId: scene.id,
          voiceId: fallback.id,
          voiceName: fallback.name,
          file: 'scene-generator.ts',
        });
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

    logger.info('Starting batch scene generation', {
      totalScenes: scenes.length,
      concurrency: CONCURRENCY,
      engines: scenes.map(() => 'hedra'),
      file: 'scene-generator.ts',
    });

    for (let i = 0; i < scenes.length; i += CONCURRENCY) {
      const batch = scenes.slice(i, i + CONCURRENCY);

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
