/**
 * GET /api/video/project/[projectId]
 * Load a video pipeline project by ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { z } from 'zod';
import { getProject, deleteProject, updateProject } from '@/lib/video/pipeline-project-service';
import { listAssets, deleteAsset } from '@/lib/media/media-library-service';
import { listFolders, deleteFolder } from '@/lib/media/media-folders-service';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

/**
 * Read the raw `shotPlan` + server-side-build status fields straight off the
 * project doc — for BOTH server-side builds: the shot-doc build (`shotPlan*`)
 * and the VIDEO clip build (`videoBuild*`). The typed `getProject`/`docToProject`
 * does NOT map these, so the client (which polls this GET to watch each build
 * fill in) would never see them otherwise. Best-effort: on any read failure we
 * return all-null so the GET stays backward-compatible.
 */
async function readShotPlanFields(projectId: string): Promise<{
  shotPlan: unknown;
  shotPlanStatus: unknown;
  shotPlanProgress: unknown;
  shotPlanError: unknown;
  videoBuildStatus: unknown;
  videoBuildProgress: unknown;
  videoBuildError: unknown;
}> {
  const empty = {
    shotPlan: null,
    shotPlanStatus: null,
    shotPlanProgress: null,
    shotPlanError: null,
    videoBuildStatus: null,
    videoBuildProgress: null,
    videoBuildError: null,
  };
  try {
    if (!adminDb) {
      return empty;
    }
    const snap = await adminDb
      .collection(getSubCollection('video_pipeline_projects'))
      .doc(projectId)
      .get();
    const data = snap.data();
    if (!data) {
      return empty;
    }
    return {
      shotPlan: data.shotPlan ?? null,
      shotPlanStatus: data.shotPlanStatus ?? null,
      shotPlanProgress: data.shotPlanProgress ?? null,
      shotPlanError: data.shotPlanError ?? null,
      videoBuildStatus: data.videoBuildStatus ?? null,
      videoBuildProgress: data.videoBuildProgress ?? null,
      videoBuildError: data.videoBuildError ?? null,
    };
  } catch (error) {
    logger.warn('Failed to read raw shotPlan fields', {
      file: 'api/video/project/[projectId]/route.ts',
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    return empty;
  }
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Auth check
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Extract projectId (Next.js 15 async params)
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project ID is required',
        },
        { status: 400 }
      );
    }

    logger.info('Loading video pipeline project', {
      file: 'api/video/project/[projectId]/route.ts',
      projectId,
    });

    // Load project from Firestore
    const project = await getProject(projectId);

    if (!project) {
      logger.warn('Video pipeline project not found', {
        file: 'api/video/project/[projectId]/route.ts',
        projectId,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    // ALSO surface the raw shotPlan + server-side-build status fields the typed
    // service strips. The client polls THIS GET to watch the server-side build
    // fill in. Backward-compatible: existing `project` is untouched; these are
    // additive top-level fields.
    const shotPlanFields = await readShotPlanFields(projectId);

    return NextResponse.json({
      success: true,
      project,
      shotPlan: shotPlanFields.shotPlan,
      shotPlanStatus: shotPlanFields.shotPlanStatus,
      shotPlanProgress: shotPlanFields.shotPlanProgress,
      shotPlanError: shotPlanFields.shotPlanError,
      videoBuildStatus: shotPlanFields.videoBuildStatus,
      videoBuildProgress: shotPlanFields.videoBuildProgress,
      videoBuildError: shotPlanFields.videoBuildError,
    });
  } catch (error) {
    logger.error('Failed to load video pipeline project', error as Error, {
      file: 'api/video/project/[projectId]/route.ts',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load project',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH Handler — Lightweight scene update (e.g. screenshotUrl after preview)
// ============================================================================

const PatchSceneSchema = z.object({
  sceneId: z.string(),
  updates: z.object({
    screenshotUrl: z.string().nullable().optional(),
    cinematicConfig: z.record(z.unknown()).optional(),
    scriptText: z.string().optional(),
    title: z.string().optional(),
    visualDescription: z.string().optional(),
    backgroundPrompt: z.string().nullable().optional(),
    duration: z.number().optional(),
  }),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 },
      );
    }

    const body: unknown = await request.json();
    const { sceneId, updates } = PatchSceneSchema.parse(body);

    // Load the project, patch the scene, save back
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 },
      );
    }

    const updatedScenes = project.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...updates } : scene,
    );

    const result = await updateProject(projectId, { scenes: updatedScenes });
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Update failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to patch scene', error as Error, {
      file: 'api/video/project/[projectId]/route.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to update scene' },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE Handler
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    logger.info('Deleting video pipeline project', {
      file: 'api/video/project/[projectId]/route.ts',
      projectId,
    });

    // Cascade ("Scrap project"): remove the project's generated media (clips + stills)
    // and its library folder so scrapping clears it from the system. Saved Characters are
    // owned separately and are NEVER deleted here (category 'character' is skipped).
    // NOTE: this removes the Firestore asset records (they vanish from the app); the
    // underlying Storage blobs are not purged here — a storage sweep can be added later.
    const projectAssets = await listAssets({ projectId, limit: 500 });
    const deletable = projectAssets.assets.filter((a) => a.category !== 'character');
    const removed = (await Promise.all(deletable.map((a) => deleteAsset(a.id)))).filter(Boolean).length;
    const folders = await listFolders();
    const projectFolder = folders.find((f) => f.projectId === projectId);
    if (projectFolder) {
      await deleteFolder(projectFolder.id);
    }
    logger.info('Scrapped project media', {
      file: 'api/video/project/[projectId]/route.ts',
      projectId,
      removedAssets: removed,
      folderRemoved: Boolean(projectFolder),
    });

    const deleted = await deleteProject(projectId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete project' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete video pipeline project', error as Error, {
      file: 'api/video/project/[projectId]/route.ts',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
