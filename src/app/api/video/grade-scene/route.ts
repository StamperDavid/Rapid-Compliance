/**
 * Scene Auto-Grade API
 *
 * POST — Downloads a generated video, extracts audio, transcribes it via Deepgram,
 *        and grades the transcription against the original script.
 *
 * Runs asynchronously — the client fires this after seeing a scene complete;
 * it does NOT block the polling loop.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  downloadVideo,
  cleanupFiles,
  extractAudioFromVideo,
  cleanupWorkDir,
} from '@/lib/video/ffmpeg-utils';
import { transcribeAudio } from '@/lib/video/transcription-service';
import { gradeScene } from '@/lib/video/scene-grading-service';

export const dynamic = 'force-dynamic';

const GradeSceneSchema = z.object({
  sceneId: z.string().min(1),
  projectId: z.string().min(1),
  providerVideoId: z.string().min(1),
  videoUrl: z.string().url(),
  originalScript: z.string().default(''),
  videoDuration: z.number().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parseResult = GradeSceneSchema.safeParse(body);

    if (!parseResult.success) {
      const zodErrors = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { success: false, error: `Invalid request: ${zodErrors}` },
        { status: 400 },
      );
    }

    const { sceneId, projectId, videoUrl, originalScript, videoDuration } = parseResult.data;

    logger.info('Starting scene auto-grade', {
      sceneId,
      projectId,
      videoDuration,
      scriptLength: originalScript.length,
      file: 'grade-scene/route.ts',
    });

    // Create temp working directory
    const workDir = join(tmpdir(), `grade-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    const videoPath = join(workDir, 'scene.mp4');
    let audioPath: string | null = null;

    try {
      // Step 1: Download video
      await downloadVideo(videoUrl, videoPath);

      // Step 2: Extract audio
      audioPath = await extractAudioFromVideo(videoPath);

      // Step 3: Transcribe
      const transcription = await transcribeAudio(audioPath);

      if (!transcription) {
        logger.warn('Transcription unavailable — returning partial grade', {
          sceneId,
          file: 'grade-scene/route.ts',
        });
        return NextResponse.json({
          success: true,
          autoGrade: null,
          reason:
            'Transcription service unavailable (Deepgram key not configured or transcription failed)',
        });
      }

      // Step 4: Grade
      const autoGrade = gradeScene(originalScript, transcription, videoDuration);

      logger.info('Scene auto-grade complete', {
        sceneId,
        scriptAccuracy: autoGrade.scriptAccuracy,
        overallScore: autoGrade.overallScore,
        pacingScore: autoGrade.pacingScore,
        file: 'grade-scene/route.ts',
      });

      return NextResponse.json({
        success: true,
        autoGrade,
      });
    } finally {
      // Cleanup temp files, then the working directory
      const filesToClean = [videoPath];
      if (audioPath !== null) {
        filesToClean.push(audioPath);
      }
      await cleanupFiles(...filesToClean);
      await cleanupWorkDir(workDir);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Scene auto-grade failed',
      error instanceof Error ? error : new Error(errorMessage),
      {
        file: 'grade-scene/route.ts',
      },
    );

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
