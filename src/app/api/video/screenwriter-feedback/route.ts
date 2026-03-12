/**
 * Screenwriter Feedback API
 *
 * POST — Submit a rating and feedback for the AI screenwriter's performance
 *        on a specific video project. Stores the feedback as a training session
 *        in the training center and auto-flags low scores for improvement.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation
// ============================================================================

const FeedbackSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().min(1, 'Feedback is required').max(2000),
  criteriaScores: z.object({
    userIntent: z.number().int().min(1).max(5).optional(),
    characterConsistency: z.number().int().min(1).max(5).optional(),
    visualDescriptions: z.number().int().min(1).max(5).optional(),
    narrationHandling: z.number().int().min(1).max(5).optional(),
    sceneStructure: z.number().int().min(1).max(5).optional(),
  }).optional(),
  // Context about the project for the training center
  projectContext: z.object({
    description: z.string().optional(),
    sceneCount: z.number().optional(),
    videoType: z.string().optional(),
  }).optional(),
});

// ============================================================================
// POST — Submit screenwriter feedback
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: unknown = await req.json();
    const parsed = FeedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { rating, feedback, criteriaScores, projectId, projectContext } = parsed.data;

    // Convert 1-5 star rating to 0-100 score for training center compatibility
    const score = rating * 20;

    // Build criteria scores for training center (convert 1-5 → 0-100)
    const normalizedCriteria: Record<string, number> = {};
    if (criteriaScores) {
      if (criteriaScores.userIntent) { normalizedCriteria.video_user_intent = criteriaScores.userIntent * 20; }
      if (criteriaScores.characterConsistency) { normalizedCriteria.video_character_consistency = criteriaScores.characterConsistency * 20; }
      if (criteriaScores.visualDescriptions) { normalizedCriteria.video_visual_description = criteriaScores.visualDescriptions * 20; }
      if (criteriaScores.narrationHandling) { normalizedCriteria.video_narration_handling = criteriaScores.narrationHandling * 20; }
      if (criteriaScores.sceneStructure) { normalizedCriteria.video_scene_structure = criteriaScores.sceneStructure * 20; }
    }

    // Store as a training session in the training center
    const sessionId = await AdminFirestoreService.add(
      getSubCollection('trainingSessions'),
      {
        agentType: 'video',
        topic: `Screenwriter feedback — ${projectContext?.videoType ?? 'video'} project`,
        description: projectContext?.description ?? '',
        scenario: projectContext?.videoType ?? 'general',
        messages: [
          {
            role: 'user',
            message: `Generate a ${projectContext?.sceneCount ?? 'multi'}-scene ${projectContext?.videoType ?? 'video'}: ${projectContext?.description ?? '(no description)'}`,
            timestamp: new Date().toISOString(),
          },
          {
            role: 'agent',
            message: `[Screenwriter generated ${projectContext?.sceneCount ?? 'multiple'} scenes for project ${projectId}]`,
            timestamp: new Date().toISOString(),
          },
        ],
        trainerFeedback: feedback,
        score,
        criteriaScores: normalizedCriteria,
        status: 'pending',
        sourceProjectId: projectId,
        goldenMasterId: 'video-screenwriter',
        createdBy: 'user' in auth ? (auth.user as { uid: string }).uid : 'unknown',
        createdAt: new Date().toISOString(),
      }
    );

    // Auto-flag for training if score is below threshold (60/100 = 3/5 stars)
    if (score < 60) {
      await AdminFirestoreService.add(
        getSubCollection('flaggedTrainingSessions'),
        {
          sessionId,
          agentType: 'video',
          score,
          issues: [feedback],
          flaggedAt: new Date().toISOString(),
          processed: false,
          sourceProjectId: projectId,
        }
      );

      logger.warn('Screenwriter auto-flagged for training', {
        sessionId,
        score,
        projectId,
        file: 'api/video/screenwriter-feedback/route.ts',
      });
    }

    logger.info('Screenwriter feedback recorded', {
      sessionId,
      rating,
      score,
      projectId,
      file: 'api/video/screenwriter-feedback/route.ts',
    });

    return NextResponse.json({
      success: true,
      sessionId,
      flagged: score < 60,
    });
  } catch (error) {
    logger.error('Screenwriter feedback error', error as Error, {
      file: 'api/video/screenwriter-feedback/route.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
