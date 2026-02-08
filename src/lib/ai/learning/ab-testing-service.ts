/**
 * A/B Testing Service for Fine-Tuned Models
 * Compares fine-tuned models against base models to measure improvement
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

export interface ABTest {
  id: string;

  // Models being compared
  controlModel: string; // Base model (e.g., gpt-4)
  treatmentModel: string; // Fine-tuned model ID
  
  // Test configuration
  trafficSplit: number; // Percentage going to treatment (0-100)
  minSampleSize: number; // Minimum conversations before evaluation
  confidenceThreshold: number; // Required confidence for decision (e.g., 95%)
  
  // Metrics to track
  metrics: {
    controlConversations: number;
    treatmentConversations: number;
    controlConversions: number;
    treatmentConversions: number;
    controlAvgRating: number;
    treatmentAvgRating: number;
    controlAvgConfidence: number;
    treatmentAvgConfidence: number;
    controlTotalTokens: number;
    treatmentTotalTokens: number;
  };
  
  // Status
  status: 'running' | 'completed' | 'winner_control' | 'winner_treatment' | 'no_winner' | 'cancelled';
  
  // Results
  results?: {
    winner: 'control' | 'treatment' | null;
    conversionLift: number; // Percentage improvement
    ratingLift: number;
    confidenceLevel: number; // Statistical confidence
    recommendation: string;
  };
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Create a new A/B test for a fine-tuned model
 */
export async function createABTest(params: {
  controlModel: string;
  treatmentModel: string;
  trafficSplit?: number;
  minSampleSize?: number;
  confidenceThreshold?: number;
}): Promise<ABTest> {
  const {
    controlModel,
    treatmentModel,
    trafficSplit = 50, // Default 50/50 split
    minSampleSize = 100, // Default 100 conversations each
    confidenceThreshold = 95, // Default 95% confidence
  } = params;
  
  const testId = `ab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  
  const test: ABTest = {
    id: testId,
    controlModel,
    treatmentModel,
    trafficSplit,
    minSampleSize,
    confidenceThreshold,
    metrics: {
      controlConversations: 0,
      treatmentConversations: 0,
      controlConversions: 0,
      treatmentConversions: 0,
      controlAvgRating: 0,
      treatmentAvgRating: 0,
      controlAvgConfidence: 0,
      treatmentAvgConfidence: 0,
      controlTotalTokens: 0,
      treatmentTotalTokens: 0,
    },
    status: 'running',
    createdAt: now,
    updatedAt: now,
  };
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/abTests`,
    testId,
    test,
    false
  );
  
  // Update organization to use this test
  await FirestoreService.update(
    COLLECTIONS.ORGANIZATIONS,
    PLATFORM_ID,
    {
      activeABTest: testId,
      updatedAt: now,
    }
  );
  
  logger.info(`[A/B Testing] Created test ${testId}: ${controlModel} vs ${treatmentModel}`, { file: 'ab-testing-service.ts' });
  
  return test;
}

/**
 * Get which model to use for a conversation (A/B routing)
 */
interface OrganizationConfig {
  activeABTest?: string;
  preferredModel?: string;
}

