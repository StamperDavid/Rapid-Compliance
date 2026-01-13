/**
 * AI Video Generation Engine Types
 *
 * Comprehensive type definitions for the Director Service, Multi-Model Picker,
 * and Automated Post-Production (Stitcher) system.
 */

// ============================================================================
// SHOT TYPES & CAMERA MOTION
// ============================================================================

export type ShotType =
  | 'extreme-close-up'    // Detail shots - eyes, product features
  | 'close-up'            // Face, product hero
  | 'medium-close-up'     // Head and shoulders
  | 'medium'              // Waist up
  | 'medium-wide'         // Full body with environment
  | 'wide'                // Establishing, environment showcase
  | 'extreme-wide'        // Epic landscapes, drone shots
  | 'over-the-shoulder'   // Conversation, product demo
  | 'point-of-view'       // First person perspective
  | 'aerial'              // Drone/bird's eye view
  | 'low-angle'           // Power, dominance
  | 'high-angle'          // Vulnerability, overview
  | 'dutch-angle'         // Tension, unease
  | 'insert'              // Product detail, hands, objects
  | 'tracking';           // Following movement

export type CameraMotion =
  | 'static'              // No movement
  | 'pan-left'            // Horizontal pivot left
  | 'pan-right'           // Horizontal pivot right
  | 'tilt-up'             // Vertical pivot up
  | 'tilt-down'           // Vertical pivot down
  | 'dolly-in'            // Move toward subject
  | 'dolly-out'           // Move away from subject
  | 'dolly-left'          // Lateral movement left
  | 'dolly-right'         // Lateral movement right
  | 'tracking'            // Follow subject movement
  | 'crane-up'            // Vertical rise
  | 'crane-down'          // Vertical descent
  | 'zoom-in'             // Optical zoom in
  | 'zoom-out'            // Optical zoom out
  | 'push-in'             // Slow dolly in for emphasis
  | 'pull-out'            // Slow dolly out for reveal
  | 'orbit'               // Circle around subject
  | 'handheld'            // Documentary-style shake
  | 'steadicam'           // Smooth tracking
  | 'whip-pan'            // Fast transition pan
  | 'rack-focus'          // Focus shift
  | 'aerial';             // Drone/aerial movement

export type TransitionType =
  | 'cut'                 // Hard cut
  | 'dissolve'            // Cross dissolve
  | 'fade-in'             // Fade from black
  | 'fade-out'            // Fade to black
  | 'wipe-left'           // Wipe transition
  | 'wipe-right'
  | 'zoom-transition'     // Zoom into next scene
  | 'whip-transition'     // Fast motion blur
  | 'match-cut'           // Visual continuity cut
  | 'j-cut'               // Audio precedes video
  | 'l-cut';              // Audio extends past video

// ============================================================================
// VIDEO GENERATION PROVIDERS
// ============================================================================

export type VideoGenerationProvider =
  | 'veo'                 // Google Veo - cinematic, high quality
  | 'runway'              // Runway ML Gen-3 - creative, stylized
  | 'kling'               // Kling AI - fast, cost-effective
  | 'pika'                // Pika Labs - motion, animation
  | 'sora'                // OpenAI Sora (when available)
  | 'heygen'              // HeyGen - avatar videos
  | 'stable-video';       // Stability AI SVD

export interface ProviderCapabilities {
  provider: VideoGenerationProvider;
  maxDuration: number;              // Max seconds per clip
  maxResolution: '720p' | '1080p' | '4k';
  supportedAspectRatios: Array<'16:9' | '9:16' | '1:1' | '4:3'>;
  strengthAreas: ShotType[];        // What this provider excels at
  averageGenerationTime: number;    // Seconds per clip
  costPer10Seconds: number;         // Credits or cents
  supportsImageToVideo: boolean;
  supportsVideoToVideo: boolean;
  supportsAudio: boolean;
  quality: 'standard' | 'high' | 'ultra';
  motionQuality: 'basic' | 'good' | 'excellent';
}

// ============================================================================
// MASTER STORYBOARD
// ============================================================================

export interface MasterStoryboard {
  id: string;
  organizationId: string;
  projectId?: string;

  // Metadata
  title: string;
  description?: string;
  version: number;

  // Source inputs
  brandDNASnapshot: BrandDNASnapshot;
  trendReportId?: string;
  styleGuideId?: string;

  // Content structure
  scenes: StoryboardScene[];
  totalDuration: number;            // Milliseconds

  // Global settings
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  resolution: '720p' | '1080p' | '4k';
  frameRate: 24 | 30 | 60;

