/**
 * Video Production Pipeline Types
 * 7-step flow: Request → Decompose → Pre-Production → Approval → Generation → Assembly → Post-Production
 */

import type { VideoAspectRatio, VideoResolution } from './video';

// ============================================================================
// Pipeline Step Definitions
// ============================================================================

export type PipelineStep =
  | 'request'
  | 'decompose'
  | 'pre-production'
  | 'approval'
  | 'generation'
  | 'assembly'
  | 'post-production';

export const PIPELINE_STEPS: readonly PipelineStep[] = [
  'request',
  'decompose',
  'pre-production',
  'approval',
  'generation',
  'assembly',
  'post-production',
] as const;

export const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  'request': 'Request',
  'decompose': 'Decompose',
  'pre-production': 'Pre-Production',
  'approval': 'Approval',
  'generation': 'Generation',
  'assembly': 'Assembly',
  'post-production': 'Post-Production',
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

export type TargetPlatform = 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'website';

export const TARGET_PLATFORM_LABELS: Record<TargetPlatform, string> = {
  'youtube': 'YouTube',
  'tiktok': 'TikTok',
  'instagram': 'Instagram',
  'linkedin': 'LinkedIn',
  'website': 'Website',
} as const;

// ============================================================================
// Engine Types
// ============================================================================

export type VideoEngineId = 'hedra';

// ============================================================================
// Scene Types
// ============================================================================

export type SceneStatus =
  | 'draft'
  | 'approved'
  | 'generating'
  | 'completed'
  | 'failed';

export interface PipelineScene {
  id: string;
  sceneNumber: number;
  title?: string; // "The Hook" / "Problem Statement" / "CTA"
  visualDescription?: string; // "Modern office with sales dashboards on monitors"
  scriptText: string;
  screenshotUrl: string | null;
  avatarId: string | null;
  voiceId: string | null;
  duration: number; // seconds
  engine: VideoEngineId | null; // null = defaults to hedra
  backgroundPrompt: string | null; // Prompt for AI video background generation
  status: SceneStatus;
  useGreenScreen?: boolean; // true = avatar on transparent BG + AI background compositing
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
}

// ============================================================================
// Pipeline Project
// ============================================================================

export type ProjectStatus =
  | 'draft'
  | 'approved'
  | 'generating'
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
  generatedScenes: SceneGenerationResult[];
  finalVideoUrl: string | null;
  transitionType: TransitionType;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
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
