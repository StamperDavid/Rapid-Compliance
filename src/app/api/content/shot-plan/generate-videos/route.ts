/**
 * POST /api/content/shot-plan/generate-videos
 *
 * Kick off the SERVER-SIDE shot-plan VIDEO build: render every shot's clip
 * (Seedance + lip-sync) on the server in ONE long-running task that survives the
 * operator navigating to the editor / refreshing / closing the tab. The browser
 * fires THIS request ONCE, then POLLS GET /api/video/project/[projectId] (which
 * now also returns `videoBuildStatus`, `videoBuildProgress`, `videoBuildError`
 * plus the live `shotPlan`) to watch each clip land.
 *
 * This route is intentionally THIN: it authenticates, validates, writes an
 * immediate `videoBuildStatus: 'generating'` + a starting `videoBuildProgress`
 * so the client's first poll sees the build is live, then FIRES the build WITHOUT
 * awaiting and returns `{ success: true, started: true, projectId }` right away.
 *
 * DEV vs PROD: in `next dev` the fire-and-forget async survives the client
 * disconnect (the Node process stays alive), so the build runs to completion.
 * TODO (serverless production): on Vercel a serverless function is frozen after
 * the response returns, so the un-awaited build would be killed. Before prod,
 * either wrap the build in Next.js `after()` (so the platform keeps the function
 * warm until it finishes) or hand it to a cron worker (the repo already has
 * `src/app/api/cron/*`). Do NOT build that queue here — this is the dev-path
 * runner; the prod durability swap is a follow-up.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { FieldValue } from 'firebase-admin/firestore';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { runShotPlanVideoBuild } from '@/lib/video/shot-plan-video-build-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/generate-videos/route.ts';

const BodySchema = z.object({
  projectId: z.string().trim().min(1, 'projectId is required'),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }
    const { projectId } = parsed.data;

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Server not ready (database unavailable)' },
        { status: 503 },
      );
    }

    // Write an immediate generating status + starting progress so the client's
    // FIRST poll already sees the build is live (the runner re-writes this too,
    // but the doc read + first render submit can take a moment — don't make the
    // client wait blind). Clear any stale error from a prior failed attempt.
    await adminDb
      .collection(getSubCollection('video_pipeline_projects'))
      .doc(projectId)
      .set(
        {
          videoBuildStatus: 'generating',
          videoBuildProgress: {
            phase: 'rendering',
            label: 'Starting the video render…',
            done: 0,
            total: 0,
          },
          videoBuildError: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    // FIRE the build WITHOUT awaiting (fire-and-forget). The runner persists its
    // own progress + final status onto the doc; the client polls the project GET.
    void runShotPlanVideoBuild({ projectId }).catch((e) =>
      logger.error(
        '[shot-plan-video-build] background build failed',
        e instanceof Error ? e : new Error(String(e)),
        { file: FILE },
      ),
    );

    logger.info('[shot-plan-video-build] build started (fire-and-forget)', {
      file: FILE,
      projectId,
      userId: user.uid,
    });

    return NextResponse.json({ success: true, started: true, projectId });
  } catch (error) {
    logger.error(
      'Shot Plan video build failed to start',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Shot Plan video build failed to start',
      },
      { status: 500 },
    );
  }
}
