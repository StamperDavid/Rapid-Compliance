/**
 * Video Provider Abstraction Layer — shared types (Phase 0)
 *
 * These types define the engine-agnostic contract every video generation
 * provider implements. Call sites program against `VideoEngineProvider` and can
 * swap engines without knowing the underlying API shape.
 *
 * Multi-tenant note: every provider method takes a `TenantContext` so the
 * credential + metering seams can resolve per-tenant once multi-tenancy is
 * re-enabled. In single-tenant mode call sites pass { tenantId: PLATFORM_ID }.
 */

import type { VideoEngineId } from '@/types/video-pipeline';

/**
 * Engine-agnostic generation request. A provider maps these neutral fields onto
 * its own API shape (e.g. the fal queue body). Fields are
 * optional where an engine may not need them; a provider validates what it
 * requires and ignores what it cannot use.
 */
export interface VideoGenerateRequest {
  /** The scene / creative prompt. Required for every engine. */
  prompt: string;
  /** Reference images for character/style consistency (e.g. fal `image_urls`). */
  imageUrls?: string[];
  /** Reference videos (e.g. fal `video_urls` — a character motion clip). */
  videoUrls?: string[];
  /** Reference audio (e.g. fal `audio_urls`). */
  audioUrls?: string[];
  /** Start frame to continue from (image-to-video continuity). */
  startFrameUrl?: string | null;
  /** Output resolution tier. */
  resolution?: '480p' | '720p' | '1080p';
  /** Aspect ratio token, e.g. "16:9" | "9:16" | "1:1". */
  aspectRatio?: string;
  /** Clip duration in seconds. */
  durationSeconds?: number;
  /** Optional deterministic seed. */
  seed?: number;
  /** Whether the engine should generate audio with the video. */
  generateAudio?: boolean;
}

/** Result of submitting a generation — the job handle to poll on. */
export interface VideoGenerationResult {
  generationId: string;
  status: string;
}

/** Normalized polling status, identical in shape across engines. */
export interface VideoGenerationStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl: string | null;
  progress: number | null;
  error: string | null;
}

/**
 * Tenant scope for credential resolution + usage metering. In single-tenant
 * (Penthouse) mode this is always { tenantId: PLATFORM_ID }. The field exists
 * now so the multi-tenant flip is additive, not a rewrite.
 *
 * When `projectId` is set, generated media assets are auto-filed into that
 * project's folder in the media library (via `createAsset` → `getOrCreateProjectFolder`).
 * `projectName` is the human-readable folder label (falls back to 'Project' if omitted).
 */
export interface TenantContext {
  tenantId: string;
  /** Optional: when present, generated (non-character) assets auto-file into this project's folder. */
  projectId?: string;
  /** Optional: human-readable project name for the auto-created folder label. */
  projectName?: string;
}

/**
 * The engine-agnostic provider contract. Every video engine implements this.
 */
export interface VideoEngineProvider {
  readonly id: VideoEngineId;
  /** Submit a fresh generation (reference-to-video / text-to-video style). */
  generateVideo(req: VideoGenerateRequest, ctx: TenantContext): Promise<VideoGenerationResult>;
  /**
   * Submit a text-to-video generation (prompt only, audio on by default).
   * For spoken / dialogue clips where the engine synthesizes the full scene
   * from text without reference media.
   */
  generateTextToVideo(
    req: VideoGenerateRequest,
    ctx: TenantContext,
  ): Promise<VideoGenerationResult>;
  /** Submit a generation that begins from a given start frame (image-to-video). */
  generateFromStartFrame(
    startFrameUrl: string,
    req: VideoGenerateRequest,
    ctx: TenantContext,
  ): Promise<VideoGenerationResult>;
  /** Poll a previously-submitted generation. */
  getStatus(generationId: string, ctx: TenantContext): Promise<VideoGenerationStatus>;
}
