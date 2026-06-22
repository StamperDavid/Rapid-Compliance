/**
 * Media Library Types — Single source of truth.
 *
 * `UnifiedMediaAsset` is the canonical shape that every content engine agent
 * (Copywriter, Alex, Video Pipeline, Voice Lab, Scraper, etc.) reads and
 * writes. All other agents must import from this file — do NOT redefine
 * media shapes elsewhere.
 *
 * Stored at: organizations/{PLATFORM_ID}/media/{id}
 *
 * The legacy `MediaItem` interface is retained for backward compatibility
 * with the existing /content/video/library page and EditorMediaPanel
 * (both predate the unified shape). New code should always use
 * `UnifiedMediaAsset`.
 */

// ============================================================================
// Canonical Unified Asset (NEW — preferred for all new code)
// ============================================================================

/**
 * Master list of every media category we care about. This is the single
 * source of truth — anywhere a category needs to be enumerated, import
 * `MEDIA_CATEGORIES` and reference its members.
 */
export const MEDIA_CATEGORIES = [
  // Branding / static graphics
  'logo',
  'social-graphic',
  'banner',
  'avatar-portrait',
  // A reusable Character Library subject (turnaround / reference / look).
  'character',
  // Photo/photography & generic graphics
  'photo',
  'graphic',
  // Audio
  'music-track',
  'voiceover',
  'sound',
  // Video
  'video-clip',
  'final-render',
  // UI / capture
  'thumbnail',
  'screenshot',
  // Catch-all
  'other',
] as const;

export type MediaAssetCategory = (typeof MEDIA_CATEGORIES)[number];

export type MediaAssetType = 'image' | 'video' | 'audio' | 'document';

export type MediaAssetSource =
  | 'ai-generated'
  | 'user-upload'
  | 'imported'
  | 'derived';

export interface MediaAssetDimensions {
  width: number;
  height: number;
}

/**
 * Canonical media asset record. Every other agent's media field shape
 * MUST conform to this type — do NOT add ad-hoc fields elsewhere; if a
 * new field is genuinely needed, extend this interface here so all
 * consumers see it.
 */
export interface UnifiedMediaAsset {
  id: string;
  type: MediaAssetType;
  category: MediaAssetCategory;
  tags: string[];
  name: string;
  /** Human-authored description of what this asset is. NEVER AI-generated. */
  description?: string;
  /** Human-authored note on how this asset is meant to be used. NEVER AI-generated. */
  intendedUse?: string;
  /** Firebase Storage public URL (or persisted CDN URL). */
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  /** Bytes. */
  fileSize: number;
  /** Seconds. Present for video/audio. */
  duration?: number;
  dimensions?: MediaAssetDimensions;
  source: MediaAssetSource;
  /** e.g. 'openai', 'replicate', 'elevenlabs' — present when source='ai-generated'. */
  aiProvider?: string;
  /** Original prompt — present when source='ai-generated'. */
  aiPrompt?: string;
  /** If this asset was derived from one parent (e.g. cropped, transcoded). */
  parentAssetId?: string;
  /** If this asset was assembled from multiple sources (e.g. final render from clips). */
  derivedFrom?: string[];
  /** IDs of social posts / blog posts / emails that have used this asset. */
  usedInPosts?: string[];
  /** Character Library profile (AvatarProfile id) this asset depicts / belongs to. */
  characterId?: string;
  /** Denormalized character name for display without a profile lookup. */
  characterName?: string;
  /** Video project (project id) this asset belongs to. */
  projectId?: string;
  /** Denormalized project title for display without a project lookup. */
  projectName?: string;
  /** Library folder this asset is filed under (MediaFolder id). Absent = Unfiled. */
  folderId?: string;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
  /** Firebase Auth uid. */
  createdBy: string;
  brandDnaApplied: boolean;
  /**
   * Lifecycle state for async-generated assets (e.g. AI video, where the
   * generation API returns immediately and the actual video is rendered
   * server-side over ~30-60s). When omitted the asset is treated as ready.
   *   pending    — placeholder created, provider has accepted the job
   *   processing — provider is actively rendering
   *   ready      — `url` points at the finished asset (terminal)
   *   failed     — provider returned an error (terminal)
   */
  processingState?: 'pending' | 'processing' | 'ready' | 'failed';
  /**
   * Provider-side generation/job ID. The Studio sidebar polls this against
   * the provider's status endpoint to flip `processingState` to ready.
   */
  aiGenerationId?: string;
}

// ============================================================================
// Filter / list / mutation shapes used by the service + API layer
// ============================================================================

export interface MediaListFilters {
  type?: MediaAssetType;
  category?: MediaAssetCategory;
  /** ANY-match — returns assets whose `tags` array contains at least one of these. */
  tags?: string[];
  /** Substring search across `name`, `tags`, and `aiPrompt`. */
  search?: string;
  source?: MediaAssetSource;
  /** Restrict to assets belonging to one Character Library subject. */
  characterId?: string;
  /** Restrict to assets belonging to one video project. */
  projectId?: string;
  /** Restrict to assets filed directly under this library folder. */
  folderId?: string;
  /** Restrict to assets NOT filed in any folder (the "Unfiled" root). */
  unfiledOnly?: boolean;
  /** ISO 8601 inclusive lower bound on createdAt. */
  createdAfter?: string;
  /** ISO 8601 inclusive upper bound on createdAt. */
  createdBefore?: string;
  limit?: number;
  offset?: number;
}

