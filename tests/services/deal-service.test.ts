/**
 * Deal Service Tests
 * Integration tests for deal service layer
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  moveDealToStage,
  getPipelineSummary,
  type Deal,
} from '@/lib/crm/deal-service';
import { FirestoreService } from '@/lib/db/firestore-service';

describe('DealService', () => {
  const testOrgId = `test-org-${Date.now()}`;
  const testWorkspaceId = 'default';
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
        await deleteDeal(testOrgId, testDealId, testWorkspaceId);
      } catch (error) {
        // Ignore
      }
    }
  });

  describe('createDeal', () => {
    it('should create a new deal', async () => {
      const deal = await createDeal(testOrgId, {
        name: 'Test Deal',
        value: 10000,
        stage: 'prospecting',
        probability: 10,
      }, testWorkspaceId);
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
      const deal = await createDeal(testOrgId, {
        name: 'Moving Deal',
        value: 50000,
        stage: 'prospecting',
        probability: 10,
      }, testWorkspaceId);
      testDealId = deal.id;

      const moved = await moveDealToStage(testOrgId, deal.id, 'qualification', testWorkspaceId);

      expect(moved.stage).toBe('qualification');
    });

    it('should set close date when deal is won', async () => {
      const deal = await createDeal(testOrgId, {
        name: 'Winning Deal',
        value: 100000,
        stage: 'negotiation',
        probability: 75,
      }, testWorkspaceId);
      testDealId = deal.id;

      const won = await moveDealToStage(testOrgId, deal.id, 'closed_won', testWorkspaceId);

      expect(won.stage).toBe('closed_won');
      expect(won.probability).toBe(100);
      expect(won.actualCloseDate).toBeDefined();
    });

    it('should set probability to 0 when deal is lost', async () => {
      const deal = await createDeal(testOrgId, {
        name: 'Lost Deal',
        value: 25000,
        stage: 'proposal',
        probability: 50,
      }, testWorkspaceId);
      testDealId = deal.id;

      const lost = await moveDealToStage(testOrgId, deal.id, 'closed_lost', testWorkspaceId);

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
        const deal = await createDeal(testOrgId, {
          name: `Deal ${i}`,
          value: i * 1000,
          stage: 'prospecting',
          probability: 10,
        }, testWorkspaceId);
        dealIds.push(deal.id);
      }

      // Get first page
      const result = await getDeals(testOrgId, testWorkspaceId, undefined, { pageSize: 5 });

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(true);

      // Cleanup
      for (const id of dealIds) {
        await deleteDeal(testOrgId, id, testWorkspaceId);
      }
    });

    it('should filter deals by stage', async () => {
      const deal1 = await createDeal(testOrgId, {
        name: 'Prospecting Deal',
        value: 10000,
        stage: 'prospecting',
        probability: 10,
      }, testWorkspaceId);

      const deal2 = await createDeal(testOrgId, {
        name: 'Proposal Deal',
        value: 20000,
        stage: 'proposal',
        probability: 50,
      }, testWorkspaceId);

      const result = await getDeals(testOrgId, testWorkspaceId, { stage: 'proposal' });

      expect(result.data.some(d => d.id === deal2.id)).toBe(true);
      expect(result.data.every(d => d.stage === 'proposal')).toBe(true);

      await deleteDeal(testOrgId, deal1.id, testWorkspaceId);
      await deleteDeal(testOrgId, deal2.id, testWorkspaceId);
    });
  });

  describe('getPipelineSummary', () => {
    it('should calculate pipeline summary by stage', async () => {
      const deal1 = await createDeal(testOrgId, {
        name: 'Deal 1',
        value: 10000,
        stage: 'prospecting',
        probability: 10,
      }, testWorkspaceId);

      const deal2 = await createDeal(testOrgId, {
        name: 'Deal 2',
        value: 20000,
        stage: 'prospecting',
        probability: 10,
      }, testWorkspaceId);

      const deal3 = await createDeal(testOrgId, {
        name: 'Deal 3',
        value: 50000,
        stage: 'proposal',
        probability: 50,
      }, testWorkspaceId);

      const summary = await getPipelineSummary(testOrgId, testWorkspaceId);

      expect(summary.prospecting.count).toBeGreaterThanOrEqual(2);
      expect(summary.prospecting.totalValue).toBeGreaterThanOrEqual(30000);
      expect(summary.proposal.count).toBeGreaterThanOrEqual(1);
      expect(summary.proposal.totalValue).toBeGreaterThanOrEqual(50000);

      await deleteDeal(testOrgId, deal1.id, testWorkspaceId);
      await deleteDeal(testOrgId, deal2.id, testWorkspaceId);
      await deleteDeal(testOrgId, deal3.id, testWorkspaceId);
    });
  });
});

