/**
 * Scene-by-scene HeyGen Bridge Service
 * Handles scene generation, polling, and batch processing for video pipeline
 */

import { logger } from '@/lib/logger/logger';
import { generateHeyGenSceneVideo, getVideoStatus } from '@/lib/video/video-service';
import type { PipelineScene, SceneGenerationResult } from '@/types/video-pipeline';
import type { VideoAspectRatio, VideoGenerationResponse } from '@/types/video';

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
// Scene Generation
// ============================================================================

/**
 * Generate a single scene with HeyGen
 * Converts aspect ratio and calls HeyGen API
 */
export async function generateScene(
  scene: PipelineScene,
  avatarId: string,
  voiceId: string,
  aspectRatio: VideoAspectRatio
): Promise<SceneGenerationResult> {
  try {
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

    logger.info('Scene generation started', {
      sceneId: scene.id,
      heygenVideoId: response.id,
      file: 'scene-generator.ts',
    });

    return {
      sceneId: scene.id,
      heygenVideoId: response.id,
      status: 'generating',
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scene generation failed', error as Error, {
      sceneId: scene.id,
      file: 'scene-generator.ts',
    });

    return {
      sceneId: scene.id,
      heygenVideoId: '',
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
 * Poll HeyGen for scene status
 * Maps HeyGen response to our scene status format
 */
export async function pollSceneStatus(
  heygenVideoId: string
): Promise<{
  status: 'generating' | 'completed' | 'failed';
  videoUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
}> {
  try {
    const response = await getVideoStatus(heygenVideoId, 'heygen');

    // Type guard: Check if this is a VideoGenerationResponse
    if (!isVideoGenerationResponse(response)) {
      // Coming soon response
      logger.warn('HeyGen video status returned coming_soon', {
        heygenVideoId,
        file: 'scene-generator.ts',
      });
      return {
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        error: 'Video service not available',
      };
    }

    // Map HeyGen status to our scene status
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
      heygenVideoId,
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
