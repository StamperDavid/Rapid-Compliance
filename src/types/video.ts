/**
 * Video Generation Types
 * Types for AI Video Factory - HeyGen, Sora, Runway integrations
 */

// ============================================================================
// Video Generation Request/Response Types
// ============================================================================

export type VideoProvider = 'heygen' | 'sora' | 'runway';
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3';
export type VideoResolution = '720p' | '1080p' | '4k';

export interface VideoGenerationRequest {
  id?: string;
  organizationId: string;
  userId: string;
  provider: VideoProvider;
  type: 'avatar' | 'text-to-video' | 'image-to-video';

  // Content
  script?: string;
  prompt?: string;
  inputImageUrl?: string;

  // Configuration
  duration?: number; // seconds
  aspectRatio?: VideoAspectRatio;
  resolution?: VideoResolution;

  // Avatar-specific (HeyGen)
  avatarConfig?: AvatarConfig;

  // Template reference
  templateId?: string;

  // Metadata
  projectId?: string;
  name?: string;
  tags?: string[];

  createdAt?: Date;
}

export interface VideoGenerationResponse {
  id: string;
  requestId: string;
  organizationId: string;

  status: VideoStatus;
  provider: VideoProvider;

  // Output
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;

  // Processing info
  progress?: number; // 0-100
  estimatedCompletionTime?: Date;
  errorMessage?: string;
  errorCode?: string;

  // Metadata
  createdAt: Date;
  completedAt?: Date;

  // Analytics
  renderTime?: number; // milliseconds
  creditsUsed?: number;
}

// ============================================================================
// HeyGen Avatar Configuration
// ============================================================================

export interface AvatarConfig {
  avatarId: string;
  avatarName?: string;

  // Voice settings
  voiceId?: string;
  voiceName?: string;
  voiceLanguage?: string;
  voiceSpeed?: number; // 0.5 - 2.0
  voicePitch?: number; // -20 to 20

  // Avatar appearance
  backgroundColor?: string;
  backgroundImageUrl?: string;
  avatarStyle?: 'professional' | 'casual' | 'formal';

  // Animation
  avatarGestures?: boolean;
  lookAtCamera?: boolean;
}

export interface HeyGenAvatar {
  id: string;
  name: string;
  thumbnailUrl: string;
  previewVideoUrl?: string;
  gender?: 'male' | 'female' | 'neutral';
  ethnicity?: string;
  style?: string;
  isPremium?: boolean;
}

export interface HeyGenVoice {
  id: string;
  name: string;
  language: string;
  accent?: string;
  gender?: 'male' | 'female' | 'neutral';
  previewUrl?: string;
  isPremium?: boolean;
}

// ============================================================================
// Video Template Types
// ============================================================================

export interface VideoTemplate {
  id: string;
  organizationId: string;

  name: string;
  description?: string;
  category: VideoTemplateCategory;

  // Template configuration
  provider: VideoProvider;
  type: 'avatar' | 'text-to-video' | 'image-to-video';

  // Default settings
  defaultAvatarConfig?: AvatarConfig;
  defaultPromptTemplate?: string;
  defaultDuration?: number;
  defaultAspectRatio?: VideoAspectRatio;
  defaultResolution?: VideoResolution;

  // Placeholders for dynamic content
  placeholders?: VideoPlaceholder[];

  // Preview
  thumbnailUrl?: string;
  previewVideoUrl?: string;

  // Metadata
  isPublic?: boolean;
  isPremium?: boolean;
  usageCount?: number;

  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export type VideoTemplateCategory =
  | 'sales-pitch'
  | 'product-demo'
  | 'explainer'
  | 'testimonial'
  | 'social-ad'
  | 'email-personalization'
  | 'training'
  | 'announcement'
  | 'custom';

export interface VideoPlaceholder {
  key: string;
  label: string;
  type: 'text' | 'image' | 'variable';
  defaultValue?: string;
  description?: string;
  required?: boolean;
}

// ============================================================================
// Video Project Types
// ============================================================================

export interface VideoProject {
  id: string;
  organizationId: string;
  userId: string;

  name: string;
  description?: string;

  // Project status
  status: 'draft' | 'in-progress' | 'completed' | 'archived';

  // Associated content
  videos: VideoProjectVideo[];

  // Campaign integration
  campaignId?: string;
  campaignType?: 'email' | 'social' | 'ads';

  // Metadata
  tags?: string[];
  folder?: string;

  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface VideoProjectVideo {
  id: string;
  requestId?: string;
  responseId?: string;

  name: string;
  status: VideoStatus;

  // Output
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;

  // Version control
  version: number;
  parentVideoId?: string;

  createdAt: Date;
}

// ============================================================================
// Video Analytics Types
// ============================================================================

export interface VideoAnalytics {
  videoId: string;
  organizationId: string;

  // Views
  totalViews: number;
  uniqueViews: number;

  // Engagement
  avgWatchTime: number; // seconds
  completionRate: number; // percentage

  // Performance
  clickThroughRate?: number;
  conversionRate?: number;

  // By platform
  viewsByPlatform?: Record<string, number>;

  // Time series
  viewsByDate?: Array<{
    date: string;
    views: number;
    uniqueViews: number;
  }>;
}

// ============================================================================
// Waitlist Types
// ============================================================================

export interface VideoWaitlistEntry {
  id: string;
  organizationId: string;
  userId?: string;

  email: string;
  name?: string;
  company?: string;

  interests: VideoWaitlistInterest[];
  useCase?: string;
  expectedVolume?: 'low' | 'medium' | 'high';

  status: 'pending' | 'invited' | 'activated';

  createdAt: Date;
  invitedAt?: Date;
  activatedAt?: Date;
}

export type VideoWaitlistInterest =
  | 'ai-avatars'
  | 'text-to-video'
  | 'automated-ads'
  | 'personalized-outreach'
  | 'product-demos'
  | 'social-content';
