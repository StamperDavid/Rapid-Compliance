/**
 * Multi-Model Picker Gateway
 *
 * Intelligent routing system that selects the optimal video generation provider
 * based on shot type, requirements, cost, and quality constraints.
 *
 * Features:
 * - Shot type to provider mapping
 * - Quality-based provider selection
 * - Cost optimization
 * - Fallback provider chains
 * - Provider capability matching
 * - Load balancing and rate limiting
 */

import { logger } from '@/lib/logger/logger';
import { v4 as uuidv4 } from 'uuid';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type {
  VideoGenerationProvider,
  ProviderCapabilities,
  ShotType,
  StoryboardShot,
  GenerationQueueItem,
  ProviderRoutingDecision,
} from './types';

// ============================================================================
// PROVIDER CAPABILITIES REGISTRY
// ============================================================================

/**
 * Comprehensive provider capabilities database
 */
export const PROVIDER_REGISTRY: Record<VideoGenerationProvider, ProviderCapabilities> = {
  veo: {
    provider: 'veo',
    maxDuration: 16,
    maxResolution: '4k',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    strengthAreas: [
      'wide',
      'extreme-wide',
      'aerial',
      'tracking',
      'medium-wide',
      'crane-up',
    ] as ShotType[],
    averageGenerationTime: 120,
    costPer10Seconds: 50,
    supportsImageToVideo: true,
    supportsVideoToVideo: true,
    supportsAudio: false,
    quality: 'ultra',
    motionQuality: 'excellent',
  },
  runway: {
    provider: 'runway',
    maxDuration: 10,
    maxResolution: '4k',
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    strengthAreas: [
      'close-up',
      'medium-close-up',
      'insert',
      'dutch-angle',
      'point-of-view',
    ] as ShotType[],
    averageGenerationTime: 90,
    costPer10Seconds: 40,
    supportsImageToVideo: true,
    supportsVideoToVideo: true,
    supportsAudio: false,
    quality: 'ultra',
    motionQuality: 'excellent',
  },
  kling: {
    provider: 'kling',
    maxDuration: 10,
    maxResolution: '1080p',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    strengthAreas: [
      'medium',
      'medium-close-up',
      'over-the-shoulder',
      'medium-wide',
    ] as ShotType[],
    averageGenerationTime: 45,
    costPer10Seconds: 15,
    supportsImageToVideo: true,
    supportsVideoToVideo: false,
    supportsAudio: false,
    quality: 'high',
    motionQuality: 'good',
  },
  pika: {
    provider: 'pika',
    maxDuration: 4,
    maxResolution: '1080p',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    strengthAreas: [
      'insert',
      'close-up',
      'extreme-close-up',
    ] as ShotType[],
    averageGenerationTime: 30,
    costPer10Seconds: 10,
    supportsImageToVideo: true,
    supportsVideoToVideo: false,
    supportsAudio: false,
    quality: 'standard',
    motionQuality: 'basic',
  },
  sora: {
    provider: 'sora',
    maxDuration: 60,
    maxResolution: '4k',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    strengthAreas: [
      'extreme-wide',
      'wide',
      'aerial',
      'tracking',
      'medium',
    ] as ShotType[],
    averageGenerationTime: 180,
    costPer10Seconds: 100,
    supportsImageToVideo: true,
    supportsVideoToVideo: true,
    supportsAudio: true,
    quality: 'ultra',
    motionQuality: 'excellent',
  },
  heygen: {
    provider: 'heygen',
    maxDuration: 300,
    maxResolution: '1080p',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    strengthAreas: [
      'medium-close-up',
      'medium',
      'close-up',
    ] as ShotType[],
    averageGenerationTime: 60,
    costPer10Seconds: 20,
    supportsImageToVideo: false,
    supportsVideoToVideo: false,
    supportsAudio: true,
    quality: 'high',
    motionQuality: 'good',
  },
  'stable-video': {
    provider: 'stable-video',
    maxDuration: 4,
    maxResolution: '1080p',
    supportedAspectRatios: ['16:9', '1:1'],
    strengthAreas: [
      'insert',
      'close-up',
      'extreme-close-up',
      'low-angle',
      'high-angle',
    ] as ShotType[],
    averageGenerationTime: 60,
    costPer10Seconds: 8,
    supportsImageToVideo: true,
    supportsVideoToVideo: false,
    supportsAudio: false,
    quality: 'standard',
    motionQuality: 'basic',
  },
};

