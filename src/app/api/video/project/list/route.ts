/**
 * GET /api/video/project/list
 * List all video pipeline projects for the authenticated user
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { listProjects } from '@/lib/video/pipeline-project-service';
import type { ProjectStatus } from '@/types/video-pipeline';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: ProjectStatus[] = ['draft', 'approved', 'generating', 'generated', 'assembled', 'completed'];

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Parse optional status filter from query params
    const statusParams = request.nextUrl.searchParams.getAll('status');
    const statusFilter = statusParams.length > 0
      ? statusParams.filter((s): s is ProjectStatus => VALID_STATUSES.includes(s as ProjectStatus))
      : undefined;

    logger.info('Listing video pipeline projects', {
      file: 'api/video/project/list/route.ts',
      userId: user.uid,
      statusFilter: statusFilter ?? 'all',
    });

    // Single-tenant: show ALL org projects, not just the current user's.
    // Jasper creates projects with createdBy = user.uid, but older projects
    // may have createdBy = 'jasper', so filtering by user.uid would hide them.
    const projects = await listProjects(undefined, statusFilter);

    // Return lightweight project summaries (no full scene data)
    const summaries = projects.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      currentStep: p.currentStep,
      status: p.status,
      sceneCount: p.scenes.length,
      hasVideo: p.finalVideoUrl !== null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      projects: summaries,
    });
  } catch (error) {
    logger.error('Failed to list video pipeline projects', error as Error, {
      file: 'api/video/project/list/route.ts',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list projects',
      },
      { status: 500 }
    );
  }
}
