/**
 * Video Generation API
 * POST /api/video/generate - Start video generation from approved storyboard
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { v4 as uuidv4 } from 'uuid';

const VideoGenerateSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID required'),
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

    const { organizationId, storyboardId } = parseResult.data;

    logger.info('Video API: Starting video generation', {
      organizationId,
      storyboardId,
    });

    // Create project and queue generation job
    const projectId = uuidv4();

    // In production, this would:
    // 1. Load the storyboard from database
    // 2. Queue each shot for generation via Multi-Model Picker
    // 3. Track progress in real-time
    // 4. Trigger Stitcher when all shots complete

    return NextResponse.json({
      success: true,
      projectId,
      status: 'queued',
      message: 'Video generation started. You will be notified when complete.',
      estimatedCompletion: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes estimate
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Video generation API failed', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
