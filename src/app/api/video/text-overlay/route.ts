/**
 * POST /api/video/text-overlay
 * Adds text overlays and/or a brand watermark to a video using FFmpeg,
 * uploads the result to Firebase Storage, and returns a signed URL.
 *
 * Supports multiple timed text overlays with configurable position, font size,
 * color, and background. Optionally applies a brand watermark image with
 * configurable position and opacity.
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
  addTextOverlay,
  addWatermark,
  uploadToStorage,
  getStoragePath,
  cleanupWorkDir,
} from '@/lib/video/ffmpeg-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Pro, 60s for Hobby

// ============================================================================
// Validation Schema
// ============================================================================

const TextOverlaySchema = z.object({
  projectId: z.string().min(1),
  videoUrl: z.string().url('Video URL required'),
  overlays: z
    .array(
      z.object({
        text: z.string().min(1),
        position: z.enum(['top', 'bottom', 'center']).default('bottom'),
        fontSize: z.number().default(48),
        fontColor: z.string().default('white'),
        backgroundColor: z.string().default('black@0.5'),
        startTime: z.number(),
        endTime: z.number(),
      }),
    )
    .default([]),
  watermarkUrl: z.string().url().optional(),
  watermarkPosition: z
    .enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
    .default('bottom-right'),
  watermarkOpacity: z.number().min(0).max(1).default(0.7),
});

type TextOverlayInput = z.infer<typeof TextOverlaySchema>;

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
    const parseResult = TextOverlaySchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid text overlay request', {
        errors: parseResult.error.errors.map((e) => e.message),
        file: 'api/video/text-overlay/route.ts',
      });

      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: parseResult.error.errors },
        { status: 400 },
      );
    }

    const {
      projectId,
      videoUrl,
      overlays,
      watermarkUrl,
      watermarkPosition,
      watermarkOpacity,
    }: TextOverlayInput = parseResult.data;

    const hasOverlays = overlays.length > 0;
    const hasWatermark = Boolean(watermarkUrl);

    if (!hasOverlays && !hasWatermark) {
      return NextResponse.json(
        { success: false, error: 'At least one overlay or a watermark URL must be provided' },
        { status: 400 },
      );
    }

    logger.info('Starting video text overlay processing', {
      projectId,
      overlayCount: overlays.length,
      hasWatermark,
      watermarkPosition,
      file: 'api/video/text-overlay/route.ts',
    });

    // Create temp working directory
    workDir = await createWorkDir('textoverlay');

    const inputPath = join(workDir, 'input.mp4');
    const textOutputPath = join(workDir, 'text_overlaid.mp4');
    const finalOutputPath = join(workDir, 'final.mp4');
    const watermarkImagePath = join(workDir, 'watermark.png');

    // Download video (and watermark image if provided) in parallel
    const downloadStart = Date.now();
    const downloads: Promise<void>[] = [downloadVideo(videoUrl, inputPath)];

    if (watermarkUrl) {
      downloads.push(downloadVideo(watermarkUrl, watermarkImagePath));
    }

    await Promise.all(downloads);

    logger.info('Assets downloaded', {
      projectId,
      downloadMs: Date.now() - downloadStart,
      file: 'api/video/text-overlay/route.ts',
    });

    // Determine processing pipeline based on what's requested
    const processStart = Date.now();
    let currentInputPath = inputPath;

    // Step 1: Apply text overlays if any
    if (hasOverlays) {
      const textOutputTarget = hasWatermark ? textOutputPath : finalOutputPath;

      await addTextOverlay(currentInputPath, textOutputTarget, overlays);

      logger.info('Text overlays applied', {
        projectId,
        overlayCount: overlays.length,
        processMs: Date.now() - processStart,
        file: 'api/video/text-overlay/route.ts',
      });

      currentInputPath = textOutputTarget;
    }

    // Step 2: Apply watermark if provided
    if (hasWatermark) {
      await addWatermark(
        currentInputPath,
        watermarkImagePath,
        finalOutputPath,
        watermarkPosition,
        watermarkOpacity,
      );

      logger.info('Watermark applied', {
        projectId,
        watermarkPosition,
        watermarkOpacity,
        processMs: Date.now() - processStart,
        file: 'api/video/text-overlay/route.ts',
      });
    }

    logger.info('Video processing complete', {
      projectId,
      totalProcessMs: Date.now() - processStart,
      file: 'api/video/text-overlay/route.ts',
    });

    // Verify output file exists and is non-empty
    const outputBuffer = await readFile(finalOutputPath);
    if (outputBuffer.length === 0) {
      throw new Error('FFmpeg produced an empty output file');
    }

    // Upload to Firebase Storage
    const uploadStart = Date.now();
    const storagePath = getStoragePath(projectId, 'overlaid');
    const processedVideoUrl = await uploadToStorage(finalOutputPath, storagePath);

    logger.info('Processed video uploaded to Storage', {
      projectId,
      uploadMs: Date.now() - uploadStart,
      fileSizeBytes: outputBuffer.length,
      file: 'api/video/text-overlay/route.ts',
    });

    // Cleanup temp files (non-blocking)
    const cleanupDir = workDir;
    workDir = null; // Prevent double cleanup in catch
    void cleanupWorkDir(cleanupDir);

    return NextResponse.json({
      success: true,
      processedVideoUrl,
    });
  } catch (error) {
    logger.error('Video text overlay processing failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'api/video/text-overlay/route.ts',
    });

    // Cleanup on error (non-blocking)
    if (workDir) {
      void cleanupWorkDir(workDir);
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Video text overlay processing failed' },
      { status: 500 },
    );
  }
}