  // Audio configuration
  audioConfig: AudioConfiguration;

  // Visual consistency
  visualStyle: VisualStyleConfig;

  // Generation status
  status: StoryboardStatus;
  generatedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export type StoryboardStatus =
  | 'draft'
  | 'approved'
  | 'generating'
  | 'post-production'
  | 'completed'
  | 'failed';

export interface BrandDNASnapshot {
  companyDescription: string;
  uniqueValue: string;
  targetAudience: string;
  toneOfVoice: string;
  communicationStyle: string;
  primaryColor?: string;
  secondaryColor?: string;
  keyPhrases: string[];
  avoidPhrases: string[];
  industry: string;
}

// ============================================================================
// SCENE & SHOT DEFINITIONS
// ============================================================================

export interface StoryboardScene {
  id: string;
  sceneNumber: number;
  name: string;
  description?: string;

  // Shots in this scene
  shots: StoryboardShot[];

  // Scene-level timing
  startTime: number;                // Milliseconds from start
  duration: number;                 // Milliseconds

  // Scene-level audio
  backgroundMusicId?: string;
  musicIntensity: 'low' | 'medium' | 'high';

  // Transition to next scene
  transitionOut: TransitionType;
  transitionDuration: number;       // Milliseconds
}

export interface StoryboardShot {
  id: string;
  shotNumber: number;

  // Shot composition
  shotType: ShotType;
  cameraMotion: CameraMotion;

  // Visual prompt for AI generation
  visualPrompt: VisualPrompt;

  // Provider routing
  preferredProvider?: VideoGenerationProvider;
  providerOverrides?: Partial<ProviderCapabilities>;

  // Timing
  startTime: number;                // Milliseconds from scene start
  duration: number;                 // Milliseconds

  // Audio synchronization
  audioTiming: AudioTimingMarker[];

  // Transition
  transitionIn?: TransitionType;
  transitionOut?: TransitionType;

  // Generation results
  generatedClipUrl?: string;
  generatedThumbnailUrl?: string;
  generationStatus: ShotGenerationStatus;
  generationProvider?: VideoGenerationProvider;
  generationAttempts: number;
  lastError?: string;
}

export type ShotGenerationStatus =
  | 'pending'
  | 'queued'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'retrying';

// ============================================================================
// VISUAL PROMPT STRUCTURE
// ============================================================================

export interface VisualPrompt {
  // Core description
  mainSubject: string;              // What's the focus
  action: string;                   // What's happening
  environment: string;              // Where is this

  // Style modifiers
  mood: string;                     // Emotional tone
  lighting: LightingStyle;
  colorGrading: string;             // Color palette description

  // Technical specifications
  depthOfField: 'shallow' | 'medium' | 'deep';
  motionBlur: 'none' | 'subtle' | 'moderate' | 'heavy';

  // Brand alignment
  brandElements: string[];          // Logo placements, brand colors
  textOverlays?: TextOverlay[];

  // Full compiled prompt
  compiledPrompt: string;           // The actual prompt sent to provider
  negativePrompt?: string;          // What to avoid

  // Reference images
  referenceImageUrls?: string[];
  styleReferenceUrl?: string;
}

export type LightingStyle =
  | 'natural'
  | 'golden-hour'
  | 'blue-hour'
  | 'studio'
  | 'dramatic'
  | 'soft'
  | 'hard'
  | 'backlit'
  | 'rim-light'
  | 'neon'
  | 'cinematic'
  | 'high-key'
  | 'low-key';

export interface TextOverlay {
  text: string;
  position: 'top' | 'center' | 'bottom' | 'custom';
  style: 'title' | 'subtitle' | 'caption' | 'call-to-action';
  appearAt: number;                 // Milliseconds
  disappearAt: number;              // Milliseconds
  animation?: 'fade' | 'slide' | 'type' | 'scale';
}

// ============================================================================
// AUDIO TIMING & SYNCHRONIZATION
// ============================================================================

export interface AudioTimingMarker {
  id: string;
  type: AudioMarkerType;
  timestamp: number;                // Milliseconds
  duration?: number;                // Milliseconds (for speech segments)

  // Content
  content?: string;                 // Text for voiceover markers

  // Sync instructions
  syncInstruction: string;          // What should happen visually
  priority: 'critical' | 'preferred' | 'optional';
}

export type AudioMarkerType =
  | 'voiceover-start'
  | 'voiceover-end'
  | 'voiceover-emphasis'            // Key word/phrase
  | 'music-beat'
  | 'music-drop'
  | 'music-swell'
  | 'sfx-cue'
  | 'silence'
  | 'transition-cue';

export interface AudioConfiguration {
  // Voiceover settings
  voiceover: {
    enabled: boolean;
    ttsEngine: 'native' | 'unreal' | 'elevenlabs';
    voiceId: string;
    speed: number;
    pitch: number;
    script: VoiceoverScript;
  };

