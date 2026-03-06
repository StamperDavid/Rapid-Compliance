/**
 * Multi-Engine Scene Generator
 * Routes scene generation to the selected video engine (HeyGen, Runway, Sora)
 * and handles polling and batch processing for the video pipeline
 */

import { logger } from '@/lib/logger/logger';
import {
  generateHeyGenSceneVideo,
  generateRunwayVideo,
  generateSoraVideo,
  getVideoStatus,
  getVideoProviderKey,
} from '@/lib/video/video-service';
import { generateImage } from '@/lib/ai/image-generation-service';
import type { PipelineScene, SceneGenerationResult, VideoEngineId } from '@/types/video-pipeline';
import type { VideoAspectRatio, VideoProvider } from '@/types/video';

// ============================================================================
// Engine-Specific Generators
// ============================================================================

async function generateWithHeyGen(
  scene: PipelineScene,
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  voiceProvider?: 'heygen' | 'elevenlabs'
): Promise<SceneGenerationResult> {
  // Validate avatar ID — HeyGen returns 404 "avatar look not found" if empty
  if (!avatarId) {
    throw new Error('No avatar selected. Go back to Pre-Production and choose an avatar.');
  }

  // Convert 4:3 to 16:9 for HeyGen (HeyGen only supports 16:9, 9:16, 1:1)
  const heygenAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  // Generate DALL-E background from backgroundPrompt if no screenshot provided
  let backgroundUrl = scene.screenshotUrl;
  if (!backgroundUrl && scene.backgroundPrompt?.trim()) {
    try {
      const dalleSize = heygenAspectRatio === '9:16' ? '1024x1792' as const
        : heygenAspectRatio === '1:1' ? '1024x1024' as const
        : '1792x1024' as const;

      logger.info('Generating DALL-E background for scene', {
        sceneId: scene.id,
        size: dalleSize,
        file: 'scene-generator.ts',
      });

      const result = await generateImage(scene.backgroundPrompt, {
        size: dalleSize,
        quality: 'standard',
        style: 'natural',
      });
      backgroundUrl = result.url;

      logger.info('DALL-E background generated', {
        sceneId: scene.id,
        file: 'scene-generator.ts',
      });
    } catch (bgError) {
      logger.warn('DALL-E background generation failed, using solid color fallback', {
        sceneId: scene.id,
        error: bgError instanceof Error ? bgError.message : String(bgError),
        file: 'scene-generator.ts',
      });
      // Continue without background — HeyGen will use solid color
    }
  }

  // Use scene-level script; if B-roll (empty script), send a minimal placeholder
  // so HeyGen doesn't error. The avatar will appear briefly with no speech.
  const script = scene.scriptText.trim() || ' ';

  // If using ElevenLabs voice, pre-synthesize audio and pass to HeyGen
  let audioUrl: string | null = null;
  if (voiceProvider === 'elevenlabs' && script.length > 1) {
    try {
      const { ElevenLabsProvider } = await import('@/lib/voice/tts/providers/elevenlabs-provider');
      const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
      const { PLATFORM_ID } = await import('@/lib/constants/platform');
      const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'elevenlabs');
      const apiKey = typeof rawKey === 'string' ? rawKey : null;

      if (apiKey) {
        const provider = new ElevenLabsProvider(apiKey);
        const ttsResult = await provider.synthesize(script, voiceId);

        // Store audio as base64 in Firestore, serve via public API endpoint
        // (Firebase Storage bucket doesn't exist — no billing on the GCP project)
        const { adminDb } = await import('@/lib/firebase/admin');
        if (adminDb) {
          const audioBase64 = ttsResult.audio.includes(',')
            ? ttsResult.audio.split(',')[1]
            : ttsResult.audio;
          const audioId = `tts-${scene.id}-${Date.now()}`;

          await adminDb
            .collection(`organizations/${PLATFORM_ID}/tts_audio`)
            .doc(audioId)
            .set({
              base64: audioBase64,
              contentType: 'audio/mpeg',
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            });

          // Build a public URL — HeyGen will download from this endpoint
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rapidcompliance.us';
          audioUrl = `${appUrl}/api/video/tts-audio/${audioId}`;

          logger.info('ElevenLabs audio synthesized and stored', {
            sceneId: scene.id,
            audioId,
            file: 'scene-generator.ts',
          });
        }
      }
    } catch (ttsError) {
      logger.warn('ElevenLabs TTS failed, falling back to HeyGen voice', {
        sceneId: scene.id,
        error: ttsError instanceof Error ? ttsError.message : String(ttsError),
        file: 'scene-generator.ts',
      });
      // Fall back to HeyGen's built-in TTS
    }
  }

  const response = await generateHeyGenSceneVideo(
    script,
    avatarId,
    voiceId,
    backgroundUrl,
    heygenAspectRatio,
    audioUrl,
  );

  logger.info('HeyGen scene generation started', {
    sceneId: scene.id,
    providerVideoId: response.id,
    file: 'scene-generator.ts',
  });

  return {
    sceneId: scene.id,
    providerVideoId: response.id,
    provider: 'heygen',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
}

