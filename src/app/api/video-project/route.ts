/**
 * /api/video-project
 *
 * The multi-document VIDEO PROJECT collection endpoint.
 *
 *   POST — segment a creative brief into ordered Shot Docs (stills rendered) and
 *          create + persist the VideoProject. Delegates to the segmentation
 *          service, which authors every doc as STILLS ONLY (no video yet).
 *   GET  — list all projects as lightweight summaries (no embedded docs payload).
 *
 * Thin route: authenticate, validate (Zod), delegate, map errors to HTTP.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateProjectDocs } from '@/lib/video/video-project-segmentation-service';
import { listVideoProjects } from '@/lib/video/video-project-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/video-project/route.ts';

const CreateBodySchema = z.object({
  title: z.string().trim().max(300).optional(),
  brief: z.string().trim().min(1, 'A brief is required').max(20000),
});

/**
 * POST — create a project from a brief.
 *
 * LONG-RUNNING: segmenting the brief plans every Shot Doc AND renders each doc's
 * stills synchronously, so this request can take several minutes for a
 * multi-doc brief. That is acceptable for now; a queue/poll split (submit → 202
 * + job id, poll for progress) can come later without changing this API.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const parsed = CreateBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const project = await generateProjectDocs({
      brief: parsed.data.brief,
      title: parsed.data.title,
      userId: authResult.user.uid,
    });

    logger.info('[video-project] project created from brief', {
      file: FILE,
      projectId: project.id,
      docs: project.docs.length,
    });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    logger.error(
      'Video project creation failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Creating the video project failed',
      },
      { status: 500 },
    );
  }
}

/** GET — list all projects as summaries, newest first. */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const projects = await listVideoProjects();
    return NextResponse.json({ success: true, projects });
  } catch (error) {
    logger.error(
      'Listing video projects failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Listing video projects failed',
      },
      { status: 500 },
    );
  }
}
