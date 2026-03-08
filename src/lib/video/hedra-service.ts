/**
 * Hedra Character-3 API Integration Service
 *
 * Integrates with Hedra's Character-3 model for talking-head avatar video
 * generation from a portrait image + audio file.
 *
 * Flow:
 *   1. GET  /public/models              — discover available models
 *   2. POST /public/assets              — create asset placeholder (image or audio)
 *   3. PUT  <upload_url>                — upload binary to the pre-signed URL
 *   4. POST /public/generations          — submit generation job
 *   5. GET  /public/generations/{id}/status — poll until complete
 *
 * Authentication: Header `x-api-key: <key>` (key stored in Firestore via Settings > API Keys)
 */

import { logger } from '@/lib/logger/logger';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// Constants
// ============================================================================

const HEDRA_BASE_URL = 'https://api.hedra.com/web-app/public';

/** Model list cache TTL in milliseconds (5 minutes). */
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// API Response Types
// ============================================================================

interface HedraModelEntry {
  id: string;
  name: string;
  type: string;
  aspect_ratios: string[];
  resolutions: string[];
  max_duration_ms: number;
  min_duration_ms: number;
}

interface HedraAssetResponse {
  id: string;
  upload_url: string;
  name: string;
  type: string;
}

interface HedraGenerationRequest {
  type: 'video';
  ai_model_id: string;
  start_keyframe_id: string;
  generated_video_inputs: {
    text_prompt: string;
    resolution: string;
    aspect_ratio: string;
    duration_ms: number;
  };
  audio_id: string;
}

interface HedraGenerationResponse {
  id: string;
  status: string;
  created_at: string;
}

interface HedraStatusResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  error_message?: string;
  progress?: number;
  created_at: string;
  updated_at: string;
}

interface HedraErrorBody {
  detail?: string;
  message?: string;
  error?: string;
}

// ============================================================================
// Exported Types
// ============================================================================

export interface HedraGenerationResult {
  generationId: string;
  modelId: string;
  status: string;
  createdAt: string;
}

export interface HedraVideoStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl: string | null;
  progress: number | null;
  error: string | null;
}

export interface HedraGenerateOptions {
  /** Text prompt describing the desired talking style / expression. */
  textPrompt?: string;
  /** Resolution — e.g. "720p", "1080p". Defaults to "720p". */
  resolution?: string;
  /** Aspect ratio — e.g. "16:9", "9:16", "1:1". Defaults to "16:9". */
  aspectRatio?: string;
  /** Duration in milliseconds. Defaults to 10000 (10 seconds). */
  durationMs?: number;
}

// ============================================================================
// Model Cache
// ============================================================================

const modelCache: { models: HedraModelEntry[] | null; timestamp: number } = {
  models: null,
  timestamp: 0,
};

// ============================================================================
// API Key Retrieval
// ============================================================================

async function getHedraApiKey(): Promise<string> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'hedra');
  if (typeof key === 'string' && key.length > 0) {
    return key;
  }
  throw new Error('Hedra API key not configured. Add it in Settings > API Keys.');
}

// ============================================================================
// Core HTTP Helpers
// ============================================================================

/**
 * Build standard Hedra request headers.
 */
function hedraHeaders(apiKey: string, contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
}

/**
 * Parse an error response body into a readable message.
 */
async function parseHedraError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as HedraErrorBody;
    return parsed.detail ?? parsed.message ?? parsed.error ?? text;
  } catch {
    return text;
  }
}

/**
 * Download a file from a URL and return its Buffer and inferred content type.
 */
async function downloadFile(url: string): Promise<{ arrayBuffer: ArrayBuffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const data = await response.arrayBuffer();

  return { arrayBuffer: data, contentType };
}

// ============================================================================
// Asset Upload Helpers
// ============================================================================

/**
 * Create an asset placeholder on Hedra and upload binary data to it.
 * Returns the asset ID.
 */
async function uploadAssetFromUrl(
  apiKey: string,
  sourceUrl: string,
  assetType: 'image' | 'audio',
  name: string,
): Promise<string> {
  // Step 1: Download the file from the source URL
  const { arrayBuffer, contentType } = await downloadFile(sourceUrl);

  logger.info('Hedra asset download complete', {
    assetType,
    sizeBytes: arrayBuffer.byteLength,
    contentType,
    file: 'hedra-service.ts',
  });

  // Step 2: Create the asset placeholder on Hedra
  const createResponse = await fetch(`${HEDRA_BASE_URL}/assets`, {
    method: 'POST',
    headers: hedraHeaders(apiKey, 'application/json'),
    body: JSON.stringify({ name, type: assetType }),
  });

  if (!createResponse.ok) {
    const detail = await parseHedraError(createResponse);
    throw new Error(`Hedra asset create failed (${createResponse.status}): ${detail}`);
  }

  const asset = (await createResponse.json()) as HedraAssetResponse;

  logger.info('Hedra asset placeholder created', {
    assetId: asset.id,
    assetType,
    file: 'hedra-service.ts',
  });

  // Step 3: Upload binary data to the pre-signed URL
  const uploadResponse = await fetch(asset.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(arrayBuffer.byteLength),
    },
    body: arrayBuffer,
  });

  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.text();
    throw new Error(
      `Hedra asset upload failed (${uploadResponse.status}): ${uploadError.slice(0, 500)}`,
    );
  }

  logger.info('Hedra asset uploaded', {
    assetId: asset.id,
    assetType,
    file: 'hedra-service.ts',
  });

  return asset.id;
}

