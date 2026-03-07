/**
 * POST /api/video/composite
 * Downloads a green-screen avatar video and a background video, runs FFmpeg
 * chroma key compositing via shared utilities, uploads the result to
 * Firebase Storage, and returns a signed URL.
 *
 * Uses @ffmpeg-installer/ffmpeg for the static binary and child_process.spawn
 * to run the colorkey composite operation.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  createWorkDir,
  downloadVideo,
  chromaKeyComposite,
  uploadToStorage,
  getStoragePath,
  cleanupWorkDir,
} from '@/lib/video/ffmpeg-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Pro, 60s for Hobby

// ============================================================================
// Validation Schema
// ============================================================================

const CompositeSchema = z.object({
  projectId: z.string().min(1),
  sceneId: z.string().min(1),
  avatarVideoUrl: z.string().url('Avatar video URL required'),
  backgroundVideoUrl: z.string().url('Background video URL required'),
  outputWidth: z.number().default(1920),
  outputHeight: z.number().default(1080),
  similarity: z.number().min(0).max(1).default(0.3),
  blend: z.number().min(0).max(1).default(0.08),
});

type CompositeInput = z.infer<typeof CompositeSchema>;

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  let workDir: string | null = null;

  try {
    // Auth check
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const parseResult = CompositeSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid video composite request', {
        errors: parseResult.error.errors.map((e) => e.message),
        file: 'api/video/composite/route.ts',
      });

      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: parseResult.error.errors },
        { status: 400 },
      );
    }

    const {
      projectId,
      sceneId,
      avatarVideoUrl,
      backgroundVideoUrl,
      outputWidth,
      outputHeight,
      similarity,
      blend,
    }: CompositeInput = parseResult.data;

    logger.info('Starting video compositing', {
      projectId,
      sceneId,
      outputWidth,
      outputHeight,
      similarity,
      blend,
      file: 'api/video/composite/route.ts',
    });

    // Create temp working directory
    workDir = await createWorkDir('composite');

    const avatarPath = join(workDir, 'avatar.mp4');
    const backgroundPath = join(workDir, 'background.mp4');
    const outputPath = join(workDir, 'composited.mp4');

    // Download both videos in parallel
    const downloadStart = Date.now();

    await Promise.all([
      downloadVideo(avatarVideoUrl, avatarPath),
      downloadVideo(backgroundVideoUrl, backgroundPath),
    ]);

    logger.info('Both videos downloaded', {
      projectId,
      sceneId,
      downloadMs: Date.now() - downloadStart,
      file: 'api/video/composite/route.ts',
    });

    // Run chroma key compositing
    const compositeStart = Date.now();

    await chromaKeyComposite(avatarPath, backgroundPath, outputPath, {
      similarity,
      blend,
      outputWidth,
      outputHeight,
    });

    logger.info('Chroma key compositing complete', {
      projectId,
      sceneId,
      compositeMs: Date.now() - compositeStart,
      file: 'api/video/composite/route.ts',
    });

    // Verify output file exists and is non-empty
    const outputBuffer = await readFile(outputPath);
    if (outputBuffer.length === 0) {
      throw new Error('FFmpeg produced an empty composite output file');
    }

    // Upload to Firebase Storage
    const uploadStart = Date.now();
    const storagePath = getStoragePath(projectId, 'composited');
    const compositedVideoUrl = await uploadToStorage(outputPath, storagePath);

    logger.info('Composited video uploaded to Storage', {
      projectId,
      sceneId,
      uploadMs: Date.now() - uploadStart,
      fileSizeBytes: outputBuffer.length,
      file: 'api/video/composite/route.ts',
    });

    // Cleanup temp files (non-blocking)
    const cleanupDir = workDir;
    workDir = null; // Prevent double cleanup in catch
    void cleanupWorkDir(cleanupDir);

    return NextResponse.json({
      success: true,
      compositedVideoUrl,
      sceneId,
    });
  } catch (error) {
    logger.error('Video compositing failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'api/video/composite/route.ts',
    });

    // Cleanup on error (non-blocking)
    if (workDir) {
      void cleanupWorkDir(workDir);
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Video compositing failed' },
      { status: 500 },
    );
  }
}
