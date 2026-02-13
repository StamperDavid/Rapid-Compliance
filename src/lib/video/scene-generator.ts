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
} from '@/lib/video/video-service';
import type { PipelineScene, SceneGenerationResult, VideoEngineId } from '@/types/video-pipeline';
import type { VideoAspectRatio, VideoGenerationResponse, VideoProvider } from '@/types/video';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if response is a VideoGenerationResponse
 */
function isVideoGenerationResponse(
  response: VideoGenerationResponse | { success: false; status: 'coming_soon'; message: string; expectedLaunch: string }
): response is VideoGenerationResponse {
  return 'status' in response && response.status !== 'coming_soon';
}

// ============================================================================
// Engine-Specific Generators
// ============================================================================

async function generateWithHeyGen(
  scene: PipelineScene,
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio
): Promise<SceneGenerationResult> {
  // Convert 4:3 to 16:9 for HeyGen (HeyGen only supports 16:9, 9:16, 1:1)
  const heygenAspectRatio: '16:9' | '9:16' | '1:1' =
    aspectRatio === '4:3' ? '16:9' : aspectRatio;

  const response = await generateHeyGenSceneVideo(
    scene.scriptText,
    avatarId,
    voiceId,
    scene.screenshotUrl,
    heygenAspectRatio
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
  const runwayAspectRatio = aspectRatio === '4:3' ? '16:9' : aspectRatio;
  const prompt = `${scene.scriptText} [${runwayAspectRatio}]`;

  const response = await generateRunwayVideo('text', prompt, {
    duration: Math.min(scene.duration, 10), // Runway max 10s
  });

  if (!isVideoGenerationResponse(response)) {
    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: 'runway',
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: response.message,
    };
  }

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

  const response = await generateSoraVideo(scene.scriptText, {
    duration: Math.min(scene.duration, 60), // Sora max 60s
    aspectRatio: soraAspectRatio,
  });

  if (!isVideoGenerationResponse(response)) {
    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: 'sora',
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: response.message,
    };
  }

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
}

// ============================================================================
// Scene Generation (Multi-Engine Router)
// ============================================================================

/**
 * Generate a single scene, dispatching to the selected engine.
 * null or 'heygen' → HeyGen path (default)
 * 'runway' → Runway path
 * 'sora' → Sora path
 * 'kling' / 'luma' → returns failed result (not yet available)
 */
export async function generateScene(
  scene: PipelineScene,
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio
): Promise<SceneGenerationResult> {
  const engine: VideoEngineId = scene.engine ?? 'heygen';

  try {
    switch (engine) {
      case 'heygen':
        return await generateWithHeyGen(scene, avatarId, voiceId, aspectRatio);

      case 'runway':
        return await generateWithRunway(scene, aspectRatio);

      case 'sora':
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
      engine,
      file: 'scene-generator.ts',
    });

    return {
      sceneId: scene.id,
      providerVideoId: '',
      provider: engine,
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

    // Type guard: Check if this is a VideoGenerationResponse
    if (!isVideoGenerationResponse(response)) {
      logger.warn('Video status returned coming_soon', {
        providerVideoId,
        provider: resolvedProvider,
        file: 'scene-generator.ts',
      });
      return {
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        error: 'Video service not available',
      };
    }

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
  onSceneUpdate?: (result: SceneGenerationResult) => void
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
        batch.map((scene) => generateScene(scene, avatarId, voiceId, aspectRatio))
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
