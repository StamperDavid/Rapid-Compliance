/**
 * OpenAI Fine-Tuning
 * Real model training on GPT-4
 */

import type { TrainingExample, FineTuningJob } from '@/types/fine-tuning';
import { formatForOpenAI, validateTrainingData } from './data-formatter';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

/**
 * Create fine-tuning job with OpenAI
 */
export async function createOpenAIFineTuningJob(params: {
  organizationId: string;
  baseModel: 'gpt-4' | 'gpt-3.5-turbo';
  examples: TrainingExample[];
  hyperparameters?: {
    epochs?: number;
    batchSize?: number;
    learningRateMultiplier?: number;
  };
}): Promise<FineTuningJob> {
  const { organizationId, baseModel, examples, hyperparameters } = params;
  
  console.log(`[OpenAI Fine-Tuning] Starting job for ${organizationId}`);
  
  // Validate data
  const validation = validateTrainingData(examples);
  if (!validation.isValid) {
    throw new Error(`Training data validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Format data for OpenAI
  const formattedData = formatForOpenAI(examples);
  
  // Upload training file to OpenAI
  const fileId = await uploadTrainingFile(formattedData);
  
  // Create fine-tuning job
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const response = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      training_file: fileId,
      model: baseModel,
      hyperparameters: {
        n_epochs: hyperparameters?.epochs || 'auto',
        batch_size: hyperparameters?.batchSize || 'auto',
        learning_rate_multiplier: hyperparameters?.learningRateMultiplier || 'auto',
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI fine-tuning error: ${JSON.stringify(error)}`);
  }
  
  const jobData = await response.json();
  
  // Estimate cost (rough approximation)
  const estimatedCost = estimateFineTuningCost(examples.length, baseModel);
  
  // Save job to Firestore
  const job: FineTuningJob = {
    id: `job_${Date.now()}`,
    organizationId,
    provider: 'openai',
    baseModel,
    datasetId: 'uploaded',
    hyperparameters: hyperparameters || {},
    status: 'running',
    progress: 0,
    providerJobId: jobData.id,
    estimatedCost,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
    job.id,
    job,
    false
  );
  
  console.log(`[OpenAI Fine-Tuning] Job created: ${job.id}`);
  
  // Start monitoring job
  monitorFineTuningJob(organizationId, job.id, jobData.id);
  
  return job;
}

/**
 * Upload training file to OpenAI
 */
async function uploadTrainingFile(data: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  // Create form data
  const formData = new FormData();
  const blob = new Blob([data], { type: 'application/json' });
  formData.append('file', blob, 'training_data.jsonl');
  formData.append('purpose', 'fine-tune');
  
  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to upload file: ${JSON.stringify(error)}`);
  }
  
  const fileData = await response.json();
  return fileData.id;
}

/**
 * Monitor fine-tuning job progress
 */
async function monitorFineTuningJob(
  organizationId: string,
  jobId: string,
  providerJobId: string
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;
  
  const checkStatus = async () => {
    try {
      const response = await fetch(
        `https://api.openai.com/v1/fine_tuning/jobs/${providerJobId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );
      
      if (!response.ok) {
        console.error('[OpenAI Fine-Tuning] Failed to check status');
        return;
      }
      
      const jobData = await response.json();
      
      // Update job in Firestore
      const updates: any = {
        status: mapJobStatus(jobData.status),
        updatedAt: new Date().toISOString(),
      };
      
      if (jobData.fine_tuned_model) {
        updates.fineTunedModelId = jobData.fine_tuned_model;
        updates.completedAt = new Date().toISOString();
      }
      
      if (jobData.error) {
        updates.error = JSON.stringify(jobData.error);
      }
      
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
        jobId,
        updates
      );
      
      // If still running, check again in 30 seconds
      if (jobData.status === 'running' || jobData.status === 'validating_files') {
        setTimeout(checkStatus, 30000);
      }
    } catch (error) {
      console.error('[OpenAI Fine-Tuning] Monitoring error:', error);
    }
  };
  
  // Start monitoring
  setTimeout(checkStatus, 10000); // Check after 10 seconds
}

/**
 * Map OpenAI job status to our status
 */
function mapJobStatus(status: string): FineTuningJob['status'] {
  switch (status) {
    case 'validating_files':
    case 'queued':
    case 'running':
      return 'running';
    case 'succeeded':
      return 'completed';
    case 'failed':
    case 'cancelled':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Estimate fine-tuning cost
 */
function estimateFineTuningCost(exampleCount: number, model: string): number {
  // OpenAI pricing (approximate):
  // GPT-3.5: $0.008 per 1K tokens for training
  // GPT-4: Not publicly available for fine-tuning yet
  
  const avgTokensPerExample = 200; // Rough estimate
  const totalTokens = exampleCount * avgTokensPerExample;
  
  if (model === 'gpt-3.5-turbo') {
    return (totalTokens / 1000) * 0.008;
  } else {
    return (totalTokens / 1000) * 0.03; // Estimated for GPT-4
  }
}

/**
 * Cancel fine-tuning job
 */
export async function cancelFineTuningJob(
  organizationId: string,
  jobId: string
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  // Get job to get provider job ID
  const job = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
    jobId
  ) as FineTuningJob;
  
  if (!job.providerJobId) {
    throw new Error('Provider job ID not found');
  }
  
  // Cancel on OpenAI
  await fetch(
    `https://api.openai.com/v1/fine_tuning/jobs/${job.providerJobId}/cancel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );
  
  // Update in Firestore
  await FirestoreService.update(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/fineTuningJobs`,
    jobId,
    {
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    }
  );
}



















