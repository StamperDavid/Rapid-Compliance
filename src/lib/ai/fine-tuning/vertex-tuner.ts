/**
 * Vertex AI Fine-Tuning
 * Real model training on Gemini via Google Cloud Vertex AI APIs
 */

import type { TrainingExample, FineTuningJob } from '@/types/fine-tuning';
import { validateTrainingData } from './data-formatter';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

// Google Cloud configuration resolved from API keys
interface GoogleCloudConfig {
  projectId: string;
  location: string;
  storageBucket: string;
  serviceAccountKey?: string;
  accessToken?: string;
}

/**
 * Resolve Google Cloud credentials from Firestore API key store.
 * Returns null (not throw) if credentials are not configured.
 */
async function resolveGoogleCloudConfig(): Promise<GoogleCloudConfig | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'googleCloud') as Record<string, string> | null;

  if (!keys) {
    return null;
  }

  const projectId = keys.projectId ?? keys.project_id ?? process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = keys.location ?? keys.region ?? process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1';
  const storageBucket = keys.storageBucket ?? keys.storage_bucket ?? process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

  if (!projectId || !storageBucket) {
    return null;
  }

  return {
    projectId,
    location,
    storageBucket,
    serviceAccountKey: keys.serviceAccountKey ?? keys.service_account_key,
    accessToken: keys.accessToken ?? keys.access_token,
  };
}

/**
 * Get an access token for Google Cloud API calls.
 * Uses service account key if available, otherwise falls back to stored access token.
 */
async function getAccessToken(config: GoogleCloudConfig): Promise<string> {
  // If a pre-configured access token is available, use it
  if (config.accessToken) {
    return config.accessToken;
  }

  // If service account key is available, exchange it for an access token
  if (config.serviceAccountKey) {
    const serviceAccount = JSON.parse(config.serviceAccountKey) as {
      client_email: string;
      private_key: string;
      token_uri: string;
    };

    // Create JWT assertion
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: serviceAccount.token_uri,
      exp: now + 3600,
      iat: now,
    })).toString('base64url');

    // Sign with the private key using Node.js crypto
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(serviceAccount.private_key, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch(serviceAccount.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to obtain Google Cloud access token: ${await tokenResponse.text()}`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    return tokenData.access_token;
  }

  throw new Error('No Google Cloud credentials available. Provide either an access token or service account key.');
}

/**
 * Upload training data to Google Cloud Storage.
 * Converts training examples to JSONL format and uploads to the configured bucket.
 *
 * @returns The gs:// URI of the uploaded file.
 */
async function uploadToCloudStorage(
  data: string,
  filename: string
): Promise<string> {
  const config = await resolveGoogleCloudConfig();
  if (!config) {
    return Promise.reject(new Error(
      'Google Cloud Storage is not configured. ' +
      'Add googleCloud credentials (projectId, storageBucket) in Settings > API Keys.'
    ));
  }

  const accessToken = await getAccessToken(config);
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${config.storageBucket}/o?uploadType=media&name=${encodeURIComponent(filename)}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/jsonl',
    },
    body: data,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloud Storage upload failed: ${errorText}`);
  }

  const gsUri = `gs://${config.storageBucket}/${filename}`;
  logger.info(`[Vertex AI] Training data uploaded to ${gsUri}`, { file: 'vertex-tuner.ts' });
  return gsUri;
}

export { uploadToCloudStorage };

/**
 * Create fine-tuning job with Vertex AI.
 *
 * Uploads training data to Cloud Storage in JSONL format, then creates a
 * supervised tuning job via the Vertex AI REST API. If Google Cloud
 * credentials are not configured, returns a descriptive error.
 */
