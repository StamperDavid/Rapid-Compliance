/**
 * Video Production Pipeline Types
 * 5-step flow: Request → Storyboard → Generation → Assembly → Post-Production
 *
 * Legacy steps (decompose, pre-production, approval) are kept in the type
 * for backward compat with Firestore projects — they map to 'storyboard'.
 */

import type { VideoAspectRatio, VideoResolution } from './video';
import type { CinematicConfig } from './creative-studio';
import type { SceneAutoGrade } from './scene-grading';
import type { ShotPlan, ShotPlanShotTransition } from './shot-plan';

// ============================================================================
// Pipeline Step Definitions
// ============================================================================

export type PipelineStep =
  | 'request'
  | 'storyboard'
  | 'generation'
  | 'assembly'
  | 'post-production'
  | 'publish'
  // Legacy steps — map to 'storyboard' in loadProject()
  | 'decompose'
  | 'pre-production'
  | 'approval';

/** Active pipeline steps (what the UI renders). Legacy steps are NOT included. */
export const PIPELINE_STEPS: readonly PipelineStep[] = [
  'request',
  'storyboard',
  'generation',
  'assembly',
  'post-production',
  'publish',
] as const;

/** Maps legacy step names to their new equivalent */
export function normalizePipelineStep(step: PipelineStep): PipelineStep {
  if (step === 'decompose' || step === 'pre-production' || step === 'approval') {
    return 'storyboard';
  }
  return step;
}

export const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  'request': 'Studio',
  'storyboard': 'Shot Plan',
  'generation': 'Generate',
  'assembly': 'Assembly',
  'post-production': 'Post-Production',
  'publish': 'Publish',
  // Legacy labels (not displayed but keeps TypeScript happy)
  'decompose': 'Shot Plan',
  'pre-production': 'Shot Plan',
  'approval': 'Shot Plan',
} as const;

// ============================================================================
// Video Type Definitions
// ============================================================================

export type VideoType =
  | 'tutorial'
  | 'explainer'
  | 'product-demo'
  | 'sales-pitch'
  | 'testimonial'
  | 'social-ad';

export const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  'tutorial': 'Tutorial',
  'explainer': 'Explainer',
  'product-demo': 'Product Demo',
  'sales-pitch': 'Sales Pitch',
  'testimonial': 'Testimonial',
  'social-ad': 'Social Ad',
} as const;

export type TargetPlatform = 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'website' | 'generic';

export const TARGET_PLATFORM_LABELS: Record<TargetPlatform, string> = {
  'youtube': 'YouTube',
  'tiktok': 'TikTok',
  'instagram': 'Instagram',
  'linkedin': 'LinkedIn',
  'website': 'Website',
  'generic': 'Generic / Any',
} as const;

// ============================================================================
// Engine Types
// ============================================================================

export type VideoEngineId = 'fal';

// ============================================================================
// Scene Types
// ============================================================================

export type SceneStatus =
  | 'draft'
  | 'approved'
  | 'generating'
  | 'persisting'
  | 'completed'
  | 'failed';

export type VoiceProviderId = 'elevenlabs' | 'unrealspeech' | 'custom';

/**
 * A piece of uploaded context/reference material attached to a scene.
 * Backed by a Media Library asset (uploaded via POST /api/media). Supports
 * image, video, audio, and text references so the operator can hand the
 * generator rich context (the third context channel alongside structured
 * fields + the Content Assistant conversation).
 */
export interface SceneReference {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  name: string;
  url: string; // Media Library asset URL
  mediaId?: string; // Media Library asset id (for round-trip + reuse)
  /** Standard purpose tag — how the AI should use this material (see REFERENCE_PURPOSES). */
  purpose?: string;
  /** Required free-text: the operator's explanation of how to use this reference. */
  usage?: string;
}

