/**
 * parseSuggestionSlot
 *
 * Converts one AI-generated "optimal posting time" suggestion into one or more
 * structured TimeSlot values that the autonomous-posting-agent scheduler can
 * consume directly.
 *
 * AI suggestion shape (from PlatformInsightsPanel / generatePlatformInsights):
 *   { dayOfWeek: string, timeWindow: string, reasoning: string }
 *
 * TimeSlot shape (from @/types/social):
 *   { dayOfWeek: number (0=Sun … 6=Sat), hour: number, minute: number, platforms: SocialPlatform[] }
 *
 * Ambiguity rules documented inline. The key design decision is to expand
 * ranges into multiple slots rather than silently drop information.
 */

import type { SocialPlatform, TimeSlot } from '@/types/social';

// ---------------------------------------------------------------------------
// Day-of-week parsing
// ---------------------------------------------------------------------------

/**
 * Map every token we might see in the AI's dayOfWeek string to a JS day number
 * (0 = Sunday … 6 = Saturday). Lower-case keys, partial prefix matching below.
 */
const DAY_TOKENS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/**
 * Parse a single day name into a day number (0-6), or return null on failure.
 * Accepts full names ("Tuesday"), three-letter abbreviations ("Tue"),
 * and mixed-case input.
 */
function parseSingleDay(token: string): number | null {
  const key = token.trim().toLowerCase();
  // Exact match first
  if (key in DAY_TOKENS) { return DAY_TOKENS[key]; }
  // Prefix match (e.g. "Tues" → "tue")
  const prefix = key.slice(0, 3);
  if (prefix in DAY_TOKENS) { return DAY_TOKENS[prefix]; }
  return null;
}

/**
 * Parse the AI's dayOfWeek string into one or more day numbers.
 *
 * Handles:
 *   "Tuesday"          → [2]
 *   "Tue-Thu"          → [2, 3, 4]  (inclusive day range)
 *   "Mon, Wed, Fri"    → [1, 3, 5]  (comma-separated list)
 *   "Weekdays"         → [1, 2, 3, 4, 5]
 *   "Weekends"         → [0, 6]
 *   "Daily" | ""       → [0,1,2,3,4,5,6]  (fall back to all days)
 *
 * AMBIGUITY: "Tue-Thu" is treated as a contiguous range Mon-through-whatever.
 * If the start day is numerically higher than the end (e.g. "Fri-Mon"), we
 * wrap around the week (Fri=5, Sat=6, Sun=0, Mon=1).
 */
