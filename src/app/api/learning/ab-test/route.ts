/**
 * A/B Testing API Routes
 * Manage A/B tests for fine-tuned models
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { 
  createABTest, 
  getActiveABTest, 
  evaluateABTest, 
  completeABTestAndDeploy 
} from '@/lib/ai/learning/ab-testing-service';
import { checkAndDeployWinner } from '@/lib/ai/learning/continuous-learning-engine';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/learning/ab-test');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    
    if (!organizationId) {
      return errors.badRequest('Organization ID required');
    }
    
    // Get active A/B test
    const test = await getActiveABTest(organizationId);
    
    if (!test) {
      return NextResponse.json({
        hasActiveTest: false,
        message: 'No active A/B test',
      });
    }
    
    return NextResponse.json({
      hasActiveTest: true,
      test,
      progress: {
        controlProgress: (test.metrics.controlConversations / test.minSampleSize) * 100,
        treatmentProgress: (test.metrics.treatmentConversations / test.minSampleSize) * 100,
      },
    });
  } catch (error: any) {
    logger.error('A/B test GET error', error, { route: '/api/learning/ab-test' });
    return errors.database('Failed to get A/B test', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      organizationId, 
      controlModel, 
      treatmentModel,
      trafficSplit,
      minSampleSize,
      confidenceThreshold,
    } = body;
    
    if (!organizationId || !controlModel || !treatmentModel) {
      return NextResponse.json(
        { error: 'organizationId, controlModel, and treatmentModel are required' },
        { status: 400 }
      );
    }
    
    // Check for existing test
    const existingTest = await getActiveABTest(organizationId);
    if (existingTest?.status === 'running') {
      return NextResponse.json(
        { error: 'An A/B test is already running. Complete it first.' },
        { status: 400 }
      );
    }
    
    // Create new test
    const test = await createABTest({
      organizationId,
      controlModel,
      treatmentModel,
      trafficSplit,
      minSampleSize,
      confidenceThreshold,
    });
    
    return NextResponse.json({
      success: true,
      test,
      message: `A/B test started: ${controlModel} vs ${treatmentModel}`,
    });
  } catch (error: any) {
    logger.error('A/B test creation error', error, { route: '/api/learning/ab-test' });
    return NextResponse.json(
      { error:(error.message !== '' && error.message != null) ? error.message : 'Failed to create A/B test'},
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, action, testId, autoDeploy } = body;
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }
    
    if (action === 'evaluate') {
      // Force evaluation of current test
      const test = await getActiveABTest(organizationId);
      if (!test) {
        return NextResponse.json(
          { error: 'No active test to evaluate' },
          { status: 400 }
        );
      }
      
      const results = await evaluateABTest(organizationId, test.id);
      return NextResponse.json({
        success: true,
        results,
      });
    }
    
    if (action === 'complete') {
      // Complete test and optionally deploy winner
      const result = await checkAndDeployWinner(organizationId);
      return NextResponse.json({
        success: true,
        ...result,
      });
    }
    
    if (action === 'deploy' && testId) {
      // Force deployment
      const result = await completeABTestAndDeploy(
        organizationId,
        testId,
        autoDeploy ?? true
      );
      return NextResponse.json({
        success: true,
        ...result,
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use: evaluate, complete, or deploy' },
      { status: 400 }
    );
  } catch (error: any) {
    logger.error('A/B test PUT error', error, { route: '/api/learning/ab-test' });
    return errors.database('Failed to update A/B test', error);
  }
}


