/**
 * Shared helpers for the platform PostPreview components.
 * Pure functions only — no React, no DOM, no side effects.
 *
 * These helpers are reused by every PostPreview variant (Twitter, LinkedIn,
 * Facebook, Instagram, plus the Batch B / Batch C platforms). Keep them
 * presentation-agnostic.
 */

/**
 * Convert an ISO timestamp (or Date) into a short relative string suitable
 * for a social-media post header.
 *
 * Rules:
 *   - < 60s        → "now"
 *   - < 60m        → "{n}m"
 *   - < 24h        → "{n}h"
 *   - < 7d         → "{n}d"
 *   - same year    → "Mar 15"
 *   - older        → "Mar 15, 2024"
 *
 * Invalid / empty input returns an empty string so the caller can collapse
 * the slot rather than render "Invalid Date".
 */
export function formatRelativeTime(input: string | Date | null | undefined): string {
  if (!input) {return '';}
  const date = input instanceof Date ? input : new Date(input);
  const ms = date.getTime();
  if (Number.isNaN(ms)) {return '';}

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - ms) / 1000));

  if (diffSec < 60) {return 'now';}
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {return `${diffMin}m`;}
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {return `${diffHr}h`;}
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) {return `${diffDay}d`;}

  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const monthShort = date.toLocaleString('en-US', { month: 'short' });
  if (sameYear) {return `${monthShort} ${date.getDate()}`;}
  return `${monthShort} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Twitter-style abbreviated count: 999, 1.2K, 5.3M, 2.1B.
 *
 *   - n < 1_000     → exact integer
 *   - n < 1_000_000 → "{x.x}K" with one decimal, trimmed when .0
 *   - n < 1e9       → "{x.x}M"
 *   - else          → "{x.x}B"
 *
 * Negative or non-finite values return "0" for safety — counts can't be
 * negative in a UI sense.
 */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n < 0) {return '0';}
  if (n < 1_000) {return String(Math.floor(n));}

  const abbreviate = (value: number, suffix: string): string => {
    const rounded = Math.floor(value * 10) / 10;
    const str = rounded % 1 === 0 ? String(Math.floor(rounded)) : rounded.toFixed(1);
    return `${str}${suffix}`;
  };

  if (n < 1_000_000) {return abbreviate(n / 1_000, 'K');}
  if (n < 1_000_000_000) {return abbreviate(n / 1_000_000, 'M');}
  return abbreviate(n / 1_000_000_000, 'B');
}

/**
 * First character of the input, uppercased. Falls back to "?" when input
 * is empty / nullish so avatar circles never render blank.
 */
export function getInitial(s?: string | null): string {
  if (!s) {return '?';}
  const trimmed = s.trim();
  if (trimmed.length === 0) {return '?';}
  return trimmed.charAt(0).toUpperCase();
}