  // Background music
  backgroundMusic: {
    enabled: boolean;
    trackId?: string;
    trackUrl?: string;
    bpm?: number;
    genre?: string;
    mood?: string;
    volume: number;                 // 0-1
    duckingConfig: DuckingConfig;
  };

  // Sound effects
  soundEffects: {
    enabled: boolean;
    effects: SoundEffect[];
  };

  // Master audio
  masterVolume: number;             // 0-1
  normalizeLoudness: boolean;
  targetLUFS: number;               // -14 for streaming
}

export interface VoiceoverScript {
  fullScript: string;
  segments: VoiceoverSegment[];
}

export interface VoiceoverSegment {
  id: string;
  text: string;
  sceneId: string;
  shotId?: string;
  startTime: number;                // Milliseconds
  estimatedDuration: number;        // Milliseconds
  emphasis: string[];               // Words to emphasize
  pacing: 'slow' | 'normal' | 'fast';
}

export interface DuckingConfig {
  enabled: boolean;
  duckOnVoiceover: boolean;
  duckLevel: number;                // 0-1, how much to reduce
  attackTime: number;               // Milliseconds
  releaseTime: number;              // Milliseconds
  threshold: number;                // dB level to trigger
}

export interface SoundEffect {
  id: string;
  name: string;
  url: string;
  timestamp: number;                // Milliseconds
  duration: number;
  volume: number;
}

// ============================================================================
// VISUAL STYLE & LUT CONFIGURATION
// ============================================================================

export interface VisualStyleConfig {
  // Global look
  lutId?: string;                   // Color LUT reference
  lutUrl?: string;                  // Direct LUT file URL
  lutIntensity: number;             // 0-1

  // Color adjustments
  colorCorrection: {
    exposure: number;               // -2 to 2
    contrast: number;               // -1 to 1
    saturation: number;             // 0 to 2
    temperature: number;            // -100 to 100 (cool to warm)
    tint: number;                   // -100 to 100 (green to magenta)
    highlights: number;             // -1 to 1
    shadows: number;                // -1 to 1
    vibrance: number;               // -1 to 1
  };

  // Brand-specific styling
  brandOverlay?: {
    logoUrl?: string;
    logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    logoOpacity: number;
    watermarkEnabled: boolean;
  };

  // Film grain & texture
  filmGrain?: {
    enabled: boolean;
    intensity: number;              // 0-1
    size: 'fine' | 'medium' | 'coarse';
  };

  // Vignette
  vignette?: {
    enabled: boolean;
    intensity: number;              // 0-1
    softness: number;               // 0-1
  };
}

// ============================================================================
// TREND REPORT INTEGRATION
// ============================================================================

export interface TrendReport {
  id: string;
  organizationId: string;

  // Analysis period
  periodStart: Date;
  periodEnd: Date;

  // Trend insights
  visualTrends: VisualTrend[];
  audienceTrends: AudienceTrend[];
  platformTrends: PlatformTrend[];

  // Recommendations
  recommendedShotTypes: ShotType[];
  recommendedDuration: number;
  recommendedAspectRatio: '16:9' | '9:16' | '1:1';

  // Competitor analysis
  competitorInsights?: CompetitorInsight[];

  createdAt: Date;
}

export interface VisualTrend {
  category: string;
  trend: string;
  confidence: number;               // 0-1
  examples: string[];
  recommendedFor: ShotType[];
}

export interface AudienceTrend {
  demographic: string;
  preference: string;
  engagement: number;               // Relative score
}

export interface PlatformTrend {
  platform: 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'facebook';
  optimalDuration: number;
  optimalAspectRatio: '16:9' | '9:16' | '1:1';
  trendingFormats: string[];
}

export interface CompetitorInsight {
  competitorName: string;
  videoStyle: string;
  strengthAreas: string[];
  weaknesses: string[];
}

// ============================================================================
// SITE-MIMICRY STYLE GUIDE
// ============================================================================

export interface SiteMimicryStyleGuide {
  id: string;
  organizationId: string;
  sourceUrl: string;

  // Extracted colors
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    additionalColors: string[];
  };

