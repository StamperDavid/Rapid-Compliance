/**
 * Scene Review API
 *
 * POST — Submit a human review (1-5 stars + feedback) for a generated video scene.
 *        Stores the review as a training session in the training center.
 *        Mirrors the screenwriter-feedback route pattern.
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

const SceneReviewSchema = z.object({
  sceneId: z.string().min(1, 'Scene ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  humanGrade: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).default(''),
  autoGrade: z.object({
    scriptAccuracy: z.number(),
    actualWpm: z.number(),
    targetWpm: z.number(),
    pacingScore: z.enum(['too_slow', 'good', 'too_fast']),
    wordsDropped: z.array(z.string()),
    wordsAdded: z.array(z.string()),
    overallScore: z.number(),
    gradedAt: z.string(),
  }).nullable().default(null),
  action: z.enum(['accept', 'regenerate']),
  sceneContext: z.object({
    sceneNumber: z.number().optional(),
    scriptText: z.string().optional(),
    visualDescription: z.string().optional(),
    backgroundPrompt: z.string().optional(),
  }).optional(),
});

// ============================================================================
// POST — Submit scene review
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body: unknown = await req.json();
    const parsed = SceneReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { sceneId, projectId, humanGrade, feedback, autoGrade, action, sceneContext } = parsed.data;

    // Convert 1-5 star rating to 0-100 score for training center compatibility
    const score = humanGrade * 20;

    // Build criteria scores from auto-grade data
    const criteriaScores: Record<string, number> = {};
    if (autoGrade) {
      criteriaScores.video_script_accuracy = Math.round(autoGrade.scriptAccuracy);
      criteriaScores.video_overall_auto_score = Math.round(autoGrade.overallScore);
      // Map pacing to a score: good=100, too_fast/too_slow=40
      criteriaScores.video_pacing = autoGrade.pacingScore === 'good' ? 100 : 40;
    }

    // Build training messages that capture the scene context
    const messages = [
      {
        role: 'user' as const,
        message: `Generate scene ${sceneContext?.sceneNumber ?? '?'}: ${sceneContext?.scriptText?.slice(0, 200) ?? '(no script)'}`,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'agent' as const,
        message: `[Video generator produced scene ${sceneId} for project ${projectId}. Visual: ${sceneContext?.visualDescription?.slice(0, 200) ?? '(none)'}]`,
        timestamp: new Date().toISOString(),
      },
    ];

    // Build trainer feedback combining human feedback and auto-grade summary
    let trainerFeedback = feedback || `Scene ${action === 'accept' ? 'approved' : 'rejected for regeneration'} with ${humanGrade}/5 stars`;
    if (autoGrade) {
      trainerFeedback += ` | Auto-grade: ${autoGrade.overallScore}% overall, ${autoGrade.scriptAccuracy}% script accuracy, pacing: ${autoGrade.pacingScore}`;
      if (autoGrade.wordsDropped.length > 0) {
        trainerFeedback += ` | Words dropped: ${autoGrade.wordsDropped.slice(0, 10).join(', ')}`;
      }
    }

    // Store as a training session in the training center
    const sessionId = await AdminFirestoreService.add(
      getSubCollection('trainingSessions'),
      {
        agentType: 'video',
        topic: `Scene review — scene ${sceneContext?.sceneNumber ?? '?'} (${action})`,
        description: sceneContext?.visualDescription ?? '',
        scenario: 'scene-generation',
        messages,
        trainerFeedback,
        score,
        criteriaScores,
        status: 'pending',
        sourceProjectId: projectId,
        sourceSceneId: sceneId,
        reviewAction: action,
        goldenMasterId: 'video-scene-generator',
        createdBy: 'user' in auth ? (auth.user as { uid: string }).uid : 'unknown',
        createdAt: new Date().toISOString(),
      },
    );

    // Auto-flag for training if score is below threshold (60/100 = 3/5 stars)
    const flagged = score < 60;
    if (flagged) {
      await AdminFirestoreService.add(
        getSubCollection('flaggedTrainingSessions'),
        {
          sessionId,
          agentType: 'video',
          score,
          issues: [trainerFeedback],
          flaggedAt: new Date().toISOString(),
          processed: false,
          sourceProjectId: projectId,
          sourceSceneId: sceneId,
        },
      );

      logger.warn('Scene generator auto-flagged for training', {
        sessionId,
        score,
        sceneId,
        projectId,
        file: 'api/video/scene-review/route.ts',
      });
    }

    logger.info('Scene review recorded', {
      sessionId,
      humanGrade,
      score,
      action,
      sceneId,
      projectId,
      flagged,
      file: 'api/video/scene-review/route.ts',
    });

    return NextResponse.json({
      success: true,
      sessionId,
      flagged,
    });
  } catch (error) {
    logger.error('Scene review error', error instanceof Error ? error : new Error(String(error)), {
      file: 'api/video/scene-review/route.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
