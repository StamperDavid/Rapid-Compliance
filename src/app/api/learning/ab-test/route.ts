/**
 * A/B Testing API Routes
 * Manage A/B tests for fine-tuned models
 */

import { type NextRequest, NextResponse } from 'next/server';
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

interface CreateABTestRequestBody {
  controlModel?: string;
  treatmentModel?: string;
  trafficSplit?: number;
  minSampleSize?: number;
  confidenceThreshold?: number;
}

interface UpdateABTestRequestBody {
  action?: string;
  testId?: string;
  autoDeploy?: boolean;
}

function isCreateABTestRequestBody(value: unknown): value is CreateABTestRequestBody {
  return typeof value === 'object' && value !== null;
}

function isUpdateABTestRequestBody(value: unknown): value is UpdateABTestRequestBody {
  return typeof value === 'object' && value !== null;
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/learning/ab-test');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Get active A/B test
    const test = await getActiveABTest();
    
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
  } catch (error: unknown) {
    logger.error('A/B test GET error', error instanceof Error ? error : new Error(String(error)), { route: '/api/learning/ab-test' });
    return errors.database('Failed to get A/B test', error instanceof Error ? error : new Error(String(error)));
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!isCreateABTestRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const {
      controlModel,
      treatmentModel,
      trafficSplit,
      minSampleSize,
      confidenceThreshold,
    } = body;

    if (!controlModel || !treatmentModel) {
      return NextResponse.json(
        { error: 'controlModel and treatmentModel are required' },
        { status: 400 }
      );
    }

    // Check for existing test
    const existingTest = await getActiveABTest();
    if (existingTest?.status === 'running') {
      return NextResponse.json(
        { error: 'An A/B test is already running. Complete it first.' },
        { status: 400 }
      );
    }

    // Create new test
    const test = await createABTest({
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
  } catch (error: unknown) {
    logger.error('A/B test creation error', error instanceof Error ? error : new Error(String(error)), { route: '/api/learning/ab-test' });
    const errorMessage = error instanceof Error ? error.message : 'Failed to create A/B test';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!isUpdateABTestRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { action, testId, autoDeploy } = body;

    if (action === 'evaluate') {
      // Force evaluation of current test
      const test = await getActiveABTest();
      if (!test) {
        return NextResponse.json(
          { error: 'No active test to evaluate' },
          { status: 400 }
        );
      }

      const results = await evaluateABTest(test.id);
      return NextResponse.json({
        success: true,
        results,
      });
    }

    if (action === 'complete') {
      // Complete test and optionally deploy winner
      const result = await checkAndDeployWinner();
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    if (action === 'deploy' && testId) {
      // Force deployment
      const result = await completeABTestAndDeploy(
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
  } catch (error: unknown) {
    logger.error('A/B test PUT error', error instanceof Error ? error : new Error(String(error)), { route: '/api/learning/ab-test' });
    return errors.database('Failed to update A/B test', error instanceof Error ? error : new Error(String(error)));
  }
}


