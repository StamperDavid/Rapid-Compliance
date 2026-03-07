/**
 * POST /api/video/color-grade
 * Applies color grading to a video using FFmpeg eq/colorbalance filters,
 * uploads the result to Firebase Storage, and returns a signed URL.
 *
 * Supports preset-based grading (6 built-in presets) or custom parameter
 * overrides for contrast, saturation, brightness, gamma, and temperature.
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
  applyColorGrade,
  uploadToStorage,
  getStoragePath,
  cleanupWorkDir,
  COLOR_GRADE_PRESETS,
  type ColorGradeParams,
} from '@/lib/video/ffmpeg-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Pro, 60s for Hobby

// ============================================================================
// Validation Schema
// ============================================================================

const ColorGradeSchema = z.object({
  projectId: z.string().min(1),
  videoUrl: z.string().url('Video URL required'),
  preset: z
    .enum([
      'corporate-clean',
      'golden-warmth',
      'cinema-contrast',
      'vibrant-pop',
      'soft-pastel',
      'tech-modern',
    ])
    .default('corporate-clean'),
  customParams: z
    .object({
      contrast: z.number().min(0.5).max(2.0).default(1.0),
      saturation: z.number().min(0).max(2.0).default(1.0),
      brightness: z.number().min(-1).max(1).default(0),
      gamma: z.number().min(0.5).max(2.0).default(1.0),
      temperature: z.number().min(-100).max(100).default(0),
    })
    .optional(),
});

type ColorGradeInput = z.infer<typeof ColorGradeSchema>;

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
    const parseResult = ColorGradeSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid color grade request', {
        errors: parseResult.error.errors.map((e) => e.message),
        file: 'api/video/color-grade/route.ts',
      });

      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: parseResult.error.errors },
        { status: 400 },
      );
    }

    const { projectId, videoUrl, preset, customParams }: ColorGradeInput = parseResult.data;

    // Determine grading params: customParams take priority over preset
    const gradeParams: ColorGradeParams | string = customParams
      ? {
          contrast: customParams.contrast,
          saturation: customParams.saturation,
          brightness: customParams.brightness,
          gamma: customParams.gamma,
          temperature: customParams.temperature,
        }
      : preset;

    const activePreset = customParams ? 'custom' : preset;

    logger.info('Starting video color grading', {
      projectId,
      preset: activePreset,
      hasCustomParams: Boolean(customParams),
      file: 'api/video/color-grade/route.ts',
    });

    // Verify preset exists when using preset mode (defensive check)
    if (!customParams && !COLOR_GRADE_PRESETS[preset]) {
      return NextResponse.json(
        { success: false, error: `Unknown preset: ${preset}` },
        { status: 400 },
      );
    }

    // Create temp working directory
    workDir = await createWorkDir('colorgrade');

    const inputPath = join(workDir, 'input.mp4');
    const outputPath = join(workDir, 'graded.mp4');

    // Download source video
    const downloadStart = Date.now();
    await downloadVideo(videoUrl, inputPath);

    logger.info('Source video downloaded', {
      projectId,
      downloadMs: Date.now() - downloadStart,
      file: 'api/video/color-grade/route.ts',
    });

    // Apply color grading via FFmpeg
    const gradeStart = Date.now();
    await applyColorGrade(inputPath, outputPath, gradeParams);

    logger.info('Color grading complete', {
      projectId,
      preset: activePreset,
      gradeMs: Date.now() - gradeStart,
      file: 'api/video/color-grade/route.ts',
    });

    // Verify output file exists and is non-empty
    const outputBuffer = await readFile(outputPath);
    if (outputBuffer.length === 0) {
      throw new Error('FFmpeg produced an empty color-graded output file');
    }

    // Upload to Firebase Storage
    const uploadStart = Date.now();
    const storagePath = getStoragePath(projectId, 'color-graded');
    const gradedVideoUrl = await uploadToStorage(outputPath, storagePath);

    logger.info('Color-graded video uploaded to Storage', {
      projectId,
      preset: activePreset,
      uploadMs: Date.now() - uploadStart,
      fileSizeBytes: outputBuffer.length,
      file: 'api/video/color-grade/route.ts',
    });

    // Cleanup temp files (non-blocking)
    const cleanupDir = workDir;
    workDir = null; // Prevent double cleanup in catch
    void cleanupWorkDir(cleanupDir);

    return NextResponse.json({
      success: true,
      gradedVideoUrl,
      preset: activePreset,
    });
  } catch (error) {
    logger.error('Video color grading failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'api/video/color-grade/route.ts',
    });

    // Cleanup on error (non-blocking)
    if (workDir) {
      void cleanupWorkDir(workDir);
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Video color grading failed' },
      { status: 500 },
    );
  }
}
