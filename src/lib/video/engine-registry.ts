/**
 * Video Engine Registry
 * Client-safe constants — no server imports
 *
 * fal (Seedance) is the sole video generation engine.
 */

import type { VideoEngineId } from '@/types/video-pipeline';

export type EngineIntegrationStatus = 'available' | 'coming-soon';

export interface VideoEngineConfig {
  id: VideoEngineId;
  label: string;
  icon: string; // Lucide icon name
  description: string;
  costPer5Seconds: number; // cents
  quality: 'standard' | 'high' | 'ultra';
  bestFor: string[];
  integrationStatus: EngineIntegrationStatus;
  apiKeyServiceId: string | null; // null = not yet integrated
}

export const FAL_ENGINE_CONFIG: VideoEngineConfig = {
  id: 'fal',
  label: 'Seedance (fal)',
  icon: 'Clapperboard',
  description: 'ByteDance Seedance 2.0 via fal — reference-to-video that casts a saved character into new scenes from reference images/video',
  costPer5Seconds: 8,
  quality: 'high',
  bestFor: ['reference-to-video', 'character-consistency', 'scene-progression', 'cinematic'],
  integrationStatus: 'available',
  apiKeyServiceId: 'fal',
};

export const VIDEO_ENGINE_REGISTRY: Record<VideoEngineId, VideoEngineConfig> = {
  fal: FAL_ENGINE_CONFIG,
} as const;

/** Ordered list of engine IDs for UI display. */
export const ENGINE_ORDER: VideoEngineId[] = ['fal'];

/** Returns the fal (Seedance) engine config — engineId parameter retained for call-site compatibility */
export function getEngineConfig(_engineId?: string | null): VideoEngineConfig {
  return FAL_ENGINE_CONFIG;
}

/** Calculate estimated cost in cents for a scene given duration */
export function estimateSceneCost(_engineId: VideoEngineId | null, durationSeconds: number): number {
  return Math.ceil(durationSeconds / 5) * FAL_ENGINE_CONFIG.costPer5Seconds;
}

/** Format cents as USD string */
export function formatCostUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
