/**
 * Fine-Tuning API Routes
 * Manage the complete learning pipeline
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  processConversationFeedback,
  processCompletedFineTuningJob,
  checkAndDeployWinner
} from '@/lib/ai/learning/continuous-learning-engine';
import { getTrainingDataStats, getTrainingExamples, approveTrainingExample, rejectTrainingExample } from '@/lib/ai/fine-tuning/data-collector';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

type TrainingExampleStatus = 'pending' | 'approved' | 'rejected' | 'used_in_training';
type FineTuneBaseModel = 'gpt-3.5-turbo' | 'gpt-4';

interface TrainingMessage {
  role: string;
  content: string;
}

interface FineTunePostRequestBody {
  PLATFORM_ID?: string;
  action?: string;
  conversationId?: string;
  messages?: TrainingMessage[];
  confidence?: number;
  userRating?: number;
  didConvert?: boolean;
  userFeedback?: string;
  exampleId?: string;
  approvedBy?: string;
  baseModel?: FineTuneBaseModel;
  hyperparameters?: Record<string, unknown>;
  jobId?: string;
}

interface FineTunePutRequestBody {
  PLATFORM_ID?: string;
  config?: Record<string, unknown>;
}

interface LearningConfig {
  autoCollectTrainingData?: boolean;
  autoTriggerFineTuning?: boolean;
  autoDeployFineTunedModels?: boolean;
  minExamplesForTraining?: number;
  trainingFrequency?: string;
}

function isFineTunePostRequestBody(value: unknown): value is FineTunePostRequestBody {
  return typeof value === 'object' && value !== null;
}

function isFineTunePutRequestBody(value: unknown): value is FineTunePutRequestBody {
  return typeof value === 'object' && value !== null;
}

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
        const jobs = await FirestoreService.getAll(
          getSubCollection('fineTuningJobs'),
          []
        );

        // Get learning config
        const config = await FirestoreService.get<LearningConfig>(
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
        const jobs = await FirestoreService.getAll(
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
    if (!isFineTunePostRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { PLATFORM_ID, action } = body;

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
          conversationId: body.conversationId ?? '',
          messages: body.messages ?? [],
          confidence: body.confidence ?? 0,
          userRating: body.userRating,
          didConvert: body.didConvert,
          userFeedback: body.userFeedback,
        });

        return NextResponse.json({
          success: true,
          ...result,
        });
      }

      case 'approve_example': {
        const exampleId = body.exampleId;
        const approvedBy = body.approvedBy;
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
        const exampleId = body.exampleId;
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

        const baseModel: FineTuneBaseModel = body.baseModel ?? 'gpt-3.5-turbo';

        const job = await createOpenAIFineTuningJob({
          baseModel,
          examples,
          hyperparameters: body.hyperparameters,
        });

        return NextResponse.json({
          success: true,
          job,
          message: `Fine-tuning job started with ${examples.length} examples`,
        });
      }

      case 'process_completed_job': {
        // Process a completed fine-tuning job (start A/B testing)
        const jobId = body.jobId;
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
    if (!isFineTunePutRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { PLATFORM_ID, config } = body;

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

    await FirestoreService.set(
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
