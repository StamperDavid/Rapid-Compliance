/**
 * GET /api/video/project/[projectId]
 * Load a video pipeline project by ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { z } from 'zod';
import { getProject, deleteProject, updateProject } from '@/lib/video/pipeline-project-service';

export const dynamic = 'force-dynamic';

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

    return NextResponse.json({
      success: true,
      project,
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
