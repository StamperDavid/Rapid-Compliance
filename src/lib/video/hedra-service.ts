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
import {
  getHedraCatalog,
  acceptsReference,
  maxReferenceImages,
  modelInputRoles,
  type HedraModel as HedraCatalogModel,
} from './hedra-capability-service';

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
  assetType: 'image' | 'audio' | 'video',
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

  // Step 3: Upload binary data via multipart POST to /assets/{id}/upload.
  // Pick an extension by asset kind so Hedra (and any CDN sniffing the name)
  // sees the right container. Video keeps an .mp4 extension — the chroma-key
  // motion clip that drives character-into-scene placement is uploaded here.
  const extByType: Record<'image' | 'audio' | 'video', string> = {
    image: 'png',
    audio: 'mp3',
    video: 'mp4',
  };
  const fileName = `${name}.${extByType[assetType]}`;
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
  // NOTE: Kling O3 does NOT support audio_generation (inline TTS) — it generates
  // audio natively from the text prompt. Only Character 3 (avatar mode) uses TTS.
  const PROMPT_T2V_MODEL_ID = 'b0e156da-da25-40b2-8386-937da7f47cc3';

  // If speech text is provided, append it to the text prompt so Kling O3
  // incorporates the dialogue into the video's native audio generation.
  let textPrompt = options.textPrompt ?? '';
  if (options.speechText) {
    textPrompt += `\n\nDialogue: "${options.speechText}"`;
  }

  const payload: HedraGenerationPayload = {
    type: 'video',
    ai_model_id: PROMPT_T2V_MODEL_ID,
    generated_video_inputs: {
      text_prompt: textPrompt,
      resolution: options.resolution ?? '720p',
      aspect_ratio: options.aspectRatio ?? '16:9',
      duration_ms: options.durationMs ?? 10000,
    },
  };

  return submitHedraGeneration(apiKey, payload, {
    mode: 'prompt-only',
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
// Public API — Character Conditioning (start frame + reference images + voice)
// ============================================================================

/**
 * A single character's conditioning material for a scene. The lead character is
 * the only one wired today, but this is an ARRAY-friendly shape so future
 * multi-character scenes (background extras, second speaker) plug in by adding
 * more entries — see the multi-character extension point in `generateHedraCharacterVideo`.
 */
export interface HedraCharacterReference {
  /** The identity anchor / start frame — typically the character's frontal portrait. */
  portraitUrl: string;
  /**
   * Additional reference images that lock wardrobe, body angles and styling:
   * the matched Look's images + the character's full-body / upper-body / extra
   * angles. The frontal portrait should NOT be repeated here.
   */
  referenceImageUrls: string[];
}

export interface HedraCharacterVideoOptions extends HedraGenerateOptions {
  /**
   * Reference sets, one per character. Only `characters[0]` (the bound lead) is
   * conditioned today; the array shape is the multi-character extension point.
   */
  characters: HedraCharacterReference[];
}

/**
 * Result of selecting a reference-capable video model from the live catalog.
 */
interface ReferenceModelSelection {
  model: HedraCatalogModel;
  maxReferences: number;
}

/**
 * Pick a video model from the LIVE catalog that can be conditioned on BOTH a
 * start frame AND reference images. Returns null when no such model exists (the
 * caller then falls back to portrait-only Character-3 / prompt mode).
 *
 * Selection criteria (all verified against the live catalog at runtime — nothing
 * hardcoded): type === 'video', accepts a `reference` input slot, and accepts a
 * `start_frame` input slot. We prefer character-tagged models (Hedra tags its
 * identity-consistency models `character`) and, among those, the one offering the
 * most reference slots so we can carry the richest identity set.
 */
async function selectReferenceCapableVideoModel(): Promise<ReferenceModelSelection | null> {
  const catalog = await getHedraCatalog();

  const candidates = catalog.filter((m) => {
    if (m.type !== 'video') { return false; }
    if (!acceptsReference(m)) { return false; }
    // Must also take a start frame so the portrait anchors the identity.
    return modelInputRoles(m).includes('start_frame');
  });

  if (candidates.length === 0) {
    return null;
  }

  // Prefer character-tagged models, then the most reference slots.
  candidates.sort((a, b) => {
    const aChar = (a.tags ?? []).includes('character') ? 1 : 0;
    const bChar = (b.tags ?? []).includes('character') ? 1 : 0;
    if (aChar !== bChar) { return bChar - aChar; }
    return maxReferenceImages(b) - maxReferenceImages(a);
  });

  const model = candidates[0];
  return { model, maxReferences: Math.max(1, maxReferenceImages(model)) };
}

/**
 * Generate a video CONDITIONED on a saved character's identity: the portrait as
 * the start frame PLUS reference images (the matched wardrobe Look + body angles)
 * so the character renders consistently across scenes — whether SPEAKING (voice
 * + script → inline TTS) or SILENT (start frame + references, no audio).
 *
 * This selects a reference-capable video model from the LIVE catalog. If none is
 * available, the catalog fetch fails, or no reference images were supplied, it
 * returns `null` so the caller can fall back to the existing portrait-only
 * Character-3 path (speaking) or the prompt path. It never throws for these
 * fallback conditions — only a genuine submit/upload failure propagates.
 *
 * MULTI-CHARACTER EXTENSION POINT: `options.characters` is an array. Today only
 * the lead (`characters[0]`) is conditioned — its portrait is the start frame and
 * its references fill the reference slots. To support background extras / a second
 * speaker, merge each additional character's portrait+references into the reference
 * set here (respecting `maxReferences`), and adjust the model selection to a
 * multi-subject model. Left single-character on purpose — multi is out of scope.
 */
export async function generateHedraCharacterVideo(
  options: HedraCharacterVideoOptions,
): Promise<HedraGenerationResult | null> {
  const lead = options.characters[0];
  if (!lead?.portraitUrl) {
    return null;
  }

  // De-dupe references and drop the portrait if it leaked into the reference set.
  const dedupedReferences = Array.from(
    new Set(lead.referenceImageUrls.filter((u) => u && u !== lead.portraitUrl)),
  );

  if (dedupedReferences.length === 0) {
    // No identity references beyond the portrait — let the caller use the
    // portrait-only path instead (this function adds nothing here).
    return null;
  }

  let selection: ReferenceModelSelection | null;
  try {
    selection = await selectReferenceCapableVideoModel();
  } catch (err) {
    logger.warn('Hedra catalog fetch failed during reference-model selection', {
      error: err instanceof Error ? err.message : String(err),
      file: 'hedra-service.ts',
    });
    return null;
  }

  if (!selection) {
    logger.info('No reference-capable Hedra video model in catalog — caller should fall back', {
      file: 'hedra-service.ts',
    });
    return null;
  }

  const { model, maxReferences } = selection;
  // Cap to the model's declared maximum reference slots.
  const references = dedupedReferences.slice(0, maxReferences);

  const useInlineTTS = Boolean(options.hedraVoiceId && options.speechText);

  const apiKey = await getHedraApiKey();

  logger.info('Hedra character-conditioned generation starting', {
    modelSlug: model.slug,
    modelId: model.id,
    references: references.length,
    maxReferences,
    mode: useInlineTTS ? 'speaking-inline-tts' : 'silent-no-audio',
    file: 'hedra-service.ts',
  });

  // Upload portrait (start frame) + references in parallel → asset ids.
  const [startId, referenceIds] = await Promise.all([
    uploadAssetFromUrl(apiKey, lead.portraitUrl, 'image', 'character-portrait'),
    Promise.all(
      references.map((u, i) => uploadAssetFromUrl(apiKey, u, 'image', `character-reference-${i}`)),
    ),
  ]);

  const payload: HedraGenerationPayload & { reference_image_ids?: string[] } = {
    type: 'video',
    ai_model_id: model.id,
    start_keyframe_id: startId,
    generated_video_inputs: {
      text_prompt: options.textPrompt ?? '',
      resolution: options.resolution ?? '720p',
      aspect_ratio: options.aspectRatio ?? '16:9',
      duration_ms: options.durationMs ?? 10000,
    },
  };
  if (referenceIds.length > 0) {
    payload.reference_image_ids = referenceIds;
  }
  // Speaking → inline TTS. Silent → omit audio entirely (start frame + references only).
  if (useInlineTTS && options.hedraVoiceId && options.speechText) {
    payload.audio_generation = {
      type: 'text_to_speech',
      voice_id: options.hedraVoiceId,
      text: options.speechText,
    };
  }

  return submitHedraGeneration(apiKey, payload, {
    mode: 'character-conditioned',
    modelSlug: model.slug,
    modelId: model.id,
    references: referenceIds.length,
    audioMode: useInlineTTS ? 'inline-tts' : 'silent',
  });
}

// ============================================================================
// Public API — Video-Driven Character Conditioning (PRIMARY, chroma-key clip)
// ============================================================================

/**
 * Options for the PRIMARY, video-driven character path.
 *
 * The reusable character is driven by a **chroma-key (green-screen) motion clip**
 * of that character. Casting the character into a new scene = feeding that clip as
 * the model's `input_video` plus a text scene prompt, so Hedra places the same
 * character (motion + identity preserved) into the described environment.
 */
export interface HedraCharacterClipVideoOptions extends HedraGenerateOptions {
  /** Public URL to the character's chroma-key (green-screen) motion clip. */
  sourceVideoUrl: string;
}

/**
 * Pick a video model from the LIVE catalog that accepts an `input_video` slot, so
 * a chroma-key character clip can drive the render. Returns null when no such
 * model exists (caller then falls back to the image-reference / portrait / prompt
 * paths). Nothing is hardcoded — the role is confirmed against the live catalog.
 *
 * Preference: models that REQUIRE an input video (`requires_input_video`) are the
 * purpose-built video-to-video / restyle models and rank first; then we prefer
 * character-tagged models so identity consistency is strongest.
 */
async function selectInputVideoCapableModel(): Promise<HedraCatalogModel | null> {
  const catalog = await getHedraCatalog();

  const candidates = catalog.filter((m) => {
    if (m.type !== 'video') { return false; }
    return modelInputRoles(m).includes('input_video');
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const aReq = a.requires_input_video ? 1 : 0;
    const bReq = b.requires_input_video ? 1 : 0;
    if (aReq !== bReq) { return bReq - aReq; }
    const aChar = (a.tags ?? []).includes('character') ? 1 : 0;
    const bChar = (b.tags ?? []).includes('character') ? 1 : 0;
    return bChar - aChar;
  });

  return candidates[0];
}

/**
 * PRIMARY character path: cast a saved character into a new scene by driving the
 * render with the character's **chroma-key (green-screen) motion clip** as the
 * model's `input_video`, plus a text scene prompt. Hedra preserves the character's
 * identity + motion from the clip and places it into the described environment
 * (e.g. a comic superhero walking through a real grocery store).
 *
 * Works SPEAKING (voice + script → inline TTS) or SILENT (input_video + prompt,
 * no audio).
 *
 * Selects an `input_video`-capable video model from the LIVE catalog, uploads the
 * clip as a VIDEO asset, and submits it in the `input_video` role. Returns `null`
 * — never throws — when there is no clip, no input-video-capable model, the
 * catalog fetch fails, or the clip upload fails, so the caller falls back to the
 * image-reference path, then portrait-only Character-3, then the prompt path.
 */
export async function generateHedraCharacterVideoFromClip(
  options: HedraCharacterClipVideoOptions,
): Promise<HedraGenerationResult | null> {
  const sourceVideoUrl = options.sourceVideoUrl?.trim();
  if (!sourceVideoUrl) {
    return null;
  }

  let model: HedraCatalogModel | null;
  try {
    model = await selectInputVideoCapableModel();
  } catch (err) {
    logger.warn('Hedra catalog fetch failed during input-video model selection', {
      error: err instanceof Error ? err.message : String(err),
      file: 'hedra-service.ts',
    });
    return null;
  }

  if (!model) {
    logger.info('No input_video-capable Hedra video model in catalog — caller should fall back', {
      file: 'hedra-service.ts',
    });
    return null;
  }

  const useInlineTTS = Boolean(options.hedraVoiceId && options.speechText);
  const apiKey = await getHedraApiKey();

  // Upload the chroma-key clip as a VIDEO asset → asset id for the input_video slot.
  let inputVideoId: string;
  try {
    inputVideoId = await uploadAssetFromUrl(apiKey, sourceVideoUrl, 'video', 'character-clip');
  } catch (err) {
    logger.warn('Hedra chroma-clip upload failed — caller should fall back', {
      modelSlug: model.slug,
      error: err instanceof Error ? err.message : String(err),
      file: 'hedra-service.ts',
    });
    return null;
  }

  logger.info('Hedra video-driven character generation starting', {
    modelSlug: model.slug,
    modelId: model.id,
    requiresInputVideo: Boolean(model.requires_input_video),
    mode: useInlineTTS ? 'speaking-inline-tts' : 'silent-no-audio',
    file: 'hedra-service.ts',
  });

  const payload: HedraGenerationPayload & { input_video_id?: string } = {
    type: 'video',
    ai_model_id: model.id,
    input_video_id: inputVideoId,
    generated_video_inputs: {
      text_prompt: options.textPrompt ?? '',
      resolution: options.resolution ?? '720p',
      aspect_ratio: options.aspectRatio ?? '16:9',
      duration_ms: options.durationMs ?? 10000,
    },
  };
  // Speaking → inline TTS. Silent → omit audio (input_video + prompt only).
  if (useInlineTTS && options.hedraVoiceId && options.speechText) {
    payload.audio_generation = {
      type: 'text_to_speech',
      voice_id: options.hedraVoiceId,
      text: options.speechText,
    };
  }

  return submitHedraGeneration(apiKey, payload, {
    mode: 'character-video-driven',
    modelSlug: model.slug,
    modelId: model.id,
    audioMode: useInlineTTS ? 'inline-tts' : 'silent',
  });
}

// ============================================================================
// Public API — GENERALIZED DRIVER (drive ANY Hedra model with ANY inputs)
// ============================================================================

/**
 * A model-agnostic generation request. The Hedra Specialist constructs one of
 * these from a creative intent + materials (which model, which reference images,
 * what controls), and this driver uploads every asset and submits the generation.
 *
 * Each *Url is a public URL we upload to Hedra as an asset; the resulting asset id
 * is placed in the payload by role (start_frame → start_keyframe_id, end_frame →
 * end_keyframe_id, reference → reference_image_ids, audio → audio_id). This is the
 * one path every model goes through, parameterized by what that model declares it
 * accepts (see hedra-capability-service).
 */
export interface HedraGenerateRequest {
  /** Hedra model id (resolve from the capability service by slug if needed). */
  modelId: string;
  /** 'video' (default) or 'image'. */
  type?: 'video' | 'image';
  textPrompt?: string;
  /** Start frame / primary conditioning image (e.g. the person or character). */
  startFrameUrl?: string | null;
  /** End frame (for start→end transition models). */
  endFrameUrl?: string | null;
  /** Additional reference images for character/style consistency. */
  referenceImageUrls?: string[];
  /** Pre-recorded audio to drive lip-sync / motion (e.g. OmniHuman, Character-3). */
  audioUrl?: string | null;
  /** Inline TTS — Hedra synthesizes the voice server-side. */
  tts?: { voiceId: string; text: string };
  resolution?: string;
  aspectRatio?: string;
  durationMs?: number;
  seed?: number;
}

/**
 * Drive ANY Hedra model. Uploads every provided asset, builds the payload by role,
 * submits the generation, and returns the generation id (poll with
 * getHedraVideoStatus). This is the single gateway the Hedra Specialist uses for
 * all generation — no more hardcoded model + single-path assumptions.
 */
export async function generateWithHedra(req: HedraGenerateRequest): Promise<HedraGenerationResult> {
  const apiKey = await getHedraApiKey();
  const type = req.type ?? 'video';

  // Upload every supplied asset in parallel → asset ids by role.
  const [startId, endId, audioId, referenceIds] = await Promise.all([
    req.startFrameUrl ? uploadAssetFromUrl(apiKey, req.startFrameUrl, 'image', 'start-frame') : Promise.resolve<string | null>(null),
    req.endFrameUrl ? uploadAssetFromUrl(apiKey, req.endFrameUrl, 'image', 'end-frame') : Promise.resolve<string | null>(null),
    req.audioUrl ? uploadAssetFromUrl(apiKey, req.audioUrl, 'audio', 'audio') : Promise.resolve<string | null>(null),
    req.referenceImageUrls && req.referenceImageUrls.length > 0
      ? Promise.all(req.referenceImageUrls.map((u, i) => uploadAssetFromUrl(apiKey, u, 'image', `reference-${i}`)))
      : Promise.resolve<string[]>([]),
  ]);

  const payload: Record<string, unknown> = {
    type,
    ai_model_id: req.modelId,
  };
  if (startId) { payload.start_keyframe_id = startId; }
  if (endId) { payload.end_keyframe_id = endId; }
  if (referenceIds.length > 0) { payload.reference_image_ids = referenceIds; }
  if (audioId) { payload.audio_id = audioId; }
  if (req.tts) {
    payload.audio_generation = { type: 'text_to_speech', voice_id: req.tts.voiceId, text: req.tts.text };
  }

  if (type === 'video') {
    const vid: Record<string, unknown> = {
      text_prompt: req.textPrompt ?? '',
      resolution: req.resolution ?? '720p',
      aspect_ratio: req.aspectRatio ?? '16:9',
    };
    if (req.durationMs) { vid.duration_ms = req.durationMs; }
    if (req.seed !== undefined) { vid.seed = req.seed; }
    payload.generated_video_inputs = vid;
  } else {
    payload.text_prompt = req.textPrompt ?? '';
    if (req.aspectRatio) { payload.aspect_ratio = req.aspectRatio; }
    if (req.resolution) { payload.resolution = req.resolution; }
  }

  const res = await fetch(`${HEDRA_BASE_URL}/generations`, {
    method: 'POST',
    headers: hedraHeaders(apiKey, 'application/json'),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Hedra generation submit failed (${res.status}): ${await parseHedraError(res)}`);
  }
  const gen = (await res.json()) as HedraGenerationResponse;
  if (!gen?.id) {
    throw new Error('Hedra generation returned no id');
  }

  logger.info('[Hedra] generateWithHedra submitted', {
    modelId: req.modelId,
    type,
    hasStart: Boolean(startId),
    hasEnd: Boolean(endId),
    references: referenceIds.length,
    hasAudio: Boolean(audioId),
    tts: Boolean(req.tts),
    generationId: gen.id,
    file: 'hedra-service.ts',
  });

  return { generationId: gen.id, modelId: req.modelId, status: gen.status, createdAt: gen.created_at };
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

  // Prefer a TEXT-to-image model. Many Hedra image models are image-to-image /
  // editing models (Kontext, inpaint, upscale, etc.) that REQUIRE a source image
  // and reject a pure text_prompt request — picking imageModels[0] grabbed one of
  // those ("Flux Kontext Max I2I"), which is why text-to-image 422'd.
  const isEditModel = (name: string): boolean =>
    /i2i|kontext|edit|inpaint|outpaint|upscal|remove|restyle|relight|swap|reference/i.test(name);
  const textToImage = imageModels.filter((m) => !isEditModel(m.name));
  // Prefer fast, permissive open models (Flux / Sana / Imagen) over GPT-Image,
  // which is slower and refuses named-artist / copyrighted-style prompts on
  // content policy (it blocked the photographer / movie-look / cinematographer
  // example renders). Lower rank = preferred.
  const rank = (name: string): number => {
    const n = name.toLowerCase();
    if (n.includes('flux') && n.includes('dev')) { return 0; }
    if (n === 'sana') { return 1; }
    if (n.includes('flux') && !n.includes('kontext')) { return 2; }
    if (n.includes('imagen')) { return 3; }
    if (n.includes('gpt image')) { return 9; }
    return 5;
  };
  const selected = [...textToImage].sort((a, b) => rank(a.name) - rank(b.name))[0] ?? imageModels[0];
  setImageModelCache(selected.id);

  logger.info('Hedra image model discovered', {
    modelId: selected.id,
    modelName: selected.name,
    textToImageCount: textToImage.length,
    totalImageModels: imageModels.length,
    allImageModels: imageModels.map((m) => m.name).join(' | '),
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
 * Generate an image CONDITIONED on a reference image (image-to-image), so the
 * result is built FROM the operator's actual artwork/character instead of being
 * reinvented from a text prompt. Picks a Hedra image-to-image / reference model
 * from the live catalog, uploads the reference, and submits it as the source frame.
 */
export async function generateHedraImageFromReference(
  prompt: string,
  referenceImageUrl: string,
  options?: { aspectRatio?: string },
): Promise<HedraImageResult> {
  const apiKey = await getHedraApiKey();

  // Choose an image-to-image / reference-capable image model from the live catalog.
  // PREFER Flux Kontext — it's the model that proved out for faithful character
  // reproduction (it reproduced the operator's hero re-posed). The previous selector
  // grabbed the first `i2i`-matching model, which landed on `flux2-pro-i2i` — that one
  // both drifts off-character and intermittently fails with a fal validation error.
  const catalog = await getHedraCatalog();
  const model =
    catalog.find((m) => m.type === 'image' && /kontext/i.test(`${m.slug} ${m.name}`))
    ?? catalog.find((m) => m.type === 'image' && /i2i|edit|restyle|reference/i.test(`${m.slug} ${m.name}`))
    ?? catalog.find((m) =>
      m.type === 'image' &&
      (m.inputs ?? []).some((mode) => (mode.slots ?? []).some((s) => s.role === 'start_frame' || s.role === 'reference')),
    );
  if (!model) {
    throw new Error('No Hedra image-to-image model available in the live catalog.');
  }

  const imageAssetId = await uploadAssetFromUrl(apiKey, referenceImageUrl, 'image', 'reference');

  const payload: Record<string, unknown> = {
    type: 'image',
    ai_model_id: model.id,
    text_prompt: prompt,
    start_keyframe_id: imageAssetId,
    aspect_ratio: options?.aspectRatio ?? '16:9',
  };

  // Submit + poll once. The fal image models intermittently fail a generation
  // (e.g. "Input should be a valid dictionary..."), so we retry the whole
  // generation one time before surfacing a hard error — an identical retry
  // usually succeeds.
  const attempt = async (n: number): Promise<HedraImageResult> => {
    logger.info('Hedra image-to-image starting', { modelSlug: model.slug, attempt: n, file: 'hedra-service.ts' });
    const genResponse = await fetch(`${HEDRA_BASE_URL}/generations`, {
      method: 'POST',
      headers: hedraHeaders(apiKey, 'application/json'),
      body: JSON.stringify(payload),
    });
    if (!genResponse.ok) {
      throw new Error(`Hedra image-to-image submit failed (${genResponse.status}): ${await parseHedraError(genResponse)}`);
    }
    const generation = (await genResponse.json()) as HedraGenerationResponse;
    if (!generation?.id) {
      throw new Error('Hedra image-to-image returned no generation ID');
    }
    const { url } = await pollHedraGeneration(apiKey, generation.id);
    return { url, generationId: generation.id, modelId: model.id, modelName: model.slug };
  };

  try {
    return await attempt(1);
  } catch (err) {
    logger.warn('Hedra image-to-image failed; retrying once', {
      modelSlug: model.slug,
      error: err instanceof Error ? err.message : String(err),
      file: 'hedra-service.ts',
    });
    return attempt(2);
  }
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

  // Build payload — image generation takes text_prompt/aspect_ratio/resolution
  // at the TOP LEVEL (unlike video, which nests under generated_video_inputs).
  // The earlier "Field required" failure was NOT this shape — it was the model:
  // getHedraImageModelId was picking an image-to-image model that needs a source
  // image. Selecting a text-to-image model (above) is the real fix.
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
