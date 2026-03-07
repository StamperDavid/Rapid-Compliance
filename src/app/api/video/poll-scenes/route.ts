import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { pollSceneStatus } from '@/lib/video/scene-generator';
import type { VideoEngineId } from '@/types/video-pipeline';

export const dynamic = 'force-dynamic';

const PollScenesSchema = z.object({
  scenes: z.array(z.object({
    sceneId: z.string(),
    providerVideoId: z.string().min(1),
    provider: z.enum(['heygen', 'runway', 'sora', 'kling', 'luma']).nullable(),
    // Green screen compositing: optional background video to poll
    backgroundVideoId: z.string().optional(),
    backgroundProvider: z.enum(['heygen', 'runway', 'sora', 'kling', 'luma']).nullable().optional(),
  })),
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

    const { scenes } = parseResult.data;

    const results = await Promise.all(
      scenes.map(async (scene) => {
        // Poll main avatar/scene video
        const status = await pollSceneStatus(
          scene.providerVideoId,
          scene.provider as VideoEngineId | null,
        );

        // Poll background video if present (green screen compositing)
        let backgroundStatus: {
          backgroundVideoUrl: string | null;
          backgroundReady: boolean;
        } = { backgroundVideoUrl: null, backgroundReady: false };

        if (scene.backgroundVideoId && scene.backgroundProvider) {
          try {
            const bgResult = await pollSceneStatus(
              scene.backgroundVideoId,
              scene.backgroundProvider as VideoEngineId | null,
            );
            backgroundStatus = {
              backgroundVideoUrl: bgResult.videoUrl,
              backgroundReady: bgResult.status === 'completed' && bgResult.videoUrl !== null,
            };
          } catch (bgErr) {
            logger.warn('Background video poll failed', {
              sceneId: scene.sceneId,
              backgroundVideoId: scene.backgroundVideoId,
              error: bgErr instanceof Error ? bgErr.message : String(bgErr),
              file: 'poll-scenes/route.ts',
            });
          }
        }

        return {
          sceneId: scene.sceneId,
          providerVideoId: scene.providerVideoId,
          provider: scene.provider,
          ...status,
          ...backgroundStatus,
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
