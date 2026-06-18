/**
 * Script & Podcast — transcript ⇄ clip mapping model.
 *
 * Edit-by-transcript works by mapping transcript word timings onto the timeline:
 *
 *   • Each clip occupies a span of the SOURCE video from `trimStart` to
 *     (duration − trimEnd). Deepgram gives us word timings relative to the
 *     start of each clip's SOURCE, so a word at `start = 12.4s` is at source
 *     time 12.4s in that clip — regardless of where the clip sits on the timeline.
 *
 *   • Selecting/deleting a run of words means "remove that source region from the
 *     clip." We translate that into the shared reducer's primitives:
 *       SPLIT_CLIP at the region's in/out points, then REMOVE_CLIP for the middle
 *       piece — or a simple trimStart/trimEnd bump when the region touches an edge.
 *
 * These are pure functions so the cut planning is testable and the React layer
 * stays thin. They never call dispatch themselves — they return a plan of
 * reducer actions for the component to apply.
 */

import type { EditorClip, EditorAction } from '../../types';
import type { TranscriptionWord } from '@/types/scene-grading';

/** A word as shown in the transcript, tagged with which clip it belongs to. */
export interface TranscriptToken {
  /** Stable id: `${clipId}:${index}` */
  id: string;
  clipId: string;
  /** Index of this word within its clip's word list. */
  wordIndex: number;
  word: string;
  /** Source-time start/end within the owning clip (seconds). */
  start: number;
  end: number;
  confidence: number;
  /** True when this word is classified as a filler word (um/uh/like/you know…). */
  isFiller: boolean;
}

/** Raw per-clip transcript as returned by the transcribe API. */
export interface ClipWords {
  clipId: string;
  words: TranscriptionWord[];
}

// ============================================================================
// Filler-word classification
// ============================================================================

/**
 * Single-word fillers. Matched case-insensitively after stripping surrounding
 * punctuation that Deepgram's smart_format adds (e.g. "Um,").
 */
const FILLER_WORDS: ReadonlySet<string> = new Set([
  'um',
  'uh',
  'erm',
  'hmm',
  'mm',
  'mhm',
  'uhh',
  'umm',
  'ah',
  'er',
  'like',
  'basically',
  'literally',
  'actually',
]);

/** Two-word filler phrases (e.g. "you know", "i mean", "sort of"). */
const FILLER_PHRASES: readonly string[] = ['you know', 'i mean', 'sort of', 'kind of'];

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[.,!?;:"'`]/g, '')
    .trim();
}

/** True if the single word is a filler. */
export function isFillerWord(word: string): boolean {
  return FILLER_WORDS.has(normalizeWord(word));
}

// ============================================================================
// Token building
// ============================================================================

/**
 * Build the flat, displayable token list for the whole project, in clip order.
 * Two-word filler phrases are detected here and BOTH words flagged as filler.
 */
export function buildTokens(clips: EditorClip[], clipWords: ClipWords[]): TranscriptToken[] {
  const wordsByClip = new Map<string, TranscriptionWord[]>();
  for (const cw of clipWords) {
    wordsByClip.set(cw.clipId, cw.words);
  }

  const tokens: TranscriptToken[] = [];
  for (const clip of clips) {
    const words = wordsByClip.get(clip.id) ?? [];
    const fillerFlags = new Array<boolean>(words.length).fill(false);

    // Single-word fillers.
    for (let i = 0; i < words.length; i += 1) {
      if (isFillerWord(words[i].word)) {
        fillerFlags[i] = true;
      }
    }

    // Two-word filler phrases.
    for (let i = 0; i < words.length - 1; i += 1) {
      const pair = `${normalizeWord(words[i].word)} ${normalizeWord(words[i + 1].word)}`;
      if (FILLER_PHRASES.includes(pair)) {
        fillerFlags[i] = true;
        fillerFlags[i + 1] = true;
      }
    }

    for (let i = 0; i < words.length; i += 1) {
      const w = words[i];
      tokens.push({
        id: `${clip.id}:${i}`,
        clipId: clip.id,
        wordIndex: i,
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
        isFiller: fillerFlags[i],
      });
    }
  }
  return tokens;
}

// ============================================================================
// Source-region → reducer-action planning
// ============================================================================

