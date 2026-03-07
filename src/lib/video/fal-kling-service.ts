/**
 * fal.ai / Kling Video Generation Service
 *
 * Integrates with Kling 2.6/3.0 via fal.ai's REST Queue API for:
 * - Text-to-video generation (cinematic B-roll)
 * - Reference-to-video (character-consistent full-body avatar scenes)
 * - AI Avatar generation (talking head from image + audio)
 *
 * Authentication: API key from Firestore (Settings > API Keys), sent as
 * Authorization: Key <fal_key>
 *
 * Queue pattern: submit → poll status → get result
 */

import { logger } from '@/lib/logger/logger';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// Constants
// ============================================================================

const FAL_QUEUE_BASE = 'https://queue.fal.run';

// Model endpoints
const MODELS = {
  textToVideo: 'fal-ai/kling-video/v2.6/pro/text-to-video',
  imageToVideo: 'fal-ai/kling-video/v2.6/pro/image-to-video',
  referenceToVideo: 'fal-ai/kling-video/o1/reference-to-video',
  avatarStandard: 'fal-ai/kling-video/ai-avatar/v2/standard',
  avatarPro: 'fal-ai/kling-video/ai-avatar/v2/pro',
} as const;

type FalModel = typeof MODELS[keyof typeof MODELS];

// ============================================================================
// Types
// ============================================================================

interface FalSubmitResponse {
  request_id: string;
  response_url: string;
  status_url: string;
  cancel_url: string;
}

interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';
  queue_position?: number;
  response_url: string;
  logs?: Array<{ message: string; level: string; timestamp: string }>;
}

interface FalVideoResult {
  video: {
    url: string;
    file_name: string;
    content_type: string;
    file_size: number;
  };
  duration?: number;
}

interface FalErrorResponse {
  detail?: string | Array<{ msg: string }>;
}

export interface KlingGenerationResult {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
  model: string;
}

export interface KlingVideoStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl: string | null;
  duration: number | null;
  error: string | null;
}

// ============================================================================
// API Key Retrieval
// ============================================================================

async function getFalApiKey(): Promise<string> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  if (typeof key === 'string' && key.length > 0) {
    return key;
  }
  throw new Error('fal.ai API key not configured. Add it in Settings > API Keys.');
}

// ============================================================================
// Core HTTP Helpers
// ============================================================================

async function falSubmit(model: FalModel, input: Record<string, unknown>): Promise<FalSubmitResponse> {
  const apiKey = await getFalApiKey();

  const response = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let detail = errorBody;
    try {
      const parsed = JSON.parse(errorBody) as FalErrorResponse;
      if (typeof parsed.detail === 'string') {
        detail = parsed.detail;
      } else if (Array.isArray(parsed.detail)) {
        detail = parsed.detail.map((d) => d.msg).join(', ');
      }
    } catch { /* use raw text */ }

    throw new Error(`fal.ai submit failed (${response.status}): ${detail}`);
  }

  return await response.json() as FalSubmitResponse;
}

