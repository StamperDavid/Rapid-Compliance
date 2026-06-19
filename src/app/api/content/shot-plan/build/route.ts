/**
 * POST /api/content/shot-plan/build
 *
 * Kick off the SERVER-SIDE shot-doc build: draft the plan + render every
 * production image, all on the server in ONE long-running task that survives the
 * operator navigating away / refreshing / closing the tab. The browser fires THIS
 * request ONCE, then POLLS GET /api/video/project/[projectId] (which now also
 * returns `shotPlan`, `shotPlanStatus`, `shotPlanProgress`, `shotPlanError`) to
 * watch the build fill in.
 *
 * This route is intentionally THIN: it authenticates, validates, writes an
 * immediate `shotPlanStatus: 'generating'` + a starting `shotPlanProgress` so the
 * client's first poll sees the build is live, then FIRES the build WITHOUT
 * awaiting and returns `{ success: true, started: true }` right away.
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
import { runShotPlanBuild } from '@/lib/video/shot-plan-build-service';
import { createProject } from '@/lib/video/pipeline-project-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/shot-plan/build/route.ts';

const BodySchema = z.object({
  // OPTIONAL: when absent/empty the route creates a fresh PipelineProject first
  // so the server build has a doc to write its plan + progress onto.
  projectId: z.string().trim().min(1).optional(),
  brief: z.string().trim().min(1, 'Describe the video you want to plan').max(8000),
  selectedLocationIds: z.array(z.string().trim().min(1)).max(20).optional(),
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
    const { projectId: providedProjectId, brief, selectedLocationIds } = parsed.data;

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Server not ready (database unavailable)' },
        { status: 503 },
      );
    }

    // When no project id was provided, CREATE a fresh PipelineProject first so
    // the build has a doc to write its plan + progress onto. The brief becomes
    // the project description; the remaining required brief fields take sensible
    // defaults (the operator edits them later in the project).
    let projectId = providedProjectId;
    if (!projectId) {
      const created = await createProject(
        {
          description: brief,
          videoType: 'explainer',
          platform: 'generic',
          duration: 60,
          aspectRatio: '16:9',
          resolution: '1080p',
        },
        user.uid,
      );
      if (!created.success || !created.projectId) {
        return NextResponse.json(
          { success: false, error: created.error ?? 'Could not start a new project for the build' },
          { status: 500 },
        );
      }
      projectId = created.projectId;
    }

    // Write an immediate generating status + starting progress so the client's
    // FIRST poll already sees the build is live (the runner re-writes this too,
    // but the LLM draft can take a few seconds — don't make the client wait blind).
    await adminDb
      .collection(getSubCollection('video_pipeline_projects'))
      .doc(projectId)
      .set(
        {
          shotPlanStatus: 'generating',
          shotPlanProgress: {
            phase: 'drafting',
            label: 'Writing the shot plan…',
            done: 0,
            total: 0,
          },
          shotPlanError: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    // FIRE the build WITHOUT awaiting (fire-and-forget). The runner persists its
    // own progress + final status onto the doc; the client polls the project GET.
    void runShotPlanBuild({
      projectId,
      brief,
      userId: user.uid,
      ...(selectedLocationIds && selectedLocationIds.length > 0 ? { selectedLocationIds } : {}),
    }).catch((e) =>
      logger.error(
        '[shot-plan-build] background build failed',
        e instanceof Error ? e : new Error(String(e)),
        { file: FILE },
      ),
    );

    logger.info('[shot-plan-build] build started (fire-and-forget)', {
      file: FILE,
      projectId,
      userId: user.uid,
    });

    return NextResponse.json({ success: true, started: true, projectId });
  } catch (error) {
    logger.error(
      'Shot Plan build failed to start',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Shot Plan build failed to start',
      },
      { status: 500 },
    );
  }
}