export function parseDayOfWeek(raw: string): number[] {
  const input = raw.trim().toLowerCase();

  if (input === 'weekdays' || input === 'weekday') {
    return [1, 2, 3, 4, 5];
  }
  if (input === 'weekends' || input === 'weekend') {
    return [0, 6];
  }
  if (input === 'daily' || input === 'every day' || input === '') {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  // Comma-separated list (may or may not have spaces after commas)
  if (input.includes(',')) {
    const parts = input.split(',').map((p) => p.trim());
    return parts.flatMap((p) => {
      const d = parseSingleDay(p);
      return d !== null ? [d] : [];
    });
  }

  // Hyphen-separated range: "Tue-Thu"
  if (input.includes('-')) {
    const [startRaw, endRaw] = input.split('-').map((p) => p.trim());
    const start = parseSingleDay(startRaw);
    const end = parseSingleDay(endRaw);
    if (start !== null && end !== null) {
      // Build the range, wrapping if end < start (e.g. Fri-Mon)
      const result: number[] = [];
      let day = start;
      while (day !== end) {
        result.push(day);
        day = (day + 1) % 7;
      }
      result.push(end); // include the endpoint
      return result;
    }
    // If either side failed to parse, fall through to single-day attempt
  }

  // Single day
  const single = parseSingleDay(raw.trim());
  if (single !== null) { return [single]; }

  // Last resort: return all weekdays (Mon-Fri) as a conservative default and
  // surface no error — the UI already shows the AI's original text for context.
  return [1, 2, 3, 4, 5];
}

// ---------------------------------------------------------------------------
// Time-window parsing
// ---------------------------------------------------------------------------

/**
 * Parse a time window string into { hour, minute } for a representative
 * mid-point in the window.
 *
 * Handles:
 *   "9-11am ET"      → midpoint of 9am–11am = 10:00
 *   "9:00 AM"        → 9:00
 *   "evening (6-9pm ET)" → midpoint of 18–21 = 19:30
 *   "afternoon"      → 14:00  (named period defaults below)
 *   "morning"        → 9:00
 *   "noon"           → 12:00
 *   "evening"        → 19:00
 *   "night"          → 21:00
 *
 * AMBIGUITY: "9-11am ET" — both bounds are in the same meridian as the
 * trailing "am"/"pm". If no meridian is present on individual numbers we
 * treat the whole window as AM if any number ≤ 12, else PM.
 * Mid-point is computed as floor((start + end) / 2) in 24-hour space.
 * Minutes always land on :00 or :30 (rounded to nearest half-hour).
 */
export function parseTimeWindow(raw: string): { hour: number; minute: number } {
  const input = raw.trim().toLowerCase();

  // Named period shortcuts — checked before numeric parsing
  if (/\bmorning\b/.test(input) && !/\d/.test(input)) { return { hour: 9, minute: 0 }; }
  if (/\bnoon\b/.test(input)) { return { hour: 12, minute: 0 }; }
  if (/\bafternoon\b/.test(input) && !/\d/.test(input)) { return { hour: 14, minute: 0 }; }
  if (/\bevening\b/.test(input) && !/\d/.test(input)) { return { hour: 19, minute: 0 }; }
  if (/\bnight\b/.test(input) && !/\d/.test(input)) { return { hour: 21, minute: 0 }; }

  // Extract all numbers that look like hour references (1-12 or 1-23)
  // Pattern: optional digits for minutes (":30"), optional am/pm
  const timePattern = /(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?/gi;
  const matches = [...input.matchAll(timePattern)];

  if (matches.length === 0) {
    // Completely unparseable — fall back to 9am
    return { hour: 9, minute: 0 };
  }

  // Determine the trailing meridian for the whole string (e.g. "9-11am ET")
  const trailingMeridian = input.match(/(am|pm)/i)?.[1]?.toLowerCase();

  function toHour24(rawHour: number, meridian: string | undefined): number {
    const h = rawHour;
    if (!meridian) {
      // Heuristic: if the value is already > 12, treat as 24-hour; otherwise
      // assume AM if h < 8 (unlikely a morning slot is 1-7pm), else ambiguous.
      return h;
    }
    if (meridian === 'am') { return h === 12 ? 0 : h; }
    return h === 12 ? 12 : h + 12; // pm
  }

  const parsedTimes = matches.map((m) => {
    const rawHour = parseInt(m[1], 10);
    const rawMinute = m[2] ? parseInt(m[2], 10) : 0;
    const meridian = m[3]?.toLowerCase() ?? trailingMeridian;
    const hour24 = toHour24(rawHour, meridian);
    return hour24 * 60 + rawMinute; // store as minutes-since-midnight for easy averaging
  });

  // Mid-point of the range (or single value if only one match)
  const minMinutes = Math.min(...parsedTimes);
  const maxMinutes = Math.max(...parsedTimes);
  const midMinutes = Math.round((minMinutes + maxMinutes) / 2);

  // Round to nearest :00 or :30
  const roundedMinutes = Math.round(midMinutes / 30) * 30;
  const hour = Math.floor(roundedMinutes / 60) % 24;
  const minute = roundedMinutes % 60;

  return { hour, minute };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Convert one AI suggestion into one or more TimeSlot values.
 *
 * @param suggestion - An OptimalPostingTime object from the AI insights response
 * @param platform   - The platform this slot belongs to (written into slot.platforms)
 * @returns           One TimeSlot per expanded day
 *
 * Examples:
 *   { dayOfWeek: 'Tuesday', timeWindow: '9-11am ET' }
 *     → [{ dayOfWeek: 2, hour: 10, minute: 0, platforms: ['twitter'] }]
 *
 *   { dayOfWeek: 'Tue-Thu', timeWindow: 'evening (6-9pm ET)' }
 *     → [
 *         { dayOfWeek: 2, hour: 19, minute: 30, platforms: ['twitter'] },
 *         { dayOfWeek: 3, hour: 19, minute: 30, platforms: ['twitter'] },
 *         { dayOfWeek: 4, hour: 19, minute: 30, platforms: ['twitter'] },
 *       ]
 */
export function parseSuggestionSlot(
  suggestion: { dayOfWeek: string; timeWindow: string },
  platform: SocialPlatform,
): TimeSlot[] {
  const days = parseDayOfWeek(suggestion.dayOfWeek);
  const { hour, minute } = parseTimeWindow(suggestion.timeWindow);

  return days.map((dayOfWeek) => ({
    dayOfWeek,
    hour,
    minute,
    platforms: [platform],
  }));
}

// ---------------------------------------------------------------------------
// Deduplication helper
// ---------------------------------------------------------------------------

/**
 * Merge two TimeSlot arrays, deduplicating by (dayOfWeek, hour, minute, platform).
 * A slot that exists in both `existing` and `incoming` is kept once.
 * The `platforms` arrays within each slot are NOT merged — each slot is a
 * single-platform entry as produced by parseSuggestionSlot.
 */
export function deduplicateSlots(existing: TimeSlot[], incoming: TimeSlot[]): TimeSlot[] {
  const key = (s: TimeSlot): string =>
    `${s.dayOfWeek}:${s.hour}:${s.minute}:${[...s.platforms].sort().join(',')}`;

  const seen = new Set(existing.map(key));
  const added: TimeSlot[] = [];

  for (const slot of incoming) {
    const k = key(slot);
    if (!seen.has(k)) {
      seen.add(k);
      added.push(slot);
    }
  }

  return [...existing, ...added];
}

/**
 * Check whether a given suggestion is already represented in an existing
 * TimeSlot array (for the "Adopted ✓" UI state check).
 *
 * Returns true when every slot produced by parseSuggestionSlot for the
 * suggestion is already present in `existing`.
 */
export function isSuggestionAdopted(
  suggestion: { dayOfWeek: string; timeWindow: string },
  platform: SocialPlatform,
  existing: TimeSlot[],
): boolean {
  const parsed = parseSuggestionSlot(suggestion, platform);
  if (parsed.length === 0) { return false; }

  const key = (s: TimeSlot): string =>
    `${s.dayOfWeek}:${s.hour}:${s.minute}:${[...s.platforms].sort().join(',')}`;

  const existingKeys = new Set(existing.map(key));
  return parsed.every((s) => existingKeys.has(key(s)));
}
