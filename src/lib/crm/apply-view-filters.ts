/**
 * apply-view-filters — the shared, server-side filtering engine for Saved Views.
 *
 * Takes a plain array of records (already fetched from Firestore by a list
 * route) plus a set of FilterConditions and a match mode, and returns the
 * subset of records that satisfy the conditions. This runs INSIDE the list
 * route handlers (contacts / companies / deals / leads) — it deliberately
 * pulls in no Firestore / Admin SDK so it stays a pure, easily-tested function.
 *
 * Comparisons are intentionally forgiving for a non-technical audience:
 *  - numbers and numeric strings compare numerically,
 *  - dates (ISO strings / timestamps parseable by Date.parse) compare chronologically,
 *  - everything else falls back to case-insensitive string comparison.
 */

import type { FilterCondition, MatchMode } from '@/types/saved-view';

/**
 * Max number of records a list route fetches when a view/filter is active.
 * Filtering happens in-process after this fetch, so this is the ceiling on how
 * many rows a single filtered view can consider. Kept sane to bound memory.
 */
export const FILTER_FETCH_CAP = 1000;

/** Read a (possibly nested, dot-pathed) field off a record. */
function getFieldValue(record: Record<string, unknown>, field: string): unknown {
  if (!field.includes('.')) {
    return record[field];
  }
  let current: unknown = record;
  for (const key of field.split('.')) {
    if (current !== null && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
  }
  return false;
}

/** Forgiving equality: boolean-aware, numeric-aware, else case-insensitive string. */
function looseEquals(a: unknown, b: unknown): boolean {
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return toBoolean(a) === toBoolean(b);
  }
  const an = toNumber(a);
  const bn = toNumber(b);
  if (an !== null && bn !== null) {
    return an === bn;
  }
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

/** Ordered comparison for gt/gte/lt/lte. Returns a sign-like number. */
function compareValues(a: unknown, b: unknown): number {
  const an = toNumber(a);
  const bn = toNumber(b);
  if (an !== null && bn !== null) {
    return an - bn;
  }
  const ad = Date.parse(String(a));
  const bd = Date.parse(String(b));
  if (!Number.isNaN(ad) && !Number.isNaN(bd)) {
    return ad - bd;
  }
  const as = String(a ?? '');
  const bs = String(b ?? '');
  if (as < bs) { return -1; }
  if (as > bs) { return 1; }
  return 0;
}

function matchesCondition(record: Record<string, unknown>, condition: FilterCondition): boolean {
  const fieldValue = getFieldValue(record, condition.field);
  const target = condition.value;

  switch (condition.operator) {
    case 'exists':
      return !isEmpty(fieldValue);
    case 'not_exists':
      return isEmpty(fieldValue);
    case 'eq':
      return looseEquals(fieldValue, target);
    case 'neq':
      return !looseEquals(fieldValue, target);
    case 'contains': {
      const needle = String(target ?? '').toLowerCase();
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(
          (item) =>
            looseEquals(item, target) || String(item).toLowerCase().includes(needle)
        );
      }
      return String(fieldValue ?? '').toLowerCase().includes(needle);
    }
    case 'in': {
      const targets = Array.isArray(target)
        ? target
        : target === undefined
          ? []
          : [target];
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((item) => targets.some((t) => looseEquals(item, t)));
      }
      return targets.some((t) => looseEquals(fieldValue, t));
    }
    case 'gt':
      return compareValues(fieldValue, target) > 0;
    case 'gte':
      return compareValues(fieldValue, target) >= 0;
    case 'lt':
      return compareValues(fieldValue, target) < 0;
    case 'lte':
      return compareValues(fieldValue, target) <= 0;
    default:
      return false;
  }
}

/**
 * Filter a record array against a set of conditions.
 * `match === 'all'` requires every condition to pass; `'any'` requires one.
 * An empty condition list is a no-op (returns a copy of the input).
 */
export function applyViewFilters<T>(
  records: readonly T[],
  filters: readonly FilterCondition[],
  match: MatchMode
): T[] {
  if (filters.length === 0) {
    return [...records];
  }
  return records.filter((record) => {
    const rec = record as unknown as Record<string, unknown>;
    const results = filters.map((condition) => matchesCondition(rec, condition));
    return match === 'any' ? results.some(Boolean) : results.every(Boolean);
  });
}