async function generateWithRunway(
  scene: PipelineScene,
  aspectRatio: VideoAspectRatio
): Promise<SceneGenerationResult> {
  const runwayAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  // For B-roll scenes, use backgroundPrompt or visualDescription as the generation prompt
  // Runway requires promptText to be at least 1 character
  const prompt = ((): string => {
    const script = scene.scriptText.trim();
    if (script) { return script; }
    const bg = scene.backgroundPrompt?.trim();
    if (bg) { return bg; }
    const vis = scene.visualDescription?.trim();
    if (vis) { return vis; }
    return 'Cinematic B-roll footage';
  })();

  const response = await generateRunwayVideo('text', prompt, {
    duration: Math.min(scene.duration, 10), // Runway max 10s
    ratio: runwayAspectRatio,
  });

  logger.info('Runway scene generation started', {
    sceneId: scene.id,
    providerVideoId: response.id,
    file: 'scene-generator.ts',
  });

  return {
    sceneId: scene.id,
    providerVideoId: response.id,
    provider: 'runway',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
}

async function generateWithSora(
  scene: PipelineScene,
  aspectRatio: VideoAspectRatio
): Promise<SceneGenerationResult> {
  const soraAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  // For B-roll scenes, use backgroundPrompt or visualDescription as the generation prompt
  const prompt = ((): string => {
    const script = scene.scriptText.trim();
    if (script) { return script; }
    const bg = scene.backgroundPrompt?.trim();
    if (bg) { return bg; }
    const vis = scene.visualDescription?.trim();
    if (vis) { return vis; }
    return 'Cinematic B-roll footage';
  })();

  try {
    const response = await generateSoraVideo(prompt, {
      duration: Math.min(scene.duration, 16), // Sora max 16s (valid: 4, 8, 12, 16)
      aspectRatio: soraAspectRatio,
    });

    logger.info('Sora scene generation started', {
      sceneId: scene.id,
      providerVideoId: response.id,
      file: 'scene-generator.ts',
    });

    return {
      sceneId: scene.id,
      providerVideoId: response.id,
      provider: 'sora',
      status: 'generating',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: null,
    };
  } catch (soraError) {
    // Sora failed — auto-fallback to Runway
    logger.warn('Sora generation failed, falling back to Runway', {
      sceneId: scene.id,
      error: soraError instanceof Error ? soraError.message : String(soraError),
      file: 'scene-generator.ts',
    });

    const providers = await getAvailableProviders();
    if (providers.runway) {
      return generateWithRunway(scene, aspectRatio);
    }

    // If Runway also unavailable, throw the original Sora error
    throw soraError;
  }
}

// ============================================================================
// Intelligent Engine Selection
// ============================================================================

/** Cached provider availability so we don't re-check on every scene */
const providerCache: { data: Record<string, boolean> | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};
const PROVIDER_CACHE_TTL = 60_000; // 1 minute

async function getAvailableProviders(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (providerCache.data && (now - providerCache.timestamp) < PROVIDER_CACHE_TTL) {
    return providerCache.data;
  }

  const [heygen, sora, runway] = await Promise.all([
    getVideoProviderKey('heygen').then((k) => k !== null),
    getVideoProviderKey('sora').then((k) => k !== null),
    getVideoProviderKey('runway').then((k) => k !== null),
  ]);

  const result = { heygen, sora, runway };
  Object.assign(providerCache, { data: result, timestamp: Date.now() });

  logger.info('Video provider availability check', {
    heygen, sora, runway,
    file: 'scene-generator.ts',
  });

  return result;
}

/**
 * Determine whether a scene needs a talking avatar or is purely visual.
 * Avatar scenes → HeyGen (avatar specialist)
 * Visual/B-roll scenes → Runway or Sora (cinematic generation)
 */
function isAvatarScene(scene: PipelineScene, hasAvatar: boolean): boolean {
  if (!hasAvatar) {
    return false;
  }

  // If the scene has a speaking script that's more than a brief overlay, it's avatar
  const scriptLength = scene.scriptText?.trim().length ?? 0;
  if (scriptLength > 30) {
    return true;
  }

  // Scenes explicitly tagged as visual-only via keywords
  const visualKeywords = ['b-roll', 'broll', 'transition', 'montage', 'aerial', 'landscape', 'cinematic', 'background'];
  const titleLower = (scene.scriptText ?? '').toLowerCase();
  if (visualKeywords.some((kw) => titleLower.includes(kw))) {
    return false;
  }

  return true;
}

/**
 * Select the best engine for a scene based on content analysis and provider availability.
 *
 * Strategy:
 * - Avatar scenes (talking head with script) → HeyGen
 * - Visual/cinematic scenes → Runway (best quality) or Sora (fallback)
 * - If the preferred provider isn't available, fall back to the next best
 */
export async function selectEngineForScene(
  scene: PipelineScene,
  hasAvatar: boolean
): Promise<VideoEngineId> {
  // If the scene already has an engine explicitly set, respect it
  if (scene.engine) {
    return scene.engine;
  }

  const providers = await getAvailableProviders();
  const needsAvatar = isAvatarScene(scene, hasAvatar);

  if (needsAvatar) {
    // Avatar scenes: HeyGen is the only provider that does talking avatars
    if (providers.heygen) { return 'heygen'; }
    // No avatar provider available — fall back to text-to-video
    if (providers.runway) { return 'runway'; }
    if (providers.sora) { return 'sora'; }
    return 'heygen'; // Will fail with a clear "not configured" error
  }

  // Visual/cinematic scenes: prefer Runway (Gen-4.5 quality), then HeyGen as fallback
  // Sora is deprioritized due to reliability issues
  if (providers.runway) { return 'runway'; }
  if (providers.heygen) { return 'heygen'; }
  if (providers.sora) { return 'sora'; }
  return 'runway'; // Will fail with a clear "not configured" error
}

/**
 * Select engines for all scenes in a batch. Returns a map of sceneId → engine.
 */
export async function selectEnginesForScenes(
  scenes: PipelineScene[],
  hasAvatar: boolean
): Promise<Map<string, VideoEngineId>> {
  const result = new Map<string, VideoEngineId>();
  for (const scene of scenes) {
    const engine = await selectEngineForScene(scene, hasAvatar);
    result.set(scene.id, engine);
  }
  return result;
}

// ============================================================================
// Scene Generation (Multi-Engine Router)
// ============================================================================

/**
 * Generate a single scene, dispatching to the best available engine.
 * Uses intelligent engine selection when scene.engine is null.
 */
export async function generateScene(
  scene: PipelineScene,
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  voiceProvider?: 'heygen' | 'elevenlabs'
): Promise<SceneGenerationResult> {
  // Entire function wrapped in try/catch so nothing can crash the batch
  try {
    const hasAvatar = Boolean(avatarId);
    const engine: VideoEngineId = await selectEngineForScene(scene, hasAvatar);

    logger.info('Engine selected for scene', {
      sceneId: scene.id,
      explicitEngine: scene.engine,
      selectedEngine: engine,
      hasAvatar,
      scriptLength: scene.scriptText?.length ?? 0,
      file: 'scene-generator.ts',
    });

    switch (engine) {
      case 'heygen':
        return await generateWithHeyGen(scene, avatarId, voiceId, aspectRatio, voiceProvider);

      case 'runway':
        return await generateWithRunway(scene, aspectRatio);

      case 'sora':
        // generateWithSora has auto-fallback to Runway on failure
        return await generateWithSora(scene, aspectRatio);

      case 'kling':
      case 'luma':
        return {
          sceneId: scene.id,
          providerVideoId: '',
          provider: engine,
          status: 'failed',
          videoUrl: null,
          thumbnailUrl: null,
          progress: 0,
          error: `${engine === 'kling' ? 'Kling' : 'Luma'} is not yet available. Please select another engine.`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scene generation failed', error as Error, {
      sceneId: scene.id,
      engine: scene.engine ?? 'unknown',
      file: 'scene-generator.ts',
    });

    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: scene.engine ?? 'heygen',
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
 * Poll provider for scene status
 * Maps provider response to our scene status format
 */
export async function pollSceneStatus(
  providerVideoId: string,
  provider: VideoEngineId | null = 'heygen'
): Promise<{
  status: 'generating' | 'completed' | 'failed';
  videoUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
}> {
  const resolvedProvider = provider ?? 'heygen';

  // Only heygen, sora, runway are valid VideoProvider values for status polling
  const validProviders: VideoProvider[] = ['heygen', 'sora', 'runway'];
  if (!validProviders.includes(resolvedProvider as VideoProvider)) {
    return {
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      error: `Status polling not supported for ${resolvedProvider}`,
    };
  }

  try {
    const response = await getVideoStatus(providerVideoId, resolvedProvider as VideoProvider);

    // Map provider status to our scene status
    if (response.status === 'completed') {
      return {
        status: 'completed',
        videoUrl: response.videoUrl ?? null,
        thumbnailUrl: response.thumbnailUrl ?? null,
        error: null,
      };
    } else if (response.status === 'failed') {
      return {
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        error: response.errorMessage ?? 'Video generation failed',
      };
    } else {
      // pending or processing
      return {
        status: 'generating',
        videoUrl: null,
        thumbnailUrl: null,
        error: null,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to poll scene status', error as Error, {
      providerVideoId,
      provider: resolvedProvider,
      file: 'scene-generator.ts',
    });

    return {
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Batch Scene Generation
// ============================================================================

/**
 * Generate all scenes with concurrency limit
 * Processes scenes in batches of 3 to avoid overwhelming the API
 */
export async function generateAllScenes(
  scenes: PipelineScene[],
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio,
  onSceneUpdate?: (result: SceneGenerationResult) => void,
  voiceProvider?: 'heygen' | 'elevenlabs'
): Promise<SceneGenerationResult[]> {
  try {
    const CONCURRENCY = 3;
    const results: SceneGenerationResult[] = [];

    logger.info('Starting batch scene generation', {
      totalScenes: scenes.length,
      concurrency: CONCURRENCY,
      engines: scenes.map((s) => s.engine ?? 'heygen'),
      file: 'scene-generator.ts',
    });

    // Process scenes in batches
    for (let i = 0; i < scenes.length; i += CONCURRENCY) {
      const batch = scenes.slice(i, i + CONCURRENCY);

      logger.info('Processing scene batch', {
        batchNumber: Math.floor(i / CONCURRENCY) + 1,
        batchSize: batch.length,
        file: 'scene-generator.ts',
      });

      const batchResults = await Promise.all(
        batch.map((scene) => generateScene(scene, avatarId, voiceId, aspectRatio, voiceProvider))
      );

      for (const result of batchResults) {
        results.push(result);

        // Call the update callback if provided
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
