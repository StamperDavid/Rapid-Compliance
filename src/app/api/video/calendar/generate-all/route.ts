/**
 * POST /api/video/calendar/generate-all
 *
 * Sequentially generates all approved storyboards in a calendar week via Hedra.
 * One project at a time to manage API costs.
 *
 * Expects: { weekId: string }
 * Returns: { success: true, results: Array<{ batchIndex, projectId, status, sceneCount }> }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getCalendarWeek,
  updateBatchProject,
} from '@/lib/video/batch-generator';
import { getProject, updateProject } from '@/lib/video/pipeline-project-service';
import { generateAllScenes } from '@/lib/video/scene-generator';
import type { SceneGenerationResult } from '@/types/video-pipeline';

export const dynamic = 'force-dynamic';

const GenerateAllSchema = z.object({
  weekId: z.string().min(1, 'weekId is required'),
});

interface BatchGenerationResult {
  batchIndex: number;
  projectId: string;
  status: 'completed' | 'failed';
  sceneCount: number;
  successCount: number;
  failedCount: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = GenerateAllSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const { weekId } = parsed.data;
    const week = await getCalendarWeek(weekId);

    if (!week) {
      return NextResponse.json(
        { success: false, error: 'Calendar week not found' },
        { status: 404 }
      );
    }

    // Find projects that are approved (have a linked pipeline project and status = approved or storyboarded)
    const eligibleProjects = week.projects
      .map((p, index) => ({ ...p, batchIndex: index }))
      .filter((p) => p.projectId && (p.status === 'approved' || p.status === 'storyboarded'));

    if (eligibleProjects.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No approved storyboards to generate. Link and approve projects first.' },
        { status: 400 }
      );
    }

    logger.info('[BatchGenerate] Starting batch generation', {
      weekId,
      eligibleCount: eligibleProjects.length,
    });

    const results: BatchGenerationResult[] = [];

    // Sequential generation — one at a time for cost management
    for (const batchProject of eligibleProjects) {
      const { projectId, batchIndex } = batchProject;
      if (!projectId) { continue; }

      try {
        // Mark as generating
        await updateBatchProject(weekId, batchIndex, { status: 'generating' });

        // Load the pipeline project
        const project = await getProject(projectId);
        if (!project || project.scenes.length === 0) {
          await updateBatchProject(weekId, batchIndex, { status: 'failed' });
          results.push({
            batchIndex,
            projectId,
            status: 'failed',
            sceneCount: 0,
            successCount: 0,
            failedCount: 0,
            error: project ? 'No scenes in project' : 'Project not found',
          });
          continue;
        }

        // Generate scenes via Hedra
        const sceneResults: SceneGenerationResult[] = await generateAllScenes(
          project.scenes,
          project.avatarId ?? '',
          project.voiceId ?? '',
          project.brief.aspectRatio,
          undefined,
          project.voiceProvider ?? undefined
        );

        const successCount = sceneResults.filter((r) => r.status === 'completed').length;
        const failedCount = sceneResults.filter((r) => r.status === 'failed').length;
        const allFailed = successCount === 0;

        // Update pipeline project with results
        await updateProject(projectId, {
          generatedScenes: sceneResults,
          status: allFailed ? 'draft' : 'generated',
          currentStep: allFailed ? 'generation' : 'assembly',
        });

        // Get the first completed scene's video URL as the batch videoUrl
        const firstVideo = sceneResults.find((r) => r.status === 'completed' && r.videoUrl);

        // Update batch project status
        await updateBatchProject(weekId, batchIndex, {
          status: allFailed ? 'failed' : 'completed',
          videoUrl: firstVideo?.videoUrl ?? null,
        });

        results.push({
          batchIndex,
          projectId,
          status: allFailed ? 'failed' : 'completed',
          sceneCount: sceneResults.length,
          successCount,
          failedCount,
        });

        logger.info('[BatchGenerate] Project generated', {
          weekId,
          projectId,
          successCount,
          failedCount,
        });
      } catch (projectError) {
        const errMsg = projectError instanceof Error ? projectError.message : String(projectError);
        logger.error('[BatchGenerate] Project generation failed', projectError instanceof Error ? projectError : undefined, {
          weekId,
          projectId,
        });

        await updateBatchProject(weekId, batchIndex, { status: 'failed' }).catch(() => {
          // Swallow update error
        });

        results.push({
          batchIndex,
          projectId,
          status: 'failed',
          sceneCount: 0,
          successCount: 0,
          failedCount: 0,
          error: errMsg,
        });
      }
    }

    const totalSuccess = results.filter((r) => r.status === 'completed').length;

    logger.info('[BatchGenerate] Batch generation complete', {
      weekId,
      total: results.length,
      success: totalSuccess,
      failed: results.length - totalSuccess,
    });

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        completed: totalSuccess,
        failed: results.length - totalSuccess,
      },
    });
  } catch (error) {
    logger.error('[BatchGenerate] Batch generation failed', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: 'Batch generation failed' },
      { status: 500 }
    );
  }
}
