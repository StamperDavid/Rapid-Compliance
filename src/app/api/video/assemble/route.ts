/**
 * POST /api/video/assemble
 * Assembles multiple scene URLs into a sequential playback playlist
 *
 * Since ffmpeg is not available in serverless environments, this endpoint
 * returns the scene URLs for client-side sequential playback. Server-side
 * video stitching will be available in future updates.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schema
// ============================================================================

const AssembleSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  sceneUrls: z.array(z.string().url()).min(1, 'At least one scene URL required'),
  transitionType: z.enum(['cut', 'fade', 'dissolve']).default('fade'),
});

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const parseResult = AssembleSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid video assembly request', {
        file: 'api/video/assemble/route.ts',
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { projectId, sceneUrls, transitionType } = parseResult.data;

    logger.info('Assembling video scenes for sequential playback', {
      file: 'api/video/assemble/route.ts',
      projectId,
      sceneCount: sceneUrls.length,
      transitionType,
    });

    // Calculate total estimated duration (assume ~15s per scene if not known)
    const estimatedDuration = sceneUrls.length * 15;

    // Return scene URLs for sequential playback
    // In a future update, this could invoke ffmpeg for server-side stitching
    return NextResponse.json({
      success: true,
      videoUrl: sceneUrls[0], // Primary: first scene as the "assembled" video
      sceneUrls, // Full ordered list for sequential playback
      duration: estimatedDuration,
      assemblyMode: 'sequential-playback' as const, // Indicates client-side sequential playback
      transitionType,
      message:
        'Scenes assembled for sequential playback. Server-side stitching with ffmpeg available in future update.',
    });
  } catch (error) {
    logger.error('Failed to assemble video', error as Error, {
      file: 'api/video/assemble/route.ts',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to assemble video scenes',
      },
      { status: 500 }
    );
  }
}
