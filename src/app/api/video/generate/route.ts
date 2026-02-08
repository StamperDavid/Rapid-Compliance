/**
 * Video Generation API
 * POST /api/video/generate - Start video generation from approved storyboard
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { executeRenderPipeline } from '@/lib/video/engine/render-pipeline';

const VideoGenerateSchema = z.object({
  storyboardId: z.string().min(1, 'Storyboard ID required'),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    const parseResult = VideoGenerateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { storyboardId } = parseResult.data;

    logger.info('Video API: Starting video generation', {
      storyboardId,
    });

    // Execute the render pipeline
    const result = await executeRenderPipeline(storyboardId);

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      status: result.status,
      message: 'Video generation started. You will be notified when complete.',
      estimatedCompletion: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes estimate
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Video generation API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
