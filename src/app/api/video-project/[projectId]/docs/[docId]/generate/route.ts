/**
 * POST /api/video-project/[projectId]/docs/[docId]/generate
 *
 * Generate ONE Shot Doc's clips within a project. The act of generating IS the
 * approval for that doc: its shots render on fal / Seedance as INDIVIDUAL clips.
 * We deliberately do NOT stitch — each clip flows into the editor on its own,
 * where the operator assembles them (using the script's marked clip frames). The
 * updated doc is persisted back into the project, and the re-derived project is
 * returned — once every doc's shots have clips the project flips to 'assembled'.
 *
 * Next 14 async params: `params` is a Promise that must be awaited.
 *
 * LONG-RUNNING: one synchronous fal generation + persist per shot, so this
 * request can take several minutes for a multi-shot doc.
 *
 * Thin route: authenticate, load + locate the doc, delegate, map errors to HTTP.
 * On a generation failure we return 500 with a plain-English message and leave
 * the stored project untouched (we only persist on success).
 */

import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { generateAllShots } from '@/lib/video/shot-plan-generation-service';
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

    // Render every shot in order as INDIVIDUAL clips — no stitch. The operator
    // assembles them in the editor. A failed shot is flagged and skipped (the run
    // does not abort), and we persist after EVERY shot so partial progress survives.
    const generated = await generateAllShots(
      doc,
      { tenantId: PLATFORM_ID },
      undefined,
      async (progressDoc) => {
        await replaceProjectDoc(projectId, progressDoc);
      },
    );

    // Final persist; the service re-derives project status (all docs done → 'assembled').
    const updatedProject = await replaceProjectDoc(projectId, generated);

    logger.info('[video-project] doc clips generated', {
      file: FILE,
      projectId,
      docId,
      shotsGenerated: generated.shots.filter((s) => s.generated?.videoUrl).length,
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
