/**
 * Deal Service Tests
 * Integration tests for deal service layer
 */

// ---------------------------------------------------------------------------
// In-memory FirestoreService mock — all state lives inside the factory closure
// so it is available when jest.mock is hoisted.
// ---------------------------------------------------------------------------
jest.mock('@/lib/db/firestore-service', () => {
  const store = new Map<string, Record<string, unknown>>();

  function getCollectionDocs(collectionPath: string) {
    const docs: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const [key, value] of store.entries()) {
      if (key.startsWith(`${collectionPath}/`)) {
        const id = key.slice(collectionPath.length + 1);
        docs.push({ id, data: value });
      }
    }
    return docs;
  }

  const FirestoreService = {
    get: jest.fn().mockImplementation((collectionPath: string, docId: string) => {
      const data = store.get(`${collectionPath}/${docId}`);
      return Promise.resolve(data ? { ...data } : null);
    }),
    getAll: jest.fn().mockImplementation((collectionPath: string) => {
      return Promise.resolve(getCollectionDocs(collectionPath).map(d => ({ id: d.id, ...d.data })));
    }),
    getAllPaginated: jest.fn().mockImplementation((
      collectionPath: string,
      constraints: Array<{ type?: string; _field?: string; _op?: string; _value?: unknown }> = [],
      pageSize: number = 50,
      lastDoc?: { id: string }
    ) => {
      // Extract where filters from firebase/firestore QueryConstraint objects
      // They expose their internals via _field, _op, _value
      const filters = constraints.filter(c => c._field !== undefined);
      let docs = getCollectionDocs(collectionPath);

      // Apply where filters
      for (const f of filters) {
        docs = docs.filter(d => {
          const v = d.data[f._field!];
          const op = f._op;
          const val = f._value;
          if (op === '==') { return v === val; }
          if (op === '!=') { return v !== val; }
          if (op === '>') { return (v as string) > (val as string); }
          if (op === '>=') { return (v as string) >= (val as string); }
          if (op === '<') { return (v as string) < (val as string); }
          if (op === '<=') { return (v as string) <= (val as string); }
          if (op === 'in') { return Array.isArray(val) && val.includes(v); }
          return true;
        });
      }

      // Apply pagination cursor
      if (lastDoc) {
        const idx = docs.findIndex(d => d.id === lastDoc.id);
        if (idx >= 0) { docs = docs.slice(idx + 1); }
      }

      const hasMore = docs.length > pageSize;
      const page = docs.slice(0, pageSize);
      const newLastDoc = page.length > 0 ? { id: page[page.length - 1].id } : null;
      return Promise.resolve({
        data: page.map(d => ({ id: d.id, ...d.data })),
        lastDoc: newLastDoc,
        hasMore,
      });
    }),
    set: jest.fn().mockImplementation((collectionPath: string, docId: string, data: Record<string, unknown>, merge: boolean = true) => {
      const key = `${collectionPath}/${docId}`;
      const existing = merge ? (store.get(key) ?? {}) : {};
      store.set(key, { ...existing, ...data, id: docId });
      return Promise.resolve();
    }),
    update: jest.fn().mockImplementation((collectionPath: string, docId: string, data: Record<string, unknown>) => {
      const key = `${collectionPath}/${docId}`;
      const existing = store.get(key) ?? {};
      store.set(key, { ...existing, ...data });
      return Promise.resolve();
    }),
    delete: jest.fn().mockImplementation((collectionPath: string, docId: string) => {
      store.delete(`${collectionPath}/${docId}`);
      return Promise.resolve();
    }),
    subscribe: jest.fn().mockReturnValue(() => {}),
  };

  return {
    FirestoreService,
    COLLECTIONS: {
      ORGANIZATIONS: 'organizations',
      USERS: 'users',
      LEADS: 'leads',
      DEALS: 'deals',
    },
  };
});

jest.mock('@/lib/firebase-admin', () => ({
  db: {
    collection: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      })),
    })),
  },
  auth: { verifyIdToken: jest.fn(), getUser: jest.fn() },
  admin: { firestore: { FieldValue: { serverTimestamp: jest.fn(() => new Date()), increment: jest.fn((n: number) => n) } } },
}));

jest.mock('@/lib/firebase/admin', () => ({
  default: null,
  adminAuth: { verifyIdToken: jest.fn(), getUser: jest.fn() },
  adminDb: null,
  adminStorage: null,
  admin: { firestore: { FieldValue: { serverTimestamp: jest.fn(() => new Date()), increment: jest.fn((n: number) => n) } } },
}));

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import {
  getDeals,
  createDeal,
  deleteDeal,
  moveDealToStage,
  getPipelineSummary,
} from '@/lib/crm/deal-service';
import { FirestoreService } from '@/lib/db/firestore-service';

