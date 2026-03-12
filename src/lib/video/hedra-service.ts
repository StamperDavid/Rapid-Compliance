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

/** Hedra Character 3 — talking-head model. Requires audio_id (TTS generated separately). */
const HEDRA_CHARACTER_3_MODEL_ID = 'd1dd37a3-e39a-4854-a298-6510289f9cf2';

// ============================================================================
// API Response Types
// ============================================================================

interface HedraAssetResponse {
  id: string;
  /** @deprecated Hedra no longer returns upload_url — use POST /assets/{id}/upload instead */
  upload_url?: string | null;
  name: string;
  type: string;
}

interface HedraGenerationPayload {
  type: 'video';
  ai_model_id?: string;
  start_keyframe_id?: string;
  generated_video_inputs: {
    text_prompt: string;
    resolution: string;
    aspect_ratio: string;
    duration_ms: number;
  };
  audio_id?: string;
}

interface HedraStatusData {
  id: string;
  asset_id?: string;
  status: string;
  url?: string;
  video_url?: string;
  download_url?: string;
  progress?: number;
  error?: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

interface HedraTTSResponse {
  id: string;
  asset_id: string;
  status: string;
  progress: number;
  eta_sec: number | null;
}

interface HedraGenerationResponse {
  id: string;
  status: string;
  created_at: string;
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
// TTS Generation (Separate Step)
// ============================================================================

/**
 * Generate TTS audio via Hedra's text-to-speech generation type.
 *
 * Hedra's TTS is a SEPARATE generation (type: "text_to_speech"), NOT a parameter
 * on the video generation. This returns a generation ID and an asset ID.
 * The asset ID is used as `audio_id` in the subsequent video generation.
 *
 * POST /generations { type: "text_to_speech", voice_id, text }
 */
async function generateHedraTTS(
  apiKey: string,
  voiceId: string,
  text: string,
): Promise<{ generationId: string; assetId: string }> {
  const payload = {
    type: 'text_to_speech',
    voice_id: voiceId,
    text,
  };

  logger.info('Hedra TTS generation starting', {
    voiceId,
    textLength: text.length,
    file: 'hedra-service.ts',
  });

  const response = await fetch(`${HEDRA_BASE_URL}/generations`, {
    method: 'POST',
    headers: hedraHeaders(apiKey, 'application/json'),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await parseHedraError(response);
    throw new Error(`Hedra TTS generation failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as HedraTTSResponse;

  if (!result?.id) {
    throw new Error(`Hedra TTS returned invalid response: missing id. Response: ${JSON.stringify(result).slice(0, 200)}`);
  }
  if (!result?.asset_id) {
    throw new Error(`Hedra TTS returned invalid response: missing asset_id. Response: ${JSON.stringify(result).slice(0, 200)}`);
  }

  logger.info('Hedra TTS generation submitted', {
    generationId: result.id,
    assetId: result.asset_id,
    file: 'hedra-service.ts',
  });

  return {
    generationId: result.id,
    assetId: result.asset_id,
  };
}

/**
 * Poll a Hedra TTS generation until it completes.
 * Returns the asset_id to use as audio_id in video generation.
 *
 * Hedra TTS typically completes in 3–8 seconds.
 */
async function waitForTTSCompletion(
  apiKey: string,
  generationId: string,
  maxWaitMs: number = 60000,
  pollIntervalMs: number = 2000,
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(
      `${HEDRA_BASE_URL}/generations/${generationId}/status`,
      { headers: hedraHeaders(apiKey) },
    );

    if (!response.ok) {
      const detail = await parseHedraError(response);
      throw new Error(`Hedra TTS status check failed (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as HedraStatusData;

    // Hedra returns "complete" (not "completed")
    if (data.status === 'complete' || data.status === 'completed') {
      const assetId = data.asset_id;
      if (!assetId) {
        throw new Error('Hedra TTS completed but no asset_id returned');
      }
      logger.info('Hedra TTS generation completed', {
        generationId,
        assetId,
        elapsedMs: Date.now() - startTime,
        file: 'hedra-service.ts',
      });
      return assetId;
    }

    if (data.status === 'failed') {
      throw new Error(`Hedra TTS generation failed: ${data.error_message ?? data.error ?? 'Unknown error'}`);
    }

    logger.info('Hedra TTS still processing', {
      generationId,
      status: data.status,
      progress: data.progress,
      elapsedMs: Date.now() - startTime,
      file: 'hedra-service.ts',
    });

    await new Promise<void>(resolve => { setTimeout(resolve, pollIntervalMs); });
  }

  throw new Error(`Hedra TTS generation timed out after ${maxWaitMs}ms`);
}

// ============================================================================
// Public API — Generation
// ============================================================================

/**
 * Submit a generation payload to Hedra and return the generation result.
 * Shared by both prompt-only and avatar flows.
 */
async function submitHedraGeneration(
  apiKey: string,
  payload: HedraGenerationPayload,
  context: Record<string, unknown>,
): Promise<HedraGenerationResult> {
  const genResponse = await fetch(`${HEDRA_BASE_URL}/generations`, {
    method: 'POST',
    headers: hedraHeaders(apiKey, 'application/json'),
    body: JSON.stringify(payload),
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
    ...context,
    file: 'hedra-service.ts',
  });

  return {
    generationId: generation.id,
    modelId: payload.ai_model_id ?? 'hedra-auto',
    status: generation.status,
    createdAt: generation.created_at,
  };
}

/**
 * Generate a video from just a text prompt — no avatar, no image required.
 *
 * Hedra picks the model automatically. If the scene has narration (speechText),
 * TTS audio is generated first and attached so the video includes voiceover.
 */
export async function generateHedraPromptVideo(
  options: HedraGenerateOptions,
): Promise<HedraGenerationResult> {
  const apiKey = await getHedraApiKey();

  logger.info('Hedra prompt-only generation starting', {
    hasNarration: Boolean(options.hedraVoiceId && options.speechText),
    promptLength: options.textPrompt?.length ?? 0,
    file: 'hedra-service.ts',
  });

  // If narration text + voice are provided, generate TTS audio first
  let audioAssetId: string | undefined;
  if (options.hedraVoiceId && options.speechText) {
    const ttsResult = await generateHedraTTS(apiKey, options.hedraVoiceId, options.speechText);
    audioAssetId = await waitForTTSCompletion(apiKey, ttsResult.generationId);
    logger.info('TTS audio ready for prompt video', { audioAssetId, file: 'hedra-service.ts' });
  }

  const payload: HedraGenerationPayload = {
    type: 'video',
    generated_video_inputs: {
      text_prompt: options.textPrompt ?? '',
      resolution: options.resolution ?? '720p',
      aspect_ratio: options.aspectRatio ?? '16:9',
      duration_ms: options.durationMs ?? 10000,
    },
  };

  if (audioAssetId) {
    payload.audio_id = audioAssetId;
  }

  return submitHedraGeneration(apiKey, payload, {
    mode: 'prompt-only',
    hasAudio: Boolean(audioAssetId),
  });
}

/**
 * Generate a talking-head avatar video using Hedra Character-3.
 *
 * This is for when the user explicitly selects a premium avatar with a portrait.
 * Character 3 requires both a portrait image and audio (TTS or uploaded).
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

  const modelId = HEDRA_CHARACTER_3_MODEL_ID;

  logger.info('Hedra avatar generation starting', {
    modelId,
    ttsMode: useNativeTTS ? 'hedra-native' : 'audio-upload',
    file: 'hedra-service.ts',
  });

  let imageAssetId: string;
  let audioAssetId: string | null = null;

  if (useNativeTTS && options?.hedraVoiceId && options?.speechText) {
    const [ttsResult, imgId] = await Promise.all([
      generateHedraTTS(apiKey, options.hedraVoiceId, options.speechText),
      uploadAssetFromUrl(apiKey, imageUrl, 'image', 'avatar-portrait'),
    ]);
    imageAssetId = imgId;
    audioAssetId = await waitForTTSCompletion(apiKey, ttsResult.generationId);
  } else if (audioUrl) {
    [imageAssetId, audioAssetId] = await Promise.all([
      uploadAssetFromUrl(apiKey, imageUrl, 'image', 'avatar-portrait'),
      uploadAssetFromUrl(apiKey, audioUrl, 'audio', 'avatar-audio'),
    ]);
  } else {
    imageAssetId = await uploadAssetFromUrl(apiKey, imageUrl, 'image', 'avatar-portrait');
  }

  const payload: HedraGenerationPayload = {
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

  if (audioAssetId) {
    payload.audio_id = audioAssetId;
  }

  return submitHedraGeneration(apiKey, payload, {
    mode: 'avatar',
    modelId,
    imageAssetId,
    audioAssetId: audioAssetId ?? 'none',
  });
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

    const data = (await response.json()) as HedraStatusData;

    // Hedra returns "complete" (not "completed") — handle both for safety
    const status = data.status;
    // Hedra returns video URL as "url" or "video_url" depending on version
    const videoUrl = data.url ?? data.video_url ?? null;

    if (status === 'complete' || status === 'completed') {
      return {
        status: 'completed',
        videoUrl,
        progress: 100,
        error: null,
      };
    }

    if (status === 'failed') {
      return {
        status: 'failed',
        videoUrl: null,
        progress: null,
        error: data.error_message ?? data.error ?? 'Generation failed without details',
      };
    }

    if (status === 'processing') {
      return {
        status: 'processing',
        videoUrl: null,
        progress: data.progress ?? null,
        error: null,
      };
    }

    // pending or any other status
    return {
      status: 'pending',
      videoUrl: null,
      progress: data.progress ?? null,
      error: null,
    };
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