/** A contiguous source-time region to cut out of a single clip. */
export interface ClipCutRegion {
  clipId: string;
  /** Source video URL of the clip — used to re-find the right piece after a
   *  split mints new clip ids (all pieces of a take share the same url). */
  clipUrl: string;
  /** Source-time in/out of the region to REMOVE (seconds). */
  removeStart: number;
  removeEnd: number;
}

export const CUT_EPSILON = 0.05; // seconds — edges within this are the clip boundary

function clipSourceBounds(clip: EditorClip): { start: number; end: number } {
  // Source region currently visible: [trimStart, duration - trimEnd].
  const sourceEnd = (clip.duration || 0) - clip.trimEnd;
  return { start: clip.trimStart, end: sourceEnd };
}

/**
 * Plan the NEXT reducer action that progresses removal of `region` from its clip.
 *
 * Why one step at a time: the shared SPLIT_CLIP reducer replaces the original
 * clip with two NEW clips (fresh ids) — so after a split we can't reference the
 * original id again. Rather than guess generated ids, the component applies one
 * action, lets React re-render with fresh `state.clips`, then calls this again
 * for the same source region until it's fully removed (or returns `null` = done).
 *
 * `SPLIT_CLIP.splitTime` is CLIP-LOCAL EFFECTIVE time (relative to the visible
 * duration), so we convert source time via `sourceTime - visibleStart`.
 *
 * Resolution order for the visible region [removeStart, removeEnd]:
 *   • whole visible clip      → REMOVE_CLIP (done)
 *   • hugs the IN edge        → bump trimStart to removeEnd (done)
 *   • hugs the OUT edge       → bump trimEnd so the clip ends at removeStart (done)
 *   • strictly in the middle  → SPLIT_CLIP at removeStart; next call sees the
 *                               trailing piece hugging its IN edge and finishes it.
 */
export function planNextCutStep(clip: EditorClip, region: ClipCutRegion): EditorAction | null {
  const { start: visibleStart, end: visibleEnd } = clipSourceBounds(clip);

  // Clamp the region to what's actually visible in the clip right now.
  const removeStart = Math.max(region.removeStart, visibleStart);
  const removeEnd = Math.min(region.removeEnd, visibleEnd);
  if (removeEnd - removeStart <= CUT_EPSILON) {
    return null; // nothing left to remove
  }

  const touchesIn = removeStart - visibleStart <= CUT_EPSILON;
  const touchesOut = visibleEnd - removeEnd <= CUT_EPSILON;

  // Whole visible clip removed.
  if (touchesIn && touchesOut) {
    return { type: 'REMOVE_CLIP', clipId: clip.id };
  }

  // Region hugs the IN edge → trim more off the start (this finishes the region).
  if (touchesIn) {
    return {
      type: 'UPDATE_CLIP',
      clipId: clip.id,
      updates: { trimStart: removeEnd },
    };
  }

  // Region hugs the OUT edge → trim more off the end (finishes the region).
  if (touchesOut) {
    return {
      type: 'UPDATE_CLIP',
      clipId: clip.id,
      updates: { trimEnd: (clip.duration || 0) - removeStart },
    };
  }

  // Middle region: split at removeStart. The trailing piece (clip B) will then
  // hug its IN edge on the next pass, so a single split is enough to converge.
  const splitLocal = removeStart - visibleStart;
  return { type: 'SPLIT_CLIP', clipId: clip.id, splitTime: splitLocal };
}

// ============================================================================
// Silence detection
// ============================================================================

/** A detected silent gap between two consecutive words within a clip. */
export interface SilenceGap {
  clipId: string;
  /** Source-time bounds of the silence (seconds). */
  start: number;
  end: number;
}

/**
 * Find silent gaps longer than `minGapSeconds` between consecutive words within
 * each clip. We keep a small `padSeconds` of breathing room on each side so cuts
 * don't clip the start/end of adjacent words.
 */
export function findSilences(
  clipWords: ClipWords[],
  minGapSeconds = 0.8,
  padSeconds = 0.1,
): SilenceGap[] {
  const gaps: SilenceGap[] = [];
  for (const cw of clipWords) {
    const words = cw.words;
    for (let i = 0; i < words.length - 1; i += 1) {
      const gap = words[i + 1].start - words[i].end;
      if (gap >= minGapSeconds) {
        const start = words[i].end + padSeconds;
        const end = words[i + 1].start - padSeconds;
        if (end - start > CUT_EPSILON) {
          gaps.push({ clipId: cw.clipId, start, end });
        }
      }
    }
  }
  return gaps;
}
