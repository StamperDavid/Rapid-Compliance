/**
 * POST /api/video/audio-mix
 * Takes a video URL and a background music URL, mixes them with auto-ducking
 * and LUFS normalization using FFmpeg, uploads the result to Firebase Storage,
 * and returns a signed URL.
 *
 * When ducking is enabled, uses sidechaincompress so the music volume
 * automatically dips when voice is detected in the video's audio track.
 * The final mix is loudness-normalized to the target LUFS.
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
  mixAudioWithDucking,
  runFfmpeg,
  uploadToStorage,
  getStoragePath,
  cleanupWorkDir,
} from '@/lib/video/ffmpeg-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Pro, 60s for Hobby

// ============================================================================
// Validation Schema
// ============================================================================

const AudioMixSchema = z.object({
  projectId: z.string().min(1),
  videoUrl: z.string().url('Video URL required'),
  musicUrl: z.string().url('Music URL required'),
  musicVolume: z.number().min(0).max(1).default(0.15),
  duckingEnabled: z.boolean().default(true),
  duckingThreshold: z.number().default(-20),
  duckingRatio: z.number().default(8),
  targetLUFS: z.number().default(-14),
});

type AudioMixInput = z.infer<typeof AudioMixSchema>;

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
    const parseResult = AudioMixSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid audio mix request', {
        errors: parseResult.error.errors.map((e) => e.message),
        file: 'api/video/audio-mix/route.ts',
      });

      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: parseResult.error.errors },
        { status: 400 },
      );
    }

    const {
      projectId,
      videoUrl,
      musicUrl,
      musicVolume,
      duckingEnabled,
      duckingThreshold,
      duckingRatio,
      targetLUFS,
    }: AudioMixInput = parseResult.data;

    logger.info('Starting audio mix', {
      projectId,
      duckingEnabled,
      musicVolume,
      duckingThreshold,
      duckingRatio,
      targetLUFS,
      file: 'api/video/audio-mix/route.ts',
    });

    // Create temp working directory
    workDir = await createWorkDir('audio-mix');

    const videoPath = join(workDir, 'video.mp4');
    const musicPath = join(workDir, 'music.mp3');
    const outputPath = join(workDir, 'mixed.mp4');

    // Download video and music in parallel
    const downloadStart = Date.now();

    await Promise.all([
      downloadVideo(videoUrl, videoPath),
      downloadVideo(musicUrl, musicPath),
    ]);

    logger.info('Video and music downloaded', {
      projectId,
      downloadMs: Date.now() - downloadStart,
      file: 'api/video/audio-mix/route.ts',
    });

    // Mix audio
    const mixStart = Date.now();

    if (duckingEnabled) {
      // Use sidechaincompress-based ducking with LUFS normalization
      await mixAudioWithDucking(videoPath, musicPath, outputPath, {
        musicVolume,
        duckingThreshold,
        duckingRatio,
        targetLUFS,
      });
    } else {
      // Simple amix without ducking — just mix at the given volume
      const filterComplex = [
        `[0:a]aformat=fltp:44100:stereo[voice]`,
        `[1:a]aformat=fltp:44100:stereo,volume=${musicVolume}[music]`,
        `[voice][music]amix=inputs=2:duration=first:dropout_transition=2[outa]`,
      ].join(';');

      await runFfmpeg([
        '-i', videoPath,
        '-i', musicPath,
        '-filter_complex', filterComplex,
        '-map', '0:v',
        '-map', '[outa]',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-shortest',
        '-y',
        outputPath,
      ]);
    }

    logger.info('Audio mixing complete', {
      projectId,
      duckingEnabled,
      mixMs: Date.now() - mixStart,
      file: 'api/video/audio-mix/route.ts',
    });

    // Verify output file exists and is non-empty
    const outputBuffer = await readFile(outputPath);
    if (outputBuffer.length === 0) {
      throw new Error('FFmpeg produced an empty audio-mix output file');
    }

    // Upload to Firebase Storage
    const uploadStart = Date.now();
    const storagePath = getStoragePath(projectId, 'audio-mixed');
    const mixedVideoUrl = await uploadToStorage(outputPath, storagePath);

    logger.info('Mixed video uploaded to Storage', {
      projectId,
      uploadMs: Date.now() - uploadStart,
      fileSizeBytes: outputBuffer.length,
      file: 'api/video/audio-mix/route.ts',
    });

    // Cleanup temp files (non-blocking)
    const cleanupDir = workDir;
    workDir = null; // Prevent double cleanup in catch
    void cleanupWorkDir(cleanupDir);

    return NextResponse.json({
      success: true,
      mixedVideoUrl,
    });
  } catch (error) {
    logger.error('Audio mixing failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'api/video/audio-mix/route.ts',
    });

    // Cleanup on error (non-blocking)
    if (workDir) {
      void cleanupWorkDir(workDir);
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Audio mixing failed' },
      { status: 500 },
    );
  }
}
