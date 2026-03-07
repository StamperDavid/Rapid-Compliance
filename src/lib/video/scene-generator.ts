/**
 * Multi-Engine Scene Generator
 * Routes scene generation to the selected video engine (HeyGen, Runway, Sora)
 * and handles polling and batch processing for the video pipeline
 */

import { logger } from '@/lib/logger/logger';
import {
  generateHeyGenSceneVideo,
  generateHeyGenGreenScreenVideo,
  generateRunwayVideo,
  generateSoraVideo,
  getVideoStatus,
  getVideoProviderKey,
} from '@/lib/video/video-service';
import {
  generateKlingTextToVideo,
  getKlingVideoStatus,
} from '@/lib/video/fal-kling-service';
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
  voiceProvider?: 'heygen' | 'elevenlabs' | 'unrealspeech' | 'custom'
): Promise<SceneGenerationResult> {
  // Validate avatar ID — HeyGen returns 404 "avatar look not found" if empty
  if (!avatarId) {
    throw new Error('No avatar selected. Go back to Pre-Production and choose an avatar.');
  }

  // Convert 4:3 to 16:9 for HeyGen (HeyGen only supports 16:9, 9:16, 1:1)
  const heygenAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  // Use scene-level script; if B-roll (empty script), send a minimal placeholder
  // so HeyGen doesn't error. The avatar will appear briefly with no speech.
  const script = scene.scriptText.trim() || ' ';

  // If using ElevenLabs voice, pre-synthesize audio and pass to HeyGen
  // Retries up to 3 times with backoff for rate limits / transient failures
  let audioUrl: string | null = null;
  if (voiceProvider === 'elevenlabs' && script.length > 1) {
    const MAX_TTS_RETRIES = 3;
    let lastTtsError: string | null = null;

    for (let attempt = 1; attempt <= MAX_TTS_RETRIES; attempt++) {
      try {
        const { ElevenLabsProvider } = await import('@/lib/voice/tts/providers/elevenlabs-provider');
        const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
        const { PLATFORM_ID } = await import('@/lib/constants/platform');
        const rawKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'elevenlabs');
        const apiKey = typeof rawKey === 'string' ? rawKey : null;

        if (!apiKey) {
          lastTtsError = 'ElevenLabs API key not configured';
          break; // No point retrying without a key
        }

        const provider = new ElevenLabsProvider(apiKey);
        const ttsResult = await provider.synthesize(script, voiceId);

        // Store audio as base64 in Firestore, serve via public API endpoint
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

          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rapidcompliance.us';
          audioUrl = `${appUrl}/api/video/tts-audio/${audioId}`;

          logger.info('ElevenLabs audio synthesized and stored', {
            sceneId: scene.id,
            audioId,
            attempt,
            file: 'scene-generator.ts',
          });
        }
        break; // Success — exit retry loop
      } catch (ttsError) {
        lastTtsError = ttsError instanceof Error ? ttsError.message : String(ttsError);
        logger.warn(`ElevenLabs TTS attempt ${attempt}/${MAX_TTS_RETRIES} failed`, {
          sceneId: scene.id,
          attempt,
          error: lastTtsError,
          file: 'scene-generator.ts',
        });

        if (attempt < MAX_TTS_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = 1000 * Math.pow(2, attempt - 1);
          await new Promise<void>(resolve => { setTimeout(resolve, delayMs); });
        }
      }
    }

    // If ElevenLabs failed after all retries, fail the scene entirely.
    // Never swap in a different voice — the user's custom voice is their identity.
    if (!audioUrl) {
      const errorDetail = lastTtsError ?? 'Unknown ElevenLabs error';
      logger.error('ElevenLabs TTS failed after all retries — failing scene', new Error(errorDetail), {
        sceneId: scene.id,
        file: 'scene-generator.ts',
      });

      return {
        sceneId: scene.id,
        providerVideoId: '',
        provider: 'heygen',
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        progress: 0,
        error: `Voice synthesis failed: ${errorDetail}. Retry the scene or check your ElevenLabs API key.`,
      };
    }
  }

  // === Cinematic Two-Track Compositing (default for avatar scenes) ===
  // If a background description exists AND a video engine is available,
  // generate the avatar on green screen + AI video background in parallel.
  // This produces broadcast-quality composited video.
  const backgroundDescription = scene.backgroundPrompt?.trim() ?? scene.visualDescription?.trim();
  const providers = await getAvailableProviders();
  const hasVideoBackgroundEngine = providers.runway || providers.sora || providers.kling;

  if (backgroundDescription && hasVideoBackgroundEngine) {
    // Select best available engine for background video generation
    const bgEngine = selectBackgroundEngine(providers, scene);

    logger.info('Cinematic two-track generation: green screen avatar + AI video background', {
      sceneId: scene.id,
      avatarEngine: 'heygen',
      backgroundEngine: bgEngine,
      backgroundPrompt: backgroundDescription.slice(0, 80),
      file: 'scene-generator.ts',
    });

    // Track 1: HeyGen avatar with green screen background
    const avatarResponse = await generateHeyGenGreenScreenVideo(
      script,
      avatarId,
      voiceId,
      heygenAspectRatio,
      audioUrl,
    );

    // Track 2: AI background video from scene description
    let backgroundVideoId = '';
    let backgroundProvider: VideoEngineId = bgEngine;

    try {
      if (bgEngine === 'kling') {
        const klingAspectRatio: '16:9' | '9:16' | '1:1' = heygenAspectRatio;
        const klingDuration: '5' | '10' = scene.duration > 7 ? '10' : '5';
        const bgResponse = await generateKlingTextToVideo(backgroundDescription, {
          duration: klingDuration,
          aspectRatio: klingAspectRatio,
        });
        backgroundVideoId = `${bgResponse.requestId}|${bgResponse.model}`;
        backgroundProvider = 'kling';
      } else if (bgEngine === 'sora') {
        const bgResponse = await generateSoraVideo(backgroundDescription, {
          duration: Math.min(scene.duration, 16),
          aspectRatio: heygenAspectRatio,
        });
        backgroundVideoId = bgResponse.id;
        backgroundProvider = 'sora';
      } else {
        // Default to Runway (best cinematic quality)
        const bgResponse = await generateRunwayVideo('text', backgroundDescription, {
          duration: Math.min(scene.duration, 10),
          ratio: heygenAspectRatio,
        });
        backgroundVideoId = bgResponse.id;
        backgroundProvider = 'runway';
      }
    } catch (bgError) {
      logger.warn('Background video generation failed — avatar will composite without video BG', {
        sceneId: scene.id,
        bgEngine,
        error: bgError instanceof Error ? bgError.message : String(bgError),
        file: 'scene-generator.ts',
      });
      // Avatar video still generates — compositing can use a fallback
    }

    logger.info('Two-track generation started', {
      sceneId: scene.id,
      avatarVideoId: avatarResponse.id,
      backgroundVideoId,
      backgroundProvider,
      file: 'scene-generator.ts',
    });

    return {
      sceneId: scene.id,
      providerVideoId: avatarResponse.id,
      provider: 'heygen',
      status: 'generating',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: null,
      backgroundVideoId: backgroundVideoId || null,
      backgroundVideoUrl: null,
      backgroundProvider,
      compositedVideoUrl: null,
      compositeStatus: backgroundVideoId ? 'pending' : null,
    };
  }

  // === Fallback: Static Background ===
  // Only used when no video engine is available for backgrounds.
  // Generates a DALL-E still image behind the avatar.
  let backgroundUrl = scene.screenshotUrl;
  if (!backgroundUrl && backgroundDescription) {
    try {
      const dalleSize = heygenAspectRatio === '9:16' ? '1024x1792' as const
        : heygenAspectRatio === '1:1' ? '1024x1024' as const
        : '1792x1024' as const;

      logger.info('No video engine available — generating DALL-E still background', {
        sceneId: scene.id,
        size: dalleSize,
        file: 'scene-generator.ts',
      });

      const result = await generateImage(backgroundDescription, {
        size: dalleSize,
        quality: 'standard',
        style: 'natural',
      });
      backgroundUrl = result.url;
    } catch (bgError) {
      logger.warn('DALL-E background generation failed, using solid color fallback', {
        sceneId: scene.id,
        error: bgError instanceof Error ? bgError.message : String(bgError),
        file: 'scene-generator.ts',
      });
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

  logger.info('HeyGen scene generation started (static background fallback)', {
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

async function generateWithKling(
  scene: PipelineScene,
  aspectRatio: VideoAspectRatio
): Promise<SceneGenerationResult> {
  const klingAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  // Determine prompt from scene data
  const prompt = ((): string => {
    const script = scene.scriptText.trim();
    if (script) { return script; }
    const bg = scene.backgroundPrompt?.trim();
    if (bg) { return bg; }
    const vis = scene.visualDescription?.trim();
    if (vis) { return vis; }
    return 'Cinematic footage';
  })();

  // Kling supports 5s or 10s durations
  const duration: '5' | '10' = scene.duration > 7 ? '10' : '5';

  const response = await generateKlingTextToVideo(prompt, {
    duration,
    aspectRatio: klingAspectRatio,
  });

  logger.info('Kling scene generation started', {
    sceneId: scene.id,
    requestId: response.requestId,
    model: response.model,
    file: 'scene-generator.ts',
  });

  // Store the model in providerVideoId as "requestId|model" so polling knows which endpoint
  return {
    sceneId: scene.id,
    providerVideoId: `${response.requestId}|${response.model}`,
    provider: 'kling',
    status: 'generating',
    videoUrl: null,
    thumbnailUrl: null,
    progress: 0,
    error: null,
  };
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

  const [heygen, sora, runway, kling] = await Promise.all([
    getVideoProviderKey('heygen').then((k) => k !== null),
    getVideoProviderKey('sora').then((k) => k !== null),
    getVideoProviderKey('runway').then((k) => k !== null),
    getVideoProviderKey('fal').then((k) => k !== null), // fal.ai key powers Kling
  ]);

  const result = { heygen, sora, runway, kling };
  Object.assign(providerCache, { data: result, timestamp: Date.now() });

  logger.info('Video provider availability check', {
    heygen, sora, runway, kling,
    file: 'scene-generator.ts',
  });

  return result;
}

/**
 * Determine whether a scene needs a talking avatar or is purely visual.
 * Avatar scenes → HeyGen (green screen avatar composited over AI video background)
 * Visual/B-roll scenes → Runway, Kling, or Sora (cinematic generation, no avatar)
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

  // Scenes explicitly tagged as visual-only via keywords in title or visual description
  const visualKeywords = ['b-roll', 'broll', 'transition', 'montage', 'aerial', 'landscape', 'cinematic shot', 'establishing shot', 'close-up', 'product shot'];
  const searchText = [
    scene.title ?? '',
    scene.visualDescription ?? '',
    scene.scriptText ?? '',
  ].join(' ').toLowerCase();

  if (visualKeywords.some((kw) => searchText.includes(kw))) {
    return false;
  }

  // Empty or very short script with no speech → visual scene
  if (scriptLength === 0) {
    return false;
  }

  return true;
}

/**
 * Select the best video engine for generating the BACKGROUND video
 * in two-track compositing mode (avatar on green screen + AI video background).
 *
 * Priority: Runway (best cinematic quality) > Kling (character consistency) > Sora (fallback)
 */
function selectBackgroundEngine(
  providers: Record<string, boolean>,
  scene: PipelineScene,
): VideoEngineId {
  // If scene explicitly specifies a background engine, respect it
  if (scene.backgroundEngine) {
    return scene.backgroundEngine;
  }

  // Analyze scene description to pick best engine
  const description = [
    scene.backgroundPrompt ?? '',
    scene.visualDescription ?? '',
  ].join(' ').toLowerCase();

  // Kling excels at character consistency and full-body motion
  const klingKeywords = ['character', 'person walking', 'full body', 'people', 'crowd', 'action'];
  const preferKling = klingKeywords.some((kw) => description.includes(kw));

  if (preferKling && providers.kling) {
    return 'kling';
  }

  // Default priority: Runway (best cinematic quality) > Kling > Sora
  if (providers.runway) { return 'runway'; }
  if (providers.kling) { return 'kling'; }
  if (providers.sora) { return 'sora'; }

  // Fallback — will be caught by the caller
  return 'runway';
}

/**
 * Select the best engine for a scene based on content analysis and provider availability.
 *
 * Strategy:
 * - Avatar scenes (talking head with script) → HeyGen (green screen + compositing)
 * - Visual/cinematic B-roll scenes → Runway (best quality) > Kling > Sora
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
    // Avatar scenes: HeyGen handles the avatar (green screen),
    // background engine is selected separately in generateWithHeyGen()
    if (providers.heygen) { return 'heygen'; }
    // No avatar provider available — fall back to text-to-video
    if (providers.runway) { return 'runway'; }
    if (providers.kling) { return 'kling'; }
    if (providers.sora) { return 'sora'; }
    return 'heygen'; // Will fail with a clear "not configured" error
  }

  // Visual/cinematic B-roll scenes: prefer Runway > Kling > Sora
  if (providers.runway) { return 'runway'; }
  if (providers.kling) { return 'kling'; }
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
  voiceProvider?: 'heygen' | 'elevenlabs' | 'unrealspeech' | 'custom'
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
        return await generateWithKling(scene, aspectRatio);

      case 'luma':
        return {
          sceneId: scene.id,
          providerVideoId: '',
          provider: engine,
          status: 'failed',
          videoUrl: null,
          thumbnailUrl: null,
          progress: 0,
          error: 'Luma is not yet available. Please select another engine.',
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

  // Kling uses fal.ai queue API — providerVideoId format: "requestId|model"
  if (resolvedProvider === 'kling') {
    const [requestId, model] = providerVideoId.split('|');
    if (!requestId || !model) {
      return {
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        error: 'Invalid Kling provider video ID format',
      };
    }

    try {
      const klingStatus = await getKlingVideoStatus(requestId, model);

      if (klingStatus.status === 'completed') {
        return {
          status: 'completed',
          videoUrl: klingStatus.videoUrl,
          thumbnailUrl: null,
          error: null,
        };
      } else if (klingStatus.status === 'failed') {
        return {
          status: 'failed',
          videoUrl: null,
          thumbnailUrl: null,
          error: klingStatus.error ?? 'Kling video generation failed',
        };
      } else {
        return {
          status: 'generating',
          videoUrl: null,
          thumbnailUrl: null,
          error: null,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to poll Kling scene status', error as Error, {
        requestId,
        model,
        file: 'scene-generator.ts',
      });
      return { status: 'failed', videoUrl: null, thumbnailUrl: null, error: errorMessage };
    }
  }

  // HeyGen, Sora, Runway use the standard video-service polling
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
  voiceProvider?: 'heygen' | 'elevenlabs' | 'unrealspeech' | 'custom'
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

      // Stagger scene starts by 1.5s each to avoid ElevenLabs rate limits
      // when multiple scenes need TTS simultaneously
      const batchResults = await Promise.all(
        batch.map(async (scene, batchIndex) => {
          if (batchIndex > 0 && voiceProvider === 'elevenlabs') {
            await new Promise<void>(resolve => { setTimeout(resolve, batchIndex * 1500); });
          }
          return generateScene(scene, avatarId, voiceId, aspectRatio, voiceProvider);
        })
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
