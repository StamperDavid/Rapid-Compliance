/**
 * Video Engine Registry
 * Client-safe constants — no server imports
 *
 * Hedra is the sole video generation engine.
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

export const VIDEO_ENGINE_REGISTRY: Record<VideoEngineId, VideoEngineConfig> = {
  hedra: HEDRA_ENGINE_CONFIG,
} as const;

/** Ordered list of engine IDs for UI display */
export const ENGINE_ORDER: VideoEngineId[] = ['hedra'];

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
