/**
 * POST /api/video/assemble
 * Downloads scene videos, concatenates them with ffmpeg, uploads to Firebase Storage.
 *
 * Uses @ffmpeg-installer/ffmpeg for the static binary and child_process.spawn
 * to run the concat operation. Works on Vercel serverless (Lambda) and local dev.
 *
 * For Sora videos: the videoUrl may be an OpenAI /content endpoint requiring
 * an Authorization header — we download through our own proxy in that case.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminStorage } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { getVideoProviderKey } from '@/lib/video/video-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Pro, 60s for Hobby

// ============================================================================
// Validation Schema
// ============================================================================

const AssembleSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  sceneUrls: z.array(z.string().url()).min(1, 'At least one scene URL required'),
  transitionType: z.enum(['cut', 'fade', 'dissolve']).default('fade'),
});

// ============================================================================
// Helpers
// ============================================================================

/**
 * Download a video file, handling auth headers for provider-specific URLs
 */
async function downloadVideo(url: string, destPath: string): Promise<void> {
  const headers: Record<string, string> = {};

  // Sora content URLs require OpenAI auth
  if (url.includes('api.openai.com/v1/videos/')) {
    const apiKey = await getVideoProviderKey('sora');
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  const response = await fetch(url, {
    headers,
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, buffer);
}

/**
 * Get the ffmpeg binary path from @ffmpeg-installer/ffmpeg
 */
function getFfmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const installer = require('@ffmpeg-installer/ffmpeg') as { path: string };
  return installer.path;
}

/**
 * Run ffmpeg with the given arguments, returning a promise
 */
function runFfmpeg(ffmpegPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stderr);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg spawn error: ${err.message}`));
    });
  });
}

/**
 * Build ffmpeg args for concatenation with optional transitions
 */
function buildConcatArgs(
  inputPaths: string[],
  outputPath: string,
  transitionType: 'cut' | 'fade' | 'dissolve',
): string[] {
  if (transitionType === 'cut' || inputPaths.length === 1) {
    // Simple concat demuxer — fastest, no re-encode needed for same-format inputs
    // But since scene videos may have different codecs/sizes, we use the filter approach
    const filterParts: string[] = [];
    const args: string[] = [];

    for (let i = 0; i < inputPaths.length; i++) {
      args.push('-i', inputPaths[i]);
      // Scale all inputs to 1280x720, pad if needed, set framerate
      filterParts.push(
        `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`
      );
    }

    // Concat all video streams
    const concatInputs = inputPaths.map((_, i) => `[v${i}]`).join('');
    filterParts.push(`${concatInputs}concat=n=${inputPaths.length}:v=1:a=0[outv]`);

    args.push(
      '-filter_complex', filterParts.join(';'),
      '-map', '[outv]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    );

    return args;
  }

  // Fade/dissolve transitions — crossfade between clips
  const fadeDuration = 0.5; // 0.5s crossfade
  const args: string[] = [];
  const filterParts: string[] = [];

  for (let i = 0; i < inputPaths.length; i++) {
    args.push('-i', inputPaths[i]);
    filterParts.push(
      `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`
    );
  }

  // Chain xfade filters between consecutive clips
  if (inputPaths.length === 2) {
    const xfadeType = transitionType === 'dissolve' ? 'dissolve' : 'fade';
    filterParts.push(
      `[v0][v1]xfade=transition=${xfadeType}:duration=${fadeDuration}:offset=4[outv]`
    );
  } else {
    // For 3+ clips, chain xfade filters
    let prevLabel = 'v0';
    for (let i = 1; i < inputPaths.length; i++) {
      const xfadeType = transitionType === 'dissolve' ? 'dissolve' : 'fade';
      const outLabel = i === inputPaths.length - 1 ? 'outv' : `xf${i}`;
      // offset is approximate — we don't know exact durations, use 4s as default
      filterParts.push(
        `[${prevLabel}][v${i}]xfade=transition=${xfadeType}:duration=${fadeDuration}:offset=${i * 4}[${outLabel}]`
      );
      prevLabel = outLabel;
    }
  }

  args.push(
    '-filter_complex', filterParts.join(';'),
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  );

  return args;
}

/**
 * Upload a file to Firebase Storage and return a signed URL
 */
async function uploadToStorage(
  filePath: string,
  projectId: string,
): Promise<string> {
  if (!adminStorage) {
    throw new Error('Firebase Storage not initialized');
  }

  const bucket = adminStorage.bucket();
  const storagePath = `organizations/${PLATFORM_ID}/videos/${projectId}/assembled_${Date.now()}.mp4`;

  await bucket.upload(filePath, {
    destination: storagePath,
    metadata: {
      contentType: 'video/mp4',
      metadata: {
        projectId,
        assembledAt: new Date().toISOString(),
      },
    },
  });

  const file = bucket.file(storagePath);
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return signedUrl;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const jobId = randomUUID().slice(0, 8);
  const workDir = join(tmpdir(), `video-assemble-${jobId}`);

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

    const { projectId, sceneUrls, transitionType } = parseResult.data;

    logger.info('Starting video assembly', {
      projectId,
      sceneCount: sceneUrls.length,
      transitionType,
      jobId,
      file: 'api/video/assemble/route.ts',
    });

    // Create temp working directory
    await mkdir(workDir, { recursive: true });

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

    // Run ffmpeg to concatenate
    const outputPath = join(workDir, 'assembled.mp4');
    const ffmpegPath = getFfmpegPath();
    const ffmpegArgs = buildConcatArgs(inputPaths, outputPath, transitionType);

    const concatStart = Date.now();
    await runFfmpeg(ffmpegPath, ffmpegArgs);

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
    const videoUrl = await uploadToStorage(outputPath, projectId);

    logger.info('Assembled video uploaded to Storage', {
      jobId,
      uploadMs: Date.now() - uploadStart,
      fileSizeBytes: outputBuffer.length,
      file: 'api/video/assemble/route.ts',
    });

    // Cleanup temp files (non-blocking)
    void cleanupWorkDir(workDir, inputPaths, outputPath);

    return NextResponse.json({
      success: true,
      videoUrl,
      sceneCount: sceneUrls.length,
      transitionType,
      fileSizeBytes: outputBuffer.length,
      assemblyMode: 'ffmpeg-concat',
    });
  } catch (error) {
    logger.error('Video assembly failed', error as Error, {
      jobId,
      file: 'api/video/assemble/route.ts',
    });

    // Cleanup on error (non-blocking)
    void cleanupWorkDir(workDir, [], '');

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Video assembly failed' },
      { status: 500 },
    );
  }
}

/**
 * Clean up temp files after assembly
 */
async function cleanupWorkDir(
  workDir: string,
  inputPaths: string[],
  outputPath: string,
): Promise<void> {
  try {
    for (const p of inputPaths) {
      await unlink(p).catch(() => { /* ignore */ });
    }
    if (outputPath) {
      await unlink(outputPath).catch(() => { /* ignore */ });
    }
    // rmdir only works on empty dirs, but we've deleted the files
    const { rmdir } = await import('fs/promises');
    await rmdir(workDir).catch(() => { /* ignore */ });
  } catch {
    // Temp cleanup is best-effort
  }
}
