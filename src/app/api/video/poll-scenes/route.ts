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
    // Track compositing state to avoid duplicate triggers
    compositeStatus: z.enum(['pending', 'compositing', 'completed', 'failed']).nullable().optional(),
  })),
  projectId: z.string().default('local'),
});

/**
 * Auto-trigger compositing when both avatar and background videos are ready.
 * Calls the /api/video/composite endpoint internally.
 */
async function triggerCompositing(
  sceneId: string,
  projectId: string,
  avatarVideoUrl: string,
  backgroundVideoUrl: string,
  request: NextRequest,
): Promise<{ compositedVideoUrl: string | null; compositeError: string | null }> {
  try {
    logger.info('Auto-triggering compositing for scene', {
      sceneId,
      projectId,
      file: 'poll-scenes/route.ts',
    });

    // Build the internal composite request
    const baseUrl = request.nextUrl.origin;
    const compositeResponse = await fetch(`${baseUrl}/api/video/composite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward auth headers
        ...(request.headers.get('cookie') ? { cookie: request.headers.get('cookie') as string } : {}),
        ...(request.headers.get('authorization') ? { authorization: request.headers.get('authorization') as string } : {}),
      },
      body: JSON.stringify({
        projectId,
        sceneId,
        avatarVideoUrl,
        backgroundVideoUrl,
        outputWidth: 1920,
        outputHeight: 1080,
      }),
    });

    if (!compositeResponse.ok) {
      const errorData = await compositeResponse.json() as { error?: string };
      const errorMsg = errorData.error ?? `Compositing failed (${compositeResponse.status})`;
      logger.error('Auto-compositing request failed', new Error(errorMsg), {
        sceneId,
        file: 'poll-scenes/route.ts',
      });
      return { compositedVideoUrl: null, compositeError: errorMsg };
    }

    const compositeData = await compositeResponse.json() as { success: boolean; compositedVideoUrl?: string };
    if (compositeData.success && compositeData.compositedVideoUrl) {
      logger.info('Auto-compositing completed', {
        sceneId,
        file: 'poll-scenes/route.ts',
      });
      return { compositedVideoUrl: compositeData.compositedVideoUrl, compositeError: null };
    }

    return { compositedVideoUrl: null, compositeError: 'Compositing returned no URL' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown compositing error';
    logger.error('Auto-compositing exception', error instanceof Error ? error : new Error(errorMsg), {
      sceneId,
      file: 'poll-scenes/route.ts',
    });
    return { compositedVideoUrl: null, compositeError: errorMsg };
  }
}

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
        // Poll main avatar/scene video
        const status = await pollSceneStatus(
          scene.providerVideoId,
          scene.provider as VideoEngineId | null,
        );

        // Poll background video if present (green screen compositing)
        let backgroundVideoUrl: string | null = null;
        let backgroundReady = false;

        if (scene.backgroundVideoId && scene.backgroundProvider) {
          try {
            const bgResult = await pollSceneStatus(
              scene.backgroundVideoId,
              scene.backgroundProvider as VideoEngineId | null,
            );
            backgroundVideoUrl = bgResult.videoUrl;
            backgroundReady = bgResult.status === 'completed' && bgResult.videoUrl !== null;
          } catch (bgErr) {
            logger.warn('Background video poll failed', {
              sceneId: scene.sceneId,
              backgroundVideoId: scene.backgroundVideoId,
              error: bgErr instanceof Error ? bgErr.message : String(bgErr),
              file: 'poll-scenes/route.ts',
            });
          }
        }

        // Auto-compositing: if both avatar and background are ready, and compositing
        // hasn't been triggered yet, auto-composite them
        let compositedVideoUrl: string | null = null;
        let compositeStatus = scene.compositeStatus ?? null;
        let compositeError: string | null = null;

        const avatarReady = status.status === 'completed' && status.videoUrl;
        if (avatarReady && backgroundReady && backgroundVideoUrl && compositeStatus === 'pending') {
          compositeStatus = 'compositing';

          const compositeResult = await triggerCompositing(
            scene.sceneId,
            projectId,
            status.videoUrl as string,
            backgroundVideoUrl,
            request,
          );

          if (compositeResult.compositedVideoUrl) {
            compositedVideoUrl = compositeResult.compositedVideoUrl;
            compositeStatus = 'completed';
          } else {
            compositeError = compositeResult.compositeError;
            compositeStatus = 'failed';
          }
        }

        return {
          sceneId: scene.sceneId,
          providerVideoId: scene.providerVideoId,
          provider: scene.provider,
          ...status,
          // Override videoUrl with composited version if available
          videoUrl: compositedVideoUrl ?? status.videoUrl,
          backgroundVideoUrl,
          backgroundReady,
          compositedVideoUrl,
          compositeStatus,
          compositeError,
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
