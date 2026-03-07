/**
 * POST /api/video/assemble
 * Downloads scene videos, concatenates them with ffmpeg, uploads to Firebase Storage.
 *
 * Upgraded to 1080p output, dynamic xfade offsets (probes actual clip durations),
 * CRF 18 for high quality, and includes audio from scene clips.
 *
 * Uses shared ffmpeg-utils for all video processing operations.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  createWorkDir,
  downloadVideo,
  uploadToStorage,
  cleanupWorkDir,
  buildSmartConcatArgs,
  runFfmpeg,
  getStoragePath,
} from '@/lib/video/ffmpeg-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Pro, 60s for Hobby

// ============================================================================
// Validation Schema
// ============================================================================

const AssembleSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  sceneUrls: z.array(z.string().url()).min(1, 'At least one scene URL required'),
  transitionType: z.enum(['cut', 'fade', 'dissolve']).default('fade'),
  outputResolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
});

const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const jobId = randomUUID().slice(0, 8);
  let workDir = '';

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
        errors: parseResult.error.errors.map((e) => e.message),
        file: 'api/video/assemble/route.ts',
      });

      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: parseResult.error.errors },
        { status: 400 },
      );
    }

    const { projectId, sceneUrls, transitionType, outputResolution } = parseResult.data;
    const { width, height } = RESOLUTION_MAP[outputResolution];

    logger.info('Starting video assembly', {
      projectId,
      sceneCount: sceneUrls.length,
      transitionType,
      outputResolution,
      jobId,
      file: 'api/video/assemble/route.ts',
    });

    // Create temp working directory
    workDir = await createWorkDir('assemble');

    // Download all scene videos in parallel
    const inputPaths: string[] = [];
    const downloadStart = Date.now();

    await Promise.all(
      sceneUrls.map(async (url, index) => {
        const filePath = join(workDir, `scene_${index}.mp4`);
        inputPaths[index] = filePath;
        await downloadVideo(url, filePath);

        logger.info('Scene downloaded', {
          index,
          jobId,
          file: 'api/video/assemble/route.ts',
        });
      }),
    );

    logger.info('All scenes downloaded', {
      jobId,
      downloadMs: Date.now() - downloadStart,
      sceneCount: inputPaths.length,
      file: 'api/video/assemble/route.ts',
    });

    // Build smart concat args with dynamic xfade offsets (probes actual clip durations)
    const outputPath = join(workDir, 'assembled.mp4');
    const ffmpegArgs = await buildSmartConcatArgs(
      inputPaths,
      outputPath,
      transitionType,
      width,
      height,
      18, // CRF 18 for high quality
    );

    const concatStart = Date.now();
    await runFfmpeg(ffmpegArgs);

    logger.info('FFmpeg concatenation complete', {
      jobId,
      concatMs: Date.now() - concatStart,
      file: 'api/video/assemble/route.ts',
    });

    // Read the output file to verify it exists
    const outputBuffer = await readFile(outputPath);
    if (outputBuffer.length === 0) {
      throw new Error('FFmpeg produced an empty output file');
    }

    // Upload to Firebase Storage
    const uploadStart = Date.now();
    const storagePath = getStoragePath(projectId, 'assembled');
    const videoUrl = await uploadToStorage(outputPath, storagePath);

    logger.info('Assembled video uploaded to Storage', {
      jobId,
      uploadMs: Date.now() - uploadStart,
      fileSizeBytes: outputBuffer.length,
      outputResolution,
      file: 'api/video/assemble/route.ts',
    });

    // Cleanup temp files (non-blocking)
    void cleanupWorkDir(workDir);

    return NextResponse.json({
      success: true,
      videoUrl,
      sceneCount: sceneUrls.length,
      transitionType,
      outputResolution,
      fileSizeBytes: outputBuffer.length,
      assemblyMode: 'ffmpeg-smart-concat',
    });
  } catch (error) {
    logger.error('Video assembly failed', error as Error, {
      jobId,
      file: 'api/video/assemble/route.ts',
    });

    // Cleanup on error (non-blocking)
    if (workDir) {
      void cleanupWorkDir(workDir);
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Video assembly failed' },
      { status: 500 },
    );
  }
}
