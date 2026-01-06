/**
 * Deal Scoring Engine Unit Tests
 * 
 * Tests predictive deal scoring with 7+ factors:
 * - Deal Age
 * - Stage Velocity
 * - Engagement Level
 * - Decision Maker Involvement
 * - Budget Alignment
 * - Competition Presence
 * - Historical Win Rate
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { calculateDealScore, batchScoreDeals } from '@/lib/templates/deal-scoring-engine';
import type { Deal } from '@/lib/crm/deal-service';

// Mock the dependencies
jest.mock('@/lib/orchestration/coordinator-factory-server', () => ({
  getServerSignalCoordinator: jest.fn(() => ({
    emitSignal: jest.fn()
  }))
}));

jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Test organization and workspace
const TEST_ORG_ID = 'test-org-scoring';
const TEST_WORKSPACE_ID = 'default';

/**
 * Create a mock deal with customizable properties
 */
function createMockDeal(overrides: Partial<Deal> = {}): Deal {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return {
    id: `deal-${Date.now()}`,
    organizationId: TEST_ORG_ID,
    workspaceId: TEST_WORKSPACE_ID,
    name: 'Test Deal',
    value: 50000,
    currency: 'USD',
    stage: 'proposal',
    probability: 50,
    expectedCloseDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    createdAt: thirtyDaysAgo,
    updatedAt: now,
    ...overrides
  } as Deal;
}

