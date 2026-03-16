/**
 * Kling 3.0 Provider — Cinematic Video & Image Generation
 *
 * Best for: cinematic video generation, complex camera movements,
 * high-quality talking heads, and video content for campaigns.
 *
 * Auth: JWT signed with HMAC-SHA256 from access_key + secret_key.
 * Stored in Firestore as a single string "accessKey:secretKey".
 *
 * Generation is asynchronous — submit a task, then poll for completion.
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import type {
  GenerationResult,
  GenerationMetadata,
  ProviderCapability,
  AspectRatio,
} from '@/types/creative-studio';

// ─── Types ───────────────────────────────────────────────────────────

export interface KlingGenerationOptions {
  model?: string;
  negativePrompt?: string;
  aspectRatio?: AspectRatio;
  imageFidelity?: number;
}

export interface KlingVideoOptions {
  model?: string;
  negativePrompt?: string;
  aspectRatio?: AspectRatio;
  duration?: '5' | '10';
  mode?: 'std' | 'pro';
}

export interface KlingModelInfo {
  id: string;
  name: string;
  description: string;
  type: 'image' | 'video';
  costPerUnit: number;
}

export interface KlingTaskStatus {
  taskId: string;
  status: 'submitted' | 'processing' | 'succeed' | 'failed';
  resultUrl?: string;
  resultWidth?: number;
  resultHeight?: number;
  errorMessage?: string;
}

interface KlingCreateResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: string;
    task_status_msg?: string;
  };
}

interface KlingImageTaskResult {
  index: number;
  url: string;
}

interface KlingVideoTaskResult {
  id: string;
  url: string;
  duration: string;
}

interface KlingStatusResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: string;
    task_status_msg?: string;
    task_result?: {
      images?: KlingImageTaskResult[];
      videos?: KlingVideoTaskResult[];
    };
    created_at?: number;
    updated_at?: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────

const KLING_BASE_URL = 'https://api.klingai.com/v1';

const DEFAULT_IMAGE_MODEL = 'kling-v1';
const DEFAULT_VIDEO_MODEL = 'kling-v1';

const IMAGE_COST = 0.014;
const VIDEO_COST_5S = 0.07;
const VIDEO_COST_10S = 0.14;
const VIDEO_COST_PRO_5S = 0.14;
const VIDEO_COST_PRO_10S = 0.28;

const ASPECT_RATIO_MAP: Record<AspectRatio, string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '9:16': '9:16',
  '21:9': '16:9',   // Kling doesn't support 21:9, fall back
  '4:3': '4:3',
  '3:2': '3:2',
};

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 896 },
  '3:2': { width: 1216, height: 832 },
};

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120; // 10 minutes at 5s intervals

// ─── JWT Generation (pure Node.js crypto) ────────────────────────────

/**
 * Create a JWT token for Kling API authentication using Node.js crypto.
 * Kling requires HS256 JWT signed with the secret key.
 */
async function createKlingJWT(accessKey: string, secretKey: string): Promise<string> {
  const crypto = await import('crypto');

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: nowSeconds + 1800,  // 30 minutes
    nbf: nowSeconds - 5,     // 5 second grace period
    iat: nowSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header))
    .toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload))
    .toString('base64url');

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

// ─── API Key & Auth ──────────────────────────────────────────────────

/**
 * Get Kling credentials from Firestore and generate a JWT.
 * Stored as "accessKey:secretKey" in the kling service key slot.
 */
async function getKlingAuthHeader(): Promise<string> {
  const raw = await apiKeyService.getServiceKey(PLATFORM_ID, 'kling');
  if (typeof raw !== 'string' || !raw.includes(':')) {
    throw new Error(
      'Kling API credentials not configured. Add access_key:secret_key in Settings > API Keys.'
    );
  }

  const colonIndex = raw.indexOf(':');
  const accessKey = raw.slice(0, colonIndex);
  const secretKey = raw.slice(colonIndex + 1);

  if (!accessKey || !secretKey) {
    throw new Error('Kling API credentials malformed. Expected format: accessKey:secretKey');
  }

  const jwt = await createKlingJWT(accessKey, secretKey);
  return `Bearer ${jwt}`;
}

// ─── Helper: Make Kling API Request ──────────────────────────────────