// ============================================================================
// Public API — Models
// ============================================================================

/**
 * Fetch the list of available Hedra models.
 * Results are cached for 5 minutes.
 */
export async function getHedraModels(): Promise<HedraModelEntry[]> {
  const now = Date.now();
  if (modelCache.models && now - modelCache.timestamp < MODEL_CACHE_TTL_MS) {
    return modelCache.models;
  }

  const apiKey = await getHedraApiKey();

  const response = await fetch(`${HEDRA_BASE_URL}/models`, {
    method: 'GET',
    headers: hedraHeaders(apiKey),
  });

  if (!response.ok) {
    const detail = await parseHedraError(response);
    throw new Error(`Hedra models fetch failed (${response.status}): ${detail}`);
  }

  const models = (await response.json()) as HedraModelEntry[];

  Object.assign(modelCache, { models, timestamp: Date.now() });

  logger.info('Hedra models fetched and cached', {
    count: models.length,
    modelNames: models.map((m) => m.name).join(', '),
    file: 'hedra-service.ts',
  });

  return models;
}

// ============================================================================
// Public API — Generation
// ============================================================================

/**
 * Generate a talking-head avatar video using Hedra Character-3.
 *
 * 1. Fetches available models and auto-selects the first video model.
 * 2. Downloads the image and audio from the provided URLs.
 * 3. Uploads them to Hedra as assets.
 * 4. Submits a generation job.
 * 5. Returns the generation result with the job ID for status polling.
 *
 * @param imageUrl  Public URL to a portrait image of the person.
 * @param audioUrl  Public URL to the audio file (e.g. from ElevenLabs).
 * @param options   Optional generation parameters (prompt, resolution, aspect ratio, duration).
 */
export async function generateHedraAvatarVideo(
  imageUrl: string,
  audioUrl: string,
  options?: HedraGenerateOptions,
): Promise<HedraGenerationResult> {
  const apiKey = await getHedraApiKey();

  // 1. Auto-select the first video model
  const models = await getHedraModels();
  const videoModel = models.find((m) => m.type === 'video') ?? models[0];
  if (!videoModel) {
    throw new Error('No Hedra models available. Check your API key and account status.');
  }

  logger.info('Hedra generation starting', {
    model: videoModel.name,
    modelId: videoModel.id,
    file: 'hedra-service.ts',
  });

  // 2. Upload image and audio as assets (in parallel)
  const [imageAssetId, audioAssetId] = await Promise.all([
    uploadAssetFromUrl(apiKey, imageUrl, 'image', 'avatar-portrait'),
    uploadAssetFromUrl(apiKey, audioUrl, 'audio', 'avatar-audio'),
  ]);

  // 3. Submit generation
  const generationPayload: HedraGenerationRequest = {
    type: 'video',
    ai_model_id: videoModel.id,
    start_keyframe_id: imageAssetId,
    generated_video_inputs: {
      text_prompt: options?.textPrompt ?? '',
      resolution: options?.resolution ?? '720p',
      aspect_ratio: options?.aspectRatio ?? '16:9',
      duration_ms: options?.durationMs ?? 10000,
    },
    audio_id: audioAssetId,
  };

  const genResponse = await fetch(`${HEDRA_BASE_URL}/generations`, {
    method: 'POST',
    headers: hedraHeaders(apiKey, 'application/json'),
    body: JSON.stringify(generationPayload),
  });

  if (!genResponse.ok) {
    const detail = await parseHedraError(genResponse);
    throw new Error(`Hedra generation submit failed (${genResponse.status}): ${detail}`);
  }

  const generation = (await genResponse.json()) as HedraGenerationResponse;

  logger.info('Hedra generation submitted', {
    generationId: generation.id,
    modelId: videoModel.id,
    modelName: videoModel.name,
    imageAssetId,
    audioAssetId,
    file: 'hedra-service.ts',
  });

  return {
    generationId: generation.id,
    modelId: videoModel.id,
    status: generation.status,
    createdAt: generation.created_at,
  };
}

// ============================================================================
// Public API — Status Polling
// ============================================================================

/**
 * Check the status of a Hedra generation job.
 * Call this periodically (every 5s) until status is 'completed' or 'failed'.
 */
export async function getHedraVideoStatus(generationId: string): Promise<HedraVideoStatus> {
  try {
    const apiKey = await getHedraApiKey();

    const response = await fetch(`${HEDRA_BASE_URL}/generations/${generationId}/status`, {
      method: 'GET',
      headers: hedraHeaders(apiKey),
    });

    if (!response.ok) {
      const detail = await parseHedraError(response);
      throw new Error(`Hedra status check failed (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as HedraStatusResponse;

    switch (data.status) {
      case 'completed':
        return {
          status: 'completed',
          videoUrl: data.video_url ?? null,
          progress: 100,
          error: null,
        };

      case 'failed':
        return {
          status: 'failed',
          videoUrl: null,
          progress: null,
          error: data.error_message ?? 'Generation failed without details',
        };

      case 'processing':
        return {
          status: 'processing',
          videoUrl: null,
          progress: data.progress ?? null,
          error: null,
        };

      case 'pending':
      default:
        return {
          status: 'pending',
          videoUrl: null,
          progress: data.progress ?? null,
          error: null,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Hedra status check failed', error instanceof Error ? error : undefined, {
      generationId,
      file: 'hedra-service.ts',
    });

    return {
      status: 'failed',
      videoUrl: null,
      progress: null,
      error: errorMessage,
    };
  }
}
