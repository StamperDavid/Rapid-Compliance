import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateScene } from '@/lib/video/scene-generator';
import type { PipelineScene } from '@/types/video-pipeline';

export const dynamic = 'force-dynamic';

const RegenerateSchema = z.object({
  projectId: z.string().min(1),
  sceneId: z.string().min(1),
  scriptText: z.string().min(1),
  screenshotUrl: z.string().nullable().default(null),
  avatarId: z.string().min(1),
  voiceId: z.string().min(1),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).default('16:9'),
  duration: z.number().default(15),
});

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const parseResult = RegenerateSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid regenerate scene request', {
        file: 'regenerate-scene/route.ts',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { projectId, sceneId, scriptText, screenshotUrl, avatarId, voiceId, aspectRatio, duration } = parseResult.data;

    logger.info('Regenerating scene', {
      projectId,
      sceneId,
      avatarId,
      voiceId,
      aspectRatio,
      file: 'regenerate-scene/route.ts',
    });

    // Build a PipelineScene from the request data
    const scene: PipelineScene = {
      id: sceneId,
      sceneNumber: 0, // Not used in generation
      scriptText,
      screenshotUrl,
      avatarId: null,
      voiceId: null,
      duration,
      status: 'approved' as const,
    };

    // Generate the scene
    const result = await generateScene(scene, avatarId, voiceId, aspectRatio);

    logger.info('Scene regeneration completed', {
      projectId,
      sceneId,
      status: result.status,
      file: 'regenerate-scene/route.ts',
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scene regeneration failed', error as Error, {
      file: 'regenerate-scene/route.ts',
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
