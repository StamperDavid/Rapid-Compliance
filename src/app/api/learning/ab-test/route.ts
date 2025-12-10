/**
 * A/B Testing API Routes
 * Manage A/B tests for fine-tuned models
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  createABTest, 
  getActiveABTest, 
  evaluateABTest, 
  completeABTestAndDeploy 
} from '@/lib/ai/learning/ab-testing-service';
import { checkAndDeployWinner } from '@/lib/ai/learning/continuous-learning-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
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
    console.error('[A/B Test API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get A/B test' },
      { status: 500 }
    );
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
    if (existingTest && existingTest.status === 'running') {
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
    console.error('[A/B Test API] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create A/B test' },
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
    console.error('[A/B Test API] PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update A/B test' },
      { status: 500 }
    );
  }
}