/** Standard "how should the AI use this?" options for an uploaded reference. */
export const REFERENCE_PURPOSES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'style', label: 'Match this visual style / look' },
  { value: 'character', label: 'This is the character / face' },
  { value: 'product', label: 'Feature this product exactly' },
  { value: 'location', label: 'Use as the background / location' },
  { value: 'composition', label: 'Match this framing / composition' },
  { value: 'brand', label: 'Brand / logo to include' },
  { value: 'voice', label: 'Match this voice / tone' },
  { value: 'script', label: 'Use as script / talking points' },
  { value: 'other', label: 'Other (explain below)' },
] as const;

export interface PipelineScene {
  id: string;
  sceneNumber: number;
  title?: string; // "The Hook" / "Problem Statement" / "CTA"
  visualDescription?: string; // Action — "Sarah turns to her laptop as the dashboard lights up"
  scriptText: string;
  screenshotUrl: string | null;
  avatarId: string | null; // Per-scene character override (null = use project default)
  avatarName?: string | null; // Display name for the per-scene character (Cast group)
  voiceId: string | null; // Per-scene voice override (null = use project default)
  voiceProvider: VoiceProviderId | null; // Per-scene voice provider (null = use project default)
  duration: number; // seconds
  engine: VideoEngineId | null; // null = defaults to fal
  backgroundPrompt: string | null; // Composed environment prompt fed to generation
  cinematicConfig?: CinematicConfig; // Cinematic presets from Creative Studio (Look & Camera)
  status: SceneStatus;
  useGreenScreen?: boolean; // true = avatar on transparent BG + AI background compositing
  shotGroupId?: string | null;  // Links scenes that are part of the same continuous shot

  // ── Structured context fields (plain-language scene builder) ──────────────
  // These are surfaced as grouped, plain-language inputs in the Storyboard step
  // and composed into backgroundPrompt + the auto-thumbnail prompt at generate time.
  location?: string;   // Setting — "Modern open-plan office"
  timeOfDay?: string;  // Setting — "Late afternoon"
  weather?: string;    // Setting — "Clear, golden-hour sun through the windows"
  ambience?: string;   // Sound — background noise/ambience, e.g. "quiet office hum, distant keyboards"
  musicCue?: string;   // Sound — music direction, e.g. "uplifting corporate underscore building to CTA"
  wardrobe?: string;   // Cast — "Smart-casual blazer, no tie"
  references?: SceneReference[]; // References — uploaded context (image/video/audio/text)

  // ── Shot Plan bridge (additive, all optional) ─────────────────────────────
  // Populated when a scene is derived from a ShotPlan shot. These let the existing
  // generation pipeline + editor carry the Shot Plan's extra signals without any
  // existing scene losing meaning when they are absent.
  transitionIn?: ShotPlanShotTransition; // 'continue' = chain from prior shot's last frame
  castMemberIds?: string[];              // Shot Plan cast references (into ShotPlanSharedChoices.cast)
  lastFrameUrl?: string;                 // Saved final frame — chaining anchor for a 'continue' scene
  seed?: number;                         // Generation seed carried from the plan
  sourcePlanShotId?: string;             // The ShotPlanShot.id this scene was mapped from
}

export interface SceneGenerationResult {
  sceneId: string;
  providerVideoId: string;
  provider: VideoEngineId | null;
  status: SceneStatus;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  progress: number; // 0-100
  error: string | null;

  // Green screen compositing (avatar over AI-generated background)
  backgroundVideoId?: string | null;
  backgroundVideoUrl?: string | null;
  backgroundProvider?: VideoEngineId | null;
  compositedVideoUrl?: string | null;
  compositeStatus?: 'pending' | 'compositing' | 'completed' | 'failed' | null;
  compositeError?: string | null;

  // Auto-grading (populated after scene completes)
  autoGrade?: SceneAutoGrade | null;
  autoGradeStatus?: 'pending' | 'grading' | 'completed' | 'failed' | null;
}

// ============================================================================
// Pipeline Project
// ============================================================================

export type ProjectStatus =
  | 'draft'
  | 'approved'
  | 'generating'
  | 'generated'
  | 'assembled'
  | 'completed';

export type TransitionType = 'cut' | 'fade' | 'dissolve';

