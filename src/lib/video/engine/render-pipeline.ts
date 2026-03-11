/**
 * Video Render Pipeline
 *
 * Legacy render pipeline retained for the /api/video/generate endpoint.
 * Actual video generation is now handled by Hedra via scene-generator.ts
 * and the /api/video/generate-scenes + /api/video/poll-scenes routes.
 *
 * This pipeline loads a storyboard from Firestore, creates a VideoJob,
 * and triggers post-production (stitching) once clips are available.
 */

import { logger } from '@/lib/logger/logger';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { getSignalBus } from '@/lib/orchestrator/signal-bus';
import { VideoJobService } from '@/lib/video/video-job-service';
import { stitcherService } from '@/lib/video/engine/stitcher-service';
import type { MasterStoryboard, GeneratedClip } from './types';

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
    logger.info('RenderPipeline: Starting execution', { storyboardId });

    try {
      const storyboard = await this.loadStoryboard(storyboardId);
      if (!storyboard) {
        throw new Error(`Storyboard not found: ${storyboardId}`);
      }

      const videoJob = await this.videoJobService.createJob({
        storyboardId,
        createdBy: storyboard.createdBy,
        aspectRatio: storyboard.aspectRatio,
        resolution: storyboard.resolution,
        maxDuration: storyboard.totalDuration / 1000,
      });

      logger.info('RenderPipeline: VideoJob created', {
        jobId: videoJob.id,
        storyboardId,
      });

      this.renderAsync(videoJob.id, storyboard).catch((error) => {
        logger.error(
          'RenderPipeline: Async render failed',
          error instanceof Error ? error : new Error(String(error)),
          { jobId: videoJob.id }
        );
      });

      return { jobId: videoJob.id, status: 'processing' };
    } catch (error) {
      logger.error(
        'RenderPipeline: Execution failed',
        error instanceof Error ? error : new Error(String(error)),
        { storyboardId }
      );
      throw error;
    }
  }

  private async loadStoryboard(storyboardId: string): Promise<MasterStoryboard | null> {
    try {
      return await FirestoreService.get<MasterStoryboard>(
        getSubCollection('storyboards'),
        storyboardId
      );
    } catch (error) {
      logger.error(
        'RenderPipeline: Failed to load storyboard',
        error instanceof Error ? error : new Error(String(error)),
        { storyboardId }
      );
      return null;
    }
  }

  private async renderAsync(jobId: string, storyboard: MasterStoryboard): Promise<void> {
    logger.info('RenderPipeline: Starting async render', {
      jobId,
      storyboardId: storyboard.id,
    });

    try {
      await this.videoJobService.updateJob(jobId, {
        status: 'processing',
        progress: 10,
        currentStep: 'Generating video clips via Hedra',
      });

      // Hedra generation is handled by scene-generator.ts and the API routes.
      // This pipeline currently has no clips to stitch — it serves as the
      // job creation + signal emission layer for the /api/video/generate endpoint.
      const generatedClips: GeneratedClip[] = [];

      await this.videoJobService.updateJob(jobId, {
        progress: 70,
        currentStep: 'Starting post-production',
      });

      const postProductionJob = stitcherService.createJob(storyboard, generatedClips);
      const completedJob = await stitcherService.processJob(postProductionJob, storyboard);

      if (completedJob.status === 'completed' && completedJob.outputUrl) {
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

      await this.videoJobService.failJob(jobId, errorMessage, 'RENDER_FAILED');
      this.emitFailureSignal(jobId, storyboard.id, errorMessage);
    }
  }

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
}

export const renderPipeline = new RenderPipeline();

export async function executeRenderPipeline(
  storyboardId: string
): Promise<{ jobId: string; status: string }> {
  return renderPipeline.execute(storyboardId);
}
