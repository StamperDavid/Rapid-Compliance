/**
 * PUT /api/video-project/[projectId]/docs/[docId]
 *
 * Persist a REVIEW edit to ONE Shot Doc inside a project — the non-generation
 * doc mutation the review surface needs:
 *   - cast/assign a saved character onto the doc (writes `sharedChoices.cast`),
 *   - mark the doc ready (writes the doc's `status: 'ready'`),
 *   - any other field-addressable edit the review page commits.
 *
 * The whole, validated doc is sent in the body; we confirm it belongs to the
 * project + matches the path docId, then delegate to `replaceProjectDoc` (which
 * re-derives project status on write). This is the SAME persistence path the
 * generate route uses, so cast/mark-ready and generation stay consistent.
 *
 * Next 14 async params: `params` is a Promise that must be awaited.
 * Thin route: authenticate, validate (Zod), delegate, map errors to HTTP.
 */

import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { ShotPlanSchema } from '@/types/shot-plan';
import { getVideoProject, replaceProjectDoc } from '@/lib/video/video-project-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/video-project/[projectId]/docs/[docId]/route.ts';

/** PUT — replace one doc in a project with an edited version (cast / mark-ready / field edits). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> },
) {
  const { projectId, docId } = await params;

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const parsed = ShotPlanSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? 'That document edit was not valid.',
        },
        { status: 400 },
      );
    }

    // The doc in the body must be the doc named in the path.
    if (parsed.data.id !== docId) {
      return NextResponse.json(
        { success: false, error: 'That edit does not match the document you are saving.' },
        { status: 400 },
      );
    }

    const project = await getVideoProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }
    if (!project.docs.some((d) => d.id === docId)) {
      return NextResponse.json(
        { success: false, error: 'That document is not part of this project' },
        { status: 404 },
      );
    }

    const updatedProject = await replaceProjectDoc(projectId, parsed.data);

    logger.info('[video-project] doc updated via review', {
      file: FILE,
      projectId,
      docId,
      docStatus: parsed.data.status,
      castCount: parsed.data.sharedChoices.cast.length,
    });

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error) {
    logger.error(
      'Updating video project doc failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE, projectId, docId },
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Saving the document changes failed',
      },
      { status: 500 },
    );
  }
}