export async function getModelForConversation(
  
  conversationId: string
): Promise<{
  model: string;
  isTestGroup: boolean;
  testId?: string;
}> {
  // Check if there's an active A/B test
  const org = await FirestoreService.get<OrganizationConfig>(COLLECTIONS.ORGANIZATIONS, PLATFORM_ID);

  if (!org?.activeABTest) {
    // No active test, use default model
    // Extract preferred model - empty string is invalid model name (Explicit Ternary for STRING)
    const preferredModel = (org?.preferredModel !== '' && org?.preferredModel != null) ? org.preferredModel : 'gpt-4';
    return {
      model: preferredModel,
      isTestGroup: false,
    };
  }

  // Get the test
  const test = await FirestoreService.get<ABTest>(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/abTests`,
    org.activeABTest
  );

  if (test?.status !== 'running') {
    // Extract preferred model - empty string is invalid model name (Explicit Ternary for STRING)
    const preferredModel = (org?.preferredModel !== '' && org?.preferredModel != null) ? org.preferredModel : 'gpt-4';
    return {
      model: preferredModel,
      isTestGroup: false,
    };
  }
  
  // Deterministic assignment based on conversation ID (consistent per conversation)
  const hash = hashCode(conversationId);
  const bucket = Math.abs(hash % 100);
  const isTestGroup = bucket < test.trafficSplit;
  
  return {
    model: isTestGroup ? test.treatmentModel : test.controlModel,
    isTestGroup,
    testId: test.id,
  };
}

/**
 * Record conversation result for A/B test
 */
export async function recordConversationResult(params: {
  testId: string;
  isTestGroup: boolean;
  converted: boolean;
  rating?: number;
  confidence: number;
  tokensUsed: number;
}): Promise<void> {
  const { testId, isTestGroup, converted, rating, confidence, tokensUsed } = params;
  
  const test = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/abTests`,
    testId
  ) as ABTest;
  
  if (test?.status !== 'running') {
    return;
  }
  
  // Update metrics
  const metrics = { ...test.metrics };
  
  if (isTestGroup) {
    metrics.treatmentConversations++;
    if (converted) {metrics.treatmentConversions++;}
    metrics.treatmentAvgConfidence = updateAverage(
      metrics.treatmentAvgConfidence,
      metrics.treatmentConversations - 1,
      confidence
    );
    if (rating) {
      metrics.treatmentAvgRating = updateAverage(
        metrics.treatmentAvgRating,
        metrics.treatmentConversations - 1,
        rating
      );
    }
    metrics.treatmentTotalTokens += tokensUsed;
  } else {
    metrics.controlConversations++;
    if (converted) {metrics.controlConversions++;}
    metrics.controlAvgConfidence = updateAverage(
      metrics.controlAvgConfidence,
      metrics.controlConversations - 1,
      confidence
    );
    if (rating) {
      metrics.controlAvgRating = updateAverage(
        metrics.controlAvgRating,
        metrics.controlConversations - 1,
        rating
      );
    }
    metrics.controlTotalTokens += tokensUsed;
  }
  
  await FirestoreService.update(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/abTests`,
    testId,
    {
      metrics,
      updatedAt: new Date().toISOString(),
    }
  );
  
  // Check if we have enough data to evaluate
  if (
    metrics.controlConversations >= test.minSampleSize &&
    metrics.treatmentConversations >= test.minSampleSize
  ) {
    await evaluateABTest(testId);
  }
}

/**
 * Evaluate A/B test results
 */
export async function evaluateABTest(
  testId: string
): Promise<ABTest['results']> {
  const test = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/abTests`,
    testId
  ) as ABTest;
  
  if (!test) {
    throw new Error('Test not found');
  }
  
  const { metrics } = test;
  
  // Calculate conversion rates
  const controlRate = metrics.controlConversions / Math.max(metrics.controlConversations, 1);
  const treatmentRate = metrics.treatmentConversions / Math.max(metrics.treatmentConversations, 1);
  
  // Calculate lift
  const conversionLift = controlRate > 0 
    ? ((treatmentRate - controlRate) / controlRate) * 100 
    : 0;
  
  const ratingLift = metrics.controlAvgRating > 0
    ? ((metrics.treatmentAvgRating - metrics.controlAvgRating) / metrics.controlAvgRating) * 100
    : 0;
  
  // Calculate statistical significance (simplified chi-squared test)
  const confidenceLevel = calculateStatisticalSignificance(
    metrics.controlConversations,
    metrics.controlConversions,
    metrics.treatmentConversations,
    metrics.treatmentConversions
  );
  
  // Determine winner
  let winner: 'control' | 'treatment' | null = null;
  let recommendation = '';
  
  if (confidenceLevel >= test.confidenceThreshold) {
    if (treatmentRate > controlRate) {
      winner = 'treatment';
      recommendation = `Fine-tuned model shows ${conversionLift.toFixed(1)}% improvement with ${confidenceLevel.toFixed(1)}% confidence. Recommend full deployment.`;
    } else {
      winner = 'control';
      recommendation = `Base model performs better. Fine-tuned model shows ${Math.abs(conversionLift).toFixed(1)}% worse performance. Keep using base model.`;
    }
  } else {
    recommendation = `Not enough confidence yet (${confidenceLevel.toFixed(1)}% < ${test.confidenceThreshold}%). Continue testing or increase sample size.`;
  }
  
  const results: ABTest['results'] = {
    winner,
    conversionLift,
    ratingLift,
    confidenceLevel,
    recommendation,
  };
  
  // Update test with results
  await FirestoreService.update(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/abTests`,
    testId,
    {
      results,
      status: winner ? (winner === 'treatment' ? 'winner_treatment' : 'winner_control') : 'no_winner',
      updatedAt: new Date().toISOString(),
      completedAt: winner ? new Date().toISOString() : undefined,
    }
  );
  
  logger.info(`[A/B Testing] Test ${testId} evaluated`, {
    testId,
    winner: results.winner ?? 'none',
    conversionLift: results.conversionLift.toFixed(2),
    confidenceLevel: results.confidenceLevel.toFixed(2),
    file: 'ab-testing-service.ts'
  });
  
  return results;
}

/**
 * Get active A/B test for organization
 */
export async function getActiveABTest(): Promise<ABTest | null> {
  const org = await FirestoreService.get<OrganizationConfig>(COLLECTIONS.ORGANIZATIONS, PLATFORM_ID);

  if (!org?.activeABTest) {
    return null;
  }

  const test = await FirestoreService.get<ABTest>(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/abTests`,
    org.activeABTest
  );
  return test ?? null;
}

