/**
 * Shared helpers for the Text & Captions tool panel.
 *
 * Keeps the panel component lean: overlay defaults, the colour swatch palette,
 * and the timeline-offset math used to line auto-subtitles up with where each
 * clip actually starts on the project timeline.
 */

import { DEFAULT_CLIP_DURATION, type EditorClip, type TextOverlay } from '../../types';

/** How long a freshly-added text overlay stays on screen, in seconds. */
export const DEFAULT_OVERLAY_DURATION = 3;

/** Font-size bounds (px, relative to a 1080p frame) the operator can pick from. */
export const MIN_FONT_SIZE = 16;
export const MAX_FONT_SIZE = 160;
export const DEFAULT_FONT_SIZE = 48;

export const POSITIONS: { value: TextOverlay['position']; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
];

/** A small, on-brand-neutral palette so the operator never types raw hex. */
export const COLOR_SWATCHES: { value: string; label: string }[] = [
  { value: '#FFFFFF', label: 'White' },
  { value: '#000000', label: 'Black' },
  { value: '#FACC15', label: 'Yellow' },
  { value: '#22C55E', label: 'Green' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#EF4444', label: 'Red' },
];

/** Transparent background sentinel, matched to what the captions route emits. */
export const TRANSPARENT = 'transparent';

export const BACKGROUND_SWATCHES: { value: string; label: string }[] = [
  { value: TRANSPARENT, label: 'None' },
  { value: '#000000', label: 'Black' },
  { value: '#FFFFFF', label: 'White' },
  { value: '#1F2937', label: 'Charcoal' },
];

/** A new overlay anchored at the playhead with sensible, render-ready defaults. */
export function buildDefaultOverlay(playheadTime: number, totalDuration: number): Omit<TextOverlay, 'id'> {
  const startTime = Math.max(0, playheadTime);
  // Clamp the end to the project length when we know it, otherwise just extend.
  const rawEnd = startTime + DEFAULT_OVERLAY_DURATION;
  const endTime = totalDuration > 0 ? Math.min(rawEnd, Math.max(startTime + 0.5, totalDuration)) : rawEnd;
  return {
    text: 'New text',
    startTime,
    endTime,
    position: 'bottom',
    fontSize: DEFAULT_FONT_SIZE,
    fontColor: '#FFFFFF',
    backgroundColor: '#000000',
  };
}

/** Effective on-timeline length of a single clip after trims, in seconds. */
export function effectiveClipDuration(clip: EditorClip): number {
  const raw = (clip.duration || DEFAULT_CLIP_DURATION) - clip.trimStart - clip.trimEnd;
  return Math.max(0, raw);
}

/**
 * Cumulative start offset (seconds) of each clip on the project timeline, in clip
 * order. Index i is where clip i begins. Auto-subtitles for clip i are offset by
 * this value so a clip's captions land where the clip plays, not at time 0.
 */
export function clipTimelineOffsets(clips: EditorClip[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const clip of clips) {
    offsets.push(cursor);
    cursor += effectiveClipDuration(clip);
  }
  return offsets;
}

/** Round seconds for display without dragging in a date lib. */
export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}