// ============================================================================
// SHOT TYPE TO PROVIDER MAPPING
// ============================================================================

/**
 * Optimal provider ranking by shot type
 * First provider is preferred, followed by fallbacks
 */
const SHOT_TYPE_PROVIDER_RANKING: Record<ShotType, VideoGenerationProvider[]> = {
  'extreme-close-up': ['runway', 'pika', 'stable-video', 'kling'],
  'close-up': ['runway', 'kling', 'pika', 'heygen'],
  'medium-close-up': ['runway', 'kling', 'heygen', 'veo'],
  'medium': ['kling', 'runway', 'veo', 'heygen'],
  'medium-wide': ['veo', 'kling', 'runway', 'sora'],
  'wide': ['veo', 'sora', 'runway', 'kling'],
  'extreme-wide': ['veo', 'sora', 'runway'],
  'over-the-shoulder': ['kling', 'runway', 'heygen'],
  'point-of-view': ['runway', 'veo', 'kling'],
  'aerial': ['veo', 'sora', 'runway'],
  'low-angle': ['runway', 'veo', 'stable-video'],
  'high-angle': ['veo', 'runway', 'stable-video'],
  'dutch-angle': ['runway', 'veo', 'kling'],
  'insert': ['runway', 'pika', 'stable-video', 'kling'],
  'tracking': ['veo', 'runway', 'kling', 'sora'],
};

// ============================================================================
// MULTI-MODEL PICKER SERVICE
// ============================================================================

export interface PickerConfig {
  maxBudgetCredits?: number;
  preferQualityOverCost?: boolean;
  allowedProviders?: VideoGenerationProvider[];
  blockedProviders?: VideoGenerationProvider[];
  preferredProvider?: VideoGenerationProvider;
  minQuality?: 'standard' | 'high' | 'ultra';
}

export interface RoutingContext {
  storyboardId: string;
  shot: StoryboardShot;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  resolution: '720p' | '1080p' | '4k';
  config?: PickerConfig;
}

export class MultiModelPicker {
  private static instance: MultiModelPicker;

  // Provider health tracking
  private providerHealth: Map<VideoGenerationProvider, ProviderHealth> = new Map();

  // Rate limiting per provider
  private rateLimits: Map<VideoGenerationProvider, RateLimitState> = new Map();

  private constructor() {
    this.initializeProviderHealth();
  }

  static getInstance(): MultiModelPicker {
    if (!MultiModelPicker.instance) {
      MultiModelPicker.instance = new MultiModelPicker();
    }
    return MultiModelPicker.instance;
  }