/**
 * Complete A/B test and optionally deploy winner
 */
export async function completeABTestAndDeploy(
  testId: string,
  autoDeploy: boolean = true
): Promise<{
  deployed: boolean;
  model: string;
  reason: string;
}> {
  const test = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/abTests`,
    testId
  ) as ABTest;
  
  if (!test) {
    throw new Error('Test not found');
  }
  
  // Evaluate if not already done
  if (!test.results) {
    await evaluateABTest(testId);
    // Re-fetch
    const updatedTest = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/abTests`,
      testId
    ) as ABTest;
    Object.assign(test, updatedTest);
  }
  
  if (!test.results?.winner) {
    return {
      deployed: false,
      model: test.controlModel,
      reason: 'No clear winner - continuing with base model',
    };
  }
  
  const winningModel = test.results.winner === 'treatment' 
    ? test.treatmentModel 
    : test.controlModel;
  
  if (autoDeploy && test.results.winner === 'treatment') {
    // Deploy fine-tuned model as the new default
    await FirestoreService.update(
      COLLECTIONS.ORGANIZATIONS,
      PLATFORM_ID,
      {
        preferredModel: winningModel,
        activeABTest: null, // Clear active test
        lastDeployedModel: winningModel,
        lastDeployedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
    
    logger.info(`[A/B Testing] Deployed fine-tuned model: ${winningModel}`, { file: 'ab-testing-service.ts' });
    
    return {
      deployed: true,
      model: winningModel,
      reason: `Fine-tuned model deployed with ${test.results.conversionLift.toFixed(1)}% conversion improvement`,
    };
  }
  
  // Clear active test without deploying
  await FirestoreService.update(
    COLLECTIONS.ORGANIZATIONS,
    PLATFORM_ID,
    {
      activeABTest: null,
      updatedAt: new Date().toISOString(),
    }
  );
  
  return {
    deployed: false,
    model: winningModel,
    reason: test.results.winner === 'control' 
      ? 'Base model performed better - no deployment needed'
      : 'Auto-deploy disabled - manual deployment required',
  };
}

// Helper: Simple hash function for consistent A/B assignment
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

// Helper: Update running average
function updateAverage(currentAvg: number, currentCount: number, newValue: number): number {
  return (currentAvg * currentCount + newValue) / (currentCount + 1);
}

// Helper: Calculate statistical significance (chi-squared approximation)
function calculateStatisticalSignificance(
  controlN: number,
  controlSuccess: number,
  treatmentN: number,
  treatmentSuccess: number
): number {
  // Simple z-test for proportions
  const p1 = controlSuccess / Math.max(controlN, 1);
  const p2 = treatmentSuccess / Math.max(treatmentN, 1);
  const pPooled = (controlSuccess + treatmentSuccess) / Math.max(controlN + treatmentN, 1);
  
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1/controlN + 1/treatmentN));
  
  if (se === 0) {return 0;}
  
  const z = Math.abs(p1 - p2) / se;
  
  // Convert z-score to confidence level (approximation)
  // z=1.96 → 95%, z=2.58 → 99%
  if (z >= 2.58) {return 99;}
  if (z >= 1.96) {return 95;}
  if (z >= 1.64) {return 90;}
  if (z >= 1.28) {return 80;}
  
  return Math.min(z / 1.96 * 95, 100);
}










