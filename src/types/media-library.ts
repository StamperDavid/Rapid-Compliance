/**
 * Media Library Types
 * Unified types for all media assets: videos, images, and audio
 */

// ============================================================================
// Media Types
// ============================================================================

export type MediaType = 'video' | 'image' | 'audio';

export type AudioCategory = 'sound' | 'voice' | 'music';
export type ImageCategory = 'photo' | 'graphic' | 'screenshot' | 'thumbnail';
export type VideoCategory = 'clip' | 'final' | 'scene';

export type MediaCategory = AudioCategory | ImageCategory | VideoCategory;

// ============================================================================
// Media Item
// ============================================================================

export interface MediaItem {
  id: string;
  type: MediaType;
  category: MediaCategory;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  fileSize: number; // bytes
  duration: number | null; // seconds, for video/audio only
  metadata: Record<string, string>; // flexible key-value pairs
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface MediaListResponse {
  success: boolean;
  items: MediaItem[];
  total: number;
}

export interface MediaCreateRequest {
  type: MediaType;
  category: MediaCategory;
  name: string;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileSize: number;
  duration?: number;
  metadata?: Record<string, string>;
}

export interface MediaUploadResponse {
  success: boolean;
  item: MediaItem;
}

// ============================================================================
// Constants
// ============================================================================

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  video: 'Videos',
  image: 'Images',
  audio: 'Audio',
};

export const AUDIO_CATEGORY_LABELS: Record<AudioCategory, string> = {
  sound: 'Sounds',
  voice: 'Voices',
  music: 'Music',
};

export const IMAGE_CATEGORY_LABELS: Record<ImageCategory, string> = {
  photo: 'Photos',
  graphic: 'Graphics',
  screenshot: 'Screenshots',
  thumbnail: 'Thumbnails',
};

export const VIDEO_CATEGORY_LABELS: Record<VideoCategory, string> = {
  clip: 'Clips',
  final: 'Final Videos',
  scene: 'Scenes',
};

export const ALLOWED_MEDIA_TYPES: Record<MediaType, string[]> = {
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
};

export const MAX_UPLOAD_SIZES: Record<MediaType, number> = {
  video: 100 * 1024 * 1024, // 100MB
  image: 10 * 1024 * 1024,  // 10MB
  audio: 50 * 1024 * 1024,  // 50MB
};
