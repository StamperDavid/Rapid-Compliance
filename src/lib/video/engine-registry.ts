/**
 * Video Engine Registry
 * Client-safe constants — no server imports
 *
 * Hedra is the default video generation engine. fal (Seedance) is registered
 * additively as a second engine (Phase 0 of the video-engine migration) — it is
 * available but does NOT change Hedra's default behavior anywhere in the app.
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

export const HEDRA_ENGINE_CONFIG: VideoEngineConfig = {
  id: 'hedra',
  label: 'Hedra',
  icon: 'Theater',
  description: 'AI video generation with superior lip-sync and character acting (Character-3)',
  costPer5Seconds: 8,
  quality: 'high',
  bestFor: ['talking-head', 'lip-sync', 'avatar', 'presentation', 'character-in-action'],
  integrationStatus: 'available',
  apiKeyServiceId: 'hedra',
};

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
  hedra: HEDRA_ENGINE_CONFIG,
  fal: FAL_ENGINE_CONFIG,
} as const;

/** Ordered list of engine IDs for UI display. Hedra stays first (default). */
export const ENGINE_ORDER: VideoEngineId[] = ['hedra', 'fal'];

/** Returns the Hedra engine config — engineId parameter retained for call-site compatibility */
export function getEngineConfig(_engineId?: string | null): VideoEngineConfig {
  return HEDRA_ENGINE_CONFIG;
}

/** Calculate estimated cost in cents for a scene given duration */
export function estimateSceneCost(_engineId: VideoEngineId | null, durationSeconds: number): number {
  return Math.ceil(durationSeconds / 5) * HEDRA_ENGINE_CONFIG.costPer5Seconds;
}

/** Format cents as USD string */
export function formatCostUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
