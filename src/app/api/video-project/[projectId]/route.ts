/**
 * /api/video-project/[projectId]
 *
 *   GET    — fetch one full project (with its embedded Shot Docs).
 *   DELETE — delete a project.
 *
 * Next 14 async params: `params` is a Promise that must be awaited.
 * Thin route: authenticate, delegate, map errors to HTTP.
 */

import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { deleteVideoProject, getVideoProject } from '@/lib/video/video-project-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/video-project/[projectId]/route.ts';

/** GET — fetch one project, or 404 when it does not exist. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { projectId } = await params;
    const project = await getVideoProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    logger.error(
      'Fetching video project failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fetching the video project failed',
      },
      { status: 500 },
    );
  }
}

/** DELETE — remove a project. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { projectId } = await params;
    await deleteVideoProject(projectId);

    logger.info('[video-project] deleted via API', { file: FILE, projectId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Deleting video project failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Deleting the video project failed',
      },
      { status: 500 },
    );
  }
}
