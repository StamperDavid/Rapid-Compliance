/**
 * POST /api/video/project/save
 * Save or update a video pipeline project
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { createProject, updateProject } from '@/lib/video/pipeline-project-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schema
// ============================================================================

const SaveProjectSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1, 'Project name required'),
  brief: z.object({
    description: z.string().min(1),
    videoType: z.enum([
      'tutorial',
      'explainer',
      'product-demo',
      'sales-pitch',
      'testimonial',
      'social-ad',
    ]),
    platform: z.enum(['youtube', 'tiktok', 'instagram', 'linkedin', 'website']),
    duration: z.number().min(10).max(600),
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']),
    resolution: z.enum(['720p', '1080p', '4k']),
  }),
  currentStep: z.enum([
    'request',
    'decompose',
    'pre-production',
    'approval',
    'generation',
    'assembly',
    'post-production',
  ]),
  scenes: z.array(
    z.object({
      id: z.string(),
      sceneNumber: z.number(),
      scriptText: z.string(),
      screenshotUrl: z.string().nullable(),
      avatarId: z.string().nullable(),
      voiceId: z.string().nullable(),
      duration: z.number(),
      engine: z.enum(['heygen', 'runway', 'sora', 'kling', 'luma']).nullable().default(null),
      status: z.enum(['draft', 'approved', 'generating', 'completed', 'failed']),
    })
  ),
  avatarId: z.string().nullable(),
  avatarName: z.string().nullable(),
  voiceId: z.string().nullable(),
  voiceName: z.string().nullable(),
  transitionType: z.enum(['cut', 'fade', 'dissolve']).default('fade'),
  status: z.enum(['draft', 'approved', 'generating', 'assembled', 'completed']).default('draft'),
});

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Parse and validate request body
    const body: unknown = await request.json();
    const parseResult = SaveProjectSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid save project request', {
        file: 'api/video/project/save/route.ts',
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Update existing project
    if (data.projectId) {
      logger.info('Updating video pipeline project', {
        file: 'api/video/project/save/route.ts',
        projectId: data.projectId,
      });

      const result = await updateProject(data.projectId, {
        name: data.name,
        currentStep: data.currentStep,
        scenes: data.scenes,
        avatarId: data.avatarId,
        avatarName: data.avatarName,
        voiceId: data.voiceId,
        voiceName: data.voiceName,
        transitionType: data.transitionType,
        status: data.status,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error ?? 'Failed to update project',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        projectId: data.projectId,
      });
    }

    // Create new project
    logger.info('Creating new video pipeline project', {
      file: 'api/video/project/save/route.ts',
      userId: user.uid,
    });

    const createResult = await createProject(data.brief, user.uid);

    if (!createResult.success || !createResult.projectId) {
      return NextResponse.json(
        {
          success: false,
          error: createResult.error ?? 'Failed to create project',
        },
        { status: 500 }
      );
    }

    const newProjectId = createResult.projectId;

    // Update with remaining fields
    const updateResult = await updateProject(newProjectId, {
      name: data.name,
      currentStep: data.currentStep,
      scenes: data.scenes,
      avatarId: data.avatarId,
      avatarName: data.avatarName,
      voiceId: data.voiceId,
      voiceName: data.voiceName,
      transitionType: data.transitionType,
      status: data.status,
    });

    if (!updateResult.success) {
      logger.warn('Project created but initial update failed', {
        file: 'api/video/project/save/route.ts',
        projectId: newProjectId,
        error: updateResult.error,
      });
    }

    return NextResponse.json({
      success: true,
      projectId: newProjectId,
    });
  } catch (error) {
    logger.error('Failed to save video pipeline project', error as Error, {
      file: 'api/video/project/save/route.ts',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save project',
      },
      { status: 500 }
    );
  }
}
