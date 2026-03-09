import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateAllScenes } from '@/lib/video/scene-generator';
import type { PipelineScene } from '@/types/video-pipeline';

export const dynamic = 'force-dynamic';

const GenerateScenesSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  scenes: z.array(z.object({
    id: z.string(),
    sceneNumber: z.number(),
    scriptText: z.string(),
    screenshotUrl: z.string().nullable(),
    duration: z.number(),
    engine: z.enum(['hedra']).nullable().default(null),
    backgroundPrompt: z.string().nullable().default(null),
    visualDescription: z.string().nullable().default(null),
    title: z.string().nullable().default(null),
  })),
  avatarId: z.string().default(''),
  voiceId: z.string().default(''),
  voiceProvider: z.enum(['elevenlabs', 'unrealspeech', 'custom']).default('elevenlabs'),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).default('16:9'),
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
    const parseResult = GenerateScenesSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid generate scenes request', {
        file: 'generate-scenes/route.ts',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { projectId, scenes, avatarId, voiceId, voiceProvider, aspectRatio } = parseResult.data;

    logger.info('Starting scene generation', {
      projectId,
      sceneCount: scenes.length,
      avatarId,
      voiceId,
      voiceProvider,
      aspectRatio,
      file: 'generate-scenes/route.ts',
    });

    // Map input scenes to PipelineScene format
    const pipelineScenes: PipelineScene[] = scenes.map((scene) => ({
      id: scene.id,
      sceneNumber: scene.sceneNumber,
      title: scene.title ?? undefined,
      scriptText: scene.scriptText,
      visualDescription: scene.visualDescription ?? undefined,
      screenshotUrl: scene.screenshotUrl,
      duration: scene.duration,
      avatarId: null,
      voiceId: null,
      engine: scene.engine ?? null,
      backgroundPrompt: scene.backgroundPrompt ?? null,
      status: 'approved' as const,
    }));

    // Generate all scenes (passes voiceProvider for ElevenLabs pre-synthesis)
    const results = await generateAllScenes(pipelineScenes, avatarId, voiceId, aspectRatio, undefined, voiceProvider);

    logger.info('Scene generation completed', {
      projectId,
      totalScenes: results.length,
      successCount: results.filter((r) => r.status !== 'failed').length,
      failedCount: results.filter((r) => r.status === 'failed').length,
      file: 'generate-scenes/route.ts',
    });

    return NextResponse.json({
      success: true,
      results,
      sceneCount: results.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scene generation failed', error as Error, {
      file: 'generate-scenes/route.ts',
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
