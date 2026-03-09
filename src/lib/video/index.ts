/**
 * Video Module
 *
 * Hedra-powered video generation system featuring:
 * - Hedra Character-3 API integration (sole video engine)
 * - AI Video Generation Engine
 *   - Director Service: Brand DNA + Trends → Master Storyboard
 *   - Stitcher Service: Post-production pipeline
 *   - Style Guide Integrator: Site-mimicry visual consistency
 *
 * @module video
 */

// ============================================================================
// VIDEO SERVICE
// ============================================================================

export {
  // Status
  VIDEO_SERVICE_STATUS,
  isVideoServiceAvailable,
  getVideoServiceStatus,

  // Waitlist
  joinVideoWaitlist,
  logVideoInterest,

  // Templates
  listVideoTemplates,
  createVideoTemplate,

  // Projects
  listVideoProjects,
  createVideoProject,

  // Utilities
  isProviderConfigured,
} from './video-service';

export type {
  VideoGenerationResponse,
  VideoProvider,
  VideoTemplate,
  VideoProject,
  VideoWaitlistEntry,
  VideoWaitlistInterest,
} from './video-service';

// ============================================================================
// AI VIDEO GENERATION ENGINE
// ============================================================================

export * from './engine';
