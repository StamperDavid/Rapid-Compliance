/**
 * Fine-Tuning API Routes
 * Manage the complete learning pipeline
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { 
  processConversationFeedback, 
  processCompletedFineTuningJob,
  checkAndDeployWinner 
} from '@/lib/ai/learning/continuous-learning-engine';
import { getTrainingDataStats, getTrainingExamples, approveTrainingExample, rejectTrainingExample } from '@/lib/ai/fine-tuning/data-collector';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET - Get training data statistics and pending examples
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/learning/fine-tune');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const actionParam = searchParams.get('action');
    const action = (actionParam !== '' && actionParam != null) ? actionParam : 'stats';
    
    if (!organizationId) {
      return errors.badRequest('Organization ID required');
    }
    
    switch (action) {
      case 'stats': {
        const stats = await getTrainingDataStats(organizationId);
        
        // Get fine-tuning jobs
        const jobs = await FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
          []
        );
        
        // Get learning config
        const config = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/config`,
          'continuousLearning'
        );
        
        return NextResponse.json({
          stats,
          recentJobs: jobs.slice(0, 5),
          config: config || {
            autoCollectTrainingData: true,
            autoTriggerFineTuning: false,
            autoDeployFineTunedModels: false,
            minExamplesForTraining: 50,
            trainingFrequency: 'monthly',
          },
        });
      }
      
      case 'examples': {
        const status = searchParams.get('status') as any || undefined;
        const examples = await getTrainingExamples(organizationId, status);
        return NextResponse.json({ examples });
      }
      
      case 'jobs': {
        const jobs = await FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
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
  } catch (error: any) {
    logger.error('Fine-tune API error', error, { route: '/api/learning/fine-tune' });
    return NextResponse.json(
      { error: error.message || 'Failed to get training data' },
      { status: 500 }
    );
  }
}

/**
 * POST - Process feedback, approve examples, or start fine-tuning
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, action } = body;
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }
    
    switch (action) {
      case 'collect_feedback': {
        // Collect training data from conversation
        const result = await processConversationFeedback({
          organizationId,
          conversationId: body.conversationId,
          messages: body.messages,
          confidence: body.confidence || 0,
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
        const { exampleId, approvedBy } = body;
        if (!exampleId) {
          return NextResponse.json(
            { error: 'Example ID required' },
            { status: 400 }
          );
        }
        
        await approveTrainingExample(organizationId, exampleId, approvedBy || 'system');
        return NextResponse.json({
          success: true,
          message: `Example ${exampleId} approved`,
        });
      }
      
      case 'reject_example': {
        const { exampleId } = body;
        if (!exampleId) {
          return NextResponse.json(
            { error: 'Example ID required' },
            { status: 400 }
          );
        }
        
        await rejectTrainingExample(organizationId, exampleId);
        return NextResponse.json({
          success: true,
          message: `Example ${exampleId} rejected`,
        });
      }
      
      case 'start_training': {
        // Manually trigger fine-tuning
        const { createOpenAIFineTuningJob } = await import('@/lib/ai/fine-tuning/openai-tuner');
        const examples = await getTrainingExamples(organizationId, 'approved');
        
        if (examples.length < 10) {
          return NextResponse.json(
            { error: `Need at least 10 approved examples. You have ${examples.length}.` },
            { status: 400 }
          );
        }
        
        const baseModel = body.baseModel || 'gpt-3.5-turbo';
        
        const job = await createOpenAIFineTuningJob({
          organizationId,
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
        const { jobId } = body;
        if (!jobId) {
          return NextResponse.json(
            { error: 'Job ID required' },
            { status: 400 }
          );
        }
        
        const result = await processCompletedFineTuningJob(organizationId, jobId);
        return NextResponse.json(result);
      }
      
      case 'check_and_deploy': {
        // Check A/B test results and deploy winner
        const result = await checkAndDeployWinner(organizationId);
        return NextResponse.json(result);
      }
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: collect_feedback, approve_example, reject_example, start_training, process_completed_job, or check_and_deploy' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    logger.error('Fine-tune POST error', error, { route: '/api/learning/fine-tune' });
    return errors.database('Failed to process request', error);
  }
}

/**
 * PUT - Update learning configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, config } = body;
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }
    
    // Update learning config
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/config`,
      'continuousLearning',
      {
        ...config,
        organizationId,
        updatedAt: new Date().toISOString(),
      },
      false
    );
    
    return NextResponse.json({
      success: true,
      message: 'Learning configuration updated',
    });
  } catch (error: any) {
    logger.error('Fine-tune PUT error', error, { route: '/api/learning/fine-tune' });
    return errors.database('Failed to update config', error);
  }
}










