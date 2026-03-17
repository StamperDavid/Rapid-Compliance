/**
 * Provider Router — Central Routing Layer for Cinematic Content Engine
 *
 * The expert engine selection system that picks the best AI provider
 * for each generation request based on style, type, and configuration.
 *
 * Provider strengths:
 *  - fal     → anime, concept art, stylized imagery, fast iteration
 *  - google  → photorealistic, natural lighting, product photography
 *  - kling   → cinematic video, complex camera movements
 *  - openai  → DALL-E 3, general purpose, good prompt understanding
 *  - hedra   → talking head avatars (handled separately by video pipeline)
 */

import { generateWithFal, getFalCapabilities } from './providers/fal-provider';
import { generateWithGoogle, getGoogleCapabilities } from './providers/google-ai-provider';
import {
  generateWithKling,
  generateVideoWithKling,
  getKlingCapabilities,
} from './providers/kling-provider';
import { generateImage as generateWithOpenAIDalle } from './image-generation-service';
import { generateHedraImage } from '@/lib/video/hedra-service';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { buildPromptFromPresets } from './cinematic-presets';
import type {
  StudioProvider,
  GenerationRequest,
  GenerationResult,
  ProviderConfig,
} from '@/types/creative-studio';
import type { APIServiceName } from '@/types/api-keys';

// ─── Provider → Service Mapping ──────────────────────────────────────

/** Map StudioProvider to the APIServiceName used by apiKeyService */
const PROVIDER_TO_SERVICE: Record<StudioProvider, APIServiceName> = {
  fal: 'fal',
  google: 'gemini', // Imagen uses the same Google AI Studio key as Gemini
  openai: 'openai',
  hedra: 'hedra',
  kling: 'kling',
};

// ─── Style Classification Sets ───────────────────────────────────────

/** Art styles where Flux/SDXL on Fal.ai excel */
const STYLIZED_ART_STYLES = new Set([
  'anime',
  'manga',
  'comic',
  'pixar-3d',
  'concept-art',
  'digital-art',
  'watercolor',
  'oil-painting',
  'pop-art',
  'art-nouveau',
  'ukiyo-e',
  'low-poly',
  'isometric',
  'vaporwave',
  'steampunk',
  'fantasy',
]);

/** Art styles where Google Imagen excels */
const PHOTOREALISTIC_ART_STYLES = new Set([
  'photorealistic',
  'hyperrealistic',
]);

/** Prompt keywords that hint at photorealistic intent */
const PHOTOREALISTIC_KEYWORDS = [
  'photo',
  'photograph',
  'realistic',
  'real life',
  'product shot',
  'headshot',
  'portrait photo',
  'professional photo',
  'dslr',
  '8k photo',
];

// ─── Provider Availability Check ─────────────────────────────────────

async function isProviderAvailable(provider: StudioProvider): Promise<boolean> {
  const serviceName = PROVIDER_TO_SERVICE[provider];
  try {
    const key = await apiKeyService.getServiceKey(PLATFORM_ID, serviceName);
    return Boolean(key);
  } catch {
    return false;
  }
}

// ─── Auto-Select Provider (Expert Engine Selection) ──────────────────

/**
 * Automatically select the best provider for a generation request
 * based on art style, generation type, and prompt content.
 *
 * Decision tree:
 * 1. User-specified provider → use that
 * 2. Video → kling (only text-to-video provider in this router)
 * 3. Anime/manga/comic/stylized art → fal (Flux excels here)
 * 4. Photorealistic or no style → google (Imagen best for natural)
 * 5. Movie look + no art style → google
 * 6. Heavy filters/effects → fal (most flexible)
 * 7. Default → google
 */