export interface MediaCreateInput {
  type: MediaAssetType;
  category: MediaAssetCategory;
  name: string;
  description?: string;
  intendedUse?: string;
  url: string;
  mimeType: string;
  fileSize: number;
  source: MediaAssetSource;
  createdBy: string;
  tags?: string[];
  thumbnailUrl?: string;
  duration?: number;
  dimensions?: MediaAssetDimensions;
  aiProvider?: string;
  aiPrompt?: string;
  parentAssetId?: string;
  derivedFrom?: string[];
  usedInPosts?: string[];
  characterId?: string;
  characterName?: string;
  projectId?: string;
  projectName?: string;
  /** Library folder this asset is filed under (MediaFolder id). */
  folderId?: string;
  brandDnaApplied?: boolean;
}

export type MediaUpdateInput = Partial<
  Omit<UnifiedMediaAsset, 'id' | 'createdAt' | 'createdBy'>
>;

// ============================================================================
// Media folders — the library hierarchy (Brand ▸ Campaign ▸ Sub-campaign ▸ …).
// Stored at organizations/{PLATFORM_ID}/mediaFolders/{id}. Nesting is via
// `parentFolderId` (any depth); a null/absent parent is a top-level folder.
// ============================================================================

export interface MediaFolder {
  id: string;
  name: string;
  /** Parent folder id; null/absent = a top-level (root) folder. */
  parentFolderId?: string | null;
  /** When this folder auto-represents a video project, the project id it mirrors. */
  projectId?: string | null;
  /** Firebase Auth uid of the creator. */
  createdBy: string;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
}

export interface MediaFolderCreateInput {
  name: string;
  parentFolderId?: string | null;
  /** Link this folder to a video project so generated assets auto-file into it. */
  projectId?: string | null;
  createdBy: string;
}

export interface MediaFolderUpdateInput {
  name?: string;
  /** Reparent the folder (move it under a different parent, or to root with null). */
  parentFolderId?: string | null;
}

// ============================================================================
// LEGACY shapes — kept for the existing /content/video/library page and the
// EditorMediaPanel. New code should NOT use these. Once those two consumers
// migrate to UnifiedMediaAsset, this section can be removed.
// ============================================================================

export type MediaType = 'video' | 'image' | 'audio';

export type AudioCategory = 'sound' | 'voice' | 'music';
export type ImageCategory = 'photo' | 'graphic' | 'screenshot' | 'thumbnail';
export type VideoCategory = 'clip' | 'final' | 'scene';

export type MediaCategory = AudioCategory | ImageCategory | VideoCategory;

/**
 * @deprecated Use {@link UnifiedMediaAsset} for all new code.
 * Retained for the legacy library page + EditorMediaPanel.
 */
export interface MediaItem {
  id: string;
  type: MediaType;
  category: MediaCategory;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  fileSize: number;
  duration: number | null;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

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
  video: 100 * 1024 * 1024,
  image: 10 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};

// ============================================================================
// Helpers — bridge between legacy and unified shapes
// ============================================================================

const LEGACY_TO_UNIFIED_CATEGORY: Record<MediaCategory, MediaAssetCategory> = {
  // audio
  sound: 'sound',
  voice: 'voiceover',
  music: 'music-track',
  // image
  photo: 'photo',
  graphic: 'graphic',
  screenshot: 'screenshot',
  thumbnail: 'thumbnail',
  // video
  clip: 'video-clip',
  final: 'final-render',
  scene: 'video-clip',
};

/**
 * Translate a legacy `MediaCategory` value into the canonical
 * `MediaAssetCategory`. Used by the backfill + API layer when migrating
 * existing records.
 */
export function legacyCategoryToUnified(
  category: MediaCategory,
): MediaAssetCategory {
  return LEGACY_TO_UNIFIED_CATEGORY[category];
}

/**
 * Project a `UnifiedMediaAsset` onto the legacy `MediaItem` shape. Used by
 * the API to keep existing consumers (library page, EditorMediaPanel)
 * working without code changes.
 */
export function unifiedToLegacyMediaItem(asset: UnifiedMediaAsset): MediaItem {
  // Map unified type/category back into legacy union. Documents — which the
  // legacy shape doesn't support — are surfaced as 'image' for compatibility;
  // legacy consumers don't render them anyway.
  const legacyType: MediaType =
    asset.type === 'document' ? 'image' : asset.type;

  const legacyCategory: MediaCategory = mapUnifiedToLegacyCategory(
    asset.type,
    asset.category,
  );

  return {
    id: asset.id,
    type: legacyType,
    category: legacyCategory,
    name: asset.name,
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl ?? null,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    duration: asset.duration ?? null,
    metadata: {
      source: asset.source,
      ...(asset.aiProvider ? { aiProvider: asset.aiProvider } : {}),
      ...(asset.aiPrompt ? { aiPrompt: asset.aiPrompt } : {}),
      ...(asset.tags.length > 0 ? { tags: asset.tags.join(',') } : {}),
    },
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    createdBy: asset.createdBy,
  };
}

function mapUnifiedToLegacyCategory(
  type: MediaAssetType,
  category: MediaAssetCategory,
): MediaCategory {
  // Audio
  if (category === 'music-track') { return 'music'; }
  if (category === 'voiceover') { return 'voice'; }
  if (category === 'sound') { return 'sound'; }
  // Video
  if (category === 'video-clip') { return 'clip'; }
  if (category === 'final-render') { return 'final'; }
  // Image-ish
  if (category === 'screenshot') { return 'screenshot'; }
  if (category === 'thumbnail') { return 'thumbnail'; }
  if (category === 'photo') { return 'photo'; }
  if (category === 'graphic') { return 'graphic'; }
  // A Character Library subject is an image asset; the legacy shape has no
  // 'character' slot, so surface it as the legacy image category 'photo'.
  if (category === 'character') { return 'photo'; }
  // Fallback: pick a sensible default per type (logo/banner/etc → graphic)
  if (type === 'audio') { return 'sound'; }
  if (type === 'video') { return 'clip'; }
  return 'graphic';
}
