/**
 * Google AI Studio Provider — Imagen 3 Image Generation
 *
 * Best for: photorealistic images, natural lighting, product photography,
 * people/portraits. Imagen 3 excels at understanding spatial relationships
 * and rendering realistic textures.
 *
 * Supported models:
 *  - imagen-3.0-generate-002  — Standard quality (best results)
 *  - imagen-3.0-fast-generate-001 — Fast mode (cheaper, slightly lower quality)
 *
 * NOTE: Imagen returns base64 encoded images, not URLs. The caller must
 * either convert to a data URI or upload to storage for a persistent URL.
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

export interface GoogleGenerationOptions {
  model?: string;
  aspectRatio?: AspectRatio;
  personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow';
  sampleCount?: number;
}

export interface GoogleModelInfo {
  id: string;
  name: string;
  description: string;
  speed: 'fast' | 'standard';
  costPerImage: number;
}

interface ImagenPrediction {
  bytesBase64Encoded: string;
  mimeType: string;
}

interface ImagenApiResponse {
  predictions?: ImagenPrediction[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// ─── Constants ───────────────────────────────────────────────────────

const GOOGLE_AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const DEFAULT_MODEL = 'imagen-3.0-generate-002';

const MODEL_COSTS: Record<string, number> = {
  'imagen-3.0-generate-002': 0.08,
  'imagen-3.0-fast-generate-001': 0.04,
};

/**
 * Imagen supports a subset of aspect ratios via string values.
 * Map our standard aspect ratios to Imagen-compatible strings.
 */
const ASPECT_RATIO_MAP: Record<AspectRatio, string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '9:16': '9:16',
  '21:9': '16:9',   // Imagen doesn't support 21:9, fall back to 16:9
  '4:3': '4:3',
  '3:2': '3:4',     // Imagen uses 3:4 instead of 3:2, reversed for portrait
};

/**
 * Approximate pixel dimensions for each aspect ratio
 * (used in metadata, Imagen handles sizing internally).
 */
const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 896 },
  '3:4': { width: 896, height: 1152 },
};

// ─── API Key Retrieval ───────────────────────────────────────────────

/**
 * Get Google AI Studio (Gemini) API key. Imagen uses the same API key
 * as Gemini since they're both Google AI Studio endpoints.
 */
async function getGoogleAIKey(): Promise<string> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'gemini');
  if (typeof key === 'string' && key.length > 0) {
    return key;
  }
  throw new Error(
    'Google AI Studio API key not configured. Add a Gemini key in Settings > API Keys (Imagen uses the same key).'
  );
}

// ─── Main Generation Function ────────────────────────────────────────

/**
 * Generate an image using Google Imagen 3.
 *
 * @param prompt - The text prompt describing the desired image
 * @param options - Model, aspect ratio, and person generation settings
 * @returns GenerationResult with base64 data URI, cost, and metadata
 */
export async function generateWithGoogle(
  prompt: string,
  options: GoogleGenerationOptions = {}
): Promise<GenerationResult> {
  const apiKey = await getGoogleAIKey();
  const model = options.model ?? DEFAULT_MODEL;
  const aspectRatio = options.aspectRatio ?? '1:1';
  const imagenAspectRatio = ASPECT_RATIO_MAP[aspectRatio] ?? '1:1';
  const personGeneration = options.personGeneration ?? 'allow_all';

  logger.info('[Google AI] Starting Imagen generation', {
    model,
    aspectRatio: imagenAspectRatio,
    promptLength: prompt.length,
    file: 'google-ai-provider.ts',
  });

  const url = `${GOOGLE_AI_BASE_URL}/${model}:predict?key=${apiKey}`;

  const requestBody = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: imagenAspectRatio,
      personGeneration,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[Google AI] Imagen API error', new Error(errorText), {
      status: response.status,
      model,
      file: 'google-ai-provider.ts',
    });
    throw new Error(`Google Imagen API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ImagenApiResponse;

  if (data.error) {
    throw new Error(`Google Imagen API error: ${data.error.message} (${data.error.status})`);
  }

  if (!data.predictions || data.predictions.length === 0) {
    throw new Error('Google Imagen returned empty response — no predictions generated');
  }

  const prediction = data.predictions[0];
  const mimeType = prediction.mimeType || 'image/png';

  // Convert base64 to data URI for immediate use
  const imageUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;

  const cost = MODEL_COSTS[model] ?? 0.08;
  const dimensions = ASPECT_RATIO_DIMENSIONS[imagenAspectRatio] ?? { width: 1024, height: 1024 };

  const metadata: GenerationMetadata = {
    width: dimensions.width,
    height: dimensions.height,
    format: mimeType,
  };

  const generationId = `google-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  logger.info('[Google AI] Imagen generation completed', {
    generationId,
    model,
    mimeType,
    file: 'google-ai-provider.ts',
  });

  return {
    id: generationId,
    url: imageUrl,
    provider: 'google',
    model,
    cost,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

// ─── Model Info ──────────────────────────────────────────────────────

/**
 * Returns information about all available Google Imagen models.
 */
export function getGoogleModels(): GoogleModelInfo[] {
  return [
    {
      id: 'imagen-3.0-generate-002',
      name: 'Imagen 3 Standard',
      description: 'Highest quality photorealistic generation, excellent for portraits and product shots',
      speed: 'standard',
      costPerImage: 0.08,
    },
    {
      id: 'imagen-3.0-fast-generate-001',
      name: 'Imagen 3 Fast',
      description: 'Faster generation at lower cost, good for iteration and drafts',
      speed: 'fast',
      costPerImage: 0.04,
    },
  ];
}

// ─── Capabilities ────────────────────────────────────────────────────

/**
 * Returns the capability set for the Google AI provider.
 */
export function getGoogleCapabilities(): ProviderCapability[] {
  return [
    {
      type: 'image',
      models: ['imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001'],
      maxResolution: '1344x1344',
      supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3'],
      supportsCharacterRef: false,
      supportsStyleRef: false,
      supportsInpainting: false,
    },
  ];
}
