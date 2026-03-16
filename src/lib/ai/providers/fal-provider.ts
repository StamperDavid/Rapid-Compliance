/**
 * Fal.ai Provider — Flux, SDXL, Stable Diffusion Image Generation
 *
 * Best for: anime, concept art, stylized imagery, fast iteration.
 * Fal.ai hosts open-source models with fast inference and competitive pricing.
 *
 * Supported models:
 *  - fal-ai/flux/dev        — Flux Dev (fast, high quality)
 *  - fal-ai/flux-pro        — Flux Pro (highest quality)
 *  - fal-ai/flux/schnell    — Flux Schnell (fastest, lower quality)
 *  - fal-ai/stable-diffusion-xl — SDXL (wide style range)
 *  - fal-ai/flux-realism    — Flux Realism (photorealistic)
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

export interface FalGenerationOptions {
  model?: string;
  negativePrompt?: string;
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
  seed?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
}

export interface FalModelInfo {
  id: string;
  name: string;
  description: string;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'standard' | 'high' | 'highest';
  costPerImage: number;
}

interface FalImageResult {
  url: string;
  content_type: string;
  width: number;
  height: number;
}

interface FalApiResponse {
  images: FalImageResult[];
  seed: number;
  timings: Record<string, number>;
  has_nsfw_concepts?: boolean[];
  prompt?: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const FAL_BASE_URL = 'https://fal.run';

const DEFAULT_MODEL = 'fal-ai/flux/dev';

const MODEL_COSTS: Record<string, number> = {
  'fal-ai/flux/schnell': 0.03,
  'fal-ai/flux/dev': 0.05,
  'fal-ai/flux-pro': 0.10,
  'fal-ai/stable-diffusion-xl': 0.04,
  'fal-ai/flux-realism': 0.06,
};

const ASPECT_RATIO_TO_PIXELS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '21:9': { width: 1536, height: 640 },
  '4:3': { width: 1152, height: 896 },
  '3:2': { width: 1216, height: 832 },
};

// ─── API Key Retrieval ───────────────────────────────────────────────

async function getFalApiKey(): Promise<string> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  if (typeof key === 'string' && key.length > 0) {
    return key;
  }
  throw new Error('Fal.ai API key not configured. Add it in Settings > API Keys.');
}

// ─── Size Resolution ─────────────────────────────────────────────────

function resolveImageSize(
  options: FalGenerationOptions
): { width: number; height: number } {
  if (options.width && options.height) {
    return { width: options.width, height: options.height };
  }
  const ratio = options.aspectRatio ?? '1:1';
  return ASPECT_RATIO_TO_PIXELS[ratio];
}

// ─── Main Generation Function ────────────────────────────────────────

/**
 * Generate an image using Fal.ai (Flux, SDXL, or Stable Diffusion models).
 *
 * @param prompt - The text prompt describing the desired image
 * @param options - Model, size, guidance, and inference step options
 * @returns GenerationResult with URL, cost, and metadata
 */
export async function generateWithFal(
  prompt: string,
  options: FalGenerationOptions = {}
): Promise<GenerationResult> {
  const apiKey = await getFalApiKey();
  const model = options.model ?? DEFAULT_MODEL;
  const { width, height } = resolveImageSize(options);

  logger.info('[Fal] Starting image generation', {
    model,
    width,
    height,
    promptLength: prompt.length,
    file: 'fal-provider.ts',
  });

  const requestBody: Record<string, unknown> = {
    prompt,
    image_size: { width, height },
    num_images: 1,
  };

  if (options.negativePrompt) {
    requestBody.negative_prompt = options.negativePrompt;
  }
  if (options.seed !== undefined) {
    requestBody.seed = options.seed;
  }
  if (options.guidanceScale !== undefined) {
    requestBody.guidance_scale = options.guidanceScale;
  }
  if (options.numInferenceSteps !== undefined) {
    requestBody.num_inference_steps = options.numInferenceSteps;
  }

  const url = `${FAL_BASE_URL}/${model}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[Fal] API error', new Error(errorText), {
      status: response.status,
      model,
      file: 'fal-provider.ts',
    });
    throw new Error(`Fal.ai API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as FalApiResponse;

  if (!data.images || data.images.length === 0) {
    throw new Error('Fal.ai returned empty image response');
  }

  const image = data.images[0];
  const cost = MODEL_COSTS[model] ?? 0.05;

  const metadata: GenerationMetadata = {
    width: image.width,
    height: image.height,
    format: image.content_type || 'image/png',
    seed: data.seed,
  };

  if (options.numInferenceSteps) {
    metadata.steps = options.numInferenceSteps;
  }
  if (options.guidanceScale) {
    metadata.cfgScale = options.guidanceScale;
  }

  const generationId = `fal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  logger.info('[Fal] Image generation completed', {
    generationId,
    model,
    width: image.width,
    height: image.height,
    file: 'fal-provider.ts',
  });

  return {
    id: generationId,
    url: image.url,
    provider: 'fal',
    model,
    cost,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

// ─── Model Info ──────────────────────────────────────────────────────

/**
 * Returns information about all available Fal.ai models.
 */
export function getFalModels(): FalModelInfo[] {
  return [
    {
      id: 'fal-ai/flux/schnell',
      name: 'Flux Schnell',
      description: 'Fastest generation, good for rapid iteration and drafts',
      speed: 'fast',
      quality: 'standard',
      costPerImage: 0.03,
    },
    {
      id: 'fal-ai/flux/dev',
      name: 'Flux Dev',
      description: 'Balanced speed and quality, excellent default choice',
      speed: 'medium',
      quality: 'high',
      costPerImage: 0.05,
    },
    {
      id: 'fal-ai/flux-pro',
      name: 'Flux Pro',
      description: 'Highest quality Flux model, best for final renders',
      speed: 'slow',
      quality: 'highest',
      costPerImage: 0.10,
    },
    {
      id: 'fal-ai/stable-diffusion-xl',
      name: 'Stable Diffusion XL',
      description: 'Wide style range, excellent for stylized and artistic imagery',
      speed: 'medium',
      quality: 'high',
      costPerImage: 0.04,
    },
    {
      id: 'fal-ai/flux-realism',
      name: 'Flux Realism',
      description: 'Optimized for photorealistic output with Flux architecture',
      speed: 'medium',
      quality: 'high',
      costPerImage: 0.06,
    },
  ];
}

// ─── Capabilities ────────────────────────────────────────────────────

/**
 * Returns the capability set for the Fal.ai provider.
 */
export function getFalCapabilities(): ProviderCapability[] {
  return [
    {
      type: 'image',
      models: [
        'fal-ai/flux/dev',
        'fal-ai/flux-pro',
        'fal-ai/flux/schnell',
        'fal-ai/stable-diffusion-xl',
        'fal-ai/flux-realism',
      ],
      maxResolution: '1536x1536',
      supportedAspectRatios: ['1:1', '16:9', '9:16', '21:9', '4:3', '3:2'],
      supportsCharacterRef: false,
      supportsStyleRef: false,
      supportsInpainting: false,
    },
  ];
}
