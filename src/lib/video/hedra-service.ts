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

/** Cached image model — discovered once from /models, then reused for 10 min. */
let imageModelCache: { id: string; expiresAt: number } | null = null;

function setImageModelCache(id: string): void {
  imageModelCache = { id, expiresAt: Date.now() + 10 * 60 * 1000 };
}

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

export interface HedraImageResult {
  url: string;
  generationId: string;
  modelId: string;
  modelName: string;
}

interface HedraModel {
  id: string;
  name: string;
  type: string;
  resolutions?: string[];
  aspect_ratios?: string[];
  tags?: string[];
  premium?: boolean;
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
// Public API — Image Generation
// ============================================================================

/**
 * Discover the first available image model from Hedra's /models endpoint.
 * Caches the result for 10 minutes to avoid repeated API calls.
 */
async function getHedraImageModelId(apiKey: string): Promise<{ id: string; name: string; resolutions?: string[] }> {
  if (imageModelCache && Date.now() < imageModelCache.expiresAt) {
    return { id: imageModelCache.id, name: 'hedra-image (cached)' };
  }

  const response = await fetch(`${HEDRA_BASE_URL}/models`, {
    headers: hedraHeaders(apiKey),
  });

  if (!response.ok) {
    const detail = await parseHedraError(response);
    throw new Error(`Hedra GET /models failed (${response.status}): ${detail}`);
  }

  const models = (await response.json()) as HedraModel[];
  const imageModels = models.filter((m) => m.type === 'image');

  if (imageModels.length === 0) {
    throw new Error('Hedra has no image generation models available');
  }

  const selected = imageModels[0];
  setImageModelCache(selected.id);

  logger.info('Hedra image model discovered', {
    modelId: selected.id,
    modelName: selected.name,
    totalImageModels: imageModels.length,
    file: 'hedra-service.ts',
  });

  return { id: selected.id, name: selected.name, resolutions: selected.resolutions };
}

/**
 * Fetch an image asset URL from Hedra by its asset ID.
 * Image generations store results as assets — the status endpoint returns
 * url:null for images, so we need to find the asset in the list.
 */
async function fetchHedraAssetUrl(apiKey: string, assetId: string): Promise<string> {
  const response = await fetch(
    `${HEDRA_BASE_URL}/assets?type=image&limit=50&recent=true`,
    { headers: hedraHeaders(apiKey) },
  );

  if (!response.ok) {
    throw new Error(`Hedra asset list failed (${response.status})`);
  }

  interface HedraAsset {
    id: string;
    asset?: { url?: string };
    thumbnail_url?: string;
  }

  const assets = (await response.json()) as HedraAsset[];
  const match = assets.find((a) => a.id === assetId);

  if (match?.asset?.url) {
    return match.asset.url;
  }
  if (match?.thumbnail_url) {
    return match.thumbnail_url;
  }

  throw new Error(`Hedra image asset ${assetId} not found in asset list`);
}

/**
 * Poll a Hedra generation until it completes or fails.
 * Images are typically faster than video (5-30 seconds).
 * For image generations, the URL comes from the asset (not the status endpoint).
 */
async function pollHedraGeneration(
  apiKey: string,
  generationId: string,
  maxWaitMs = 120000,
): Promise<{ url: string }> {
  const start = Date.now();
  const interval = 3000;

  while (Date.now() - start < maxWaitMs) {
    const response = await fetch(`${HEDRA_BASE_URL}/generations/${generationId}/status`, {
      headers: hedraHeaders(apiKey),
    });

    if (!response.ok) {
      const detail = await parseHedraError(response);
      throw new Error(`Hedra status poll failed (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as HedraStatusData;

    if (data.status === 'complete' || data.status === 'completed') {
      // Video generations return url directly; image generations store as asset
      const directUrl = data.url ?? data.download_url;
      if (directUrl) {
        return { url: directUrl };
      }

      // Image generation — fetch the asset URL
      if (data.asset_id) {
        const assetUrl = await fetchHedraAssetUrl(apiKey, data.asset_id);
        return { url: assetUrl };
      }

      throw new Error('Hedra generation completed but returned no URL or asset_id');
    }

    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(`Hedra image generation failed: ${data.error_message ?? data.error ?? 'Unknown error'}`);
    }

    await new Promise<void>((resolve) => { setTimeout(resolve, interval); });
  }

  throw new Error(`Hedra image generation timed out after ${maxWaitMs / 1000}s`);
}

/**
 * Generate an image using Hedra's image generation models.
 *
 * Uses the same /generations endpoint as video, but with type: 'image'.
 * Model is auto-discovered from Hedra's /models API.
 * Polls until complete and returns the image URL.
 */
export async function generateHedraImage(
  prompt: string,
  options?: { aspectRatio?: string; resolution?: string },
): Promise<HedraImageResult> {
  const apiKey = await getHedraApiKey();
  const model = await getHedraImageModelId(apiKey);

  logger.info('Hedra image generation starting', {
    modelId: model.id,
    modelName: model.name,
    promptLength: prompt.length,
    file: 'hedra-service.ts',
  });

  // Build payload — same endpoint as video, different type
  const payload: Record<string, unknown> = {
    type: 'image',
    ai_model_id: model.id,
    text_prompt: prompt,
    aspect_ratio: options?.aspectRatio ?? '1:1',
  };

  // Add resolution if the model supports it
  if (options?.resolution ?? (model.resolutions && model.resolutions.length > 0)) {
    const preferred = ['1080p', '1440p (2K QHD)', '720p'];
    const res = options?.resolution
      ?? preferred.find((r) => model.resolutions?.includes(r))
      ?? model.resolutions?.[0];
    if (res) {
      payload.resolution = res;
    }
  }

  // Submit generation
  const genResponse = await fetch(`${HEDRA_BASE_URL}/generations`, {
    method: 'POST',
    headers: hedraHeaders(apiKey, 'application/json'),
    body: JSON.stringify(payload),
  });

  if (!genResponse.ok) {
    const detail = await parseHedraError(genResponse);
    throw new Error(`Hedra image generation submit failed (${genResponse.status}): ${detail}`);
  }

  const generation = (await genResponse.json()) as HedraGenerationResponse;

  if (!generation?.id) {
    throw new Error('Hedra image generation returned no generation ID');
  }

  logger.info('Hedra image generation submitted, polling...', {
    generationId: generation.id,
    file: 'hedra-service.ts',
  });

  // Poll until complete
  const result = await pollHedraGeneration(apiKey, generation.id);

  logger.info('Hedra image generation complete', {
    generationId: generation.id,
    file: 'hedra-service.ts',
  });

  return {
    url: result.url,
    generationId: generation.id,
    modelId: model.id,
    modelName: model.name,
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
