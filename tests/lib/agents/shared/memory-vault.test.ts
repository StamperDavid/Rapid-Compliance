/**
 * MemoryVault Unit Tests
 *
 * Tests for the cross-agent shared memory store with Firestore persistence.
 * Covers: singleton lifecycle, hydration, async read/query, sync write,
 * TTL cleanup, and date serialization.
 */

 

// ---------------------------------------------------------------------------
// Mocks — must use jest.fn() inside factory to avoid hoisting issues
// ---------------------------------------------------------------------------

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn(() => ({ set: mockSet, delete: mockDeleteDoc }));
const mockGet = jest.fn().mockResolvedValue({ docs: [] });
const mockCollectionFn = jest.fn(() => ({ doc: mockDoc, get: mockGet }));

jest.mock('@/lib/firebase/admin', () => {
  return {
    __esModule: true,
    get adminDb() {
      return { collection: mockCollectionFn };
    },
  };
});

jest.mock('@/lib/firebase/collections', () => ({
  __esModule: true,
  getSubCollection: jest.fn((sub: string) => `organizations/rapid-compliance-root/${sub}`),
  getOrgSubCollection: jest.fn((sub: string) => `organizations/rapid-compliance-root/${sub}`),
}));

jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { MemoryVault, getMemoryVault, type MemoryEntry, type MemoryCategory, type MemoryPriority } from '@/lib/agents/shared/memory-vault';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFirestoreDoc(overrides: Partial<MemoryEntry> = {}): { data: () => Record<string, unknown> } {
  const now = new Date().toISOString();
  return {
    data: () => ({
      id: 'mem_test_001',
      category: 'INSIGHT' as MemoryCategory,
      key: 'test_key',
      value: { type: 'MARKET', title: 'Test', summary: 'Test insight', confidence: 80, sources: [], relatedAgents: [], actionable: false },
      createdBy: 'TEST_AGENT',
      createdAt: now,
      updatedAt: now,
      priority: 'MEDIUM' as MemoryPriority,
      tags: ['MARKET'],
      metadata: {},
      version: 1,
      accessCount: 0,
      ...overrides,
    }),
  };
}