async function falStatus(statusUrl: string): Promise<FalStatusResponse> {
  const apiKey = await getFalApiKey();

  const response = await fetch(`${statusUrl}?logs=0`, {
    headers: {
      'Authorization': `Key ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`fal.ai status check failed: ${response.status}`);
  }

  return await response.json() as FalStatusResponse;
}

async function falResult(responseUrl: string): Promise<FalVideoResult> {
  const apiKey = await getFalApiKey();

  const response = await fetch(responseUrl, {
    headers: {
      'Authorization': `Key ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`fal.ai result fetch failed (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  const data = await response.json() as { response?: FalVideoResult } & FalVideoResult;
  // fal.ai wraps results in a `response` field when fetching from queue
  return data.response ?? data;
}

// ============================================================================
// Public API — Generation
// ============================================================================

/**
 * Generate a video from a text prompt using Kling 2.6 Pro.
 * Best for: B-roll, cinematic scenes, product demos.
 */
export async function generateKlingTextToVideo(
  prompt: string,
  options?: {
    duration?: '5' | '10';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    negativePrompt?: string;
    generateAudio?: boolean;
  },
): Promise<KlingGenerationResult> {
  const input: Record<string, unknown> = {
    prompt,
    duration: options?.duration ?? '5',
    aspect_ratio: options?.aspectRatio ?? '16:9',
    negative_prompt: options?.negativePrompt ?? 'blur, distort, and low quality',
    generate_audio: options?.generateAudio ?? false,
  };

  const result = await falSubmit(MODELS.textToVideo, input);

  logger.info('Kling text-to-video submitted', {
    requestId: result.request_id,
    model: MODELS.textToVideo,
    file: 'fal-kling-service.ts',
  });

  return {
    requestId: result.request_id,
    statusUrl: result.status_url,
    responseUrl: result.response_url,
    model: MODELS.textToVideo,
  };
}

/**
 * Generate a video from an image using Kling 2.6 Pro.
 * Best for: Animating a still image, product shots.
 */
export async function generateKlingImageToVideo(
  imageUrl: string,
  prompt: string,
  options?: {
    duration?: '5' | '10';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    negativePrompt?: string;
  },
): Promise<KlingGenerationResult> {
  const input: Record<string, unknown> = {
    prompt,
    image_url: imageUrl,
    duration: options?.duration ?? '5',
    aspect_ratio: options?.aspectRatio ?? '16:9',
    negative_prompt: options?.negativePrompt ?? 'blur, distort, and low quality',
  };

  const result = await falSubmit(MODELS.imageToVideo, input);

  logger.info('Kling image-to-video submitted', {
    requestId: result.request_id,
    model: MODELS.imageToVideo,
    file: 'fal-kling-service.ts',
  });

  return {
    requestId: result.request_id,
    statusUrl: result.status_url,
    responseUrl: result.response_url,
    model: MODELS.imageToVideo,
  };
}

/**
 * Generate a character-consistent video using reference images.
 * Best for: Full-body avatar scenes (walking, sitting, standing, presenting).
 *
 * Uses Kling O1 reference-to-video with the Elements system:
 * - Provide 1-4 reference images of the person
 * - Prompt describes the action/scene
 * - Kling maintains character consistency across the generated video
 */
export async function generateKlingReferenceVideo(
  prompt: string,
  referenceImages: {
    frontalImageUrl: string;
    additionalImageUrls?: string[];
  },
  options?: {
    duration?: '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
    aspectRatio?: '16:9' | '9:16' | '1:1';
  },
): Promise<KlingGenerationResult> {
  const input: Record<string, unknown> = {
    prompt: `Take @Element1 to reference the person. ${prompt}`,
    duration: options?.duration ?? '5',
    aspect_ratio: options?.aspectRatio ?? '16:9',
    elements: [{
      frontal_image_url: referenceImages.frontalImageUrl,
      reference_image_urls: [
        referenceImages.frontalImageUrl,
        ...(referenceImages.additionalImageUrls ?? []),
      ].slice(0, 4), // Max 4 reference images
    }],
  };

  const result = await falSubmit(MODELS.referenceToVideo, input);

  logger.info('Kling reference-to-video submitted', {
    requestId: result.request_id,
    model: MODELS.referenceToVideo,
    referenceCount: (referenceImages.additionalImageUrls?.length ?? 0) + 1,
    file: 'fal-kling-service.ts',
  });

  return {
    requestId: result.request_id,
    statusUrl: result.status_url,
    responseUrl: result.response_url,
    model: MODELS.referenceToVideo,
  };
}

/**
 * Generate an AI avatar video from a reference image and audio.
 * Best for: Talking head scenes using a person's photo + ElevenLabs audio.
 *
 * Primary avatar engine — uses Kling's AI Avatar model via fal.ai.
 */
export async function generateKlingAvatarVideo(
  imageUrl: string,
  audioUrl: string,
  options?: {
    prompt?: string;
    pro?: boolean;
  },
): Promise<KlingGenerationResult> {
  const model = options?.pro ? MODELS.avatarPro : MODELS.avatarStandard;

  const input: Record<string, unknown> = {
    image_url: imageUrl,
    audio_url: audioUrl,
    prompt: options?.prompt ?? '.',
  };

  const result = await falSubmit(model, input);

  logger.info('Kling AI avatar submitted', {
    requestId: result.request_id,
    model,
    file: 'fal-kling-service.ts',
  });

  return {
    requestId: result.request_id,
    statusUrl: result.status_url,
    responseUrl: result.response_url,
    model,
  };
}

// ============================================================================
// Public API — Status Polling
// ============================================================================

/**
 * Check the status of a Kling generation job.
 * Call this periodically (every 5s) until status is 'completed' or 'failed'.
 */
export async function getKlingVideoStatus(
  requestId: string,
  model: string,
): Promise<KlingVideoStatus> {
  const statusUrl = `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`;
  const responseUrl = `${FAL_QUEUE_BASE}/${model}/requests/${requestId}`;

  try {
    const status = await falStatus(statusUrl);

    if (status.status === 'COMPLETED') {
      // Fetch the actual result
      const result = await falResult(responseUrl);

      return {
        status: 'completed',
        videoUrl: result.video?.url ?? null,
        duration: result.duration ?? null,
        error: null,
      };
    }

    if (status.status === 'IN_PROGRESS') {
      return {
        status: 'processing',
        videoUrl: null,
        duration: null,
        error: null,
      };
    }

    // IN_QUEUE
    return {
      status: 'pending',
      videoUrl: null,
      duration: null,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Kling status check failed', error as Error, {
      requestId,
      model,
      file: 'fal-kling-service.ts',
    });

    return {
      status: 'failed',
      videoUrl: null,
      duration: null,
      error: errorMessage,
    };
  }
}