export function autoSelectProvider(request: GenerationRequest): StudioProvider {
  if (request.provider) {
    return request.provider;
  }

  const artStyle = request.presets.artStyle ?? '';
  const promptLower = request.prompt.toLowerCase();
  const hasMovieLook = Boolean(request.presets.movieLook);
  const hasFilters = Boolean(request.presets.filters && request.presets.filters.length > 0);

  // Video generation → kling
  if (request.type === 'video') {
    return 'kling';
  }

  // Anime, manga, comic, and stylized art → fal
  if (artStyle && STYLIZED_ART_STYLES.has(artStyle)) {
    return 'fal';
  }

  // Explicitly photorealistic art style → google
  if (artStyle && PHOTOREALISTIC_ART_STYLES.has(artStyle)) {
    return 'google';
  }

  // Prompt contains photorealistic keywords → google
  const hasPhotoKeywords = PHOTOREALISTIC_KEYWORDS.some(kw => promptLower.includes(kw));
  if (hasPhotoKeywords) {
    return 'google';
  }

  // Movie look with no specific art style → google
  if (hasMovieLook && !artStyle) {
    return 'google';
  }

  // Heavy filters/effects → fal
  if (hasFilters) {
    return 'fal';
  }

  // Default → hedra (uses existing API key, no additional keys needed)
  return 'hedra';
}

// ─── Fallback Provider Selection ─────────────────────────────────────

async function findFallbackProvider(
  type: 'image' | 'video',
  excludeProvider: StudioProvider
): Promise<StudioProvider> {
  if (type === 'video') {
    if (excludeProvider !== 'kling' && await isProviderAvailable('kling')) {
      return 'kling';
    }
    throw new Error(
      'No video generation provider available. Configure Kling API credentials in Settings > API Keys.'
    );
  }

  // Image fallback chain: hedra → google → fal → openai
  const imageFallbackOrder: StudioProvider[] = ['hedra', 'google', 'fal', 'openai'];

  for (const provider of imageFallbackOrder) {
    if (provider !== excludeProvider && await isProviderAvailable(provider)) {
      logger.info(`[Router] Falling back to ${provider}`, {
        file: 'provider-router.ts',
      });
      return provider;
    }
  }

  throw new Error(
    'No image generation provider available. Configure at least one provider (Google AI, Fal.ai, or OpenAI) in Settings > API Keys.'
  );
}

// ─── Route Generation ────────────────────────────────────────────────

/**
 * Route a generation request to the appropriate provider.
 *
 * 1. Assembles the cinematic prompt from presets
 * 2. Determines the provider (user-selected or auto-selected)
 * 3. Verifies provider availability, falls back if unavailable
 * 4. Routes to the correct provider function
 * 5. Returns GenerationResult with cost, metadata, etc.
 */
