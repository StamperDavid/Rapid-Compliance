/**
 * Segment utilities for the Social Repurposing workspace.
 *
 * The editor's project timeline is the project's clips concatenated in order.
 * Each clip contributes its EFFECTIVE duration:
 *   effective = (duration || DEFAULT_CLIP_DURATION) - trimStart - trimEnd
 *
 * A "short" is an operator-defined span [startSec, endSec] measured on that
 * concatenated timeline. To render a short with the existing render route
 * (which takes clips with trimStart / trimEnd in seconds), we slice the span
 * back into per-clip trims. This module holds that pure, side-effect-free math
 * so it can be reasoned about (and unit-tested) independently of React.
 */

import { DEFAULT_CLIP_DURATION, type EditorClip } from '../../types';

/** A queued short: an in/out span over the project timeline plus its options. */
export interface ShortSegment {
  id: string;
  /** Operator-facing label, e.g. "Short 1". */
  name: string;
  /** Start offset on the concatenated project timeline, in seconds. */
  startSec: number;
  /** End offset on the concatenated project timeline, in seconds. */
  endSec: number;
  /** Whether the operator asked for auto-captions on this short. */
  autoCaptions: boolean;
}

/** Render lifecycle for a single queued short. */
export type ShortRenderPhase = 'queued' | 'rendering' | 'done' | 'error';

export interface ShortRenderStatus {
  phase: ShortRenderPhase;
  /** Plain-English error if phase === 'error'. */
  error: string | null;
  /** Library URL of the finished short if phase === 'done'. */
  url: string | null;
  /**
   * Optional plain-English caption note. Set when the operator asked for
   * auto-captions but the transcription service isn't connected — the short
   * still renders (vertical, uncaptioned) and this explains why captions were
   * skipped. Undefined when captions weren't requested or were applied cleanly.
   */
  captionsNote?: string;
}

/** The effective (trimmed) duration a clip contributes to the timeline. */
export function effectiveClipDuration(clip: EditorClip): number {
  const raw = (clip.duration || DEFAULT_CLIP_DURATION) - clip.trimStart - clip.trimEnd;
  return Math.max(0, raw);
}

/** Total project timeline length: sum of every clip's effective duration. */
export function projectTimelineDuration(clips: EditorClip[]): number {
  return clips.reduce((sum, clip) => sum + effectiveClipDuration(clip), 0);
}

/**
 * A clip prepared for the render route: the original clip with its trims
 * tightened so it covers only the portion inside the requested span.
 */
export interface RenderReadyClip {
  id: string;
  url: string;
  trimStart: number;
  trimEnd: number;
  effect?: EditorClip['effect'];
}

/**
 * Slice the project timeline span [startSec, endSec] into per-clip render
 * instructions. Walks clips in order, and for every clip that overlaps the
 * span, adds extra trim so only the overlapping portion is rendered.
 *
 * Returns an empty array if the span is empty or lands outside the timeline —
 * callers must treat that as "nothing to render" (never fabricate a clip).
 */
export function sliceTimelineToClips(
  clips: EditorClip[],
  startSec: number,
  endSec: number,
): RenderReadyClip[] {
  if (endSec <= startSec) {
    return [];
  }

  const result: RenderReadyClip[] = [];
  let cursor = 0; // running position on the concatenated timeline

  for (const clip of clips) {
    const clipLen = effectiveClipDuration(clip);
    if (clipLen <= 0) {
      continue;
    }

    const clipStartOnTimeline = cursor;
    const clipEndOnTimeline = cursor + clipLen;
    cursor = clipEndOnTimeline;

    // No overlap with the requested span — skip.
    if (clipEndOnTimeline <= startSec || clipStartOnTimeline >= endSec) {
      continue;
    }

    // How far into THIS clip the span begins / ends (clamped to the clip).
    const enterAt = Math.max(0, startSec - clipStartOnTimeline);
    const exitAt = Math.min(clipLen, endSec - clipStartOnTimeline);

    // Extra trim layered ON TOP of the clip's existing trims so we keep only
    // the [enterAt, exitAt] window of this clip's already-trimmed content.
    const extraTrimStart = enterAt;
    const extraTrimEnd = clipLen - exitAt;

    result.push({
      id: clip.id,
      url: clip.url,
      trimStart: clip.trimStart + extraTrimStart,
      trimEnd: clip.trimEnd + extraTrimEnd,
      effect: clip.effect,
    });
  }

  return result;
}

/**
 * A source span that contributes to a short, expressed in the SOURCE clip's own
 * timeline plus where it lands inside the rendered short. Used to fetch + window
 * captions accurately when a short is cut from one or more source clips.
 */
export interface ShortSourceSpan {
  /** The clip the captions are transcribed from. */
  url: string;
  /** Start of the kept window in the SOURCE clip's timeline, in seconds. */
  sourceStart: number;
  /** End of the kept window in the SOURCE clip's timeline, in seconds. */
  sourceEnd: number;
  /** Offset of this span's start within the rendered short, in seconds. */
  offsetInShort: number;
}

/**
 * Resolve the source spans that make up a short. Walks clips in order (same math
 * as sliceTimelineToClips) and, for each overlapping clip, records the exact
 * window of the SOURCE that is kept plus where it begins inside the short. The
 * caller transcribes each source URL, keeps only the words inside
 * [sourceStart, sourceEnd], and re-bases them by (offsetInShort - sourceStart).
 *
 * Returns [] when the span is empty or outside the timeline.
 */
export function resolveShortSourceSpans(
  clips: EditorClip[],
  startSec: number,
  endSec: number,
): ShortSourceSpan[] {
  if (endSec <= startSec) {
    return [];
  }

  const spans: ShortSourceSpan[] = [];
  let cursor = 0; // running position on the concatenated timeline
  let offsetInShort = 0; // running position inside the rendered short

  for (const clip of clips) {
    const clipLen = effectiveClipDuration(clip);
    if (clipLen <= 0) {
      continue;
    }

    const clipStartOnTimeline = cursor;
    const clipEndOnTimeline = cursor + clipLen;
    cursor = clipEndOnTimeline;

    if (clipEndOnTimeline <= startSec || clipStartOnTimeline >= endSec) {
      continue;
    }

    // How far into THIS clip's effective (already-trimmed) content the span runs.
    const enterAt = Math.max(0, startSec - clipStartOnTimeline);
    const exitAt = Math.min(clipLen, endSec - clipStartOnTimeline);

    // Translate to the SOURCE clip's own timeline: the kept content starts at
    // clip.trimStart in the source, so add enterAt/exitAt to it.
    const sourceStart = clip.trimStart + enterAt;
    const sourceEnd = clip.trimStart + exitAt;

    spans.push({
      url: clip.url,
      sourceStart,
      sourceEnd,
      offsetInShort,
    });

    offsetInShort += exitAt - enterAt;
  }

  return spans;
}

/** Format a seconds value as M:SS for operator-facing labels. */
export function formatTimecode(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
