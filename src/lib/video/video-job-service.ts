/**
 * Video Job Service
 * Service layer for managing video rendering jobs in Firestore
 *
 * Handles:
 * - Creating video render jobs with real jobIds
 * - Tracking job status (pending, processing, completed, failed)
 * - Persisting job data to Firestore for worker execution
 *
 * Collection: videoJobs (via getSubCollection)
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { v4 as uuidv4 } from 'uuid';
import type { VideoStatus, VideoAspectRatio, VideoResolution, VideoProvider } from '@/types/video';
import { getSubCollection } from '@/lib/firebase/collections';

// =============================================================================
// TYPES
// =============================================================================

export interface VideoJob {
  id: string;
  storyboardId: string;
  createdBy: string;

  // Job configuration
  provider?: VideoProvider;
  aspectRatio?: VideoAspectRatio;
  resolution?: VideoResolution;
  maxDuration?: number;

  // Status tracking
  status: VideoStatus;
  progress: number;
  currentStep?: string;

  // Output
  outputUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;

  // Error handling
  error?: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;

  // Timing
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;

  // Metadata
  metadata?: Record<string, unknown>;
}

export interface CreateVideoJobRequest {
  storyboardId: string;
  createdBy: string;
  provider?: VideoProvider;
  aspectRatio?: VideoAspectRatio;
  resolution?: VideoResolution;
  maxDuration?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateVideoJobRequest {
  status?: VideoStatus;
  progress?: number;
  currentStep?: string;
  outputUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
  error?: string;
  errorCode?: string;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
}

// =============================================================================
// SERVICE
// =============================================================================

const VIDEO_JOBS_COLLECTION = 'videoJobs';

/**
 * Video Job Service
 * Manages video rendering jobs in Firestore
 */
export class VideoJobService {
  /**
   * Get the collection path for video jobs
   */
  private getCollectionPath(): string {
    return getSubCollection(VIDEO_JOBS_COLLECTION);
  }

  /**
   * Create a new video rendering job
   */
  async createJob(request: CreateVideoJobRequest): Promise<VideoJob> {
    const jobId = `job_${uuidv4()}`;
    const now = new Date();

    const job: VideoJob = {
      id: jobId,
      storyboardId: request.storyboardId,
      createdBy: request.createdBy,

      // Configuration
      provider: request.provider,
      aspectRatio: request.aspectRatio ?? '16:9',
      resolution: request.resolution ?? '1080p',
      maxDuration: request.maxDuration,

      // Initial status
      status: 'processing',
      progress: 0,
      currentStep: 'initializing',

      // Error handling
      retryCount: 0,
      maxRetries: 3,

      // Timing
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      estimatedCompletion: new Date(now.getTime() + 10 * 60 * 1000), // 10 min estimate

      // Metadata
      metadata: request.metadata,
    };

    try {
      await FirestoreService.set(
        this.getCollectionPath(),
        jobId,
        job,
        false
      );

      logger.info('VideoJobService: Created video job', {
        jobId,
        storyboardId: request.storyboardId,
        file: 'video-job-service.ts',
      });

      return job;
    } catch (error) {
      logger.error(
        'VideoJobService: Failed to create job',
        error instanceof Error ? error : new Error(String(error)),
        {
          storyboardId: request.storyboardId,
          file: 'video-job-service.ts',
        }
      );
      throw error;
    }
  }

  /**
   * Get a video job by ID
   */
  async getJob(jobId: string): Promise<VideoJob | null> {
    try {
      const job = await FirestoreService.get<VideoJob>(
        this.getCollectionPath(),
        jobId
      );
      return job;
    } catch (error) {
      logger.error(
        'VideoJobService: Failed to get job',
        error instanceof Error ? error : new Error(String(error)),
        {
          jobId,
          file: 'video-job-service.ts',
        }
      );
      return null;
    }
  }

  /**
   * Update a video job
   */
  async updateJob(jobId: string, updates: UpdateVideoJobRequest): Promise<void> {
    try {
      const updateData: Record<string, unknown> = { ...updates };

      // Add completedAt if status is completed or failed
      if (updates.status === 'completed' || updates.status === 'failed') {
        updateData.completedAt = new Date();
      }

      await FirestoreService.update(
        this.getCollectionPath(),
        jobId,
        updateData
      );

      logger.info('VideoJobService: Updated video job', {
        jobId,
        status: updates.status,
        file: 'video-job-service.ts',
      });
    } catch (error) {
      logger.error(
        'VideoJobService: Failed to update job',
        error instanceof Error ? error : new Error(String(error)),
        {
          jobId,
          file: 'video-job-service.ts',
        }
      );
      throw error;
    }
  }

  /**
   * Get all video jobs for the organization
   */
  async getAllJobs(): Promise<VideoJob[]> {
    try {
      const jobs = await FirestoreService.getAll<VideoJob>(
        this.getCollectionPath()
      );
      return jobs;
    } catch (error) {
      logger.error(
        'VideoJobService: Failed to get all jobs',
        error instanceof Error ? error : new Error(String(error)),
        {
          file: 'video-job-service.ts',
        }
      );
      return [];
    }
  }

  /**
   * Get pending/processing jobs for worker execution
   */
  async getPendingJobs(): Promise<VideoJob[]> {
    try {
      const { where } = await import('firebase/firestore');
      const jobs = await FirestoreService.getAll<VideoJob>(
        this.getCollectionPath(),
        [where('status', 'in', ['pending', 'processing'])]
      );
      return jobs;
    } catch (error) {
      logger.error(
        'VideoJobService: Failed to get pending jobs',
        error instanceof Error ? error : new Error(String(error)),
        {
          file: 'video-job-service.ts',
        }
      );
      return [];
    }
  }

  /**
   * Mark job as failed with error details
   */
  async failJob(jobId: string, error: string, errorCode?: string): Promise<void> {
    const job = await this.getJob(jobId);

    if (job && job.retryCount < job.maxRetries) {
      // Retry the job
      await this.updateJob(jobId, {
        status: 'pending',
        error,
        errorCode,
      });
      // Increment retry count manually
      await FirestoreService.update(
        this.getCollectionPath(),
        jobId,
        { retryCount: job.retryCount + 1 }
      );
      logger.info('VideoJobService: Job queued for retry', {
        jobId,
        retryCount: job.retryCount + 1,
        file: 'video-job-service.ts',
      });
    } else {
      // Max retries reached
      await this.updateJob(jobId, {
        status: 'failed',
        error,
        errorCode,
        completedAt: new Date(),
      });
      logger.warn('VideoJobService: Job failed permanently', {
        jobId,
        error,
        file: 'video-job-service.ts',
      });
    }
  }

  /**
   * Mark job as completed with output details
   */
  async completeJob(
    jobId: string,
    output: {
      outputUrl: string;
      thumbnailUrl?: string;
      duration?: number;
      fileSize?: number;
    }
  ): Promise<void> {
    await this.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      ...output,
      completedAt: new Date(),
    });

    logger.info('VideoJobService: Job completed successfully', {
      jobId,
      outputUrl: output.outputUrl,
      file: 'video-job-service.ts',
    });
  }
}

/**
 * Create a VideoJobService instance
 */
export function createVideoJobService(): VideoJobService {
  return new VideoJobService();
}
