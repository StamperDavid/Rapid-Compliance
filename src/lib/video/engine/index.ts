/**
 * AI Video Generation Engine
 *
 * Video generation is powered by Hedra Character-3 exclusively.
 * Legacy multi-model picker and provider routing have been removed.
 *
 * @module video/engine
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Shot & Camera
  ShotType,
  CameraMotion,
  TransitionType,

  // Provider (Hedra only)
  VideoGenerationProvider,

  // Storyboard
  MasterStoryboard,
  StoryboardScene,
  StoryboardShot,
  BrandDNASnapshot,
  StoryboardStatus,
  ShotGenerationStatus,

  // Visual Prompts
  VisualPrompt,
  LightingStyle,
  TextOverlay,

  // Audio
  AudioConfiguration,
  AudioTimingMarker,
  AudioMarkerType,
  VoiceoverScript,
  VoiceoverSegment,
  DuckingConfig,
  SoundEffect,
  AudioTrack,

  // Visual Style
  VisualStyleConfig,

  // Trend Reports
  TrendReport,
  VisualTrend,
  AudienceTrend,
  PlatformTrend,
  CompetitorInsight,

  // Site Mimicry
  SiteMimicryStyleGuide,

  // Post-Production
  PostProductionJob,
  PostProductionStatus,
  PostProductionError,
  GeneratedClip,

  // Queue & Routing
  GenerationQueueItem,
  ProviderRoutingDecision,

  // Director
  DirectorRequest,
  DirectorResponse,
} from './types';

// ============================================================================
// DIRECTOR SERVICE
// ============================================================================

export {
  DirectorService,
  directorService,
  generateStoryboard,
} from './director-service';

// ============================================================================
// STITCHER SERVICE
// ============================================================================

export {
  StitcherService,
  stitcherService,
  createPostProductionJob,
  processPostProduction,
  getPostProductionStatus,
  getLUTPresets,
} from './stitcher-service';

// ============================================================================
// STYLE GUIDE INTEGRATOR
// ============================================================================

export {
  StyleGuideIntegrator,
  styleGuideIntegrator,
  extractStyleGuide,
  convertToVisualStyleConfig,
  generatePromptModifiers,
  enhancePromptWithStyleGuide,
  recommendCameraSettings,
} from './style-guide-integrator';

export type {
  CrawledWebsiteData,
  ProcessedStyleGuide,
  PromptModifiers,
  CameraRecommendations,
} from './style-guide-integrator';
