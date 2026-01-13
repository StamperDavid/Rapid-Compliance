/**
 * Video Module
 *
 * Comprehensive video generation system featuring:
 * - Legacy video service (HeyGen, Sora, Runway stubs)
 * - AI Video Generation Engine
 *   - Director Service: Brand DNA + Trends → Master Storyboard
 *   - Multi-Model Picker: Intelligent provider routing
 *   - Stitcher Service: Post-production pipeline
 *   - Style Guide Integrator: Site-mimicry visual consistency
 *
 * @module video
 */

// ============================================================================
// LEGACY VIDEO SERVICE
// ============================================================================

export {
  // Status
  VIDEO_SERVICE_STATUS,
  isVideoServiceAvailable,
  getVideoServiceStatus,

  // Waitlist
  joinVideoWaitlist,
  logVideoInterest,

  // Generation stubs
  generateVideo as generateLegacyVideo,
  getVideoStatus,
  cancelVideoGeneration,

  // HeyGen stubs
  listHeyGenAvatars,
  listHeyGenVoices,
  generateHeyGenVideo,

  // Sora stubs
  generateSoraVideo,

  // Runway stubs
  generateRunwayVideo,

  // Templates
  listVideoTemplates,
  createVideoTemplate,

  // Projects
  listVideoProjects,
  createVideoProject,

  // Utilities
  isProviderConfigured,
  estimateVideoCost,
} from './video-service';

export type {
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoProvider,
  VideoTemplate,
  VideoProject,
  HeyGenAvatar,
  HeyGenVoice,
  VideoWaitlistEntry,
  VideoWaitlistInterest,
} from './video-service';

// ============================================================================
// AI VIDEO GENERATION ENGINE
// ============================================================================

export * from './engine';
