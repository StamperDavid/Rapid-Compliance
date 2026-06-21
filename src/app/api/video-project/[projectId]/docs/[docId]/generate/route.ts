/**
 * POST /api/video-project/[projectId]/docs/[docId]/generate
 *
 * Generate ONE Shot Doc's video within a project. The act of generating IS the
 * approval for that doc: its shots render on fal / Seedance and stitch into the
 * doc's single video (the per-doc P4 stitch → the doc's `finalVideoUrl`). The
 * updated doc is persisted back into the project, and the re-derived project is
 * returned — reaching the last doc's video flips project status to 'assembled'.
 *
 * Next 14 async params: `params` is a Promise that must be awaited.
 *
 * LONG-RUNNING: one synchronous fal generation + persist per shot plus the final
 * stitch, so this request can take several minutes for a multi-shot doc.
 *
 * Thin route: authenticate, load + locate the doc, delegate, map errors to HTTP.
 * On a generation failure we return 500 with a plain-English message and leave
 * the stored project untouched (we only persist on success).
 */

import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { generateAllShots, stitchShotPlan } from '@/lib/video/shot-plan-generation-service';
import { getVideoProject, replaceProjectDoc } from '@/lib/video/video-project-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/video-project/[projectId]/docs/[docId]/generate/route.ts';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> },
) {
  const { projectId, docId } = await params;

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const project = await getVideoProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }

    const doc = project.docs.find((d) => d.id === docId);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'That document is not part of this project' },
        { status: 404 },
      );
    }

    // Render every shot in order, then stitch them into the doc's single video.
    const stitched = await stitchShotPlan(
      await generateAllShots(doc, { tenantId: PLATFORM_ID }),
      { tenantId: PLATFORM_ID },
    );

    // Persist the updated doc; the service re-derives project status (last doc → 'assembled').
    const updatedProject = await replaceProjectDoc(projectId, stitched);

    logger.info('[video-project] doc video generated', {
      file: FILE,
      projectId,
      docId,
      finalVideoUrl: stitched.finalVideoUrl,
      status: updatedProject.status,
    });

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error) {
    logger.error(
      'Video project doc generation failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE, projectId, docId },
    );
    const message = error instanceof Error ? error.message : 'Generating the document video failed';
    return NextResponse.json(
      {
        success: false,
        error:
          `Building this document's video didn't finish: ${message}. ` +
          'The project was left as it was — you can try generating this document again.',
      },
      { status: 500 },
    );
  }
}