export async function createVertexAIFineTuningJob(params: {
  baseModel: 'gemini-1.5-pro' | 'gemini-1.0-pro';
  examples: TrainingExample[];
  hyperparameters?: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
  };
}): Promise<FineTuningJob> {
  const { baseModel, examples, hyperparameters } = params;

  // Validate training data first
  const validation = validateTrainingData(examples);
  if (!validation.isValid) {
    throw new Error(`Training data validation failed: ${validation.errors.join(', ')}`);
  }

  // Resolve Google Cloud config
  const config = await resolveGoogleCloudConfig();
  if (!config) {
    throw new Error(
      'Vertex AI fine-tuning requires Google Cloud credentials. ' +
      'Add googleCloud credentials (projectId, storageBucket, location, and either ' +
      'serviceAccountKey or accessToken) in Settings > API Keys.'
    );
  }

  logger.info('[Vertex AI Fine-Tuning] Creating fine-tuning job', {
    file: 'vertex-tuner.ts',
    baseModel,
    exampleCount: examples.length,
    location: config.location,
  });

  // Convert training examples to Vertex AI JSONL format
  const jsonlData = examples.map(example => {
    const messages = example.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));
    return JSON.stringify({ contents: messages });
  }).join('\n');

  // Upload training data to Cloud Storage
  const timestamp = Date.now();
  const filename = `fine-tuning/training-data-${timestamp}.jsonl`;
  const gsUri = await uploadToCloudStorage(jsonlData, filename);

  // Map base model to Vertex AI model resource name
  const modelMap: Record<string, string> = {
    'gemini-1.5-pro': 'gemini-1.5-pro-002',
    'gemini-1.0-pro': 'gemini-1.0-pro-002',
  };
  const sourceModel = modelMap[baseModel] ?? baseModel;

  // Create the tuning job via Vertex AI REST API
  const accessToken = await getAccessToken(config);
  const tuningEndpoint = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/tuningJobs`;

  const tuningRequest: Record<string, unknown> = {
    baseModel: sourceModel,
    supervisedTuningSpec: {
      trainingDatasetUri: gsUri,
      hyperParameters: {
        epochCount: hyperparameters?.epochs ?? 3,
        learningRateMultiplier: hyperparameters?.learningRate ?? 1.0,
      },
    },
    tunedModelDisplayName: `ft-${baseModel}-${timestamp}`,
  };

  const response = await fetch(tuningEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tuningRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI tuning job creation failed: ${errorText}`);
  }

  interface VertexTuningJobResponse {
    name: string;
    state: string;
    createTime: string;
  }

  const jobResponse = await response.json() as VertexTuningJobResponse;

  // Extract job ID from resource name (format: projects/.../locations/.../tuningJobs/{id})
  const jobId = jobResponse.name.split('/').pop() ?? `vertex_${timestamp}`;

  // Create local job record in Firestore
  const job: FineTuningJob = {
    id: jobId,
    provider: 'google',
    baseModel,
    datasetId: gsUri,
    hyperparameters: {
      epochs: hyperparameters?.epochs ?? 3,
      batchSize: hyperparameters?.batchSize ?? 16,
      learningRateMultiplier: hyperparameters?.learningRate ?? 1.0,
    },
    status: 'running',
    progress: 0,
    providerJobId: jobResponse.name,
    estimatedCost: estimateVertexAICost(examples.length),
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };

  await FirestoreService.set(
    getSubCollection('fineTuningJobs'),
    jobId,
    job,
    false
  );

  logger.info(`[Vertex AI Fine-Tuning] Job created: ${jobId}`, {
    file: 'vertex-tuner.ts',
    providerJobId: jobResponse.name,
    estimatedCost: job.estimatedCost,
  });

  return job;
}

/**
 * Estimate Vertex AI fine-tuning cost
 */
function estimateVertexAICost(exampleCount: number): number {
  // Vertex AI pricing for Gemini fine-tuning (estimated)
  // Approximately $3 per 1000 training examples
  return (exampleCount / 1000) * 3;
}

export { estimateVertexAICost };

/**
 * Get fine-tuning job status.
 * Queries the Vertex AI API for the current job state and syncs it to Firestore.
 */
export async function getVertexAIJobStatus(
  jobId: string
): Promise<FineTuningJob> {
  const job = await FirestoreService.get(
    getSubCollection('fineTuningJobs'),
    jobId
  ) as FineTuningJob;

  if (!job) {
    throw new Error(`Fine-tuning job ${jobId} not found`);
  }

  // If job has a provider job ID and is still running, query Vertex AI for live status
  if (job.providerJobId && (job.status === 'running' || job.status === 'pending')) {
    try {
      const config = await resolveGoogleCloudConfig();
      if (config) {
        const accessToken = await getAccessToken(config);
        const response = await fetch(
          `https://${config.location}-aiplatform.googleapis.com/v1/${job.providerJobId}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (response.ok) {
          interface VertexJobStatus {
            state: string;
            tunedModel?: { model?: string; endpoint?: string };
            error?: { message?: string };
          }

          const vertexJob = await response.json() as VertexJobStatus;

          // Map Vertex AI state to our status
          const stateMap: Record<string, FineTuningJob['status']> = {
            JOB_STATE_PENDING: 'pending',
            JOB_STATE_RUNNING: 'running',
            JOB_STATE_SUCCEEDED: 'completed',
            JOB_STATE_FAILED: 'failed',
            JOB_STATE_CANCELLED: 'cancelled',
          };

          const newStatus = stateMap[vertexJob.state] ?? job.status;
          const updates: Partial<FineTuningJob> = { status: newStatus };

          if (newStatus === 'completed' && vertexJob.tunedModel?.model) {
            updates.fineTunedModelId = vertexJob.tunedModel.model;
            updates.completedAt = new Date().toISOString();
            updates.progress = 100;
          } else if (newStatus === 'failed' && vertexJob.error?.message) {
            updates.error = vertexJob.error.message;
          }

          // Sync to Firestore
          await FirestoreService.set(
            getSubCollection('fineTuningJobs'),
            jobId,
            { ...job, ...updates },
            false
          );

          return { ...job, ...updates };
        }
      }
    } catch (error) {
      logger.warn('[Vertex AI] Failed to fetch live job status, returning cached status', {
        file: 'vertex-tuner.ts',
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return job;
}
