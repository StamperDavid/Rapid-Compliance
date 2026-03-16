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

interface HedraAudioGeneration {
  type: 'text_to_speech';
  voice_id: string;
  text: string;
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
  /** Inline TTS — Hedra generates audio server-side before video. Replaces separate TTS step. */
  audio_generation?: HedraAudioGeneration;
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
// NOTE: TTS is now handled inline via `audio_generation` parameter on the
// video generation request. No separate TTS step needed. Hedra handles
// text-to-speech server-side in a single API call.
// ============================================================================

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
 * Uses Kling O3 Standard T2V which generates characters with native audio
 * directly from the prompt. The model produces speaking characters from
 * text descriptions — no separate TTS step needed.
 *
 * If a voice + script are provided, inline `audio_generation` is used so
 * Hedra handles TTS server-side in a single call (no polling).
 */
export async function generateHedraPromptVideo(
  options: HedraGenerateOptions,
): Promise<HedraGenerationResult> {
  const apiKey = await getHedraApiKey();

  const hasInlineTTS = Boolean(options.hedraVoiceId && options.speechText);

  logger.info('Hedra prompt-only generation starting', {
    hasInlineTTS,
    promptLength: options.textPrompt?.length ?? 0,
    file: 'hedra-service.ts',
  });

  // Kling O3 Standard T2V — generates characters with native audio from text,
  // supports up to 15s, produces speaking characters directly from prompt.
  const PROMPT_T2V_MODEL_ID = 'b0e156da-da25-40b2-8386-937da7f47cc3';

  const payload: HedraGenerationPayload = {
    type: 'video',
    ai_model_id: PROMPT_T2V_MODEL_ID,
    generated_video_inputs: {
      text_prompt: options.textPrompt ?? '',
      resolution: options.resolution ?? '720p',
      aspect_ratio: options.aspectRatio ?? '16:9',
      duration_ms: options.durationMs ?? 10000,
    },
  };

  // Use inline audio_generation for controlled TTS (single API call, no polling)
  if (hasInlineTTS && options.hedraVoiceId && options.speechText) {
    payload.audio_generation = {
      type: 'text_to_speech',
      voice_id: options.hedraVoiceId,
      text: options.speechText,
    };
  }

  return submitHedraGeneration(apiKey, payload, {
    mode: 'prompt-only',
    hasInlineTTS,
  });
}

/**
 * Generate a talking-head avatar video using Hedra Character-3.
 *
 * This is for when the user explicitly selects a premium avatar with a portrait.
 * Character 3 requires a portrait image and audio. Audio is provided via:
 *   - Inline `audio_generation` (preferred — single API call, Hedra handles TTS server-side)
 *   - Pre-uploaded audio file (legacy path, still supported)
 *
 * @param imageUrl  Public URL to a portrait image of the person.
 * @param audioUrl  Public URL to a pre-recorded audio file. Pass `null` when using inline TTS.
 * @param options   Generation parameters (prompt, resolution, aspect ratio, duration, voice).
 */
export async function generateHedraAvatarVideo(
  imageUrl: string,
  audioUrl: string | null,
  options?: HedraGenerateOptions,
): Promise<HedraGenerationResult> {
  const apiKey = await getHedraApiKey();
  const useInlineTTS = Boolean(options?.hedraVoiceId && options?.speechText);

  if (!audioUrl && !useInlineTTS) {
    throw new Error('Either audioUrl or hedraVoiceId + speechText must be provided.');
  }

  const modelId = HEDRA_CHARACTER_3_MODEL_ID;

  logger.info('Hedra avatar generation starting', {
    modelId,
    audioMode: useInlineTTS ? 'inline-tts' : 'audio-upload',
    file: 'hedra-service.ts',
  });

  // Upload portrait image as Hedra asset
  let imageAssetId: string;
  let audioAssetId: string | null = null;

  if (audioUrl) {
    // Legacy path: pre-recorded audio file — upload both in parallel
    [imageAssetId, audioAssetId] = await Promise.all([
      uploadAssetFromUrl(apiKey, imageUrl, 'image', 'avatar-portrait'),
      uploadAssetFromUrl(apiKey, audioUrl, 'audio', 'avatar-audio'),
    ]);
  } else {
    // Inline TTS path: only upload the portrait, Hedra handles TTS server-side
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
    // Legacy: pre-uploaded audio
    payload.audio_id = audioAssetId;
  } else if (useInlineTTS && options?.hedraVoiceId && options?.speechText) {
    // Preferred: inline TTS — single API call, no polling
    payload.audio_generation = {
      type: 'text_to_speech',
      voice_id: options.hedraVoiceId,
      text: options.speechText,
    };
  }

  return submitHedraGeneration(apiKey, payload, {
    mode: 'avatar',
    modelId,
    imageAssetId,
    audioMode: audioAssetId ? 'uploaded' : 'inline-tts',
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