async function klingFetch<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<T> {
  const authHeader = await getKlingAuthHeader();
  const url = `${KLING_BASE_URL}${path}`;

  const fetchOptions: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[Kling] API error', new Error(errorText), {
      status: response.status,
      path,
      file: 'kling-provider.ts',
    });
    throw new Error(`Kling API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
}

// ─── Image Generation ────────────────────────────────────────────────

/**
 * Generate an image using Kling AI.
 * Submits a task and polls until completion.
 *
 * @param prompt - The text prompt
 * @param options - Model, aspect ratio, fidelity settings
 * @returns GenerationResult with URL, cost, and metadata
 */
export async function generateWithKling(
  prompt: string,
  options: KlingGenerationOptions = {}
): Promise<GenerationResult> {
  const model = options.model ?? DEFAULT_IMAGE_MODEL;
  const aspectRatio = options.aspectRatio ?? '1:1';
  const klingAspectRatio = ASPECT_RATIO_MAP[aspectRatio] ?? '1:1';

  logger.info('[Kling] Starting image generation', {
    model,
    aspectRatio: klingAspectRatio,
    promptLength: prompt.length,
    file: 'kling-provider.ts',
  });

  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    aspect_ratio: klingAspectRatio,
  };

  if (options.negativePrompt) {
    requestBody.negative_prompt = options.negativePrompt;
  }
  if (options.imageFidelity !== undefined) {
    requestBody.image_fidelity = options.imageFidelity;
  }

  const createResponse = await klingFetch<KlingCreateResponse>(
    '/images/generations',
    { method: 'POST', body: requestBody }
  );

  if (createResponse.code !== 0) {
    throw new Error(`Kling image creation failed: ${createResponse.message}`);
  }

  const taskId = createResponse.data.task_id;

  logger.info('[Kling] Image task created, polling for result', {
    taskId,
    file: 'kling-provider.ts',
  });

  // Poll for completion
  const result = await pollKlingStatus(taskId, 'image');

  if (result.status === 'failed') {
    throw new Error(`Kling image generation failed: ${result.errorMessage ?? 'Unknown error'}`);
  }

  if (!result.resultUrl) {
    throw new Error('Kling image generation completed but no result URL returned');
  }

  const dimensions = ASPECT_RATIO_DIMENSIONS[klingAspectRatio] ?? { width: 1024, height: 1024 };

  const metadata: GenerationMetadata = {
    width: result.resultWidth ?? dimensions.width,
    height: result.resultHeight ?? dimensions.height,
    format: 'image/png',
  };

  const generationId = `kling-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  logger.info('[Kling] Image generation completed', {
    generationId,
    taskId,
    file: 'kling-provider.ts',
  });

  return {
    id: generationId,
    url: result.resultUrl,
    provider: 'kling',
    model,
    cost: IMAGE_COST,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

// ─── Video Generation ────────────────────────────────────────────────

/**
 * Generate a video using Kling AI (text-to-video).
 * Submits a task and polls until completion.
 *
 * @param prompt - The text prompt describing the desired video
 * @param options - Model, duration, mode, aspect ratio settings
 * @returns GenerationResult with video URL, cost, and metadata
 */
export async function generateVideoWithKling(
  prompt: string,
  options: KlingVideoOptions = {}
): Promise<GenerationResult> {
  const model = options.model ?? DEFAULT_VIDEO_MODEL;
  const aspectRatio = options.aspectRatio ?? '16:9';
  const klingAspectRatio = ASPECT_RATIO_MAP[aspectRatio] ?? '16:9';
  const duration = options.duration ?? '5';
  const mode = options.mode ?? 'std';

  logger.info('[Kling] Starting video generation', {
    model,
    videoDuration: String(duration),
    mode,
    aspectRatio: klingAspectRatio,
    promptLength: prompt.length,
    file: 'kling-provider.ts',
  });

  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    duration,
    aspect_ratio: klingAspectRatio,
    mode,
  };

  if (options.negativePrompt) {
    requestBody.negative_prompt = options.negativePrompt;
  }

  const createResponse = await klingFetch<KlingCreateResponse>(
    '/videos/text2video',
    { method: 'POST', body: requestBody }
  );

  if (createResponse.code !== 0) {
    throw new Error(`Kling video creation failed: ${createResponse.message}`);
  }

  const taskId = createResponse.data.task_id;

  logger.info('[Kling] Video task created, polling for result', {
    taskId,
    file: 'kling-provider.ts',
  });

  // Poll for completion
  const result = await pollKlingStatus(taskId, 'video');

  if (result.status === 'failed') {
    throw new Error(`Kling video generation failed: ${result.errorMessage ?? 'Unknown error'}`);
  }

  if (!result.resultUrl) {
    throw new Error('Kling video generation completed but no result URL returned');
  }

  const dimensions = ASPECT_RATIO_DIMENSIONS[klingAspectRatio] ?? { width: 1344, height: 768 };
  const durationSeconds = parseInt(duration, 10);

  // Calculate cost based on duration and mode
  let cost: number;
  if (mode === 'pro') {
    cost = durationSeconds >= 10 ? VIDEO_COST_PRO_10S : VIDEO_COST_PRO_5S;
  } else {
    cost = durationSeconds >= 10 ? VIDEO_COST_10S : VIDEO_COST_5S;
  }

  const metadata: GenerationMetadata = {
    width: dimensions.width,
    height: dimensions.height,
    duration: durationSeconds,
    format: 'video/mp4',
  };

  const generationId = `kling-vid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  logger.info('[Kling] Video generation completed', {
    generationId,
    taskId,
    videoDuration: String(duration),
    mode,
    file: 'kling-provider.ts',
  });

  return {
    id: generationId,
    url: result.resultUrl,
    provider: 'kling',
    model,
    cost,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

// ─── Status Polling ──────────────────────────────────────────────────

/**
 * Poll a Kling task until it completes or fails.
 *
 * @param taskId - The task ID returned from creation
 * @param type - Whether this is an 'image' or 'video' task
 * @returns The final task status with result URL
 */
export async function pollKlingStatus(
  taskId: string,
  type: 'image' | 'video'
): Promise<KlingTaskStatus> {
  const endpoint = type === 'image'
    ? `/images/generations/${taskId}`
    : `/videos/text2video/${taskId}`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const statusResponse = await klingFetch<KlingStatusResponse>(endpoint);

    if (statusResponse.code !== 0) {
      return {
        taskId,
        status: 'failed',
        errorMessage: statusResponse.message,
      };
    }

    const taskStatus = statusResponse.data.task_status;

    if (taskStatus === 'succeed') {
      const taskResult = statusResponse.data.task_result;

      if (type === 'image' && taskResult?.images && taskResult.images.length > 0) {
        return {
          taskId,
          status: 'succeed',
          resultUrl: taskResult.images[0].url,
        };
      }

      if (type === 'video' && taskResult?.videos && taskResult.videos.length > 0) {
        return {
          taskId,
          status: 'succeed',
          resultUrl: taskResult.videos[0].url,
        };
      }

      return {
        taskId,
        status: 'succeed',
        errorMessage: 'Task succeeded but no result data returned',
      };
    }

    if (taskStatus === 'failed') {
      return {
        taskId,
        status: 'failed',
        errorMessage: statusResponse.data.task_status_msg ?? 'Task failed without error message',
      };
    }

    // Still processing — wait before next poll
    logger.debug(`[Kling] Task ${taskId} status: ${taskStatus}, polling again...`, {
      attempt,
      file: 'kling-provider.ts',
    });

    await new Promise<void>(resolve => { setTimeout(resolve, POLL_INTERVAL_MS); });
  }

  return {
    taskId,
    status: 'failed',
    errorMessage: `Kling task timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000} seconds`,
  };
}

// ─── Model Info ──────────────────────────────────────────────────────

/**
 * Returns information about all available Kling models.
 */
export function getKlingModels(): KlingModelInfo[] {
  return [
    {
      id: 'kling-v1',
      name: 'Kling v1 Image',
      description: 'High-quality image generation with cinematic look',
      type: 'image',
      costPerUnit: IMAGE_COST,
    },
    {
      id: 'kling-v1-video-std',
      name: 'Kling v1 Video (Standard)',
      description: 'Standard quality text-to-video, 5 or 10 second clips',
      type: 'video',
      costPerUnit: VIDEO_COST_5S,
    },
    {
      id: 'kling-v1-video-pro',
      name: 'Kling v1 Video (Pro)',
      description: 'Professional quality video with complex camera movements',
      type: 'video',
      costPerUnit: VIDEO_COST_PRO_5S,
    },
  ];
}

// ─── Capabilities ────────────────────────────────────────────────────

/**
 * Returns the capability set for the Kling provider.
 */
export function getKlingCapabilities(): ProviderCapability[] {
  return [
    {
      type: 'image',
      models: ['kling-v1'],
      maxResolution: '1344x1344',
      supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:2'],
      supportsCharacterRef: false,
      supportsStyleRef: false,
      supportsInpainting: false,
    },
    {
      type: 'video',
      models: ['kling-v1'],
      maxResolution: '1344x768',
      supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3'],
      supportsCharacterRef: false,
      supportsStyleRef: false,
      supportsInpainting: false,
    },
  ];
}
