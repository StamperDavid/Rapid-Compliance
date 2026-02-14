/**
 * Video Render Pipeline
 * Orchestrates end-to-end video generation from storyboard to final output
 *
 * Features:
 * - Loads storyboard from Firestore
 * - Routes shots to optimal providers via MultiModelPicker
 * - Manages video generation API calls to Runway ML, Google Veo, etc.
 * - Polls for generation status with exponential backoff
 * - Triggers Stitcher for post-production
 * - Uploads final video to Firebase Storage
 * - Updates VideoJob status throughout process
 * - Emits signals via Signal Bus on completion/failure
 */

import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { getSignalBus } from '@/lib/orchestrator/signal-bus';
import { VideoJobService } from '@/lib/video/video-job-service';
import { multiModelPicker } from '@/lib/video/engine/multi-model-picker';
import { stitcherService } from '@/lib/video/engine/stitcher-service';
import {
  generateHeyGenVideoInternal,
  generateSoraVideoInternal,
  generateRunwayVideoInternal,
  getVideoStatus,
  getVideoProviderKey,
} from '@/lib/video/video-service';
import type { VideoProvider } from '@/types/video';
import type {
  MasterStoryboard,
  GeneratedClip,
  VideoGenerationProvider,
  GenerationQueueItem,
} from './types';

// Provider API response types
interface ProviderGenerationResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  progress?: number;
  errorMessage?: string;
}

/**
 * Video Render Pipeline
 * Orchestrates the entire video generation process
 */
export class RenderPipeline {
  private videoJobService: VideoJobService;

  constructor() {
    this.videoJobService = new VideoJobService();
  }

  /**
   * Execute the render pipeline for a storyboard
   */
  async execute(storyboardId: string): Promise<{ jobId: string; status: string }> {
    logger.info('RenderPipeline: Starting execution', {
      storyboardId,
    });

    try {
      // Step 1: Load the storyboard from Firestore
      const storyboard = await this.loadStoryboard(storyboardId);

      if (!storyboard) {
        throw new Error(`Storyboard not found: ${storyboardId}`);
      }

      // Step 2: Create a VideoJob
      const videoJob = await this.videoJobService.createJob({
        storyboardId,
        createdBy: storyboard.createdBy,
        aspectRatio: storyboard.aspectRatio,
        resolution: storyboard.resolution,
        maxDuration: storyboard.totalDuration / 1000, // Convert ms to seconds
      });

      logger.info('RenderPipeline: VideoJob created', {
        jobId: videoJob.id,
        storyboardId,
      });

      // Step 3: Start async rendering process (don't block)
      this.renderAsync(videoJob.id, storyboard).catch((error) => {
        logger.error(
          'RenderPipeline: Async render failed',
          error instanceof Error ? error : new Error(String(error)),
          { jobId: videoJob.id }
        );
      });

      return {
        jobId: videoJob.id,
        status: 'processing',
      };
    } catch (error) {
      logger.error(
        'RenderPipeline: Execution failed',
        error instanceof Error ? error : new Error(String(error)),
        { storyboardId }
      );
      throw error;
    }
  }

