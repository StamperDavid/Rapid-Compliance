/**
 * Video Pipeline Cost Estimator
 *
 * Estimates Hedra generation costs based on scene configuration.
 * Pricing is based on Hedra's published rates — update when pricing changes.
 */

import type { PipelineScene } from '@/types/video-pipeline';

// ============================================================================
// Hedra Pricing (updated March 2026)
// ============================================================================

/** Per-generation cost in USD by mode and duration tier */
const HEDRA_PRICING = {
  /** Character 3 (avatar + inline TTS) — portrait-driven video */
  avatar: {
    base: 0.10,       // up to 15s
    perSecond: 0.007,  // per additional second beyond 15s
  },
  /** Kling O3 T2V (prompt-only) — text-to-video with native audio */
  promptOnly: {
    base: 0.07,        // up to 10s
    perSecond: 0.007,  // per additional second beyond 10s
  },
} as const;

// ============================================================================
// Types
// ============================================================================

export interface SceneCostEstimate {
  sceneId: string;
  sceneNumber: number;
  mode: 'avatar' | 'prompt-only';
  duration: number;
  estimatedCost: number;
}

export interface CostEstimate {
  scenes: SceneCostEstimate[];
  totalCost: number;
  sceneCount: number;
  avatarScenes: number;
  promptOnlyScenes: number;
}

// ============================================================================
// Estimator
// ============================================================================

/**
 * Determines whether a scene uses avatar mode or prompt-only mode.
 * Avatar mode requires either a per-scene avatarId or a project-level avatarId.
 */
function getSceneMode(
  scene: PipelineScene,
  projectAvatarId: string | null,
): 'avatar' | 'prompt-only' {
  const hasAvatar = Boolean(scene.avatarId ?? projectAvatarId);
  return hasAvatar ? 'avatar' : 'prompt-only';
}

/**
 * Estimates the cost for a single scene based on its mode and duration.
 */
function estimateSceneCost(mode: 'avatar' | 'prompt-only', durationSeconds: number): number {
  const pricing = mode === 'avatar' ? HEDRA_PRICING.avatar : HEDRA_PRICING.promptOnly;
  const baseDuration = mode === 'avatar' ? 15 : 10;

  if (durationSeconds <= baseDuration) {
    return pricing.base;
  }

  const extraSeconds = durationSeconds - baseDuration;
  return pricing.base + extraSeconds * pricing.perSecond;
}

/**
 * Estimates total generation cost for a set of pipeline scenes.
 */
export function estimateGenerationCost(
  scenes: PipelineScene[],
  projectAvatarId: string | null,
): CostEstimate {
  const sceneEstimates: SceneCostEstimate[] = scenes.map((scene) => {
    const mode = getSceneMode(scene, projectAvatarId);
    const cost = estimateSceneCost(mode, scene.duration);

    return {
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      mode,
      duration: scene.duration,
      estimatedCost: Math.round(cost * 100) / 100, // round to cents
    };
  });

  const totalCost = sceneEstimates.reduce((sum, s) => sum + s.estimatedCost, 0);
  const avatarScenes = sceneEstimates.filter((s) => s.mode === 'avatar').length;
  const promptOnlyScenes = sceneEstimates.filter((s) => s.mode === 'prompt-only').length;

  return {
    scenes: sceneEstimates,
    totalCost: Math.round(totalCost * 100) / 100,
    sceneCount: scenes.length,
    avatarScenes,
    promptOnlyScenes,
  };
}

/**
 * Formats a cost estimate as a human-readable summary string.
 */
export function formatCostSummary(estimate: CostEstimate): string {
  const parts: string[] = [];

  if (estimate.avatarScenes > 0) {
    parts.push(`${estimate.avatarScenes} avatar`);
  }
  if (estimate.promptOnlyScenes > 0) {
    parts.push(`${estimate.promptOnlyScenes} cinematic`);
  }

  const breakdown = parts.join(', ');
  return `~$${estimate.totalCost.toFixed(2)} for ${estimate.sceneCount} scene${estimate.sceneCount !== 1 ? 's' : ''} (${breakdown})`;
}
