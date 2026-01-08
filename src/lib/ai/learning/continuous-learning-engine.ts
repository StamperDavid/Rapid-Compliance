/**
 * Continuous Learning Engine
 * Automatically improves agent from feedback
 */

import type { ContinuousLearningConfig, TrainingExample } from '@/types/fine-tuning';
import { collectTrainingExample, getTrainingDataStats } from '../fine-tuning/data-collector';
import { createOpenAIFineTuningJob } from '../fine-tuning/openai-tuner';
import { createVertexAIFineTuningJob } from '../fine-tuning/vertex-tuner';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { where } from 'firebase/firestore';

/**
 * Process conversation feedback and trigger learning
 */
export async function processConversationFeedback(params: {
  organizationId: string;
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
  confidence: number;
  userRating?: number;
  didConvert?: boolean;
  userFeedback?: string;
}): Promise<{
  collected: boolean;
  shouldTriggerTraining: boolean;
  trainingJobId?: string;
}> {
  const { organizationId } = params;
  
  // Get learning config
  const config = await getLearningConfig(organizationId);
  
  if (!config?.autoCollectTrainingData) {
    return { collected: false, shouldTriggerTraining: false };
  }
  
  // Check if meets quality criteria
  const meetsQuality =
    params.confidence >= config.minConfidenceForCollection ||
    (params.userRating && params.userRating >= config.minRatingForCollection);
  
  if (!meetsQuality) {
    return { collected: false, shouldTriggerTraining: false };
  }
  
  // Collect training example
  const example = await collectTrainingExample(params);
  
  if (!example) {
    return { collected: false, shouldTriggerTraining: false };
  }
  
  // Check if we should trigger training
  const shouldTrigger = await shouldTriggerFineTuning(organizationId, config);
  
  if (!shouldTrigger) {
    return { collected: true, shouldTriggerTraining: false };
  }
  
  // Trigger fine-tuning
  const trainingJobId = await triggerFineTuning(organizationId, config);
  
  return {
    collected: true,
    shouldTriggerTraining: true,
    trainingJobId,
  };
}

/**
 * Check if should trigger fine-tuning
 */
async function shouldTriggerFineTuning(
  organizationId: string,
  config: ContinuousLearningConfig
): Promise<boolean> {
  if (!config.autoTriggerFineTuning) {
    return false;
  }
  
  // Get training data stats
  const stats = await getTrainingDataStats(organizationId);
  
  // Need minimum approved examples
  if (stats.approved < config.minExamplesForTraining) {
    logger.info('[Continuous Learning] Not enough examples', { 
      approved: stats.approved, 
      required: config.minExamplesForTraining,
      file: 'continuous-learning-engine.ts' 
    });
    return false;
  }
  
  // Check last training date
  const lastJob = await getLastFineTuningJob(organizationId);
  
  if (lastJob) {
    const daysSinceLastTraining = getDaysSince(lastJob.createdAt);
    
    switch (config.trainingFrequency) {
      case 'weekly':
        if (daysSinceLastTraining < 7) {return false;}
        break;
      case 'monthly':
        if (daysSinceLastTraining < 30) {return false;}
        break;
      case 'quarterly':
        if (daysSinceLastTraining < 90) {return false;}
        break;
    }
  }
  
  // Check budget
  const monthlySpend = await getMonthlyTrainingSpend(organizationId);
  if (monthlySpend >= config.maxMonthlyTrainingCost) {
    logger.info('[Continuous Learning] Budget limit reached', { file: 'continuous-learning-engine.ts' });
    return false;
  }
  
  return true;
}

/**
 * Trigger fine-tuning with approved examples
 */
async function triggerFineTuning(
  organizationId: string,
  config: ContinuousLearningConfig
): Promise<string> {
  logger.info('Continuous Learning Triggering fine-tuning for organizationId}', { file: 'continuous-learning-engine.ts' });
  
  // Get approved examples
  const examples = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingExamples`,
    [where('status', '==', 'approved')] as any
  ) as unknown as TrainingExample[];
  
  if (examples.length === 0) {
    throw new Error('No approved examples found');
  }
  
  // Get organization's model preferences
  const orgConfig = await FirestoreService.get(
    COLLECTIONS.ORGANIZATIONS,
    organizationId
  ) as any;
  
  // Extract preferred model - empty string is invalid model name (Explicit Ternary for STRING)
  const rawPreferredModel = orgConfig?.preferredModel;
  const preferredModel = (rawPreferredModel !== '' && rawPreferredModel != null) ? rawPreferredModel : 'gpt-4';
  
  // Create fine-tuning job
  let job;
  if (preferredModel.startsWith('gpt-')) {
    job = await createOpenAIFineTuningJob({
      organizationId,
      baseModel: preferredModel,
      examples,
    });
  } else if (preferredModel.startsWith('gemini-')) {
    job = await createVertexAIFineTuningJob({
      organizationId,
      baseModel: preferredModel,
      examples,
    });
  } else {
    throw new Error(`Unsupported model for fine-tuning: ${preferredModel}`);
  }
  
  return job.id;
}

/**
 * Get learning configuration
 */
async function getLearningConfig(
  organizationId: string
): Promise<ContinuousLearningConfig | null> {
  try {
    const config = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/config`,
      'continuousLearning'
    );
    return config as ContinuousLearningConfig;
  } catch (error) {
    // Return default config if not found
    return {
      organizationId,
      autoCollectTrainingData: true,
      minConfidenceForCollection: 80,
      minRatingForCollection: 4,
      autoTriggerFineTuning: false, // Safer default
      minExamplesForTraining: 50,
      trainingFrequency: 'monthly',
      autoDeployFineTunedModels: false, // Safer default
      minImprovementForDeploy: 10,
      maxMonthlyTrainingCost: 100,
      requireHumanApproval: true,
      approvers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Get last fine-tuning job
 */
async function getLastFineTuningJob(organizationId: string): Promise<any> {
  const jobs = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
    []
  );
  
  if (jobs.length === 0) {return null;}
  
  // Sort by created date descending
  jobs.sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return jobs[0];
}

/**
 * Get monthly training spend
 */
async function getMonthlyTrainingSpend(organizationId: string): Promise<number> {
  const jobs = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
    []
  );
  
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  
  const monthlyJobs = jobs.filter((job: any) => {
    const jobDate = new Date(job.createdAt);
    return jobDate >= thisMonth;
  });
  
  // Costs are NUMBERS - 0 is valid (use ?? for numbers)
  return monthlyJobs.reduce((sum: number, job: any) => 
    sum + (job.actualCost ?? job.estimatedCost ?? 0), 
    0
  );
}

