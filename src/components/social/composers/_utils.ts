/**
 * Shared helpers for the per-platform Composer components.
 *
 * These are tiny presentation-only helpers used by every composer in this
 * folder. Keep them dependency-free (no React, no DOM, no fetch). The single
 * exception is `useCharCountdownColor` which is a React hook so it can be
 * memoised — no side effects.
 */

import * as React from 'react';

/**
 * Color thresholds for the character-countdown that lives at the bottom-right
 * of every native composer textarea. Identical thresholds across all platforms
 * so the operator's eye learns the colors once.
 *
 * - 0 to <85% of cap   → muted (foreground/40)
 * - 85% to <95% of cap → amber
 * - >= 95% of cap      → destructive
 *
 * When `max` is 0 or negative (i.e. "no hard limit") we always return muted.
 */
export function useCharCountdownColor(current: number, max: number): string {
  return React.useMemo(() => {
    if (!max || max <= 0) {return 'text-muted-foreground';}
    const ratio = current / max;
    if (ratio >= 0.95) {return 'text-destructive';}
    if (ratio >= 0.85) {return 'text-amber-500';}
    return 'text-muted-foreground';
  }, [current, max]);
}

/**
 * Count `#` hashtag tokens in a string. We treat any `#word` as one tag.
 * Used by Instagram for the `12 / 30 hashtags` indicator.
 */
export function countHashtags(text: string): number {
  if (!text) {return 0;}
  const matches = text.match(/#[\w\d_]+/g);
  return matches?.length ?? 0;
}

/**
 * Split a thread string on the `---` separator into individual tweets.
 * Trims leading/trailing whitespace on each segment; drops empty segments.
 * Used by Twitter and Threads composers.
 */
export function splitThread(text: string): string[] {
  if (!text) {return [];}
  return text
    .split(/\n?-{3,}\n?/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