describe('DealService', () => {
  const testOrgId = `test-org-${Date.now()}`;
  let testDealId: string;

  beforeEach(async () => {
    await FirestoreService.set('organizations', testOrgId, {
      id: testOrgId,
      name: 'Test Organization',
    }, false);
  });

  afterEach(async () => {
    if (testDealId) {
      try {
        await deleteDeal(testDealId);
      } catch {
        // Ignore - deal may already be deleted by test
      }
    }
  });

  afterAll(async () => {
    try {
      await FirestoreService.delete('organizations', testOrgId);
    } catch {
      // Ignore - org may not exist
    }
  });

  describe('createDeal', () => {
    it('should create a new deal', async () => {
      const deal = await createDeal({
        name: 'Test Deal',
        value: 10000,
        stage: 'prospecting',
        probability: 10,
      });
      testDealId = deal.id;

      expect(deal.id).toBeDefined();
      expect(deal.name).toBe('Test Deal');
      expect(deal.value).toBe(10000);
      expect(deal.stage).toBe('prospecting');
      expect(deal.probability).toBe(10);
      expect(deal.currency).toBe('USD');
    });
  });

  describe('moveDealToStage', () => {
    it('should move deal to new stage', async () => {
      const deal = await createDeal({
        name: 'Moving Deal',
        value: 50000,
        stage: 'prospecting',
        probability: 10,
      });
      testDealId = deal.id;

      const moved = await moveDealToStage(deal.id, 'qualification');

      expect(moved.stage).toBe('qualification');
    });

    it('should set close date when deal is won', async () => {
      const deal = await createDeal({
        name: 'Winning Deal',
        value: 100000,
        stage: 'negotiation',
        probability: 75,
      });
      testDealId = deal.id;

      const won = await moveDealToStage(deal.id, 'closed_won');

      expect(won.stage).toBe('closed_won');
      expect(won.probability).toBe(100);
      expect(won.actualCloseDate).toBeDefined();
    });

    it('should set probability to 0 when deal is lost', async () => {
      const deal = await createDeal({
        name: 'Lost Deal',
        value: 25000,
        stage: 'proposal',
        probability: 50,
      });
      testDealId = deal.id;

      const lost = await moveDealToStage(deal.id, 'closed_lost');

      expect(lost.stage).toBe('closed_lost');
      expect(lost.probability).toBe(0);
      expect(lost.actualCloseDate).toBeDefined();
    });
  });

  describe('getDeals with pagination', () => {
    it('should paginate deals', async () => {
      const dealIds: string[] = [];

      // Create 10 deals
      for (let i = 0; i < 10; i++) {
        const deal = await createDeal({
          name: `Deal ${i}`,
          value: i * 1000,
          stage: 'prospecting',
          probability: 10,
        });
        dealIds.push(deal.id);
      }

      // Get first page
      const result = await getDeals(undefined, { pageSize: 5 });

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(true);

      // Cleanup
      for (const id of dealIds) {
        await deleteDeal(id);
      }
    });

    it('should filter deals by stage', async () => {
      const deal1 = await createDeal({
        name: 'Prospecting Deal',
        value: 10000,
        stage: 'prospecting',
        probability: 10,
      });

      const deal2 = await createDeal({
        name: 'Proposal Deal',
        value: 20000,
        stage: 'proposal',
        probability: 50,
      });

      const result = await getDeals({ stage: 'proposal' });

      expect(result.data.some(d => d.id === deal2.id)).toBe(true);
      expect(result.data.every(d => d.stage === 'proposal')).toBe(true);

      await deleteDeal(deal1.id);
      await deleteDeal(deal2.id);
    });
  });

  describe('getPipelineSummary', () => {
    it('should calculate pipeline summary by stage', async () => {
      const deal1 = await createDeal({
        name: 'Deal 1',
        value: 10000,
        stage: 'prospecting',
        probability: 10,
      });

      const deal2 = await createDeal({
        name: 'Deal 2',
        value: 20000,
        stage: 'prospecting',
        probability: 10,
      });

      const deal3 = await createDeal({
        name: 'Deal 3',
        value: 50000,
        stage: 'proposal',
        probability: 50,
      });

      const summary = await getPipelineSummary();

      expect(summary.prospecting.count).toBeGreaterThanOrEqual(2);
      expect(summary.prospecting.totalValue).toBeGreaterThanOrEqual(30000);
      expect(summary.proposal.count).toBeGreaterThanOrEqual(1);
      expect(summary.proposal.totalValue).toBeGreaterThanOrEqual(50000);

      await deleteDeal(deal1.id);
      await deleteDeal(deal2.id);
      await deleteDeal(deal3.id);
    });
  });
});