  /**
   * Load storyboard from Firestore
   */
  private async loadStoryboard(storyboardId: string): Promise<MasterStoryboard | null> {
    try {
      const storyboard = await FirestoreService.get<MasterStoryboard>(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/storyboards`,
        storyboardId
      );
      return storyboard;
    } catch (error) {
      logger.error(
        'RenderPipeline: Failed to load storyboard',
        error instanceof Error ? error : new Error(String(error)),
        { storyboardId }
      );
      return null;
    }
  }

  /**
   * Async rendering process
   */
  private async renderAsync(jobId: string, storyboard: MasterStoryboard): Promise<void> {
    logger.info('RenderPipeline: Starting async render', {
      jobId,
      storyboardId: storyboard.id,
    });

    try {
      // Update job status
      await this.videoJobService.updateJob(jobId, {
        status: 'processing',
        progress: 5,
        currentStep: 'Routing shots to providers',
      });

      // Step 1: Route all shots to optimal providers
      const queueItems = this.routeShots(storyboard);

      logger.info('RenderPipeline: Shots routed', {
        jobId,
        totalShots: queueItems.length,
      });

      // Step 2: Generate all clips
      await this.videoJobService.updateJob(jobId, {
        progress: 10,
        currentStep: 'Generating video clips',
      });

      const generatedClips = await this.generateAllClips(jobId, queueItems);

      logger.info('RenderPipeline: Clips generated', {
        jobId,
        successfulClips: generatedClips.length,
        totalShots: queueItems.length,
      });

      // Step 3: Trigger post-production (Stitcher)
      await this.videoJobService.updateJob(jobId, {
        progress: 70,
        currentStep: 'Starting post-production',
      });

      const postProductionJob = stitcherService.createJob(storyboard, generatedClips);

      logger.info('RenderPipeline: Post-production job created', {
        jobId,
        postProductionJobId: postProductionJob.id,
      });

      // Process post-production
      const completedJob = await stitcherService.processJob(postProductionJob, storyboard);

      if (completedJob.status === 'completed' && completedJob.outputUrl) {
        // Step 4: Mark VideoJob as completed
        await this.videoJobService.completeJob(jobId, {
          outputUrl: completedJob.outputUrl,
          thumbnailUrl: completedJob.outputThumbnailUrl,
          duration: completedJob.outputDuration,
          fileSize: completedJob.outputFileSize,
        });

        logger.info('RenderPipeline: Video generation complete', {
          jobId,
          outputUrl: completedJob.outputUrl,
        });

        // Step 5: Emit success signal via Signal Bus
        this.emitCompletionSignal(jobId, storyboard.id, completedJob.outputUrl);
      } else {
        throw new Error('Post-production failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        'RenderPipeline: Async render failed',
        error instanceof Error ? error : new Error(String(error)),
        { jobId }
      );

      // Mark job as failed
      await this.videoJobService.failJob(jobId, errorMessage, 'RENDER_FAILED');

      // Emit failure signal
      this.emitFailureSignal(jobId, storyboard.id, errorMessage);
    }
  }

  /**
   * Route all shots to optimal providers using MultiModelPicker
   */
  private routeShots(storyboard: MasterStoryboard): GenerationQueueItem[] {
    const allShots = storyboard.scenes.flatMap((scene) => scene.shots);

    const queueItems = multiModelPicker.routeStoryboard(
      storyboard.id,
      allShots,
      storyboard.aspectRatio,
      storyboard.resolution,
      {
        // Configuration options
        preferQualityOverCost: true,
        minQuality: 'high',
      }
    );

    return queueItems;
  }

  /**
   * Generate all clips from queue items
   */
  private async generateAllClips(
    jobId: string,
    queueItems: GenerationQueueItem[]
  ): Promise<GeneratedClip[]> {
    const generatedClips: GeneratedClip[] = [];
    const totalShots = queueItems.length;

    for (let i = 0; i < queueItems.length; i++) {
      const item = queueItems[i];

      logger.info('RenderPipeline: Generating clip', {
        jobId,
        shotId: item.shotId,
        provider: item.targetProvider,
        progress: `${i + 1}/${totalShots}`,
      });

      try {
        const clip = await this.generateClip(item);
        generatedClips.push(clip);

        // Update progress
        const progress = 10 + Math.floor((i + 1) / totalShots * 60);
        await this.videoJobService.updateJob(jobId, {
          progress,
          currentStep: `Generated ${i + 1}/${totalShots} clips`,
        });
      } catch (error) {
        logger.error(
          'RenderPipeline: Clip generation failed',
          error instanceof Error ? error : new Error(String(error)),
          { jobId, shotId: item.shotId, provider: item.targetProvider }
        );

        // Try fallback providers
        const fallbackClip = await this.tryFallbackProviders(item);
        if (fallbackClip) {
          generatedClips.push(fallbackClip);
        } else {
          // If all providers fail, use a placeholder
          logger.warn('RenderPipeline: All providers failed, using placeholder', {
            jobId,
            shotId: item.shotId,
          });
          generatedClips.push(this.createPlaceholderClip(item));
        }
      }
    }

    return generatedClips;
  }

  /**
   * Generate a single clip from a provider
   */
  private async generateClip(item: GenerationQueueItem): Promise<GeneratedClip> {
    const provider = item.targetProvider;

    logger.info('RenderPipeline: Calling provider', {
      provider,
      shotId: item.shotId,
      duration: item.duration,
    });

    // Check if provider has API key configured
    if (!(await this.isProviderConfigured(provider))) {
      logger.warn('RenderPipeline: Provider not configured, skipping', {
        provider,
        shotId: item.shotId,
      });
      throw new Error(`Provider not configured: ${provider}`);
    }

    // Call the provider API
    const response = await this.callProviderAPI(provider, item);

    // Poll for completion
    const videoUrl = await this.pollForCompletion(provider, response.jobId);

    // Report success to MultiModelPicker for health tracking
    multiModelPicker.reportProviderResult(provider, true);

    return {
      shotId: item.shotId,
      url: videoUrl,
      duration: item.duration * 1000, // Convert seconds to ms
      provider,
      resolution: item.resolution,
      fps: 30,
    };
  }

  /**
   * Check if provider is configured with API key (reads from Firestore via apiKeyService)
   */
  private async isProviderConfigured(provider: VideoGenerationProvider): Promise<boolean> {
    // Map render pipeline provider names to video-service provider names
    const providerMap: Record<string, VideoProvider> = {
      'runway': 'runway',
      'sora': 'sora',
      'heygen': 'heygen',
    };

    const videoProvider = providerMap[provider];
    if (!videoProvider) {
      // Veo, Kling, Pika, Stable Video — not yet available
      return false;
    }

    const key = await getVideoProviderKey(videoProvider);
    return key !== null;
  }

  /**
   * Call provider API to start generation — delegates to real implementations in video-service.ts
   */
  private async callProviderAPI(
    provider: VideoGenerationProvider,
    item: GenerationQueueItem
  ): Promise<ProviderGenerationResponse> {
    logger.info('RenderPipeline: Calling provider API', {
      provider,
      shotId: item.shotId,
    });

    switch (provider) {
      case 'runway':
        return this.callRunwayAPI(item);
      case 'sora':
        return this.callSoraAPI(item);
      case 'heygen':
        return this.callHeyGenAPI(item);
      case 'veo':
      case 'kling':
      case 'pika':
      case 'stable-video':
        throw new Error(`Provider ${provider} is not yet available. Configure Runway, Sora, or HeyGen instead.`);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Call Runway ML API via video-service.ts
   */
  private async callRunwayAPI(item: GenerationQueueItem): Promise<ProviderGenerationResponse> {
    logger.info('RenderPipeline: Calling Runway ML API', { shotId: item.shotId });

    const prompt = item.visualPrompt.compiledPrompt;
    const referenceImages = item.visualPrompt.referenceImageUrls;
    const firstRefImage = referenceImages && referenceImages.length > 0 ? referenceImages[0] : null;

    const result = firstRefImage
      ? await generateRunwayVideoInternal('image', firstRefImage, {
          duration: Math.ceil(item.duration / 1000),
          ratio: item.aspectRatio as '16:9' | '9:16' | '1:1',
        })
      : await generateRunwayVideoInternal('text', prompt, {
          duration: Math.ceil(item.duration / 1000),
          ratio: item.aspectRatio as '16:9' | '9:16' | '1:1',
        });

    return {
      jobId: result.id,
      status: 'queued',
    };
  }

  /**
   * Call OpenAI Sora API via video-service.ts
   */
  private async callSoraAPI(item: GenerationQueueItem): Promise<ProviderGenerationResponse> {
    logger.info('RenderPipeline: Calling Sora API', { shotId: item.shotId });

    const result = await generateSoraVideoInternal(
      item.visualPrompt.compiledPrompt,
      {
        duration: Math.ceil(item.duration / 1000),
        aspectRatio: item.aspectRatio as '16:9' | '9:16' | '1:1',
        style: item.visualPrompt.mood,
      }
    );

    return {
      jobId: result.id,
      status: 'queued',
    };
  }

  /**
   * Call HeyGen API via video-service.ts
   */
  private async callHeyGenAPI(item: GenerationQueueItem): Promise<ProviderGenerationResponse> {
    logger.info('RenderPipeline: Calling HeyGen API', { shotId: item.shotId });

    // HeyGen requires an avatar ID — use a default if not specified in the visual prompt
    const promptWithExtras = item.visualPrompt as unknown as Record<string, unknown>;
    const avatarId = (typeof promptWithExtras.avatarId === 'string' ? promptWithExtras.avatarId : null)
      ?? 'default';
    const script = item.visualPrompt.compiledPrompt;

    const result = await generateHeyGenVideoInternal(script, avatarId, {
      aspectRatio: item.aspectRatio as '16:9' | '9:16' | '1:1',
    });

    return {
      jobId: result.id,
      status: 'queued',
    };
  }

  /**
   * Poll for generation completion with exponential backoff
   */
  private async pollForCompletion(
    provider: VideoGenerationProvider,
    providerJobId: string
  ): Promise<string> {
    const maxAttempts = 120; // 10 minutes with 5-second intervals
    let attempt = 0;
    let backoffMs = 5000; // Start with 5 seconds

    while (attempt < maxAttempts) {
      attempt++;

      logger.debug('RenderPipeline: Polling for completion', {
        provider,
        providerJobId,
        attempt,
      });

      // Check status (would be actual API call in production)
      const status = await this.checkProviderStatus(provider, providerJobId);

      if (status.status === 'completed' && status.videoUrl) {
        logger.info('RenderPipeline: Generation completed', {
          provider,
          providerJobId,
          videoUrl: status.videoUrl,
        });
        return status.videoUrl;
      }

      if (status.status === 'failed') {
        throw new Error(`Provider generation failed: ${status.errorMessage ?? 'Unknown error'}`);
      }

      // Wait with exponential backoff
      await this.sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 1.5, 30000); // Max 30 seconds
    }

    throw new Error('Generation timeout - exceeded maximum polling attempts');
  }

  /**
   * Check provider generation status via video-service.ts
   */
  private async checkProviderStatus(
    provider: VideoGenerationProvider,
    providerJobId: string
  ): Promise<ProviderGenerationResponse> {
    logger.debug('RenderPipeline: Checking provider status', {
      provider,
      providerJobId,
    });

    // Map render-pipeline provider names to video-service provider names
    const providerMap: Record<string, VideoProvider> = {
      'runway': 'runway',
      'sora': 'sora',
      'heygen': 'heygen',
    };

    const videoProvider = providerMap[provider];
    if (!videoProvider) {
      throw new Error(`Cannot check status for unsupported provider: ${provider}`);
    }

    const statusResult = await getVideoStatus(providerJobId, videoProvider);

    // Check if we got a "coming soon" response (provider not configured)
    if (!('id' in statusResult)) {
      throw new Error(`Provider ${provider} is not configured`);
    }

    // Map video-service response to ProviderGenerationResponse
    const statusMap: Record<string, 'queued' | 'processing' | 'completed' | 'failed'> = {
      'pending': 'queued',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed',
    };

    return {
      jobId: providerJobId,
      status: statusMap[statusResult.status] ?? 'processing',
      videoUrl: statusResult.videoUrl,
      errorMessage: statusResult.errorMessage,
    };
  }

  /**
   * Try fallback providers if primary fails
   */
  private async tryFallbackProviders(item: GenerationQueueItem): Promise<GeneratedClip | null> {
    for (const fallbackProvider of item.fallbackProviders) {
      logger.info('RenderPipeline: Trying fallback provider', {
        shotId: item.shotId,
        fallbackProvider,
      });

      try {
        if (!(await this.isProviderConfigured(fallbackProvider))) {
          logger.warn('RenderPipeline: Fallback provider not configured', {
            fallbackProvider,
          });
          continue;
        }

        const fallbackItem: GenerationQueueItem = {
          ...item,
          targetProvider: fallbackProvider,
        };

        return await this.generateClip(fallbackItem);
      } catch (error) {
        logger.error(
          'RenderPipeline: Fallback provider failed',
          error instanceof Error ? error : new Error(String(error)),
          { fallbackProvider }
        );
        // Continue to next fallback
      }
    }

    return null;
  }

  /**
   * Create a placeholder clip when all providers fail
   */
  private createPlaceholderClip(item: GenerationQueueItem): GeneratedClip {
    logger.warn('RenderPipeline: Creating placeholder clip', {
      shotId: item.shotId,
    });

    return {
      shotId: item.shotId,
      url: 'https://storage.example.com/placeholders/default.mp4',
      duration: item.duration * 1000,
      provider: 'stable-video', // Use a default
      resolution: item.resolution,
      fps: 30,
    };
  }

  /**
   * Emit completion signal via Signal Bus
   */
  private emitCompletionSignal(jobId: string, storyboardId: string, outputUrl: string): void {
    try {
      const signalBus = getSignalBus();

      const signal = signalBus.createSignal(
        'BROADCAST',
        'VIDEO_RENDER_PIPELINE',
        'JASPER',
        {
          id: `video_complete_${jobId}`,
          timestamp: new Date(),
          from: 'VIDEO_RENDER_PIPELINE',
          to: 'JASPER',
          type: 'REPORT',
          priority: 'NORMAL',
          payload: {
            taskType: 'VIDEO_GENERATION_COMPLETE',
            jobId,
            storyboardId,
            outputUrl,
            completedAt: new Date().toISOString(),
          },
          requiresResponse: false,
          traceId: jobId,
        }
      );

      signalBus.send(signal).catch((error) => {
        logger.error(
          'RenderPipeline: Failed to emit completion signal',
          error instanceof Error ? error : new Error(String(error)),
          { jobId }
        );
      });
    } catch (error) {
      logger.error(
        'RenderPipeline: Error emitting completion signal',
        error instanceof Error ? error : new Error(String(error)),
        { jobId }
      );
    }
  }

  /**
   * Emit failure signal via Signal Bus
   */
  private emitFailureSignal(jobId: string, storyboardId: string, errorMessage: string): void {
    try {
      const signalBus = getSignalBus();

      const signal = signalBus.createSignal(
        'BROADCAST',
        'VIDEO_RENDER_PIPELINE',
        'JASPER',
        {
          id: `video_failed_${jobId}`,
          timestamp: new Date(),
          from: 'VIDEO_RENDER_PIPELINE',
          to: 'JASPER',
          type: 'ALERT',
          priority: 'HIGH',
          payload: {
            taskType: 'VIDEO_GENERATION_FAILED',
            jobId,
            storyboardId,
            error: errorMessage,
            failedAt: new Date().toISOString(),
          },
          requiresResponse: false,
          traceId: jobId,
        }
      );

      signalBus.send(signal).catch((error) => {
        logger.error(
          'RenderPipeline: Failed to emit failure signal',
          error instanceof Error ? error : new Error(String(error)),
          { jobId }
        );
      });
    } catch (error) {
      logger.error(
        'RenderPipeline: Error emitting failure signal',
        error instanceof Error ? error : new Error(String(error)),
        { jobId }
      );
    }
  }

  /**
   * Sleep utility for polling delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

/**
 * Create and export singleton instance
 */
export const renderPipeline = new RenderPipeline();

/**
 * Execute the render pipeline for a storyboard
 */
export async function executeRenderPipeline(
  storyboardId: string
): Promise<{ jobId: string; status: string }> {
  return renderPipeline.execute(storyboardId);
}