  /**
   * Select the optimal provider for a shot
   */
  selectProvider(context: RoutingContext): ProviderRoutingDecision {
    const { shot, aspectRatio, resolution, config } = context;

    logger.info('MultiModelPicker: Selecting provider', {
      shotType: shot.shotType,
      aspectRatio,
      resolution,
      preferredProvider: config?.preferredProvider,
    });

    // Get candidate providers for this shot type
    let candidates = this.getCandidateProviders(shot.shotType);

    // Apply config filters
    candidates = this.applyConfigFilters(candidates, config);

    // Filter by capability
    candidates = this.filterByCapability(candidates, {
      aspectRatio,
      resolution,
      duration: shot.duration / 1000,
      minQuality: config?.minQuality,
    });

    // Score candidates
    const scoredCandidates = this.scoreCandidates(candidates, {
      shotType: shot.shotType,
      duration: shot.duration / 1000,
      preferQualityOverCost: config?.preferQualityOverCost ?? true,
      preferredProvider: config?.preferredProvider,
    });

    // Select the best provider
    const selectedProvider = scoredCandidates[0];

    if (!selectedProvider) {
      logger.error('MultiModelPicker: No suitable provider found', new Error('No suitable provider found'), {
        shotType: shot.shotType,
        aspectRatio,
        resolution,
      });

      // Return a fallback decision
      return {
        selectedProvider: 'kling', // Most versatile fallback
        reason: 'No optimal provider available, using fallback',
        confidence: 0.3,
        alternatives: [],
      };
    }

    // Build routing decision
    const decision: ProviderRoutingDecision = {
      selectedProvider: selectedProvider.provider,
      reason: selectedProvider.reason,
      confidence: selectedProvider.score,
      alternatives: scoredCandidates.slice(1, 4).map((c) => ({
        provider: c.provider,
        score: c.score,
        reason: c.reason,
      })),
    };

    logger.info('MultiModelPicker: Provider selected', {
      selected: decision.selectedProvider,
      confidence: decision.confidence,
      alternativeCount: decision.alternatives.length,
    });

    return decision;
  }

  /**
   * Create a generation queue item with routing
   */
  createQueueItem(
    context: RoutingContext,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): GenerationQueueItem {
    const decision = this.selectProvider(context);

    return {
      id: uuidv4(),
      storyboardId: context.storyboardId,
      shotId: context.shot.id,
      targetProvider: decision.selectedProvider,
      fallbackProviders: decision.alternatives.map((a) => a.provider),
      visualPrompt: context.shot.visualPrompt,
      duration: context.shot.duration / 1000,
      aspectRatio: context.aspectRatio,
      resolution: context.resolution,
      priority,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      queuedAt: new Date(),
    };
  }

