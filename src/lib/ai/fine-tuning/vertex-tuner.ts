/**
 * Vertex AI Fine-Tuning
 * Real model training on Gemini
 */

import type { TrainingExample, FineTuningJob } from '@/types/fine-tuning';
import { validateTrainingData } from './data-formatter';
import { FirestoreService } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

/**
 * Create fine-tuning job with Vertex AI.
 *
 * NOTE: Vertex AI fine-tuning is not yet implemented. Google Cloud credentials
 * and the Vertex AI SDK must be configured before this feature can be used.
 * This function throws an explicit error rather than creating a fake job record.
 */
export function createVertexAIFineTuningJob(params: {
  baseModel: 'gemini-1.5-pro' | 'gemini-1.0-pro';
  examples: TrainingExample[];
  hyperparameters?: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
  };
}): Promise<FineTuningJob> {
  const { baseModel, examples } = params;

  logger.warn('[Vertex AI Fine-Tuning] createVertexAIFineTuningJob called but Vertex AI is not configured', {
    file: 'vertex-tuner.ts',
    baseModel,
    exampleCount: examples.length,
  });

  // Validate training data first so callers get meaningful feedback even before
  // the configuration error surface.
  const validation = validateTrainingData(examples);
  if (!validation.isValid) {
    return Promise.reject(
      new Error(`Training data validation failed: ${validation.errors.join(', ')}`)
    );
  }

  return Promise.reject(
    new Error(
      'Vertex AI fine-tuning is not configured. ' +
      'This feature requires Google Cloud credentials, the Vertex AI API enabled, ' +
      'and a Cloud Storage bucket. Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_LOCATION, ' +
      'and GOOGLE_CLOUD_STORAGE_BUCKET in your environment and install @google-cloud/aiplatform.'
    )
  );
}

/**
 * Upload training data to Cloud Storage.
 *
 * NOTE: Cloud Storage is not yet configured. This function throws an explicit
 * error rather than returning a fake gs:// URI.
 */
function uploadToCloudStorage(
  _data: string,
  _filename: string
): string {
  throw new Error(
    'Cloud Storage upload is not configured. ' +
    'This feature requires the @google-cloud/storage package and ' +
    'GOOGLE_CLOUD_STORAGE_BUCKET to be set in your environment.'
  );
}

// Keep the reference so the module export surface is consistent and the
// function is not treated as dead code by linters.
export { uploadToCloudStorage };

/**
 * Estimate Vertex AI fine-tuning cost
 */
function estimateVertexAICost(exampleCount: number): number {
  // Vertex AI pricing for Gemini fine-tuning (estimated)
  // Approximately $3 per 1000 training examples
  return (exampleCount / 1000) * 3;
}

// Exported so callers can surface cost estimates in the UI even before the
// feature is fully configured.
export { estimateVertexAICost };

/**
 * Get fine-tuning job status
 */
export async function getVertexAIJobStatus(
  jobId: string
): Promise<FineTuningJob> {
  const job = await FirestoreService.get(
    getSubCollection('fineTuningJobs'),
    jobId
  ) as FineTuningJob;

  // In production, would query Vertex AI API for actual status

  return job;
}