function getVault(): MemoryVault {
  return MemoryVault.getInstance();
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('MemoryVault', () => {
  beforeEach(() => {
    MemoryVault.resetInstance();
    jest.clearAllMocks();
    // Default: hydration returns empty collection
    mockGet.mockResolvedValue({ docs: [] });
  });

  // =========================================================================
  // Singleton
  // =========================================================================

  describe('Singleton', () => {
    it('should return the same instance on repeated calls', () => {
      const a = MemoryVault.getInstance();
      const b = MemoryVault.getInstance();
      expect(a).toBe(b);
    });

    it('should return a fresh instance after resetInstance()', () => {
      const a = MemoryVault.getInstance();
      MemoryVault.resetInstance();
      const b = MemoryVault.getInstance();
      expect(a).not.toBe(b);
    });

    it('getMemoryVault() helper should return the singleton', () => {
      const instance = getMemoryVault();
      expect(instance).toBe(MemoryVault.getInstance());
    });
  });

  // =========================================================================
  // Hydration
  // =========================================================================

  describe('Hydration', () => {
    it('should load Firestore docs into the store on hydration', async () => {
      const doc = createMockFirestoreDoc({ key: 'hydration_test' });
      mockGet.mockResolvedValue({ docs: [doc] });

      const vault = getVault();
      await vault.ensureHydrated();

      const entry = await vault.read('INSIGHT', 'hydration_test', 'READER');
      expect(entry).not.toBeNull();
      expect(entry!.key).toBe('hydration_test');
    });

    it('should not overwrite pre-existing in-memory entries during hydration', async () => {
      // Simulate a slow hydration by deferring the mock
      let resolveGet!: (value: { docs: Array<{ data: () => Record<string, unknown> }> }) => void;
      mockGet.mockReturnValue(new Promise(resolve => { resolveGet = resolve; }));

      const vault = getVault();

      // Write before hydration completes
      vault.write('INSIGHT', 'pre_hydration_key', { fresh: true }, 'WRITER');

      // Now resolve hydration with a stale version of the same key
      const staleDoc = createMockFirestoreDoc({ key: 'pre_hydration_key' });
      resolveGet({ docs: [staleDoc] });

      await vault.ensureHydrated();

      const entry = await vault.read('INSIGHT', 'pre_hydration_key', 'READER');
      expect(entry).not.toBeNull();
      // The in-memory write should win over the Firestore hydration
      expect((entry!.value as Record<string, unknown>).fresh).toBe(true);
    });

    it('should handle hydration failure gracefully (in-memory fallback)', async () => {
      mockGet.mockRejectedValue(new Error('Firestore unavailable'));

      const vault = getVault();
      await vault.ensureHydrated();

      // Vault should still work in-memory
      vault.write('SIGNAL', 'fallback_key', { test: true }, 'AGENT');
      const entry = await vault.read('SIGNAL', 'fallback_key', 'AGENT');
      expect(entry).not.toBeNull();
    });

    it('should ensureHydrated() resolve multiple times without restarting', async () => {
      const vault = getVault();
      await vault.ensureHydrated();
      await vault.ensureHydrated(); // second call should be instant no-op
      // Firestore get() should only be called once
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Async Read
  // =========================================================================

  describe('read()', () => {
    it('should return null for a non-existent key', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      const entry = await vault.read('INSIGHT', 'nonexistent', 'AGENT');
      expect(entry).toBeNull();
    });

    it('should return the entry for an existing key', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      vault.write('PROFILE', 'existing_key', { name: 'Test' }, 'WRITER');
      const entry = await vault.read('PROFILE', 'existing_key', 'READER');

      expect(entry).not.toBeNull();
      expect(entry!.category).toBe('PROFILE');
      expect(entry!.key).toBe('existing_key');
      expect((entry!.value as Record<string, unknown>).name).toBe('Test');
    });

    it('should filter out expired entries', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      // Write an entry with an already-expired TTL
      vault.write('WORKFLOW', 'expired_key', { data: 'old' }, 'AGENT', { ttlMs: -1000 });

      const entry = await vault.read('WORKFLOW', 'expired_key', 'AGENT');
      expect(entry).toBeNull();
    });

    it('should increment accessCount on read', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      vault.write('CONTEXT', 'access_track', { x: 1 }, 'WRITER');

      await vault.read('CONTEXT', 'access_track', 'READER_A');
      await vault.read('CONTEXT', 'access_track', 'READER_B');
      const entry = await vault.read('CONTEXT', 'access_track', 'READER_C');

      expect(entry!.accessCount).toBe(3);
      expect(entry!.lastAccessedBy).toBe('READER_C');
    });
  });

  // =========================================================================
  // Async Query
  // =========================================================================

  describe('query()', () => {
    it('should filter by category', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      vault.write('INSIGHT', 'i1', { a: 1 }, 'A');
      vault.write('SIGNAL', 's1', { b: 2 }, 'B');
      vault.write('INSIGHT', 'i2', { c: 3 }, 'C');

      const results = await vault.query('Q', { category: 'INSIGHT' });
      expect(results).toHaveLength(2);
      expect(results.every(e => e.category === 'INSIGHT')).toBe(true);
    });

    it('should filter by tags', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      vault.write('STRATEGY', 'st1', {}, 'A', { tags: ['alpha', 'beta'] });
      vault.write('STRATEGY', 'st2', {}, 'A', { tags: ['gamma'] });

      const results = await vault.query('Q', { category: 'STRATEGY', tags: ['alpha'] });
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('st1');
    });

    it('should sort by priority descending', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      vault.write('SIGNAL', 'low', {}, 'A', { priority: 'LOW' });
      vault.write('SIGNAL', 'critical', {}, 'A', { priority: 'CRITICAL' });
      vault.write('SIGNAL', 'medium', {}, 'A', { priority: 'MEDIUM' });

      const results = await vault.query('Q', { category: 'SIGNAL', sortBy: 'priority', sortOrder: 'desc' });
      expect(results[0].key).toBe('critical');
      expect(results[results.length - 1].key).toBe('low');
    });

    it('should apply limit and offset', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      for (let i = 0; i < 5; i++) {
        vault.write('PERFORMANCE', `perf_${i}`, { i }, 'A');
      }

      const results = await vault.query('Q', { category: 'PERFORMANCE', limit: 2, offset: 1, sortBy: 'createdAt', sortOrder: 'asc' });
      expect(results).toHaveLength(2);
    });
  });

  // =========================================================================
  // Synchronous Write
  // =========================================================================

  describe('write()', () => {
    it('should create a new entry with version 1', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      const entry = vault.write('CONTENT', 'new_entry', { body: 'hello' }, 'WRITER');

      expect(entry.version).toBe(1);
      expect(entry.category).toBe('CONTENT');
      expect(entry.key).toBe('new_entry');
      expect(entry.createdBy).toBe('WRITER');
    });

    it('should increment version on update', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      vault.write('CONTENT', 'versioned', { v: 1 }, 'A');
      const updated = vault.write('CONTENT', 'versioned', { v: 2 }, 'A');

      expect(updated.version).toBe(2);
    });

    it('should persist to Firestore on write', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      vault.write('INSIGHT', 'persist_test', { data: true }, 'AGENT');

      // set() should have been called (fire-and-forget)
      expect(mockSet).toHaveBeenCalled();
    });

    it('should work before hydration completes', () => {
      // Delay hydration indefinitely
      mockGet.mockReturnValue(new Promise(() => { /* never resolves */ }));

      const vault = getVault();
      // write() is synchronous — should not block
      const entry = vault.write('WORKFLOW', 'pre_hydration', { fast: true }, 'AGENT');
      expect(entry.key).toBe('pre_hydration');
    });

    it('should set expiresAt when ttlMs is provided', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      const before = Date.now();
      const entry = vault.write('CONTEXT', 'ttl_entry', {}, 'A', { ttlMs: 60_000 });
      const after = Date.now();

      expect(entry.expiresAt).toBeDefined();
      const expiresMs = entry.expiresAt!.getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 60_000);
      expect(expiresMs).toBeLessThanOrEqual(after + 60_000);
    });
  });

  // =========================================================================
  // TTL Cleanup
  // =========================================================================

  describe('cleanExpired()', () => {
    it('should remove expired entries from the Map and Firestore', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      // Write an expired entry (TTL in the past)
      vault.write('WORKFLOW', 'dead_entry', {}, 'A', { ttlMs: -5000 });
      vault.write('WORKFLOW', 'alive_entry', {}, 'A');

      const cleaned = await vault.cleanExpired();
      expect(cleaned).toBe(1);

      // Firestore delete should have been called for the expired entry
      expect(mockDeleteDoc).toHaveBeenCalled();

      // Alive entry should still be readable
      const alive = await vault.read('WORKFLOW', 'alive_entry', 'A');
      expect(alive).not.toBeNull();

      // Expired entry should be gone
      const dead = await vault.read('WORKFLOW', 'dead_entry', 'A');
      expect(dead).toBeNull();
    });

    it('should return 0 when no entries are expired', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      vault.write('CONTEXT', 'fresh', {}, 'A');
      const cleaned = await vault.cleanExpired();
      expect(cleaned).toBe(0);
    });
  });

  // =========================================================================
  // Stats
  // =========================================================================

  describe('getStats()', () => {
    it('should return accurate category counts', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      vault.write('INSIGHT', 'i1', {}, 'A');
      vault.write('INSIGHT', 'i2', {}, 'A');
      vault.write('SIGNAL', 's1', {}, 'A');

      const stats = await vault.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.byCategory.INSIGHT).toBe(2);
      expect(stats.byCategory.SIGNAL).toBe(1);
      expect(stats.byCategory.CONTENT).toBe(0);
    });
  });

  // =========================================================================
  // Serialization Roundtrip
  // =========================================================================

  describe('Date serialization', () => {
    it('should revive ISO date strings from Firestore into Date objects', async () => {
      const testDate = '2026-02-01T12:00:00.000Z';
      const doc = createMockFirestoreDoc({
        key: 'date_test',
        createdAt: testDate as unknown as Date,
        updatedAt: testDate as unknown as Date,
      });
      mockGet.mockResolvedValue({ docs: [doc] });

      const vault = getVault();
      await vault.ensureHydrated();

      const entry = await vault.read('INSIGHT', 'date_test', 'AGENT');
      expect(entry).not.toBeNull();
      expect(entry!.createdAt).toBeInstanceOf(Date);
      expect(entry!.updatedAt).toBeInstanceOf(Date);
      expect(entry!.createdAt.toISOString()).toBe(testDate);
    });

    it('should handle Firestore Timestamp objects', async () => {
      const jsDate = new Date('2026-01-15T08:30:00.000Z');
      const mockTimestamp = { toDate: () => jsDate };
      const doc = {
        data: () => ({
          id: 'mem_ts',
          category: 'SIGNAL',
          key: 'timestamp_test',
          value: { signalType: 'TEST', urgency: 'LOW', source: 'A', affectedAgents: [], payload: {}, acknowledged: false },
          createdBy: 'A',
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          priority: 'LOW',
          tags: [],
          metadata: {},
          version: 1,
          accessCount: 0,
        }),
      };
      mockGet.mockResolvedValue({ docs: [doc] });

      const vault = getVault();
      await vault.ensureHydrated();

      const entry = await vault.read('SIGNAL', 'timestamp_test', 'AGENT');
      expect(entry).not.toBeNull();
      expect(entry!.createdAt).toBeInstanceOf(Date);
      expect(entry!.createdAt.getTime()).toBe(jsDate.getTime());
    });
  });

  // =========================================================================
  // Subscriptions
  // =========================================================================

  describe('Subscriptions', () => {
    it('should notify subscribers on write', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      const received: MemoryEntry[] = [];
      vault.subscribe('test-sub', (entry) => received.push(entry), { category: 'INSIGHT' });

      vault.write('INSIGHT', 'sub_test', { data: 1 }, 'WRITER');
      vault.write('SIGNAL', 'other', { data: 2 }, 'WRITER'); // should not trigger

      expect(received).toHaveLength(1);
      expect(received[0].key).toBe('sub_test');
    });

    it('should unsubscribe correctly', async () => {
      const vault = getVault();
      await vault.ensureHydrated();

      const received: MemoryEntry[] = [];
      const unsub = vault.subscribe('test-sub', (entry) => received.push(entry));

      vault.write('INSIGHT', 'before', {}, 'A');
      unsub();
      vault.write('INSIGHT', 'after', {}, 'A');

      expect(received).toHaveLength(1);
      expect(received[0].key).toBe('before');
    });
  });
});
