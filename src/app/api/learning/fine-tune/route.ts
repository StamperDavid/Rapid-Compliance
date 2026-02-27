/**
 * Fine-Tuning API Routes
 * Manage the complete learning pipeline
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  processConversationFeedback,
  processCompletedFineTuningJob,
  checkAndDeployWinner
} from '@/lib/ai/learning/continuous-learning-engine';
import { getTrainingDataStats, getTrainingExamples, approveTrainingExample, rejectTrainingExample } from '@/lib/ai/fine-tuning/data-collector';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

type TrainingExampleStatus = 'pending' | 'approved' | 'rejected' | 'used_in_training';
type FineTuneBaseModel = 'gpt-3.5-turbo' | 'gpt-4';

const TrainingMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const FineTunePostSchema = z.object({
  PLATFORM_ID: z.string().optional(),
  action: z.string().optional(),
  conversationId: z.string().optional(),
  messages: z.array(TrainingMessageSchema).optional(),
  confidence: z.number().optional(),
  userRating: z.number().optional(),
  didConvert: z.boolean().optional(),
  userFeedback: z.string().optional(),
  exampleId: z.string().optional(),
  approvedBy: z.string().optional(),
  baseModel: z.enum(['gpt-3.5-turbo', 'gpt-4']).optional(),
  hyperparameters: z.record(z.unknown()).optional(),
  jobId: z.string().optional(),
});

const FineTunePutSchema = z.object({
  PLATFORM_ID: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

function isValidTrainingExampleStatus(value: string | null): value is TrainingExampleStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'used_in_training';
}

/**
 * GET - Get training data statistics and pending examples
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rateLimitResponse = await rateLimitMiddleware(request, '/api/learning/fine-tune');
    if (rateLimitResponse) { return rateLimitResponse; }

    const { searchParams } = new URL(request.url);
    const actionParam = searchParams.get('action');
    const action = (actionParam !== '' && actionParam != null) ? actionParam : 'stats';

    switch (action) {
      case 'stats': {
        const stats = await getTrainingDataStats();

        // Get fine-tuning jobs
        const jobs = await AdminFirestoreService.getAll(
          getSubCollection('fineTuningJobs'),
          []
        );

        // Get learning config
        const config = await AdminFirestoreService.get(
          getSubCollection('config'),
          'continuousLearning'
        );

        return NextResponse.json({
          stats,
          recentJobs: jobs.slice(0, 5),
          config: config ?? {
            autoCollectTrainingData: true,
            autoTriggerFineTuning: false,
            autoDeployFineTunedModels: false,
            minExamplesForTraining: 50,
            trainingFrequency: 'monthly',
          },
        });
      }

      case 'examples': {
        const statusParam = searchParams.get('status');
        const status = isValidTrainingExampleStatus(statusParam) ? statusParam : undefined;
        const examples = await getTrainingExamples(status);
        return NextResponse.json({ examples });
      }

      case 'jobs': {
        const jobs = await AdminFirestoreService.getAll(
          getSubCollection('fineTuningJobs'),
          []
        );
        return NextResponse.json({ jobs });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: stats, examples, or jobs' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    logger.error('Fine-tune API error', error instanceof Error ? error : new Error(String(error)), { route: '/api/learning/fine-tune' });
    const errorMessage = error instanceof Error ? error.message : 'Failed to get training data';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST - Process feedback, approve examples, or start fine-tuning
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = FineTunePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { PLATFORM_ID, action } = parsed.data;

    if (!PLATFORM_ID) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'collect_feedback': {
        // Collect training data from conversation
        const result = await processConversationFeedback({
          conversationId: parsed.data.conversationId ?? '',
          messages: parsed.data.messages ?? [],
          confidence: parsed.data.confidence ?? 0,
          userRating: parsed.data.userRating,
          didConvert: parsed.data.didConvert,
          userFeedback: parsed.data.userFeedback,
        });

        return NextResponse.json({
          success: true,
          ...result,
        });
      }

      case 'approve_example': {
        const exampleId = parsed.data.exampleId;
        const approvedBy = parsed.data.approvedBy;
        if (!exampleId) {
          return NextResponse.json(
            { error: 'Example ID required' },
            { status: 400 }
          );
        }

        const approver = (approvedBy !== '' && approvedBy != null) ? approvedBy : 'system';
        await approveTrainingExample(exampleId, approver);
        return NextResponse.json({
          success: true,
          message: `Example ${exampleId} approved`,
        });
      }

      case 'reject_example': {
        const exampleId = parsed.data.exampleId;
        if (!exampleId) {
          return NextResponse.json(
            { error: 'Example ID required' },
            { status: 400 }
          );
        }

        await rejectTrainingExample(exampleId);
        return NextResponse.json({
          success: true,
          message: `Example ${exampleId} rejected`,
        });
      }

      case 'start_training': {
        // Manually trigger fine-tuning
        const { createOpenAIFineTuningJob } = await import('@/lib/ai/fine-tuning/openai-tuner');
        const examples = await getTrainingExamples('approved');

        if (examples.length < 10) {
          return NextResponse.json(
            { error: `Need at least 10 approved examples. You have ${examples.length}.` },
            { status: 400 }
          );
        }

        const baseModel: FineTuneBaseModel = parsed.data.baseModel ?? 'gpt-3.5-turbo';

        const job = await createOpenAIFineTuningJob({
          baseModel,
          examples,
          hyperparameters: parsed.data.hyperparameters,
        });

        return NextResponse.json({
          success: true,
          job,
          message: `Fine-tuning job started with ${examples.length} examples`,
        });
      }

      case 'process_completed_job': {
        // Process a completed fine-tuning job (start A/B testing)
        const jobId = parsed.data.jobId;
        if (!jobId) {
          return NextResponse.json(
            { error: 'Job ID required' },
            { status: 400 }
          );
        }

        const result = await processCompletedFineTuningJob(jobId);
        return NextResponse.json(result);
      }

      case 'check_and_deploy': {
        // Check A/B test results and deploy winner
        const result = await checkAndDeployWinner();
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: collect_feedback, approve_example, reject_example, start_training, process_completed_job, or check_and_deploy' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    logger.error('Fine-tune POST error', error instanceof Error ? error : new Error(String(error)), { route: '/api/learning/fine-tune' });
    return errors.database('Failed to process request', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * PUT - Update learning configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsedPut = FineTunePutSchema.safeParse(body);
    if (!parsedPut.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsedPut.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { PLATFORM_ID, config } = parsedPut.data;

    if (!PLATFORM_ID) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Update learning config
    const configData: Record<string, unknown> = {
      ...(config ?? {}),
      PLATFORM_ID,
      updatedAt: new Date().toISOString(),
    };

    await AdminFirestoreService.set(
      getSubCollection('config'),
      'continuousLearning',
      configData,
      false
    );

    return NextResponse.json({
      success: true,
      message: 'Learning configuration updated',
    });
  } catch (error: unknown) {
    logger.error('Fine-tune PUT error', error instanceof Error ? error : new Error(String(error)), { route: '/api/learning/fine-tune' });
    return errors.database('Failed to update config', error instanceof Error ? error : new Error(String(error)));
  }
}