describe('Deal Scoring Engine', () => {
  
  describe('calculateDealScore', () => {
    
    it('should calculate score for a typical deal', async () => {
      const deal = createMockDeal();
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: deal.id,
        deal
      });
      
      // Basic validation
      expect(score.dealId).toBe(deal.id);
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(score.closeProbability).toBeGreaterThanOrEqual(0);
      expect(score.closeProbability).toBeLessThanOrEqual(100);
      expect(['hot', 'warm', 'cold', 'at-risk']).toContain(score.tier);
      expect(score.confidence).toBeGreaterThanOrEqual(0);
      expect(score.confidence).toBeLessThanOrEqual(100);
      
      // Should have 7 factors
      expect(score.factors).toHaveLength(7);
      
      // All factors should have required fields
      score.factors.forEach(factor => {
        expect(factor.id).toBeDefined();
        expect(factor.name).toBeDefined();
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.contribution).toBeDefined();
        expect(['positive', 'negative', 'neutral']).toContain(factor.impact);
      });
      
      // Should have risk factors and recommendations
      expect(Array.isArray(score.riskFactors)).toBe(true);
      expect(Array.isArray(score.recommendations)).toBe(true);
      expect(score.calculatedAt).toBeInstanceOf(Date);
    });
    
    it('should score a hot deal (high value, recent, fast-moving)', async () => {
      const deal = createMockDeal({
        value: 500000, // High value
        stage: 'proposal',
        probability: 75,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago (recent)
        expectedCloseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Closing soon
        customFields: {
          contactName: 'John Smith', // Decision maker
          contactTitle: 'CEO' // C-level
        }
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: deal.id,
        deal
      });
      
      // Hot deals should have high scores
      expect(score.score).toBeGreaterThan(60);
      expect(['hot', 'warm']).toContain(score.tier);
      expect(score.closeProbability).toBeGreaterThan(50);
    });
    
    it('should score an at-risk deal (old, stagnant, low engagement)', async () => {
      const deal = createMockDeal({
        value: 10000, // Low value
        stage: 'qualification', // Early stage
        probability: 20,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months old (stale)
        expectedCloseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Overdue
        customFields: {
          contactTitle: 'Coordinator' // Not decision maker
        }
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: deal.id,
        deal
      });
      
      // At-risk deals should have lower scores
      expect(score.score).toBeLessThan(50);
      expect(['at-risk', 'cold']).toContain(score.tier);
      expect(score.closeProbability).toBeLessThan(40);
      
      // Should identify risk factors
      expect(score.riskFactors.length).toBeGreaterThan(0);
    });
    
    it('should detect deal age risk factor for old deals', async () => {
      const deal = createMockDeal({
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year old
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: deal.id,
        deal
      });
      
      const ageRisk = score.riskFactors.find(r => r.category === 'timing');
      expect(ageRisk).toBeDefined();
    });
    
    it('should detect decision maker involvement factor', async () => {
      const dealWithCEO = createMockDeal({
        customFields: {
          contactName: 'Jane Doe',
          contactTitle: 'CEO'
        }
      });
      
      const scoreWithCEO = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: dealWithCEO.id,
        deal: dealWithCEO
      });
      
      const decisionMakerFactor = scoreWithCEO.factors.find(f => f.id === 'decision_maker');
      expect(decisionMakerFactor).toBeDefined();
      expect(decisionMakerFactor!.score).toBeGreaterThan(70); // High score for CEO involvement
      
      const dealWithCoordinator = createMockDeal({
        customFields: {
          contactName: 'Bob Smith',
          contactTitle: 'Coordinator'
        }
      });
      
      const scoreWithCoordinator = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: dealWithCoordinator.id,
        deal: dealWithCoordinator
      });
      
      const coordinatorFactor = scoreWithCoordinator.factors.find(f => f.id === 'decision_maker');
      expect(coordinatorFactor!.score).toBeLessThan(50); // Low score for non-decision maker
    });
    
    it('should calculate budget alignment factor', async () => {
      const dealAtBudget = createMockDeal({
        value: 50000,
        customFields: {
          stated_budget: 50000 // Perfect alignment
        }
      });
      
      const scoreAtBudget = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: dealAtBudget.id,
        deal: dealAtBudget
      });
      
      const budgetFactor = scoreAtBudget.factors.find(f => f.id === 'budget');
      expect(budgetFactor).toBeDefined();
      expect(budgetFactor!.score).toBeGreaterThan(70); // High score for budget alignment
      
      const dealOverBudget = createMockDeal({
        value: 100000,
        customFields: {
          stated_budget: 50000 // 2x over budget
        }
      });
      
      const scoreOverBudget = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: dealOverBudget.id,
        deal: dealOverBudget
      });
      
      const overBudgetFactor = scoreOverBudget.factors.find(f => f.id === 'budget');
      expect(overBudgetFactor!.score).toBeLessThan(50); // Low score for misalignment
    });
    
    it('should detect competition presence factor', async () => {
      const dealWithCompetitors = createMockDeal({
        customFields: {
          competitors: ['Salesforce', 'HubSpot']
        }
      });
      
      const scoreWithCompetitors = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: dealWithCompetitors.id,
        deal: dealWithCompetitors
      });
      
      const competitionFactor = scoreWithCompetitors.factors.find(f => f.id === 'competition');
      expect(competitionFactor).toBeDefined();
      expect(competitionFactor!.impact).toBe('negative'); // Competition is negative impact
      
      const dealNoCompetitors = createMockDeal({
        customFields: {}
      });
      
      const scoreNoCompetitors = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: dealNoCompetitors.id,
        deal: dealNoCompetitors
      });
      
      const noCompetitionFactor = scoreNoCompetitors.factors.find(f => f.id === 'competition');
      expect(noCompetitionFactor!.score).toBeGreaterThan(competitionFactor!.score);
    });
    
    it('should apply custom template scoring weights', async () => {
      const deal = createMockDeal();
      
      // Score with SaaS template (emphasizes engagement)
      const saasScore = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: deal.id,
        deal,
        templateId: 'saas'
      });
      
      // Score with Manufacturing template (emphasizes budget)
      const mfgScore = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: deal.id,
        deal,
        templateId: 'manufacturing'
      });
      
      // Scores might differ based on template weights
      expect(saasScore.score).toBeDefined();
      expect(mfgScore.score).toBeDefined();
      
      // Both should have all 7 factors
      expect(saasScore.factors).toHaveLength(7);
      expect(mfgScore.factors).toHaveLength(7);
    });
    
    it('should generate actionable recommendations', async () => {
      const deal = createMockDeal();
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: deal.id,
        deal
      });
      
      expect(score.recommendations.length).toBeGreaterThan(0);
      score.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });
    
    it('should predict close date and final value', async () => {
      const deal = createMockDeal({
        value: 50000,
        stage: 'proposal',
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: deal.id,
        deal
      });
      
      expect(score.predictedValue).toBeGreaterThan(0);
      expect(score.predictedCloseDate).toBeDefined();
    });
  });
  
  describe('Tier Classification', () => {
    
    it('should classify deals into correct tiers', async () => {
      // Hot deal: high score, high probability
      const hotDeal = createMockDeal({
        value: 500000,
        stage: 'negotiation',
        probability: 80,
        customFields: {
          contactTitle: 'CEO'
        }
      });
      
      const hotScore = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: hotDeal.id,
        deal: hotDeal
      });
      
      // At-risk deal: overdue, low engagement
      const atRiskDeal = createMockDeal({
        value: 10000,
        stage: 'prospecting',
        probability: 10,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        expectedCloseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      });
      
      const atRiskScore = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: atRiskDeal.id,
        deal: atRiskDeal
      });
      
      // Verify tier classification
      expect(['hot', 'warm']).toContain(hotScore.tier);
      expect(['at-risk', 'cold']).toContain(atRiskScore.tier);
      expect(hotScore.score).toBeGreaterThan(atRiskScore.score);
    });
  });
  
  describe('Risk Factor Detection', () => {
    
    it('should detect timing risks for overdue deals', async () => {
      const overdueDeal = createMockDeal({
        expectedCloseDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days overdue
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: overdueDeal.id,
        deal: overdueDeal
      });
      
      const timingRisk = score.riskFactors.find(r => r.category === 'timing');
      expect(timingRisk).toBeDefined();
      expect(['critical', 'high']).toContain(timingRisk!.severity);
    });
    
    it('should detect budget risks for misaligned budgets', async () => {
      const budgetRiskDeal = createMockDeal({
        value: 200000,
        customFields: {
          stated_budget: 50000 // 4x over budget
        }
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: budgetRiskDeal.id,
        deal: budgetRiskDeal
      });
      
      const budgetRisk = score.riskFactors.find(r => r.category === 'budget');
      expect(budgetRisk).toBeDefined();
    });
    
    it('should detect stakeholder risks when no decision maker', async () => {
      const noDecisionMakerDeal = createMockDeal({
        customFields: {
          contactTitle: 'Intern'
        }
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: noDecisionMakerDeal.id,
        deal: noDecisionMakerDeal
      });
      
      const stakeholderRisk = score.riskFactors.find(r => r.category === 'stakeholder');
      expect(stakeholderRisk).toBeDefined();
    });
    
    it('should provide mitigation strategies for each risk', async () => {
      const riskyDeal = createMockDeal({
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        customFields: {
          contactTitle: 'Coordinator'
        }
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: riskyDeal.id,
        deal: riskyDeal
      });
      
      score.riskFactors.forEach(risk => {
        expect(risk.mitigation).toBeDefined();
        expect(risk.mitigation.length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('Batch Scoring', () => {
    
    it('should score multiple deals in batch', async () => {
      const deals = [
        createMockDeal({ id: 'deal-1', value: 100000 }),
        createMockDeal({ id: 'deal-2', value: 50000 }),
        createMockDeal({ id: 'deal-3', value: 25000 })
      ];
      
      const result = await batchScoreDeals(
        TEST_ORG_ID,
        TEST_WORKSPACE_ID,
        deals.map(d => d.id)
      );
      
      expect(result.scores.size).toBe(3);
      expect(result.summary.totalDeals).toBe(3);
      expect(result.summary.avgScore).toBeGreaterThan(0);
      
      // Summary counts should add up
      const totalCategorized = 
        result.summary.hotDeals +
        result.summary.warmDeals +
        result.summary.coldDeals +
        result.summary.atRiskDeals;
      
      expect(totalCategorized).toBe(3);
    });
    
    it('should handle empty batch gracefully', async () => {
      const result = await batchScoreDeals(
        TEST_ORG_ID,
        TEST_WORKSPACE_ID,
        []
      );
      
      expect(result.scores.size).toBe(0);
      expect(result.summary.totalDeals).toBe(0);
      expect(result.summary.avgScore).toBe(0);
    });
  });
  
  describe('Confidence Scoring', () => {
    
    it('should have high confidence for deals with complete data', async () => {
      const completeDeal = createMockDeal({
        name: 'Complete Deal',
        value: 100000,
        stage: 'proposal',
        probability: 60,
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        customFields: {
          contactName: 'Jane Smith',
          contactTitle: 'VP of Sales',
          stated_budget: 100000,
          last_activity_date: new Date()
        }
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: completeDeal.id,
        deal: completeDeal
      });
      
      expect(score.confidence).toBeGreaterThan(60);
    });
    
    it('should have lower confidence for deals with missing data', async () => {
      const incompleteDeal = createMockDeal({
        name: 'Incomplete Deal',
        value: 50000,
        stage: 'prospecting',
        // Missing: contact info, expected close date, custom fields
      });
      
      const score = await calculateDealScore({
        organizationId: TEST_ORG_ID,
        workspaceId: TEST_WORKSPACE_ID,
        dealId: incompleteDeal.id,
        deal: incompleteDeal
      });
      
      expect(score.confidence).toBeLessThan(70);
    });
  });
});
