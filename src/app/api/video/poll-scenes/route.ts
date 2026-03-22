import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { pollSceneStatus } from '@/lib/video/scene-generator';
import { persistVideoToStorage } from '@/lib/video/video-persistence';

export const dynamic = 'force-dynamic';

const PollScenesSchema = z.object({
  scenes: z.array(z.object({
    sceneId: z.string(),
    providerVideoId: z.string().min(1),
    provider: z.enum(['hedra']).nullable(),
    compositeStatus: z.enum(['pending', 'compositing', 'completed', 'failed']).nullable().optional(),
  })),
  projectId: z.string().default('local'),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parseResult = PollScenesSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 },
      );
    }

    const { scenes, projectId } = parseResult.data;

    const results = await Promise.all(
      scenes.map(async (scene) => {
        const status = await pollSceneStatus(
          scene.providerVideoId,
          scene.provider,
        );

        const statusLabel = `${status.status} ${status.progress ?? 0}%`;
        logger.info('Scene poll result', {
          sceneId: scene.sceneId.slice(0, 8),
          statusLabel,
          file: 'poll-scenes/route.ts',
        });

        // When a scene completes, immediately download from Hedra and persist
        // to Firebase Storage so the URL never expires.
        let persistedVideoUrl = status.videoUrl;

        if (status.status === 'completed' && status.videoUrl) {
          try {
            const permanentUrl = await persistVideoToStorage(
              scene.providerVideoId,
              status.videoUrl,
              projectId,
              scene.sceneId,
            );
            if (permanentUrl) {
              persistedVideoUrl = permanentUrl;
              logger.info('Scene video persisted to Firebase Storage', {
                sceneId: scene.sceneId.slice(0, 8),
                file: 'poll-scenes/route.ts',
              });
            }
          } catch (persistError) {
            logger.error('Scene video persistence failed', persistError instanceof Error ? persistError : new Error(String(persistError)), {
              sceneId: scene.sceneId.slice(0, 8),
              file: 'poll-scenes/route.ts',
            });
            return {
              sceneId: scene.sceneId,
              providerVideoId: scene.providerVideoId,
              provider: scene.provider,
              ...status,
              status: 'failed' as const,
              videoUrl: null,
              error: 'Video generated but could not be saved — click Retry',
            };
          }
        }

        return {
          sceneId: scene.sceneId,
          providerVideoId: scene.providerVideoId,
          provider: scene.provider,
          ...status,
          videoUrl: persistedVideoUrl,
        };
      }),
    );

    return NextResponse.json({ success: true, results });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scene polling failed', error as Error, {
      file: 'poll-scenes/route.ts',
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
