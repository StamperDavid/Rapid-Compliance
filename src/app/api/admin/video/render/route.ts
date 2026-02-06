/**
 * Admin Video Render API
 * POST /api/admin/video/render - Start video rendering from approved storyboard
 * GET /api/admin/video/render - Get video job status
 *
 * This endpoint triggers real video generation jobs that persist to Firestore
 * for worker execution. Replaces mock responses with actual execution logic.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { createVideoJobService } from '@/lib/video/video-job-service';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// =============================================================================
// REQUEST VALIDATION SCHEMAS
// =============================================================================

const VideoRenderRequestSchema = z.object({
  storyboardId: z.string().min(1, 'Storyboard ID is required'),
  provider: z.enum(['heygen', 'sora', 'runway', 'veo', 'kling', 'pika']).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).optional(),
  resolution: z.enum(['720p', '1080p', '4k']).optional(),
  maxDuration: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const GetJobRequestSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
});

// =============================================================================
// POST /api/admin/video/render
// Start video rendering job
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const validation = VideoRenderRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      storyboardId,
      provider,
      aspectRatio,
      resolution,
      maxDuration,
      metadata,
    } = validation.data;

    // PENTHOUSE: Penthouse model - all admins have access to the organization
    // Cross-org access checks removed

    logger.info('[AdminVideoRender] Starting video render job', {
      organizationId: DEFAULT_ORG_ID,
      storyboardId,
      provider,
      adminId: authResult.user.uid,
      file: 'admin/video/render/route.ts',
    });

    // Create video job service for the organization
    const videoJobService = createVideoJobService();

    // Create the video rendering job (persisted to Firestore)
    const job = await videoJobService.createJob({
      storyboardId,
      createdBy: authResult.user.uid,
      provider: provider as 'heygen' | 'sora' | 'runway' | undefined,
      aspectRatio,
      resolution,
      maxDuration,
      metadata: {
        ...metadata,
        initiatedBy: 'admin-dashboard',
        adminEmail: authResult.user.email,
      },
    });

    logger.info('[AdminVideoRender] Video job created successfully', {
      jobId: job.id,
      organizationId: DEFAULT_ORG_ID,
      storyboardId,
      file: 'admin/video/render/route.ts',
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      estimatedCompletion: job.estimatedCompletion?.toISOString(),
      message: 'Video rendering job created. Track progress using jobId.',
    });
  } catch (error: unknown) {
    logger.error(
      '[AdminVideoRender] Unexpected error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'admin/video/render/route.ts' }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/admin/video/render
// Get video job status
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    // Validate query params
    const validation = GetJobRequestSchema.safeParse({ jobId });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { jobId: validJobId } = validation.data;

    // PENTHOUSE: Penthouse model - all admins have access to the organization
    // Cross-org access checks removed

    // Get job status from Firestore
    const videoJobService = createVideoJobService();
    const job = await videoJobService.getJob(validJobId);

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        organizationId: job.organizationId,
        storyboardId: job.storyboardId,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        outputUrl: job.outputUrl,
        thumbnailUrl: job.thumbnailUrl,
        duration: job.duration,
        fileSize: job.fileSize,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        estimatedCompletion: job.estimatedCompletion,
      },
    });
  } catch (error: unknown) {
    logger.error(
      '[AdminVideoRender] GET error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'admin/video/render/route.ts' }
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