  // Typography
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: number;
    bodyWeight: number;
    headingSizes: {
      h1: number;
      h2: number;
      h3: number;
    };
  };

  // Visual style
  visualStyle: {
    borderRadius: 'none' | 'subtle' | 'rounded' | 'pill';
    shadowStyle: 'none' | 'subtle' | 'medium' | 'heavy';
    imageStyle: 'sharp' | 'rounded' | 'circular';
    overallAesthetic: 'minimal' | 'modern' | 'classic' | 'bold' | 'playful';
  };

  // Motion preferences
  motionPreferences: {
    animationSpeed: 'slow' | 'normal' | 'fast';
    transitionStyle: 'fade' | 'slide' | 'scale' | 'none';
    microInteractions: boolean;
  };

  // Brand assets discovered
  discoveredAssets: {
    logoUrl?: string;
    faviconUrl?: string;
    heroImageUrls: string[];
    iconStyle?: string;
  };

  // Confidence scores
  extractionConfidence: {
    colors: number;
    typography: number;
    overall: number;
  };

  extractedAt: Date;
  sourcePageTitle?: string;
}

// ============================================================================
// POST-PRODUCTION PIPELINE
// ============================================================================

export interface PostProductionJob {
  id: string;
  storyboardId: string;
  organizationId: string;

  // Input clips
  clips: GeneratedClip[];

  // Audio layers
  voiceoverTrack?: AudioTrack;
  musicTrack?: AudioTrack;
  sfxTracks: AudioTrack[];

  // Visual processing
  lutApplied: boolean;
  colorCorrectionApplied: boolean;
  brandOverlayApplied: boolean;

  // Output
  outputUrl?: string;
  outputThumbnailUrl?: string;
  outputDuration?: number;
  outputFileSize?: number;

  // Status
  status: PostProductionStatus;
  progress: number;                 // 0-100
  currentStep: string;

  // Timing
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;

  // Errors
  errors: PostProductionError[];
}

export type PostProductionStatus =
  | 'pending'
  | 'preparing'
  | 'stitching'
  | 'audio-mixing'
  | 'color-grading'
  | 'rendering'
  | 'uploading'
  | 'completed'
  | 'failed';

export interface GeneratedClip {
  shotId: string;
  url: string;
  duration: number;
  provider: VideoGenerationProvider;
  resolution: string;
  fps: number;
}

export interface AudioTrack {
  id: string;
  type: 'voiceover' | 'music' | 'sfx';
  url: string;
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;

  // For music - BPM sync
  bpm?: number;
  beatMarkers?: number[];           // Milliseconds
}

export interface PostProductionError {
  step: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

// ============================================================================
// GENERATION QUEUE & ROUTING
// ============================================================================

export interface GenerationQueueItem {
  id: string;
  storyboardId: string;
  shotId: string;
  organizationId: string;

  // Routing
  targetProvider: VideoGenerationProvider;
  fallbackProviders: VideoGenerationProvider[];

  // Request
  visualPrompt: VisualPrompt;
  duration: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  resolution: '720p' | '1080p' | '4k';

  // Priority
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // Status
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;

  // Results
  resultUrl?: string;
  resultProvider?: VideoGenerationProvider;
  generationTime?: number;
  credits?: number;

  // Timing
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ProviderRoutingDecision {
  selectedProvider: VideoGenerationProvider;
  reason: string;
  confidence: number;
  alternatives: Array<{
    provider: VideoGenerationProvider;
    score: number;
    reason: string;
  }>;
}

// ============================================================================
// DIRECTOR REQUEST/RESPONSE
// ============================================================================

export interface DirectorRequest {
  organizationId: string;
  projectId?: string;

  // Source inputs
  brandDNA: BrandDNASnapshot;
  trendReport?: TrendReport;
  styleGuide?: SiteMimicryStyleGuide;

  // Content brief
  brief: {
    objective: 'awareness' | 'consideration' | 'conversion' | 'retention';
    message: string;
    callToAction?: string;
    targetPlatform: 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'website';
  };

  // Constraints
  constraints: {
    maxDuration: number;            // Seconds
    aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
    resolution: '720p' | '1080p' | '4k';
    budgetCredits?: number;
  };

  // Voice script (optional - can be generated)
  voiceoverScript?: string;

  // Creative direction
  creativeDirection?: {
    mood: string;
    pacing: 'slow' | 'medium' | 'fast' | 'dynamic';
    visualStyle: string;
    referenceVideos?: string[];
  };
}

export interface DirectorResponse {
  storyboard: MasterStoryboard;
  estimatedCost: {
    videoGeneration: number;
    ttsGeneration: number;
    musicLicensing: number;
    total: number;
    currency: 'credits' | 'usd';
  };
  estimatedDuration: number;        // Minutes to complete
  warnings: string[];
  suggestions: string[];
}
