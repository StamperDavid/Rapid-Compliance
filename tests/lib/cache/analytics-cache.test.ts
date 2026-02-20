/**
 * AnalyticsCache Unit Tests
 *
 * Full coverage for:
 *   - AnalyticsCache class (get, set, invalidate, invalidateNamespace,
 *     cleanupExpired, getStats, clear, cache-key isolation by params)
 *   - withCache() wrapper (hit, miss, custom TTL)
 *   - invalidateAnalyticsCache() (deal, order, and full-namespace paths)
 *
 * Timer tests use jest.useFakeTimers() so TTL expiry can be simulated
 * without real sleeping.
 */

// ---------------------------------------------------------------------------
// Mocks — declared before any import so jest.mock() hoisting works correctly
// ---------------------------------------------------------------------------

jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// The module-level setInterval in analytics-cache.ts fires during module
// load.  Fake timers suppress that side-effect for the entire suite.
jest.useFakeTimers();

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  analyticsCache,
  withCache,
  invalidateAnalyticsCache,
} from '@/lib/cache/analytics-cache';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ---------------------------------------------------------------------------
// AnalyticsCache class
// ---------------------------------------------------------------------------

describe('AnalyticsCache', () => {
  // Reset the shared singleton and fake timers before every test so that
  // each test starts from a known-empty state with Date.now() at the same
  // baseline.
  beforeEach(() => {
    jest.useFakeTimers();
    analyticsCache.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // get()
  // =========================================================================

  describe('get()', () => {
    it('returns null for a key that has never been set', () => {
      const result = analyticsCache.get('ns', 'missing-key');
      expect(result).toBeNull();
    });

    it('returns the cached data immediately after set()', () => {
      const payload = { revenue: 42_000 };
      analyticsCache.set('ns', 'revenue', payload);
      const result = analyticsCache.get<{ revenue: number }>('ns', 'revenue');
      expect(result).toEqual(payload);
    });

    it('returns null for an entry whose TTL has elapsed', () => {
      // Store with a very short custom TTL of 1 000 ms
      analyticsCache.set('ns', 'short-ttl', { value: 1 }, undefined, 1_000);

      // Advance fake clock past the TTL
      jest.advanceTimersByTime(1_001);

      const result = analyticsCache.get('ns', 'short-ttl');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // set()
  // =========================================================================

  describe('set()', () => {
    it('stores data that survives a subsequent get() call', () => {
      const data = { pipeline: 'stage-1' };
      analyticsCache.set('org', 'pipeline', data);
      expect(analyticsCache.get('org', 'pipeline')).toEqual(data);
    });

    it('overwrites a previous value for the same key', () => {
      analyticsCache.set('org', 'pipeline', { v: 1 });
      analyticsCache.set('org', 'pipeline', { v: 2 });
      expect(analyticsCache.get<{ v: number }>('org', 'pipeline')).toEqual({ v: 2 });
    });
  });

  // =========================================================================
  // invalidate()
  // =========================================================================

  describe('invalidate()', () => {
    it('removes the specific cache entry', () => {
      analyticsCache.set('ns', 'revenue', { total: 5_000 });
      analyticsCache.invalidate('ns', 'revenue');
      expect(analyticsCache.get('ns', 'revenue')).toBeNull();
    });

    it('leaves other entries in the same namespace untouched', () => {
      analyticsCache.set('ns', 'revenue', { total: 5_000 });
      analyticsCache.set('ns', 'pipeline', { stage: 'A' });

      analyticsCache.invalidate('ns', 'revenue');

      expect(analyticsCache.get('ns', 'revenue')).toBeNull();
      expect(analyticsCache.get('ns', 'pipeline')).toEqual({ stage: 'A' });
    });

    it('does not throw when invalidating a key that does not exist', () => {
      expect(() => analyticsCache.invalidate('ns', 'nonexistent')).not.toThrow();
    });
  });

  // =========================================================================
  // invalidateNamespace()
  // =========================================================================

  describe('invalidateNamespace()', () => {
    it('removes every entry whose key starts with the given namespace', () => {
      analyticsCache.set('alpha', 'revenue', { x: 1 });
      analyticsCache.set('alpha', 'pipeline', { x: 2 });
      analyticsCache.set('beta', 'revenue', { x: 3 }); // different namespace

      analyticsCache.invalidateNamespace('alpha');

      expect(analyticsCache.get('alpha', 'revenue')).toBeNull();
      expect(analyticsCache.get('alpha', 'pipeline')).toBeNull();
      // The beta namespace must remain intact
      expect(analyticsCache.get<{ x: number }>('beta', 'revenue')).toEqual({ x: 3 });
    });

    it('is a no-op when the namespace has no entries', () => {
      expect(() => analyticsCache.invalidateNamespace('empty-ns')).not.toThrow();
    });
  });

  // =========================================================================
  // cleanupExpired()
  // =========================================================================

  describe('cleanupExpired()', () => {
    it('removes expired entries and returns the count of entries removed', () => {
      analyticsCache.set('ns', 'expired-a', { v: 1 }, undefined, 500);
      analyticsCache.set('ns', 'expired-b', { v: 2 }, undefined, 500);
      analyticsCache.set('ns', 'alive', { v: 3 }, undefined, 60_000);

      jest.advanceTimersByTime(501);

      const removed = analyticsCache.cleanupExpired();
      expect(removed).toBe(2);
    });

    it('returns 0 when no entries have expired', () => {
      analyticsCache.set('ns', 'fresh', { v: 1 }, undefined, 60_000);
      const removed = analyticsCache.cleanupExpired();
      expect(removed).toBe(0);
    });

    it('does not remove entries that are still within their TTL', () => {
      analyticsCache.set('ns', 'alive', { v: 1 }, undefined, 60_000);

      jest.advanceTimersByTime(10_000); // advance only 10 s — well within TTL

      analyticsCache.cleanupExpired();
      expect(analyticsCache.get('ns', 'alive')).toEqual({ v: 1 });
    });
  });

  // =========================================================================
  // getStats()
  // =========================================================================

  describe('getStats()', () => {
    it('reports correct totalEntries, validEntries, and expiredEntries', () => {
      analyticsCache.set('ns', 'valid-1', { v: 1 }, undefined, 60_000);
      analyticsCache.set('ns', 'valid-2', { v: 2 }, undefined, 60_000);
      analyticsCache.set('ns', 'expired', { v: 3 }, undefined, 500);

      jest.advanceTimersByTime(501);

      const stats = analyticsCache.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.validEntries).toBe(2);
      expect(stats.expiredEntries).toBe(1);
    });

    it('returns all-zero counts on an empty cache', () => {
      const stats = analyticsCache.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.validEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
    });

    it('includes a numeric memoryUsage field', () => {
      const stats = analyticsCache.getStats();
      expect(typeof stats.memoryUsage).toBe('number');
    });
  });

  // =========================================================================
  // clear()
  // =========================================================================

  describe('clear()', () => {
    it('removes every entry regardless of namespace or TTL', () => {
      analyticsCache.set('ns-a', 'k1', { v: 1 });
      analyticsCache.set('ns-b', 'k2', { v: 2 });
      analyticsCache.set('ns-c', 'k3', { v: 3 });

      analyticsCache.clear();

      const stats = analyticsCache.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('is idempotent — calling clear() on an already-empty cache does not throw', () => {
      expect(() => analyticsCache.clear()).not.toThrow();
    });
  });

  // =========================================================================
  // Cache-key isolation by params
  // =========================================================================

  describe('Cache key includes params', () => {
    it('treats entries with different params as distinct cache slots', () => {
      const paramsA = { period: '7d' };
      const paramsB = { period: '30d' };

      analyticsCache.set('ns', 'revenue', { total: 7_000 }, paramsA);
      analyticsCache.set('ns', 'revenue', { total: 30_000 }, paramsB);

      expect(analyticsCache.get<{ total: number }>('ns', 'revenue', paramsA)).toEqual({ total: 7_000 });
      expect(analyticsCache.get<{ total: number }>('ns', 'revenue', paramsB)).toEqual({ total: 30_000 });
    });

    it('treats an entry with params as distinct from an entry without params', () => {
      analyticsCache.set('ns', 'pipeline', { stage: 'no-params' });
      analyticsCache.set('ns', 'pipeline', { stage: 'with-params' }, { filter: 'hot' });

      expect(analyticsCache.get<{ stage: string }>('ns', 'pipeline')).toEqual({ stage: 'no-params' });
      expect(analyticsCache.get<{ stage: string }>('ns', 'pipeline', { filter: 'hot' })).toEqual({ stage: 'with-params' });
    });

    it('invalidate() with params only removes the matching params slot', () => {
      const paramsA = { period: '7d' };
      const paramsB = { period: '30d' };

      analyticsCache.set('ns', 'revenue', { total: 7_000 }, paramsA);
      analyticsCache.set('ns', 'revenue', { total: 30_000 }, paramsB);

      analyticsCache.invalidate('ns', 'revenue', paramsA);

      expect(analyticsCache.get('ns', 'revenue', paramsA)).toBeNull();
      expect(analyticsCache.get<{ total: number }>('ns', 'revenue', paramsB)).toEqual({ total: 30_000 });
    });
  });
});

// ---------------------------------------------------------------------------
// withCache()
// ---------------------------------------------------------------------------

describe('withCache()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    analyticsCache.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls fetchFn on a cache miss and stores the result', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ revenue: 1_000 });

    const result = await withCache('revenue', fetchFn, { period: '7d' });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ revenue: 1_000 });
  });

  it('returns the cached value on a subsequent call without calling fetchFn again', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ revenue: 1_000 });

    // First call — populates cache
    await withCache('revenue', fetchFn, { period: '7d' });
    // Second call — should hit cache
    const cached = await withCache('revenue', fetchFn, { period: '7d' });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(cached).toEqual({ revenue: 1_000 });
  });

  it('fetches again after the TTL has expired', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ revenue: 1_000 });
    const shortTTL = 1_000; // 1 second

    await withCache('revenue', fetchFn, { period: '7d' }, shortTTL);
    jest.advanceTimersByTime(shortTTL + 1);

    // After expiry, withCache must call fetchFn again
    await withCache('revenue', fetchFn, { period: '7d' }, shortTTL);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('respects a custom TTL — stores result with that TTL instead of the default', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ revenue: 2_000 });
    const customTTL = 30_000;

    await withCache('revenue', fetchFn, { period: '30d' }, customTTL);

    // Advance partway through the custom TTL — entry must still be alive
    jest.advanceTimersByTime(customTTL - 1);
    const hit = await withCache('revenue', fetchFn, { period: '30d' }, customTTL);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(hit).toEqual({ revenue: 2_000 });
  });

  it('treats calls with different params as different cache entries', async () => {
    const fetchFn7d = jest.fn().mockResolvedValue({ revenue: 7_000 });
    const fetchFn30d = jest.fn().mockResolvedValue({ revenue: 30_000 });

    await withCache('revenue', fetchFn7d, { period: '7d' });
    await withCache('revenue', fetchFn30d, { period: '30d' });

    // Both fetch functions must have been called exactly once each
    expect(fetchFn7d).toHaveBeenCalledTimes(1);
    expect(fetchFn30d).toHaveBeenCalledTimes(1);
  });

  it('uses PLATFORM_ID as the namespace so the cached entry is readable via analyticsCache.get()', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ pipeline: 'data' });
    const params = { stage: 'proposal' };

    await withCache('pipeline', fetchFn, params);

    const stored = analyticsCache.get<{ pipeline: string }>(PLATFORM_ID, 'pipeline', params);
    expect(stored).toEqual({ pipeline: 'data' });
  });
});

