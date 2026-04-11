/**
 * Coaching AI Model Configuration
 *
 * Curated list of models available for the coaching feature via OpenRouter.
 * Each model is identified by its OpenRouter model ID.
 */

import { z } from 'zod';

// ============================================================================
// MODEL CATALOG
// ============================================================================

export interface CoachingModelInfo {
  /** Display name */
  name: string;
  /** Provider company */
  provider: string;
  /** Quality tier */
  quality: 'ultra' | 'high' | 'standard';
  /** Relative cost tier */
  costTier: 'premium' | 'standard' | 'budget';
  /** Short description */
  description: string;
}

export const COACHING_MODELS: Record<string, CoachingModelInfo> = {
  'anthropic/claude-sonnet-4.6': {
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    quality: 'ultra',
    costTier: 'standard',
    description: 'Best balance of quality and speed for coaching insights',
  },
  'openai/gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    quality: 'ultra',
    costTier: 'standard',
    description: 'Strong analytical reasoning with fast response times',
  },
  'google/gemini-pro-1.5': {
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    quality: 'ultra',
    costTier: 'standard',
    description: 'Excellent at structured data analysis and long context',
  },
  'anthropic/claude-3-haiku': {
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    quality: 'high',
    costTier: 'budget',
    description: 'Fast and affordable with solid coaching quality',
  },
  'meta-llama/llama-3.1-70b-instruct': {
    name: 'Llama 3.1 70B',
    provider: 'Meta',
    quality: 'high',
    costTier: 'budget',
    description: 'Open-source powerhouse, great value for coaching',
  },
} as const;

/** Default model when no preference is set */
export const DEFAULT_COACHING_MODEL = 'anthropic/claude-sonnet-4.6';

/** Valid model IDs (for runtime validation) */
export const VALID_COACHING_MODEL_IDS = Object.keys(COACHING_MODELS);

// ============================================================================
// PREFERENCES
// ============================================================================

export interface CoachingPreferences {
  /** Selected OpenRouter model ID */
  selectedModel: string;
  /** Who last changed this preference */
  updatedBy: string;
  /** When it was last changed */
  updatedAt: Date;
}

export const CoachingPreferencesSchema = z.object({
  selectedModel: z.string().refine(
    (val) => VALID_COACHING_MODEL_IDS.includes(val),
    { message: 'Invalid coaching model ID' }
  ),
  updatedBy: z.string().min(1),
  updatedAt: z.date(),
});
