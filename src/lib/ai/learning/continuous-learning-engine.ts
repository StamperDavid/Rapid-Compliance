/**
 * Continuous Learning Engine
 * Automatically improves agent from feedback
 */

import type { ContinuousLearningConfig, TrainingExample } from '@/types/fine-tuning';
import { collectTrainingExample, getTrainingDataStats } from '../fine-tuning/data-collector';
import { createOpenAIFineTuningJob } from '../fine-tuning/openai-tuner';
import { createVertexAIFineTuningJob } from '../fine-tuning/vertex-tuner';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

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
  
  if (!config || !config.autoCollectTrainingData) {
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
    console.log(
      `[Continuous Learning] Not enough examples: ${stats.approved}/${config.minExamplesForTraining}`
    );
    return false;
  }
  
  // Check last training date
  const lastJob = await getLastFineTuningJob(organizationId);
  
  if (lastJob) {
    const daysSinceLastTraining = getDaysSince(lastJob.createdAt);
    
    switch (config.trainingFrequency) {
      case 'weekly':
        if (daysSinceLastTraining < 7) return false;
        break;
      case 'monthly':
        if (daysSinceLastTraining < 30) return false;
        break;
      case 'quarterly':
        if (daysSinceLastTraining < 90) return false;
        break;
    }
  }
  
  // Check budget
  const monthlySpend = await getMonthlyTrainingSpend(organizationId);
  if (monthlySpend >= config.maxMonthlyTrainingCost) {
    console.log('[Continuous Learning] Budget limit reached');
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
  console.log(`[Continuous Learning] Triggering fine-tuning for ${organizationId}`);
  
  // Get approved examples
  const examples = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/trainingExamples`,
    [{ field: 'status', operator: '==', value: 'approved' }] as any
  ) as TrainingExample[];
  
  if (examples.length === 0) {
    throw new Error('No approved examples found');
  }
  
  // Get organization's model preferences
  const orgConfig = await FirestoreService.get(
    COLLECTIONS.ORGANIZATIONS,
    organizationId
  ) as any;
  
  const preferredModel = orgConfig?.preferredModel || 'gpt-4';
  
  // Create fine-tuning job
  let job;
  if (preferredModel.startsWith('gpt-')) {
    job = await createOpenAIFineTuningJob({
      organizationId,
      baseModel: preferredModel as any,
      examples,
    });
  } else if (preferredModel.startsWith('gemini-')) {
    job = await createVertexAIFineTuningJob({
      organizationId,
      baseModel: preferredModel as any,
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
  
  if (jobs.length === 0) return null;
  
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
  
  return monthlyJobs.reduce((sum: number, job: any) => 
    sum + (job.actualCost || job.estimatedCost || 0), 
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
}> {
  const config = await getLearningConfig(organizationId);
  
  if (!config || !config.autoDeployFineTunedModels) {
    return { deployed: false, reason: 'Auto-deployment disabled' };
  }
  
  // TODO: Implement A/B testing and performance comparison
  // For now, return manual approval required
  return { deployed: false, reason: 'Awaiting human approval' };
}

