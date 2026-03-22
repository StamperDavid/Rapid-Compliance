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
import { adminStorage, adminDb } from '@/lib/firebase/admin';
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
  addWatermark,
} from '@/lib/video/ffmpeg-utils';
import { getHedraVideoStatus } from '@/lib/video/hedra-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getBrandKit } from '@/lib/video/brand-kit-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Pro, 60s for Hobby

// ============================================================================
// Validation Schema
// ============================================================================

const AssembleSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  // Accept either direct URLs or Hedra generation IDs (preferred — resolves fresh URLs)
  sceneUrls: z.array(z.string().url()).optional(),
  providerVideoIds: z.array(z.string().min(1)).optional(),
  transitionType: z.enum(['cut', 'fade', 'dissolve']).default('fade'),
  outputResolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
}).refine(
  (data) => {
    const hasUrls = (data.sceneUrls?.length ?? 0) > 0;
    const hasIds = (data.providerVideoIds?.length ?? 0) > 0;
    return hasUrls || hasIds;
  },
  { message: 'Either sceneUrls or providerVideoIds required' },
);

// ============================================================================
// Progress Tracking
// ============================================================================

async function writeProgress(
  projectId: string,
  phase: string,
  phaseLabel: string,
  phaseIndex: number,
  totalPhases: number,
  extra?: Record<string, string>,
): Promise<void> {
  if (!adminDb) { return; }
  try {
    await adminDb
      .collection('organizations')
      .doc(PLATFORM_ID)
      .collection('assembly_progress')
      .doc(projectId)
      .set({
        phase,
        phaseLabel,
        phaseIndex,
        totalPhases,
        updatedAt: new Date().toISOString(),
        ...extra,
      });
  } catch {
    // Non-critical — don't fail assembly if progress write fails
  }
}

async function clearProgress(projectId: string): Promise<void> {
  if (!adminDb) { return; }
  try {
    await adminDb
      .collection('organizations')
      .doc(PLATFORM_ID)
      .collection('assembly_progress')
      .doc(projectId)
      .delete();
  } catch {
    // Non-critical
  }
}

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
    // Guard: Firebase Storage must be available before doing any CPU/network work.
    // If it is null the upload step will fail after minutes of ffmpeg work — fail fast instead.
    if (!adminStorage) {
      logger.error(
        'Video assembly aborted: Firebase Storage is not initialized',
        new Error('adminStorage is null'),
        { jobId, file: 'api/video/assemble/route.ts' },
      );
      return NextResponse.json(
        {
          success: false,
          error:
            'Storage service unavailable. Check FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_ADMIN_* env vars in Vercel.',
        },
        { status: 503 },
      );
    }

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

    const { projectId, transitionType, outputResolution } = parseResult.data;
    const { width, height } = RESOLUTION_MAP[outputResolution];

    // Resolve scene URLs — prefer providerVideoIds (always-fresh Hedra URLs)
    let sceneUrls: string[];

    if (parseResult.data.providerVideoIds && parseResult.data.providerVideoIds.length > 0) {
      logger.info('Resolving fresh Hedra URLs from providerVideoIds', {
        count: parseResult.data.providerVideoIds.length,
        jobId,
        file: 'api/video/assemble/route.ts',
      });

      const resolved = await Promise.all(
        parseResult.data.providerVideoIds.map(async (genId) => {
          const status = await getHedraVideoStatus(genId);
          if (status.status !== 'completed' || !status.videoUrl) {
            throw new Error(`Video ${genId.slice(0, 8)}... is not ready (status: ${status.status})`);
          }
          return status.videoUrl;
        }),
      );
      sceneUrls = resolved;
    } else {
      sceneUrls = parseResult.data.sceneUrls ?? [];
    }

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

    // Write initial progress
    await writeProgress(projectId, 'downloading', `Downloading scenes (0/${sceneUrls.length})`, 0, 4);

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

    await writeProgress(projectId, 'probing', 'Probing scene durations', 1, 4);

    // Build smart concat args with dynamic xfade offsets (probes actual clip durations)
    logger.info('Building FFmpeg args (probing clip durations)...', {
      jobId,
      transitionType,
      outputResolution,
      file: 'api/video/assemble/route.ts',
    });

    const outputPath = join(workDir, 'assembled.mp4');
    const ffmpegArgs = await buildSmartConcatArgs(
      inputPaths,
      outputPath,
      transitionType,
      width,
      height,
      18, // CRF 18 for high quality
    );

    logger.info('Running FFmpeg concatenation...', {
      jobId,
      argCount: ffmpegArgs.length,
      file: 'api/video/assemble/route.ts',
    });

    await writeProgress(projectId, 'stitching', 'Stitching video with transitions', 2, 4);

    const concatStart = Date.now();
    await runFfmpeg(ffmpegArgs);

    logger.info('FFmpeg concatenation complete', {
      jobId,
      concatMs: Date.now() - concatStart,
      file: 'api/video/assemble/route.ts',
    });

    // ── Brand Kit: Logo Watermark ───────────────────────────────────────────
    // Apply logo watermark if brand kit is enabled and has a logo configured.
    // Downloads the logo, overlays it on the assembled video via FFmpeg.
    let finalOutputPath = outputPath;

    try {
      const brandKit = await getBrandKit();
      if (brandKit.enabled && brandKit.logo?.url) {
        logger.info('Applying brand kit logo watermark', {
          jobId,
          position: brandKit.logo.position,
          opacity: brandKit.logo.opacity,
          scale: brandKit.logo.scale,
          file: 'api/video/assemble/route.ts',
        });

        const logoPath = join(workDir, 'brand_logo.png');
        await downloadVideo(brandKit.logo.url, logoPath);

        const brandedPath = join(workDir, 'assembled_branded.mp4');
        await addWatermark(
          outputPath,
          logoPath,
          brandedPath,
          brandKit.logo.position,
          brandKit.logo.opacity,
          brandKit.logo.scale,
        );

        finalOutputPath = brandedPath;
        logger.info('Brand kit logo watermark applied', { jobId, file: 'api/video/assemble/route.ts' });
      }
    } catch (brandError) {
      // Brand kit is non-critical — proceed without watermark if it fails
      logger.warn('Brand kit watermark failed, proceeding without', {
        jobId,
        error: brandError instanceof Error ? brandError.message : 'Unknown',
        file: 'api/video/assemble/route.ts',
      });
    }

    // Read the output file to verify it exists
    const outputBuffer = await readFile(finalOutputPath);
    if (outputBuffer.length === 0) {
      throw new Error('FFmpeg produced an empty output file');
    }

    await writeProgress(projectId, 'uploading', 'Uploading final video', 3, 4);

    // Upload to Firebase Storage
    logger.info('Uploading assembled video to Firebase Storage...', {
      jobId,
      fileSizeBytes: outputBuffer.length,
      file: 'api/video/assemble/route.ts',
    });

    const uploadStart = Date.now();
    const storagePath = getStoragePath(projectId, 'assembled');
    const videoUrl = await uploadToStorage(finalOutputPath, storagePath);

    logger.info('Assembled video uploaded to Storage', {
      jobId,
      uploadMs: Date.now() - uploadStart,
      fileSizeBytes: outputBuffer.length,
      outputResolution,
      file: 'api/video/assemble/route.ts',
    });

    // Cleanup temp files and progress doc (non-blocking)
    void cleanupWorkDir(workDir);
    void clearProgress(projectId);

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
