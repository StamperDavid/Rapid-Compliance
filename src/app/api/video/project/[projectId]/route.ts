/**
 * GET /api/video/project/[projectId]
 * Load a video pipeline project by ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getProject } from '@/lib/video/pipeline-project-service';

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
