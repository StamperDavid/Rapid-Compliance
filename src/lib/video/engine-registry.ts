/**
 * Video Engine Registry
 * Client-safe constants — no server imports
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

export const VIDEO_ENGINE_REGISTRY: Record<VideoEngineId, VideoEngineConfig> = {
  heygen: {
    id: 'heygen',
    label: 'HeyGen',
    icon: 'User',
    description: 'AI avatar videos with lip-sync and voice cloning',
    costPer5Seconds: 5, // $0.05 per 5s
    quality: 'high',
    bestFor: ['avatar', 'talking-head', 'explainer', 'sales-pitch'],
    integrationStatus: 'available',
    apiKeyServiceId: 'heygen',
  },
  runway: {
    id: 'runway',
    label: 'Runway',
    icon: 'Film',
    description: 'Cinematic AI video from text or image prompts',
    costPer5Seconds: 10, // $0.10 per 5s
    quality: 'ultra',
    bestFor: ['cinematic', 'b-roll', 'product-demo', 'social-ad'],
    integrationStatus: 'available',
    apiKeyServiceId: 'runway',
  },
  sora: {
    id: 'sora',
    label: 'Sora',
    icon: 'Sparkles',
    description: 'OpenAI video generation with realistic motion',
    costPer5Seconds: 8, // $0.08 per 5s
    quality: 'ultra',
    bestFor: ['storytelling', 'cinematic', 'wide-shot', 'aerial'],
    integrationStatus: 'available',
    apiKeyServiceId: 'sora',
  },
  kling: {
    id: 'kling',
    label: 'Kling',
    icon: 'Video',
    description: 'High-quality AI video with strong motion control',
    costPer5Seconds: 6,
    quality: 'high',
    bestFor: ['motion', 'action', 'product-demo'],
    integrationStatus: 'coming-soon',
    apiKeyServiceId: null,
  },
  luma: {
    id: 'luma',
    label: 'Luma Dream Machine',
    icon: 'Clapperboard',
    description: 'Fast, high-quality video generation with great consistency',
    costPer5Seconds: 7,
    quality: 'high',
    bestFor: ['fast-turnaround', 'social-ad', 'b-roll'],
    integrationStatus: 'coming-soon',
    apiKeyServiceId: null,
  },
} as const;

/** Ordered list of engine IDs for UI display */
export const ENGINE_ORDER: VideoEngineId[] = ['heygen', 'runway', 'sora', 'kling', 'luma'];

/** Calculate estimated cost in cents for a scene given engine and duration */
export function estimateSceneCost(engineId: VideoEngineId | null, durationSeconds: number): number {
  const engine = VIDEO_ENGINE_REGISTRY[engineId ?? 'heygen'];
  return Math.ceil(durationSeconds / 5) * engine.costPer5Seconds;
}

/** Format cents as USD string */
export function formatCostUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
