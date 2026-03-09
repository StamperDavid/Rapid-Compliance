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
  scriptText: z.string().default(''), // Empty for B-roll scenes
  screenshotUrl: z.string().nullable().default(null),
  avatarId: z.string().default(''), // Empty for B-roll (avatar-profile-driven) scenes
  voiceId: z.string().default(''), // Empty for B-roll (avatar-profile-driven) scenes
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).default('16:9'),
  duration: z.number().default(15),
  engine: z.enum(['hedra']).nullable().default(null),
  backgroundPrompt: z.string().nullable().default(null),
  visualDescription: z.string().nullable().default(null),
  title: z.string().nullable().default(null),
  voiceProvider: z.enum(['elevenlabs', 'unrealspeech', 'custom', 'hedra']).default('elevenlabs'),
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
      const zodErrors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn('Invalid regenerate scene request', {
        errors: zodErrors,
        file: 'regenerate-scene/route.ts',
      });
      return NextResponse.json(
        { success: false, error: `Invalid request: ${zodErrors}`, details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { projectId, sceneId, scriptText, screenshotUrl, avatarId, voiceId, aspectRatio, duration, engine, backgroundPrompt, visualDescription, title, voiceProvider } = parseResult.data;

    logger.info('Regenerating scene', {
      projectId,
      sceneId,
      avatarId: avatarId ? avatarId.slice(0, 8) : '(none)',
      voiceId: voiceId ? voiceId.slice(0, 8) : '(none)',
      voiceProvider,
      engine,
      aspectRatio,
      file: 'regenerate-scene/route.ts',
    });

    // Build a PipelineScene from the request data
    const scene: PipelineScene = {
      id: sceneId,
      sceneNumber: 0, // Not used in generation
      title: title ?? undefined,
      scriptText,
      visualDescription: visualDescription ?? undefined,
      screenshotUrl,
      avatarId: null,
      voiceId: null,
      voiceProvider: null,
      duration,
      engine: engine ?? null,
      backgroundPrompt,
      status: 'approved' as const,
    };

    // Generate the scene
    const result = await generateScene(scene, avatarId, voiceId, aspectRatio, voiceProvider);

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