export type VideoTone = 'conversational' | 'professional' | 'energetic' | 'empathetic';

export const VIDEO_TONE_LABELS: Record<VideoTone, string> = {
  'conversational': 'Conversational',
  'professional': 'Professional',
  'energetic': 'Energetic',
  'empathetic': 'Empathetic',
} as const;

export interface PipelineBrief {
  description: string;
  videoType: VideoType;
  platform: TargetPlatform;
  duration: number; // seconds
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  targetAudience?: string;
  painPoints?: string;
  talkingPoints?: string;
  tone?: VideoTone;
  callToAction?: string;
}

export interface PipelineProject {
  id: string;
  name: string;
  type: VideoType;
  currentStep: PipelineStep;
  brief: PipelineBrief;
  scenes: PipelineScene[];
  avatarId: string | null;
  avatarName: string | null;
  voiceId: string | null;
  voiceName: string | null;
  voiceProvider: VoiceProviderId | null;
  generatedScenes: SceneGenerationResult[];
  finalVideoUrl: string | null;
  transitionType: TransitionType;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  /**
   * Optional Shot Plan draft. When present it autosaves/loads with the project via
   * the existing persistence mechanism. Additive — projects without a Shot Plan are
   * unaffected. `shotPlanToScenes()` derives `scenes` from this when the plan drives
   * generation.
   */
  shotPlan?: ShotPlan;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface DecomposeRequest {
  description: string;
  videoType: VideoType;
  platform: TargetPlatform;
  duration: number;
}

export interface DecomposeResponse {
  scenes: Array<{
    sceneNumber: number;
    scriptText: string;
    description: string;
    suggestedDuration: number;
  }>;
  totalScenes: number;
  estimatedDuration: number;
  assetsNeeded: string[];
  avatarRecommendation: string | null;
}

export interface GenerateScenesRequest {
  projectId: string;
}

export interface GenerateScenesResponse {
  jobId: string;
  sceneCount: number;
  estimatedTime: number; // seconds
}

export interface SceneStatusResponse {
  projectId: string;
  scenes: SceneGenerationResult[];
  allComplete: boolean;
  failedCount: number;
}

export interface RegenerateSceneRequest {
  projectId: string;
  sceneId: string;
  updatedScript?: string;
}

export interface AssembleRequest {
  projectId: string;
  transitionType: TransitionType;
}

export interface AssembleResponse {
  videoUrl: string;
  duration: number;
  sceneUrls: string[];
}

// ============================================================================
// Decomposition Plan (from AI)
// ============================================================================

// ============================================================================
// Post-Production Types
// ============================================================================

export type ColorGradePreset =
  | 'corporate-clean'
  | 'golden-warmth'
  | 'cinema-contrast'
  | 'vibrant-pop'
  | 'soft-pastel'
  | 'tech-modern'
  | 'none';

// ============================================================================
// Caption Types
// ============================================================================

export type CaptionStyle =
  | 'bold-center'
  | 'bottom-bar'
  | 'karaoke'
  | 'word-highlight'
  | 'big-impact'
  | 'boxed'
  | 'minimal';

/** Every caption style, in display order. Single source of truth for UI pickers
 *  and request validation so a new style only has to be added in one place. */
export const CAPTION_STYLES: readonly CaptionStyle[] = [
  'bold-center',
  'bottom-bar',
  'karaoke',
  'word-highlight',
  'big-impact',
  'boxed',
  'minimal',
] as const;

export const CAPTION_STYLE_LABELS: Record<CaptionStyle, string> = {
  'bold-center': 'Bold Center (TikTok)',
  'bottom-bar': 'Bottom Bar (YouTube)',
  'karaoke': 'Karaoke (Word Highlight)',
  'word-highlight': 'Word Pop (active word)',
  'big-impact': 'Big Impact (huge & bold)',
  'boxed': 'Boxed (solid bar)',
  'minimal': 'Minimal (small, no box)',
} as const;

/** One-line description of how each style looks, for picker hints. */
export const CAPTION_STYLE_HINTS: Record<CaptionStyle, string> = {
  'bold-center': 'Big centered lines, a few words each.',
  'bottom-bar': 'Smaller lines along the bottom with a dark bar.',
  'karaoke': 'One golden word at a time, centered.',
  'word-highlight': 'A few words centered with the spoken word emphasized.',
  'big-impact': 'Huge bold centered text for punchy hooks.',
  'boxed': 'Short lines on a solid black box near the bottom.',
  'minimal': 'Small, clean captions at the bottom, no background.',
} as const;

export interface CaptionConfig {
  enabled: boolean;
  style: CaptionStyle;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
}

// ============================================================================
// Audio & Post-Production Types
// ============================================================================

export interface AudioMixConfig {
  backgroundMusicUrl?: string | null;
  musicVolume: number; // 0.0-1.0
  voiceoverVolume: number; // 0.0-1.0
  duckingEnabled: boolean; // auto-lower music when voice speaks
  duckingAmount: number; // dB to reduce music (e.g., -14)
  normalizeLUFS: number; // target LUFS (e.g., -14 for broadcast)
}

export interface TextOverlayConfig {
  text: string;
  position: 'top' | 'bottom' | 'center';
  fontSize: number;
  fontColor: string;
  backgroundColor?: string;
  startTime: number; // seconds
  endTime: number; // seconds
}

export interface PostProductionConfig {
  colorGrade: ColorGradePreset;
  audioMix: AudioMixConfig;
  textOverlays: TextOverlayConfig[];
  watermarkUrl?: string | null;
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  watermarkOpacity?: number; // 0.0-1.0
  outputResolution: '720p' | '1080p' | '4k';
}

// ============================================================================
// Decomposition Types
// ============================================================================

export interface DecompositionPlan {
  videoType: VideoType;
  targetAudience: string;
  keyMessages: string[];
  scenes: Array<{
    sceneNumber: number;
    title: string;
    scriptText: string;
    visualDescription: string;
    suggestedDuration: number;
    engine: VideoEngineId | null;
    backgroundPrompt: string | null;
  }>;
  assetsNeeded: string[];
  avatarRecommendation: string | null;
  estimatedTotalDuration: number;
  generatedBy: 'ai' | 'template';
}

// ============================================================================
// Publish Types
// ============================================================================

/**
 * PublishPlatform is now an alias for SocialPlatform — all 14 platforms are supported.
 */
export type { SocialPlatform as PublishPlatform } from '@/types/social';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';

/**
 * Build labels dynamically from the central platform config.
 */
export const PUBLISH_PLATFORM_LABELS: Record<SocialPlatform, string> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p, PLATFORM_META[p].label])
) as Record<SocialPlatform, string>;

export type PublishScheduleMode = 'now' | 'scheduled';

export interface PublishConfig {
  platforms: SocialPlatform[];
  title: string;
  description: string;
  tags: string[];
  scheduleMode: PublishScheduleMode;
  scheduledAt: string | null; // ISO string for scheduled time
}

export type PublishStatus = 'draft' | 'publishing' | 'published' | 'failed' | 'scheduled';

export interface PublishResult {
  platform: SocialPlatform;
  status: PublishStatus;
  postId?: string;
  postUrl?: string;
  error?: string;
  publishedAt?: string;
}

// ============================================================================
// Batch / Content Calendar Types
// ============================================================================

export interface BatchProject {
  id: string;
  name: string;
  topic: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ... 6=Saturday
  projectId: string | null; // linked pipeline project ID
  status: 'pending' | 'storyboarded' | 'approved' | 'generating' | 'completed' | 'failed';
  videoUrl: string | null;
}

export interface ContentCalendarWeek {
  id: string;
  name: string;
  weekStartDate: string; // ISO date string for week start (Monday)
  theme: string;
  projects: BatchProject[];
  status: 'draft' | 'storyboarded' | 'approved' | 'generating' | 'completed';
  createdAt: string;
  createdBy: string;
}