export async function routeGeneration(
  request: GenerationRequest
): Promise<GenerationResult> {
  // Build the assembled prompt from subject text + cinematic presets
  const assembledPrompt = buildPromptFromPresets(request.prompt, request.presets);

  logger.info('[Router] Routing generation request', {
    type: request.type,
    requestedProvider: request.provider ?? 'auto',
    promptLength: assembledPrompt.length,
    file: 'provider-router.ts',
  });

  // Determine provider
  let selectedProvider = autoSelectProvider(request);

  // Verify provider is available; fall back if not
  const providerAvailable = await isProviderAvailable(selectedProvider);
  if (!providerAvailable) {
    logger.warn(`[Router] Provider ${selectedProvider} not available, finding fallback`, {
      file: 'provider-router.ts',
    });
    selectedProvider = await findFallbackProvider(request.type, selectedProvider);
  }

  logger.info(`[Router] Selected provider: ${selectedProvider}`, {
    type: request.type,
    file: 'provider-router.ts',
  });

  const startTime = Date.now();
  let result: GenerationResult;

  // Try the selected provider; on auth/availability errors, attempt fallback
  const tryProvider = async (provider: StudioProvider): Promise<GenerationResult> => {
    switch (provider) {
      case 'fal':
        return generateWithFal(assembledPrompt, {
          model: request.model,
          negativePrompt: request.negativePrompt,
          aspectRatio: request.presets.aspectRatio,
        });

      case 'google':
        return generateWithGoogle(assembledPrompt, {
          model: request.model,
          aspectRatio: request.presets.aspectRatio,
        });

      case 'kling':
        if (request.type === 'video') {
          return generateVideoWithKling(assembledPrompt, {
            model: request.model,
            negativePrompt: request.negativePrompt,
            aspectRatio: request.presets.aspectRatio,
          });
        }
        return generateWithKling(assembledPrompt, {
          model: request.model,
          negativePrompt: request.negativePrompt,
          aspectRatio: request.presets.aspectRatio,
        });

      case 'openai': {
        const sizeMap: Record<string, '1024x1024' | '1792x1024' | '1024x1792'> = {
          '1:1': '1024x1024',
          '16:9': '1792x1024',
          '9:16': '1024x1792',
          '21:9': '1792x1024',
          '4:3': '1024x1024',
          '3:2': '1792x1024',
        };
        const dalleSize = sizeMap[request.presets.aspectRatio ?? '1:1'] ?? '1024x1024';
        const quality = request.quality === 'hd' ? 'hd' : 'standard';

        const openaiResult = await generateWithOpenAIDalle(assembledPrompt, {
          size: dalleSize,
          quality,
        });

        const widthHeight = dalleSize.split('x').map(Number);

        return {
          id: `openai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          url: openaiResult.url,
          revisedPrompt: openaiResult.revisedPrompt,
          provider: 'openai',
          model: 'dall-e-3',
          cost: quality === 'hd' ? 0.08 : 0.04,
          metadata: {
            width: widthHeight[0],
            height: widthHeight[1],
            format: 'image/png',
          },
          createdAt: new Date().toISOString(),
        };
      }

      case 'hedra': {
        if (request.type === 'video') {
          throw new Error(
            'Hedra video generation is handled by the Video Pipeline, not the Creative Studio router. ' +
            'Use the /api/video endpoints for talking head videos.'
          );
        }

        const hedraResult = await generateHedraImage(assembledPrompt, {
          aspectRatio: request.presets.aspectRatio,
        });

        return {
          id: hedraResult.generationId,
          url: hedraResult.url,
          provider: 'hedra',
          model: hedraResult.modelName,
          cost: 0.04,
          metadata: {
            width: 1024,
            height: 1024,
            format: 'image/png',
          },
          createdAt: new Date().toISOString(),
        };
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  };

  // Attempt selected provider, fall back on auth/API errors
  try {
    result = await tryProvider(selectedProvider);
  } catch (providerError) {
    const errMsg = providerError instanceof Error ? providerError.message : String(providerError);
    const isAuthError = /invalid.*key|key.*invalid|unauthorized|forbidden|API_KEY_INVALID/i.test(errMsg);
    const isProviderDown = /failed|error|unavailable|timeout/i.test(errMsg);

    if ((isAuthError || isProviderDown) && request.type === 'image') {
      logger.warn(`[Router] Provider ${selectedProvider} failed (${errMsg.slice(0, 100)}), trying fallback`, {
        file: 'provider-router.ts',
      });
      try {
        const fallback = await findFallbackProvider(request.type, selectedProvider);
        result = await tryProvider(fallback);
      } catch (_fallbackError) {
        // Fallback also failed — throw the original error
        throw providerError;
      }
    } else {
      throw providerError;
    }
  }

  const durationMs = Date.now() - startTime;
  logger.info('[Router] Generation complete', {
    provider: selectedProvider,
    model: result.model,
    duration: durationMs,
    cost: result.cost,
    file: 'provider-router.ts',
  });

  return result;
}

// ─── Available Providers ─────────────────────────────────────────────

/**
 * Check which providers are configured and return their status and capabilities.
 */
export async function getAvailableProviders(): Promise<ProviderConfig[]> {
  const providers: ProviderConfig[] = [];

  // Fal.ai
  const falConfigured = await isProviderAvailable('fal');
  providers.push({
    provider: 'fal',
    displayName: 'Fal.ai (Flux)',
    description: 'Flux & SDXL models — best for anime, concept art, stylized imagery, and fast iteration',
    isConfigured: falConfigured,
    isHealthy: falConfigured,
    capabilities: getFalCapabilities(),
    costPerUnit: {
      'fal-ai/flux/schnell': 0.03,
      'fal-ai/flux/dev': 0.05,
      'fal-ai/flux-pro': 0.10,
      'fal-ai/stable-diffusion-xl': 0.04,
      'fal-ai/flux-realism': 0.06,
    },
    recommended: ['anime', 'concept art', 'stylized', 'fast drafts'],
  });

  // Google AI (Imagen)
  const googleConfigured = await isProviderAvailable('google');
  providers.push({
    provider: 'google',
    displayName: 'Google Imagen 3',
    description: 'Imagen 3 — best for photorealistic images, natural lighting, product photography',
    isConfigured: googleConfigured,
    isHealthy: googleConfigured,
    capabilities: getGoogleCapabilities(),
    costPerUnit: {
      'imagen-3.0-generate-002': 0.08,
      'imagen-3.0-fast-generate-001': 0.04,
    },
    recommended: ['photorealistic', 'portraits', 'product shots', 'natural lighting'],
  });

  // Kling
  const klingConfigured = await isProviderAvailable('kling');
  providers.push({
    provider: 'kling',
    displayName: 'Kling 3.0',
    description: 'Kling AI — cinematic video generation, complex camera movements, text-to-video',
    isConfigured: klingConfigured,
    isHealthy: klingConfigured,
    capabilities: getKlingCapabilities(),
    costPerUnit: {
      'kling-v1-image': 0.014,
      'kling-v1-video-5s-std': 0.07,
      'kling-v1-video-10s-std': 0.14,
      'kling-v1-video-5s-pro': 0.14,
      'kling-v1-video-10s-pro': 0.28,
    },
    recommended: ['video', 'cinematic', 'camera movements', 'talking heads'],
  });

  // OpenAI (DALL-E 3)
  const openaiConfigured = await isProviderAvailable('openai');
  providers.push({
    provider: 'openai',
    displayName: 'OpenAI DALL-E 3',
    description: 'DALL-E 3 — excellent prompt understanding, good generalist for all styles',
    isConfigured: openaiConfigured,
    isHealthy: openaiConfigured,
    capabilities: [
      {
        type: 'image',
        models: ['dall-e-3'],
        maxResolution: '1792x1024',
        supportedAspectRatios: ['1:1', '16:9', '9:16'],
        supportsCharacterRef: false,
        supportsStyleRef: false,
        supportsInpainting: false,
      },
    ],
    costPerUnit: {
      'dall-e-3-standard': 0.04,
      'dall-e-3-hd': 0.08,
    },
    recommended: ['general purpose', 'text rendering', 'prompt adherence'],
  });

  // Hedra (for completeness — avatars handled by Video Pipeline)
  const hedraConfigured = await isProviderAvailable('hedra');
  providers.push({
    provider: 'hedra',
    displayName: 'Hedra Character-3',
    description: 'Hedra — talking head avatar video generation (managed via Video Pipeline)',
    isConfigured: hedraConfigured,
    isHealthy: hedraConfigured,
    capabilities: [
      {
        type: 'video',
        models: ['character-3'],
        maxResolution: '1024x1024',
        supportedAspectRatios: ['1:1', '16:9', '9:16'],
        supportsCharacterRef: true,
        supportsStyleRef: false,
        supportsInpainting: false,
      },
    ],
    costPerUnit: {
      'character-3': 0.10,
    },
    recommended: ['talking heads', 'avatar videos', 'character animation'],
  });

  return providers;
}

// ─── Cost Estimation ─────────────────────────────────────────────────

/**
 * Get the estimated cost for a generation with a specific provider and model.
 *
 * @param provider - The provider to estimate for
 * @param model - The specific model ID
 * @param resolution - The resolution string (e.g., "1024x1024")
 * @returns Estimated cost in USD
 */
export function getProviderCostEstimate(
  provider: StudioProvider,
  model: string,
  resolution: string
): number {
  const parts = resolution.split('x').map(Number);
  const totalPixels = (parts[0] ?? 1024) * (parts[1] ?? 1024);
  const isHighRes = totalPixels > 1024 * 1024;

  switch (provider) {
    case 'fal': {
      const falCosts: Record<string, number> = {
        'fal-ai/flux/schnell': 0.03,
        'fal-ai/flux/dev': 0.05,
        'fal-ai/flux-pro': 0.10,
        'fal-ai/stable-diffusion-xl': 0.04,
        'fal-ai/flux-realism': 0.06,
      };
      return falCosts[model] ?? 0.05;
    }

    case 'google': {
      const googleCosts: Record<string, number> = {
        'imagen-3.0-generate-002': 0.08,
        'imagen-3.0-fast-generate-001': 0.04,
      };
      return googleCosts[model] ?? 0.08;
    }

    case 'kling': {
      if (model.includes('video') || model.includes('text2video')) {
        return 0.07;
      }
      return 0.014;
    }

    case 'openai':
      return isHighRes ? 0.08 : 0.04;

    case 'hedra':
      return 0.10;

    default:
      return 0.05;
  }
}