  /**
   * Route multiple shots efficiently
   */
  routeStoryboard(
    storyboardId: string,
    shots: StoryboardShot[],
    aspectRatio: '16:9' | '9:16' | '1:1' | '4:3',
    resolution: '720p' | '1080p' | '4k',
    config?: PickerConfig
  ): GenerationQueueItem[] {
    const queueItems: GenerationQueueItem[] = [];

    // Group shots by provider for efficiency
    const providerGroups = new Map<VideoGenerationProvider, StoryboardShot[]>();

    for (const shot of shots) {
      const context: RoutingContext = {
        storyboardId,
        shot,
        aspectRatio,
        resolution,
        config,
      };

      const decision = this.selectProvider(context);

      // Determine priority based on shot position
      const priority = this.determinePriority(shot, shots.length);

      const queueItem = this.createQueueItem(context, priority);
      queueItems.push(queueItem);

      // Track grouping for logging
      const existing = providerGroups.get(decision.selectedProvider) ?? [];
      existing.push(shot);
      providerGroups.set(decision.selectedProvider, existing);
    }

    // Log routing summary
    const providerDistribution = Object.fromEntries(
      Array.from(providerGroups.entries()).map(([p, s]) => [p, s.length])
    );
    logger.info('MultiModelPicker: Storyboard routing complete', {
      storyboardId,
      totalShots: shots.length,
      veo: providerDistribution['veo'] ?? 0,
      runway: providerDistribution['runway'] ?? 0,
      kling: providerDistribution['kling'] ?? 0,
      pika: providerDistribution['pika'] ?? 0,
      sora: providerDistribution['sora'] ?? 0,
      heygen: providerDistribution['heygen'] ?? 0,
      stableVideo: providerDistribution['stable-video'] ?? 0,
    });

    return queueItems;
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(provider: VideoGenerationProvider): ProviderCapabilities {
    return PROVIDER_REGISTRY[provider];
  }

  /**
   * Get all available providers
   */
  getAllProviders(): ProviderCapabilities[] {
    return Object.values(PROVIDER_REGISTRY);
  }

  /**
   * Check if a provider can handle specific requirements
   */
  canProviderHandle(
    provider: VideoGenerationProvider,
    requirements: {
      aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
      resolution: '720p' | '1080p' | '4k';
      duration: number;
      shotType?: ShotType;
    }
  ): boolean {
    const capabilities = PROVIDER_REGISTRY[provider];

    // Check aspect ratio support
    if (!capabilities.supportedAspectRatios.includes(requirements.aspectRatio)) {
      return false;
    }

    // Check resolution support
    const resolutionRank = { '720p': 1, '1080p': 2, '4k': 3 };
    if (resolutionRank[requirements.resolution] > resolutionRank[capabilities.maxResolution]) {
      return false;
    }

    // Check duration support
    if (requirements.duration > capabilities.maxDuration) {
      return false;
    }

    // Check shot type strength (optional)
    if (requirements.shotType && !capabilities.strengthAreas.includes(requirements.shotType)) {
      // Provider can still handle it, just not optimally
      return true;
    }

    return true;
  }

  /**
   * Report provider success/failure for health tracking
   */
  reportProviderResult(
    provider: VideoGenerationProvider,
    success: boolean,
    latencyMs?: number
  ): void {
    const health = this.providerHealth.get(provider) ?? this.createDefaultHealth(provider);

    health.totalRequests++;

    if (success) {
      health.successCount++;
      if (latencyMs) {
        health.averageLatencyMs =
          (health.averageLatencyMs * (health.successCount - 1) + latencyMs) / health.successCount;
      }
      health.consecutiveFailures = 0;
    } else {
      health.failureCount++;
      health.consecutiveFailures++;
      health.lastFailure = new Date();

      // Mark as degraded if too many failures
      if (health.consecutiveFailures >= 3) {
        health.status = 'degraded';
      }
      if (health.consecutiveFailures >= 5) {
        health.status = 'unhealthy';
      }
    }

    health.lastChecked = new Date();
    this.providerHealth.set(provider, health);

    logger.debug('MultiModelPicker: Provider health updated', {
      provider,
      success,
      status: health.status,
      successRate: health.successCount / health.totalRequests,
    });
  }

  /**
   * Get health status for all providers
   */
  getProviderHealthStatus(): Map<VideoGenerationProvider, ProviderHealth> {
    return new Map(this.providerHealth);
  }

  /**
   * Estimate cost for a storyboard
   */
  estimateStoryboardCost(
    shots: StoryboardShot[],
    aspectRatio: '16:9' | '9:16' | '1:1' | '4:3',
    resolution: '720p' | '1080p' | '4k',
    config?: PickerConfig
  ): CostEstimate {
    let totalCost = 0;
    let totalDuration = 0;
    const providerCosts = new Map<VideoGenerationProvider, number>();

    for (const shot of shots) {
      const context: RoutingContext = {
        storyboardId: 'estimate',
        shot,
        aspectRatio,
        resolution,
        config,
      };

      const decision = this.selectProvider(context);
      const provider = decision.selectedProvider;
      const capabilities = PROVIDER_REGISTRY[provider];

      const durationSeconds = shot.duration / 1000;
      const cost = (durationSeconds / 10) * capabilities.costPer10Seconds;

      totalCost += cost;
      totalDuration += durationSeconds;

      const existingCost = providerCosts.get(provider) ?? 0;
      providerCosts.set(provider, existingCost + cost);
    }

    return {
      totalCredits: Math.ceil(totalCost),
      totalDurationSeconds: totalDuration,
      costByProvider: Object.fromEntries(providerCosts),
      averageCostPerSecond: totalCost / totalDuration,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeProviderHealth(): void {
    for (const provider of Object.keys(PROVIDER_REGISTRY) as VideoGenerationProvider[]) {
      this.providerHealth.set(provider, this.createDefaultHealth(provider));
    }
  }

  private createDefaultHealth(provider: VideoGenerationProvider): ProviderHealth {
    return {
      provider,
      status: 'healthy',
      successCount: 0,
      failureCount: 0,
      totalRequests: 0,
      consecutiveFailures: 0,
      averageLatencyMs: PROVIDER_REGISTRY[provider].averageGenerationTime * 1000,
      lastChecked: new Date(),
    };
  }

  private getCandidateProviders(shotType: ShotType): VideoGenerationProvider[] {
    return SHOT_TYPE_PROVIDER_RANKING[shotType] || ['kling', 'runway', 'veo'];
  }

  private applyConfigFilters(
    candidates: VideoGenerationProvider[],
    config?: PickerConfig
  ): VideoGenerationProvider[] {
    let filtered = [...candidates];

    // Apply allowed providers filter
    if (config?.allowedProviders && config.allowedProviders.length > 0) {
      const allowedProviders = config.allowedProviders;
      filtered = filtered.filter((p) => allowedProviders.includes(p));
    }

    // Apply blocked providers filter
    if (config?.blockedProviders && config.blockedProviders.length > 0) {
      const blockedProviders = config.blockedProviders;
      filtered = filtered.filter((p) => !blockedProviders.includes(p));
    }

    return filtered;
  }

  private filterByCapability(
    candidates: VideoGenerationProvider[],
    requirements: {
      aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
      resolution: '720p' | '1080p' | '4k';
      duration: number;
      minQuality?: 'standard' | 'high' | 'ultra';
    }
  ): VideoGenerationProvider[] {
    return candidates.filter((provider) => {
      const capabilities = PROVIDER_REGISTRY[provider];

      // Check aspect ratio
      if (!capabilities.supportedAspectRatios.includes(requirements.aspectRatio)) {
        return false;
      }

      // Check resolution
      const resolutionRank = { '720p': 1, '1080p': 2, '4k': 3 };
      if (resolutionRank[requirements.resolution] > resolutionRank[capabilities.maxResolution]) {
        return false;
      }

      // Check duration (allow some clips to be split)
      if (requirements.duration > capabilities.maxDuration * 2) {
        return false;
      }

      // Check minimum quality
      if (requirements.minQuality) {
        const qualityRank = { standard: 1, high: 2, ultra: 3 };
        if (qualityRank[capabilities.quality] < qualityRank[requirements.minQuality]) {
          return false;
        }
      }

      // Check provider health
      const health = this.providerHealth.get(provider);
      if (health?.status === 'unhealthy') {
        return false;
      }

      return true;
    });
  }

  private scoreCandidates(
    candidates: VideoGenerationProvider[],
    context: {
      shotType: ShotType;
      duration: number;
      preferQualityOverCost: boolean;
      preferredProvider?: VideoGenerationProvider;
    }
  ): ScoredProvider[] {
    const scored: ScoredProvider[] = [];

    for (const provider of candidates) {
      const capabilities = PROVIDER_REGISTRY[provider];
      const health = this.providerHealth.get(provider);

      let score = 0;
      const reasons: string[] = [];

      // Shot type match score (0-30 points)
      const shotTypeRanking = SHOT_TYPE_PROVIDER_RANKING[context.shotType] || [];
      const rankPosition = shotTypeRanking.indexOf(provider);
      if (rankPosition !== -1) {
        const shotTypeScore = Math.max(0, 30 - rankPosition * 8);
        score += shotTypeScore;
        if (rankPosition === 0) {
          reasons.push('Optimal for shot type');
        }
      }

      // Quality score (0-25 points)
      const qualityPoints = { standard: 10, high: 18, ultra: 25 };
      const qualityScore = qualityPoints[capabilities.quality];
      score += context.preferQualityOverCost ? qualityScore : qualityScore * 0.5;

      // Motion quality (0-15 points)
      const motionPoints = { basic: 5, good: 10, excellent: 15 };
      score += motionPoints[capabilities.motionQuality];

      // Cost efficiency (0-15 points, inverted if preferring quality)
      const maxCost = 100; // Reference max cost
      const costScore = 15 * (1 - capabilities.costPer10Seconds / maxCost);
      score += context.preferQualityOverCost ? costScore * 0.5 : costScore;

      // Health score (0-10 points)
      if (health) {
        if (health.status === 'healthy') {
          score += 10;
        } else if (health.status === 'degraded') {
          score += 5;
          reasons.push('Provider degraded');
        }

        // Bonus for high success rate
        if (health.totalRequests > 10) {
          const successRate = health.successCount / health.totalRequests;
          score += successRate * 5;
        }
      }

      // Preferred provider bonus (5 points)
      if (context.preferredProvider === provider) {
        score += 5;
        reasons.push('User preference');
      }

      // Duration penalty if exceeds max
      if (context.duration > capabilities.maxDuration) {
        score -= 10;
        reasons.push('Requires clip splitting');
      }

      // Normalize score to 0-1
      const normalizedScore = Math.min(1, score / 100);

      scored.push({
        provider,
        score: normalizedScore,
        reason: reasons.length > 0 ? reasons.join(', ') : 'Standard selection',
      });
    }

    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score);
  }

  private determinePriority(
    shot: StoryboardShot,
    totalShots: number
  ): 'low' | 'normal' | 'high' | 'urgent' {
    // First and last shots are high priority
    if (shot.shotNumber === 1 || shot.shotNumber === totalShots) {
      return 'high';
    }

    // Shots with many audio timing markers are important
    if (shot.audioTiming.filter((m) => m.priority === 'critical').length > 0) {
      return 'high';
    }

    return 'normal';
  }
}

// ============================================================================
// HELPER INTERFACES
// ============================================================================

interface ProviderHealth {
  provider: VideoGenerationProvider;
  status: 'healthy' | 'degraded' | 'unhealthy';
  successCount: number;
  failureCount: number;
  totalRequests: number;
  consecutiveFailures: number;
  averageLatencyMs: number;
  lastChecked: Date;
  lastFailure?: Date;
}

interface RateLimitState {
  provider: VideoGenerationProvider;
  requestsThisMinute: number;
  windowStart: Date;
  maxRequestsPerMinute: number;
}

interface ScoredProvider {
  provider: VideoGenerationProvider;
  score: number;
  reason: string;
}

interface CostEstimate {
  totalCredits: number;
  totalDurationSeconds: number;
  costByProvider: Record<string, number>;
  averageCostPerSecond: number;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const multiModelPicker = MultiModelPicker.getInstance();

/**
 * Select the optimal provider for a shot
 */
export function selectProvider(context: RoutingContext): ProviderRoutingDecision {
  return multiModelPicker.selectProvider(context);
}

/**
 * Route all shots in a storyboard
 */
export function routeStoryboard(
  storyboardId: string,
  shots: StoryboardShot[],
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3',
  resolution: '720p' | '1080p' | '4k',
  config?: PickerConfig
): GenerationQueueItem[] {
  return multiModelPicker.routeStoryboard(
    storyboardId,
    shots,
    aspectRatio,
    resolution,
    config
  );
}

/**
 * Get provider capabilities
 */
export function getProviderCapabilities(
  provider: VideoGenerationProvider
): ProviderCapabilities {
  return multiModelPicker.getProviderCapabilities(provider);
}

/**
 * Estimate storyboard generation cost
 */
export function estimateStoryboardCost(
  shots: StoryboardShot[],
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3',
  resolution: '720p' | '1080p' | '4k',
  config?: PickerConfig
): CostEstimate {
  return multiModelPicker.estimateStoryboardCost(shots, aspectRatio, resolution, config);
}
