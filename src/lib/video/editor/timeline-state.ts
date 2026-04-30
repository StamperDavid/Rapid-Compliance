/**
 * Timeline State — shared contract between the CapCut-style video editor
 * frontend and the server-side render endpoint at /api/video/editor/render.
 *
 * The frontend reducer (`src/app/(dashboard)/content/video/editor/editor-reducer.ts`)
 * is the source of truth for in-flight editor state. This module re-exports
 * those types so server code can consume them without depending on the
 * dashboard route directory, and adds the render-request payload shape.
 *
 * Effects, transitions and overlays defined here are intentionally minimal
 * (CSS-style filter values, three transition types, basic text overlays).
 * The server-side render uses the same numeric ranges so client preview
 * and final output match.
 */

import type {
  EditorClip,
  EditorAudioTrack,
  TextOverlay,
  ClipEffect,
} from '@/app/(dashboard)/content/video/editor/types';
import type { TransitionType } from '@/types/video-pipeline';

// ============================================================================
// Re-exports — single import point for server / shared code
// ============================================================================

export type { EditorClip, EditorAudioTrack, TextOverlay, ClipEffect, TransitionType };
export { NEUTRAL_EFFECT } from '@/app/(dashboard)/content/video/editor/types';

// ============================================================================
// Render contract
// ============================================================================

/**
 * Wire format sent from the editor page to /api/video/editor/render.
 * The server walks `clips` in array order, applying each clip's `effect`
 * via FFmpeg eq + hue filters, then concatenates with the configured
 * transition, then burns in `textOverlays` via the drawtext filter.
 */
export interface RenderRequest {
  /** Project name used for the saved media library entry. */
  name: string;
  clips: RenderClip[];
  textOverlays: RenderTextOverlay[];
  /** Default transition between clips (each clip can also override). */
  transition: TransitionType;
  /** Output resolution. Matches /api/video/assemble's enum. */
  resolution?: '720p' | '1080p';
  /** Source-clip media library ids — written into the saved record's
   *  metadata so we can trace the lineage of a final render. */
  derivedFromMediaIds?: string[];
}

export interface RenderClip {
  /** Stable id used for logging / matching the editor state. */
  id: string;
  /** HTTPS URL the server can fetch (Firebase Storage signed URL is fine). */
  url: string;
  /** Seconds to trim from the start of the source. */
  trimStart: number;
  /** Seconds to trim from the end of the source. */
  trimEnd: number;
  /** Transition that plays at the trailing edge of THIS clip into the next. */
  transitionType: TransitionType;
  /** Optional per-clip lighting effect — falls back to neutral. */
  effect?: ClipEffect;
}

export interface RenderTextOverlay {
  text: string;
  /** Seconds from the start of the assembled video. */
  startTime: number;
  endTime: number;
  /** Fallback when canvasX/Y are not set. */
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  canvasX?: number;
  canvasY?: number;
  fontFamily?: string;
}
