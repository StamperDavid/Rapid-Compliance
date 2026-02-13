import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getProject } from '@/lib/video/pipeline-project-service';

export const dynamic = 'force-dynamic';

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

    // Extract projectId from params (Next.js 15 async params)
    const { projectId } = await params;

    logger.info('Fetching scene status', {
      projectId,
      file: 'scene-status/[projectId]/route.ts',
    });

    // Load project
    const project = await getProject(projectId);

    if (!project) {
      logger.warn('Project not found', {
        projectId,
        file: 'scene-status/[projectId]/route.ts',
      });
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Calculate completion status
    const allComplete =
      project.generatedScenes.length > 0 &&
      project.generatedScenes.every((s) => s.status === 'completed');

    const failedCount = project.generatedScenes.filter((s) => s.status === 'failed').length;

    logger.info('Scene status retrieved', {
      projectId,
      totalScenes: project.generatedScenes.length,
      allComplete,
      failedCount,
      file: 'scene-status/[projectId]/route.ts',
    });

    return NextResponse.json({
      success: true,
      projectId,
      scenes: project.generatedScenes,
      allComplete,
      failedCount,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch scene status', error as Error, {
      file: 'scene-status/[projectId]/route.ts',
    });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
