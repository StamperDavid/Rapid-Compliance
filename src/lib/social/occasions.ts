/**
 * Curated marketing occasions / holidays.
 *
 * A static, hand-curated list of recurring marketing-relevant occasions used by
 * the composer's one-click "themed post" control. Each entry stores a
 * month/day (recurs every year) rather than a fixed year, so the list never
 * goes stale — `getUpcomingOccasions` computes the next occurrence relative to
 * the current date and returns the soonest few.
 *
 * This is intentionally a pure data module (no server imports) so both the
 * client composer and the server-side occasion-post service can import it.
 *
 * NOTE: This is a curated starter list, not an exhaustive holiday feed. Adding
 * a live holiday API is a future enhancement; the curated approach keeps the
 * feature dependency-free and predictable.
 *
 * @module lib/social/occasions
 */

export interface Occasion {
  /** Stable id (slug). */
  id: string;
  /** Display name, e.g. "Black Friday". */
  name: string;
  /** Month, 1-12. */
  month: number;
  /** Day of month, 1-31. */
  day: number;
}

export interface UpcomingOccasion extends Occasion {
  /** Next occurrence as an ISO date string (YYYY-MM-DD), local-agnostic. */
  nextDateIso: string;
  /** Whole days from `now` until the next occurrence (0 = today). */
  daysAway: number;
}

/**
 * Curated recurring occasions, sorted only for readability. Order doesn't
 * matter — `getUpcomingOccasions` re-sorts by next date.
 */
export const CURATED_OCCASIONS: readonly Occasion[] = [
  { id: 'new-years-day', name: "New Year's Day", month: 1, day: 1 },
  { id: 'valentines-day', name: "Valentine's Day", month: 2, day: 14 },
  { id: 'international-womens-day', name: "International Women's Day", month: 3, day: 8 },
  { id: 'st-patricks-day', name: "St. Patrick's Day", month: 3, day: 17 },
  { id: 'earth-day', name: 'Earth Day', month: 4, day: 22 },
  { id: 'world-environment-day', name: 'World Environment Day', month: 6, day: 5 },
  { id: 'independence-day-us', name: 'Independence Day (US)', month: 7, day: 4 },
  { id: 'international-friendship-day', name: 'International Friendship Day', month: 7, day: 30 },
  { id: 'labor-day-intl', name: 'Labor Day', month: 9, day: 1 },
  { id: 'world-mental-health-day', name: 'World Mental Health Day', month: 10, day: 10 },
  { id: 'halloween', name: 'Halloween', month: 10, day: 31 },
  { id: 'small-business-saturday', name: 'Small Business Saturday', month: 11, day: 29 },
  { id: 'black-friday', name: 'Black Friday', month: 11, day: 28 },
  { id: 'cyber-monday', name: 'Cyber Monday', month: 12, day: 1 },
  { id: 'giving-tuesday', name: 'Giving Tuesday', month: 12, day: 2 },
  { id: 'christmas', name: 'Christmas', month: 12, day: 25 },
  { id: 'new-years-eve', name: "New Year's Eve", month: 12, day: 31 },
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Compute the soonest upcoming occurrence of each curated occasion (this year
 * if still ahead, otherwise next year), sort by date, and return the first
 * `limit`. Pure + deterministic given `now`.
 */
export function getUpcomingOccasions(now: Date = new Date(), limit = 8): UpcomingOccasion[] {
  // Work in UTC-date terms to avoid TZ drift on the day boundary.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const year = today.getUTCFullYear();

  const computed: UpcomingOccasion[] = CURATED_OCCASIONS.map((occ) => {
    let occurrence = new Date(Date.UTC(year, occ.month - 1, occ.day));
    if (occurrence.getTime() < today.getTime()) {
      occurrence = new Date(Date.UTC(year + 1, occ.month - 1, occ.day));
    }
    const daysAway = Math.round(
      (occurrence.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    const nextDateIso = `${occurrence.getUTCFullYear()}-${pad2(occ.month)}-${pad2(occ.day)}`;
    return { ...occ, nextDateIso, daysAway };
  });

  computed.sort((a, b) => a.daysAway - b.daysAway);
  return computed.slice(0, Math.max(1, limit));
}

/** Look up a curated occasion by its id. */
export function findOccasionById(id: string): Occasion | undefined {
  return CURATED_OCCASIONS.find((o) => o.id === id);
}