// ---------------------------------------------------------------------------
// invalidateAnalyticsCache()
// ---------------------------------------------------------------------------

describe('invalidateAnalyticsCache()', () => {
  // Seed helper: populate a set of query-type keys in the PLATFORM_ID namespace
  // so we can assert which ones survive invalidation.
  function seedKeys(queryTypes: string[]): void {
    for (const qt of queryTypes) {
      analyticsCache.set(PLATFORM_ID, qt, { seeded: true });
    }
  }

  beforeEach(() => {
    jest.useFakeTimers();
    analyticsCache.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('with dataType "deal" — invalidates pipeline, winloss, and forecast', () => {
    seedKeys(['pipeline', 'winloss', 'forecast', 'revenue', 'ecommerce']);

    invalidateAnalyticsCache('deal');

    expect(analyticsCache.get(PLATFORM_ID, 'pipeline')).toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'winloss')).toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'forecast')).toBeNull();

    // Unrelated keys must remain
    expect(analyticsCache.get(PLATFORM_ID, 'revenue')).not.toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'ecommerce')).not.toBeNull();
  });

  it('with dataType "order" — invalidates revenue and ecommerce', () => {
    seedKeys(['revenue', 'ecommerce', 'pipeline', 'winloss']);

    invalidateAnalyticsCache('order');

    expect(analyticsCache.get(PLATFORM_ID, 'revenue')).toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'ecommerce')).toBeNull();

    // Unrelated keys must remain
    expect(analyticsCache.get(PLATFORM_ID, 'pipeline')).not.toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'winloss')).not.toBeNull();
  });

  it('with dataType "lead" — invalidates leadScoring only', () => {
    seedKeys(['leadScoring', 'pipeline', 'revenue']);

    invalidateAnalyticsCache('lead');

    expect(analyticsCache.get(PLATFORM_ID, 'leadScoring')).toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'pipeline')).not.toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'revenue')).not.toBeNull();
  });

  it('with dataType "workflow" — invalidates workflows only', () => {
    seedKeys(['workflows', 'revenue', 'pipeline']);

    invalidateAnalyticsCache('workflow');

    expect(analyticsCache.get(PLATFORM_ID, 'workflows')).toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'revenue')).not.toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'pipeline')).not.toBeNull();
  });

  it('with an unknown dataType — invalidates nothing (graceful no-op)', () => {
    seedKeys(['revenue', 'pipeline']);

    invalidateAnalyticsCache('unknown-type');

    expect(analyticsCache.get(PLATFORM_ID, 'revenue')).not.toBeNull();
    expect(analyticsCache.get(PLATFORM_ID, 'pipeline')).not.toBeNull();
  });

  it('with no dataType — invalidates the entire PLATFORM_ID namespace', () => {
    seedKeys(['pipeline', 'winloss', 'forecast', 'revenue', 'ecommerce', 'leadScoring', 'workflows']);

    invalidateAnalyticsCache();

    const stats = analyticsCache.getStats();
    // Every key in the PLATFORM_ID namespace must now be gone
    expect(stats.totalEntries).toBe(0);
  });

  it('with no dataType — leaves entries in other namespaces intact', () => {
    analyticsCache.set('other-ns', 'custom-key', { unrelated: true });
    seedKeys(['revenue']);

    invalidateAnalyticsCache();

    // The other namespace entry must survive
    expect(analyticsCache.get<{ unrelated: boolean }>('other-ns', 'custom-key')).toEqual({ unrelated: true });
    // The PLATFORM_ID namespace entry must be gone
    expect(analyticsCache.get(PLATFORM_ID, 'revenue')).toBeNull();
  });
});