/**
 * Get days since a date
 */
function getDaysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Auto-deploy fine-tuned model if it performs better
 */
export async function evaluateAndDeployModel(
  organizationId: string,
  fineTunedModelId: string
): Promise<{
  deployed: boolean;
  reason: string;
  testId?: string;
}> {
  const config = await getLearningConfig(organizationId);
  
  if (!config?.autoDeployFineTunedModels) {
    return { deployed: false, reason: 'Auto-deployment disabled' };
  }
  
  // Import A/B testing service
  const { createABTest, getActiveABTest } = await import('./ab-testing-service');
  
  // Check if there's already an active test
  const existingTest = await getActiveABTest(organizationId);
  if (existingTest?.status === 'running') {
    return {
      deployed: false,
      reason: `A/B test already running (${existingTest.id}). Wait for completion.`,
      testId: existingTest.id,
    };
  }
  
  // Get organization's current model
  const orgConfig = await FirestoreService.get(
    COLLECTIONS.ORGANIZATIONS,
    organizationId
  ) as any;
  
  // Extract current model - empty string is invalid model name (Explicit Ternary for STRING)
  const rawCurrentModel = orgConfig?.preferredModel;
  const currentModel = (rawCurrentModel !== '' && rawCurrentModel != null) ? rawCurrentModel : 'gpt-4';
  
  // Start A/B test
  const test = await createABTest({
    organizationId,
    controlModel: currentModel,
    treatmentModel: fineTunedModelId,
    trafficSplit: 50, // 50/50 split
    minSampleSize: config.minImprovementForDeploy > 0 ? 100 : 50,
    confidenceThreshold: 95,
  });
  
  logger.info('Continuous Learning Started A/B test: test.id}', { file: 'continuous-learning-engine.ts' });
  logger.info('Continuous Learning Control: currentModel}, Treatment: fineTunedModelId}', { file: 'continuous-learning-engine.ts' });
  
  return {
    deployed: false,
    reason: `A/B test started. Fine-tuned model will be evaluated against base model. Test ID: ${test.id}`,
    testId: test.id,
  };
}

/**
 * Process completed fine-tuning job and start A/B testing
 */
export async function processCompletedFineTuningJob(
  organizationId: string,
  jobId: string
): Promise<{
  success: boolean;
  message: string;
  testId?: string;
}> {
  // Get the job
  const job = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
    jobId
  ) as any;
  
  if (!job) {
    return { success: false, message: 'Job not found' };
  }
  
  if (job.status !== 'completed' || !job.fineTunedModelId) {
    return { success: false, message: `Job not ready: status=${job.status}` };
  }
  
  // Start A/B testing
  const result = await evaluateAndDeployModel(organizationId, job.fineTunedModelId);
  
  // Update job with test info
  await FirestoreService.update(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
    jobId,
    {
      abTestId: result.testId,
      abTestStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );
  
  return {
    success: true,
    message: result.reason,
    testId: result.testId,
  };
}

/**
 * Check A/B test results and auto-deploy if winner
 */
export async function checkAndDeployWinner(
  organizationId: string
): Promise<{
  deployed: boolean;
  model?: string;
  reason: string;
}> {
  const { getActiveABTest, completeABTestAndDeploy } = await import('./ab-testing-service');
  
  const test = await getActiveABTest(organizationId);
  
  if (!test) {
    return { deployed: false, reason: 'No active A/B test' };
  }
  
  if (test.status === 'running') {
    const progress = Math.min(
      test.metrics.controlConversations / test.minSampleSize,
      test.metrics.treatmentConversations / test.minSampleSize
    ) * 100;
    
    return {
      deployed: false,
      reason: `Test still running (${progress.toFixed(0)}% complete). Need ${test.minSampleSize} conversations each.`,
    };
  }
  
  // Get config to check auto-deploy setting
  const config = await getLearningConfig(organizationId);
  const autoDeploy = config?.autoDeployFineTunedModels ?? false;
  
  const result = await completeABTestAndDeploy(organizationId, test.id, autoDeploy);
  
  return {
    deployed: result.deployed,
    model: result.model,
    reason: result.reason,
  };
}










