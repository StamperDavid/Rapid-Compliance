/**
 * Image Generation Service
 * Wraps OpenAI DALL-E 3 API for brand asset generation
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// Types
// ============================================================================

export type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';
export type ImageQuality = 'standard' | 'hd';
export type ImageStyle = 'vivid' | 'natural';

export interface ImageGenerationOptions {
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
}

export interface ImageGenerationResult {
  url: string;
  revisedPrompt: string;
}

interface DallEResponse {
  created: number;
  data: Array<{
    url: string;
    revised_prompt: string;
  }>;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Get OpenAI API key from Firestore or environment fallback
 */
async function getOpenAIKey(): Promise<string | null> {
  const key = await apiKeyService.getServiceKey(PLATFORM_ID, 'openai');
  if (typeof key === 'string' && key.length > 0) {
    return key;
  }
  // Fallback to environment variable
  return process.env.OPENAI_API_KEY ?? null;
}

/**
 * Generate an image using DALL-E 3
 *
 * @param prompt - The text prompt describing the desired image
 * @param options - Size, quality, and style options
 * @returns The generated image URL and the revised prompt DALL-E used
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Add it in Settings > API Keys.');
  }

  const {
    size = '1024x1024',
    quality = 'standard',
    style = 'vivid',
  } = options;

  logger.info('Image generation starting', {
    size,
    quality,
    style,
    promptLength: prompt.length,
    file: 'image-generation-service.ts',
  });

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
      style,
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('DALL-E 3 API error', new Error(errorText), {
      status: response.status,
      file: 'image-generation-service.ts',
    });
    throw new Error(`DALL-E 3 API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as DallEResponse;

  if (!data.data[0]) {
    throw new Error('DALL-E 3 returned empty response');
  }

  logger.info('Image generation completed', {
    file: 'image-generation-service.ts',
  });

  return {
    url: data.data[0].url,
    revisedPrompt: data.data[0].revised_prompt,
  };
}

/**
 * Map asset dimensions to DALL-E 3 sizes
 *
 * - Square/icon assets → 1024x1024
 * - Wide banners → 1792x1024
 * - Tall/story formats → 1024x1792
 */
export function mapDimensionsToSize(
  width: number,
  height: number
): ImageSize {
  const aspectRatio = width / height;

  if (aspectRatio > 1.3) {
    return '1792x1024'; // Wide/landscape
  } else if (aspectRatio < 0.77) {
    return '1024x1792'; // Tall/portrait
  }
  return '1024x1024'; // Square
}
