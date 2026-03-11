/**
 * Hedra Character-3 API Integration Service
 *
 * Integrates with Hedra's Character-3 model for talking-head avatar video
 * generation from a portrait image + audio file.
 *
 * Flow:
 *   1. GET  /public/models                    — discover available models
 *   2. POST /public/assets                    — create asset placeholder (image or audio)
 *   3. POST /public/assets/{id}/upload        — multipart upload binary to the asset
 *   4. POST /public/generations               — submit generation job
 *   5. GET  /public/generations/{id}/status   — poll until complete
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

/** Hedra Character 3 — the proven talking-head model with native TTS support. */
const HEDRA_CHARACTER_3_MODEL_ID = 'd1dd37a3-e39a-4854-a298-6510289f9cf2';

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
  requires_audio_input?: boolean;
  tags?: string[];
}

interface HedraAssetResponse {
  id: string;
  /** @deprecated Hedra no longer returns upload_url — use POST /assets/{id}/upload instead */
  upload_url?: string | null;
  name: string;
  type: string;
}

interface HedraAudioGeneration {
  type: 'text_to_speech';
  voice_id: string;
  text: string;
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
  audio_id?: string;
  audio_generation?: HedraAudioGeneration;
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
  /**
   * When set, uses Hedra's native TTS instead of uploaded audio.
   * The voice_id is from Hedra's voice catalog (GET /voices).
   * `speechText` is the script text Hedra will synthesize.
   */
  hedraVoiceId?: string;
  /** Script text for Hedra native TTS. Required when hedraVoiceId is set. */
  speechText?: string;
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
 * Guards against null/undefined values that cause "Cannot read properties of null (reading 'toString')"
 * inside Node.js fetch (undici) when it processes header values.
 */
function hedraHeaders(apiKey: string, contentType?: string): Record<string, string> {
  if (!apiKey) {
    throw new Error('hedraHeaders called with empty API key');
  }
  const headers: Record<string, string> = {
    'x-api-key': String(apiKey),
  };
  if (contentType) {
    headers['Content-Type'] = String(contentType);
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
  if (!url || typeof url !== 'string') {
    throw new Error(`downloadFile called with invalid URL: ${JSON.stringify(url)}`);
  }

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
 *
 * Hedra's current flow (2026):
 *   1. POST /assets        → creates placeholder, returns { id, name, type }
 *   2. POST /assets/{id}/upload  → multipart/form-data with "file" field
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

  if (!asset?.id) {
    throw new Error(`Hedra asset create returned invalid response: missing id. Response: ${JSON.stringify(asset).slice(0, 200)}`);
  }

  logger.info('Hedra asset placeholder created', {
    assetId: asset.id,
    assetType,
    file: 'hedra-service.ts',
  });

  // Step 3: Upload binary data via multipart POST to /assets/{id}/upload
  const fileName = assetType === 'image' ? `${name}.png` : `${name}.mp3`;
  const formData = new FormData();
  formData.append('file', new Blob([arrayBuffer], { type: contentType }), fileName);

  const uploadResponse = await fetch(`${HEDRA_BASE_URL}/assets/${asset.id}/upload`, {
    method: 'POST',
    headers: { 'x-api-key': String(apiKey) },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.text();
    throw new Error(
      `Hedra asset upload failed (${uploadResponse.status}): ${uploadError.slice(0, 500)}`,
    );
  }

  logger.info('Hedra asset uploaded via multipart', {
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

  const raw: unknown = await response.json();

  // Hedra may wrap models in an object or return an array directly
  let models: HedraModelEntry[];
  if (Array.isArray(raw)) {
    models = raw as HedraModelEntry[];
  } else if (raw && typeof raw === 'object' && 'models' in raw && Array.isArray((raw as Record<string, unknown>).models)) {
    models = (raw as Record<string, unknown>).models as HedraModelEntry[];
  } else if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as Record<string, unknown>).data)) {
    models = (raw as Record<string, unknown>).data as HedraModelEntry[];
  } else {
    logger.error('Unexpected Hedra models response format', new Error('Invalid models response'), {
      responseType: typeof raw,
      isArray: Array.isArray(raw),
      keys: raw && typeof raw === 'object' ? Object.keys(raw) : [],
      file: 'hedra-service.ts',
    });
    throw new Error('Hedra models API returned unexpected format. Check API key and account status.');
  }

  Object.assign(modelCache, { models, timestamp: Date.now() });

  logger.info('Hedra models fetched and cached', {
    count: models.length,
    modelNames: models.map((m) => m?.name ?? 'unnamed').join(', '),
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
 * Supports two audio modes:
 *   1. **Audio upload** — provide `audioUrl` with pre-synthesized audio (ElevenLabs/UnrealSpeech)
 *   2. **Hedra native TTS** — set `options.hedraVoiceId` + `options.speechText` to let Hedra synthesize
 *
 * Flow:
 *   1. Fetches available models and auto-selects the first video model.
 *   2. Uploads image (and audio if using upload mode) as Hedra assets.
 *   3. Submits a generation job with either `audio_id` or `audio_generation`.
 *   4. Returns the generation result with the job ID for status polling.
 *
 * @param imageUrl  Public URL to a portrait image of the person.
 * @param audioUrl  Public URL to the audio file. Pass `null` when using Hedra native TTS.
 * @param options   Generation parameters (prompt, resolution, aspect ratio, duration, voice).
 */
export async function generateHedraAvatarVideo(
  imageUrl: string,
  audioUrl: string | null,
  options?: HedraGenerateOptions,
): Promise<HedraGenerationResult> {
  const apiKey = await getHedraApiKey();
  const useNativeTTS = Boolean(options?.hedraVoiceId && options?.speechText);

  if (!audioUrl && !useNativeTTS) {
    throw new Error('Either audioUrl or hedraVoiceId + speechText must be provided.');
  }

  // 1. Use hardcoded Hedra Character 3 model ID for TTS generation.
  //    Hedra's marketplace has 80+ models; dynamic lookup previously picked
  //    the wrong model (Kling) which doesn't support TTS.
  const modelId = HEDRA_CHARACTER_3_MODEL_ID;

  logger.info('Hedra generation starting', {
    modelId,
    ttsMode: useNativeTTS ? 'hedra-native' : 'audio-upload',
    file: 'hedra-service.ts',
  });

  // 2. Upload image asset (and audio asset if using upload mode)
  let imageAssetId: string;
  let audioAssetId: string | null = null;

  if (audioUrl) {
    [imageAssetId, audioAssetId] = await Promise.all([
      uploadAssetFromUrl(apiKey, imageUrl, 'image', 'avatar-portrait'),
      uploadAssetFromUrl(apiKey, audioUrl, 'audio', 'avatar-audio'),
    ]);
  } else {
    imageAssetId = await uploadAssetFromUrl(apiKey, imageUrl, 'image', 'avatar-portrait');
  }

  // 3. Build generation payload — audio_id for upload mode, audio_generation for native TTS
  const generationPayload: HedraGenerationRequest = {
    type: 'video',
    ai_model_id: modelId,
    start_keyframe_id: imageAssetId,
    generated_video_inputs: {
      text_prompt: options?.textPrompt ?? '',
      resolution: options?.resolution ?? '720p',
      aspect_ratio: options?.aspectRatio ?? '16:9',
      duration_ms: options?.durationMs ?? 10000,
    },
  };

  if (useNativeTTS && options?.hedraVoiceId && options?.speechText) {
    generationPayload.audio_generation = {
      type: 'text_to_speech',
      voice_id: options.hedraVoiceId,
      text: options.speechText,
    };
    logger.info('Using Hedra native TTS', {
      voiceId: options.hedraVoiceId,
      textLength: options.speechText.length,
      file: 'hedra-service.ts',
    });
  } else if (audioAssetId) {
    generationPayload.audio_id = audioAssetId;
  }

  // 4. Submit generation
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

  if (!generation?.id) {
    throw new Error(`Hedra generation returned invalid response: missing id. Response: ${JSON.stringify(generation).slice(0, 200)}`);
  }

  logger.info('Hedra generation submitted', {
    generationId: generation.id,
    modelId,
    imageAssetId,
    audioAssetId: audioAssetId ?? 'native-tts',
    ttsMode: useNativeTTS ? 'hedra-native' : 'audio-upload',
    file: 'hedra-service.ts',
  });

  return {
    generationId: generation.id,
    modelId,
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
