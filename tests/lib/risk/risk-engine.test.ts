/**
 * Deal Risk Predictor - Unit Tests
 * 
 * Comprehensive unit tests for the risk prediction engine.
 * Tests cover risk factor analysis, slippage probability calculation,
 * intervention generation, and prediction confidence.
 */

import { predictDealRisk, predictBatchDealRisk } from '@/lib/risk/risk-engine';
import type {
  RiskPredictionRequest,
  BatchRiskPredictionRequest,
  RiskEngineConfig,
} from '@/lib/risk/types';
import { getDeal } from '@/lib/crm/deal-service';
import { calculateDealScore } from '@/lib/templates/deal-scoring-engine';
import { calculateDealHealth } from '@/lib/crm/deal-health';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';

// Mock dependencies
jest.mock('@/lib/logger/logger');
jest.mock('@/lib/ai/unified-ai-service');
jest.mock('@/lib/orchestration/coordinator-factory-server');
jest.mock('@/lib/crm/deal-service');
jest.mock('@/lib/templates/deal-scoring-engine');
jest.mock('@/lib/crm/deal-health');

describe('Deal Risk Predictor', () => {
  // Mock data
  const mockDeal = {
    id: 'deal_test_123',
    organizationId: 'org_test',
    workspaceId: 'default',
    name: 'Test Enterprise Deal',
    company: 'Test Corp',
    companyName: 'Test Corp',
    contactId: 'contact_123',
    value: 100000,
    currency: 'USD',
    stage: 'negotiation' as const,
    probability: 60,
    expectedCloseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    actualCloseDate: undefined,
    ownerId: 'user_123',
    source: 'inbound',
    lostReason: undefined,
    notes: 'Important enterprise deal',
    customFields: {},
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
    updatedAt: new Date(),
  };

  const mockDealScore = {
    dealId: 'deal_test_123',
    score: 65,
    closeProbability: 60,
    tier: 'warm' as const,
    confidence: 75,
    factors: [
      {
        id: 'deal_age',
        name: 'Deal Age',
        score: 70,
        weight: 0.2,
        contribution: 14,
        impact: 'neutral' as const,
        description: 'Deal is 45 days old',
        value: 45,
        benchmark: 30,
      },
    ],
    riskFactors: [
      {
        id: 'risk_1',
        severity: 'medium' as const,
        category: 'timing' as const,
        description: 'Deal in pipeline longer than expected',
        impact: 'May indicate budget or approval issues',
        mitigation: 'Accelerate decision process',
      },
    ],
    recommendations: ['Follow up with decision maker', 'Provide ROI justification'],
    predictedCloseDate: mockDeal.expectedCloseDate,
    predictedValue: mockDeal.value,
    calculatedAt: new Date(),
  };

  const mockDealHealth = {
    overall: 55,
    status: 'at-risk' as const,
    factors: [
      {
        name: 'Activity Recency',
        score: 50,
        weight: 0.2,
        impact: 'negative' as const,
        description: 'No activity in 7 days',
      },
      {
        name: 'Stage Duration',
        score: 60,
        weight: 0.25,
        impact: 'neutral' as const,
        description: 'On track (45/60 days in negotiation)',
      },
    ],
    warnings: ['No activity in 7 days', 'Deal stale'],
    recommendations: ['Schedule follow-up call', 'Reassess requirements'],
  };

  const mockAIResponse = {
    text: JSON.stringify([
      {
        title: 'Executive Escalation',
        type: 'executive_engagement',
        priority: 'high',
        description: 'Engage C-level executive to accelerate decision',
        expectedImpact: 45,
        estimatedEffort: 3,
        actionSteps: [
          'Schedule exec meeting',
          'Prepare value deck',
          'Address concerns',
        ],
        successMetrics: ['Meeting scheduled', 'Decision timeline confirmed'],
        suggestedOwner: 'Account Executive',
        deadlineDays: 3,
        reasoning: 'Executive buy-in critical for closing',
      },
    ]),
    content: JSON.stringify([
      {
        title: 'Executive Escalation',
        type: 'executive_engagement',
        priority: 'high',
        description: 'Engage C-level executive to accelerate decision',
        expectedImpact: 45,
        estimatedEffort: 3,
        actionSteps: [
          'Schedule exec meeting',
          'Prepare value deck',
          'Address concerns',
        ],
        successMetrics: ['Meeting scheduled', 'Decision timeline confirmed'],
        suggestedOwner: 'Account Executive',
        deadlineDays: 3,
        reasoning: 'Executive buy-in critical for closing',
      },
    ]),
    model: 'gpt-4',
    provider: 'openai' as const,
    usage: {
      promptTokens: 500,
      completionTokens: 300,
      totalTokens: 800,
    },
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock getDeal
    jest.mocked(getDeal).mockResolvedValue(mockDeal);

    // Mock calculateDealScore
    jest.mocked(calculateDealScore).mockResolvedValue(mockDealScore);

    // Mock calculateDealHealth
    jest.mocked(calculateDealHealth).mockResolvedValue(mockDealHealth);

    // Mock AI service
    jest.mocked(sendUnifiedChatMessage).mockResolvedValue(mockAIResponse);

    // Mock signal coordinator
    jest.mocked(getServerSignalCoordinator).mockReturnValue({
      emitSignal: jest.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getServerSignalCoordinator>);
  });

  describe('predictDealRisk', () => {
    it('should predict risk for a deal', async () => {
      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
        workspaceId: 'default',
        includeInterventions: true,
        forceRefresh: false,
      };

      const prediction = await predictDealRisk(request);

      expect(prediction).toBeDefined();
      expect(prediction.dealId).toBe('deal_test_123');
      expect(prediction.organizationId).toBe('org_test');
      expect(prediction.riskLevel).toMatch(/critical|high|medium|low|minimal/);
      expect(prediction.slippageProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.slippageProbability).toBeLessThanOrEqual(100);
      expect(prediction.lossProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.lossProbability).toBeLessThanOrEqual(100);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(100);
    });

    it('should identify risk factors', async () => {
      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
        includeInterventions: false,
      };

      const prediction = await predictDealRisk(request);

      expect(prediction.riskFactors).toBeDefined();
      expect(Array.isArray(prediction.riskFactors)).toBe(true);
      
      prediction.riskFactors.forEach(factor => {
        expect(factor.id).toBeDefined();
        expect(factor.category).toMatch(/timing|engagement|stakeholder|competition|budget|value_alignment|technical|external/);
        expect(factor.severity).toMatch(/critical|high|medium|low/);
        expect(factor.impact).toBeGreaterThanOrEqual(0);
        expect(factor.impact).toBeLessThanOrEqual(100);
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.weight).toBeLessThanOrEqual(1);
      });
    });

    it('should identify protective factors', async () => {
      // Mock high-performing deal
      jest.mocked(calculateDealScore).mockResolvedValue({
        ...mockDealScore,
        score: 85,
        tier: 'hot',
      });

      jest.mocked(calculateDealHealth).mockResolvedValue({
        ...mockDealHealth,
        overall: 82,
        status: 'healthy',
      });

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction.protectiveFactors).toBeDefined();
      expect(Array.isArray(prediction.protectiveFactors)).toBe(true);
      expect(prediction.protectiveFactors.length).toBeGreaterThan(0);
    });

    it('should generate AI interventions when requested', async () => {
      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
        includeInterventions: true,
      };

      const prediction = await predictDealRisk(request);

      expect(prediction.interventions).toBeDefined();
      expect(Array.isArray(prediction.interventions)).toBe(true);
      
      if (prediction.interventions.length > 0) {
        const intervention = prediction.interventions[0];
        expect(intervention.id).toBeDefined();
        expect(intervention.type).toBeDefined();
        expect(intervention.priority).toMatch(/critical|high|medium|low/);
        expect(intervention.title).toBeDefined();
        expect(intervention.expectedImpact).toBeGreaterThanOrEqual(0);
        expect(intervention.estimatedEffort).toBeGreaterThan(0);
        expect(intervention.roiScore).toBeGreaterThan(0);
        expect(intervention.actionSteps).toBeDefined();
        expect(intervention.actionSteps.length).toBeGreaterThan(0);
      }
    });

    it('should skip interventions when not requested', async () => {
      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
        includeInterventions: false,
      };

      const prediction = await predictDealRisk(request);

      expect(prediction.interventions).toBeDefined();
      expect(prediction.interventions.length).toBe(0);
    });

    it('should calculate slippage timeline for at-risk deals', async () => {
      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      // May or may not predict slippage based on risk level
      if (prediction.predictedSlippageDate) {
        expect(prediction.daysUntilSlippage).toBeGreaterThanOrEqual(0);
        expect(prediction.predictedSlippageDate instanceof Date).toBe(true);
      }
    });

    it('should include metadata', async () => {
      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction.metadata).toBeDefined();
      expect(prediction.metadata.modelVersion).toBeDefined();
      expect(prediction.metadata.dataSources).toBeDefined();
      expect(prediction.metadata.factorsConsidered).toBeGreaterThanOrEqual(0);
      expect(prediction.metadata.aiModel).toMatch(/gpt-4o|gpt-4o-mini/);
      expect(prediction.metadata.calculationDuration).toBeGreaterThan(0);
    });

    it('should handle deal not found', async () => {
      jest.mocked(getDeal).mockResolvedValue(null);

      const request: RiskPredictionRequest = {
        dealId: 'nonexistent',
        organizationId: 'org_test',
      };

      await expect(predictDealRisk(request)).rejects.toThrow();
    });

    it('should handle AI failure gracefully', async () => {
      jest.mocked(sendUnifiedChatMessage).mockRejectedValue(new Error('AI service unavailable'));

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
        includeInterventions: true,
      };

      // Should still return prediction with fallback interventions
      const prediction = await predictDealRisk(request);
      expect(prediction).toBeDefined();
      // Fallback interventions should be provided
      expect(prediction.interventions).toBeDefined();
    });
  });

  describe('Risk Level Determination', () => {
    it('should classify critical risk (80%+ slippage)', async () => {
      // Mock very low health
      jest.mocked(calculateDealHealth).mockResolvedValue({
        ...mockDealHealth,
        overall: 15,
        status: 'critical',
      });

      jest.mocked(calculateDealScore).mockResolvedValue({
        ...mockDealScore,
        score: 20,
        tier: 'at-risk',
      });

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction.riskLevel).toBe('critical');
      expect(prediction.slippageProbability).toBeGreaterThanOrEqual(80);
    });

    it('should classify minimal risk (0-19% slippage)', async () => {
      // Mock high health
      jest.mocked(calculateDealHealth).mockResolvedValue({
        ...mockDealHealth,
        overall: 92,
        status: 'healthy',
      });

      jest.mocked(calculateDealScore).mockResolvedValue({
        ...mockDealScore,
        score: 88,
        tier: 'hot',
      });

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction.riskLevel).toBe('minimal');
      expect(prediction.slippageProbability).toBeLessThan(20);
    });
  });

  describe('Batch Risk Prediction', () => {
    it('should predict risk for multiple deals', async () => {
      const request: BatchRiskPredictionRequest = {
        dealIds: ['deal_1', 'deal_2', 'deal_3'],
        organizationId: 'org_test',
        workspaceId: 'default',
        includeInterventions: false,
      };

      const result = await predictBatchDealRisk(request);

      expect(result).toBeDefined();
      expect(result.predictions).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.calculatedAt instanceof Date).toBe(true);
    });

    it('should calculate summary statistics', async () => {
      const request: BatchRiskPredictionRequest = {
        dealIds: ['deal_1', 'deal_2'],
        organizationId: 'org_test',
      };

      const result = await predictBatchDealRisk(request);

      expect(result.summary.totalDeals).toBeGreaterThanOrEqual(0);
      expect(result.summary.byRiskLevel).toBeDefined();
      expect(result.summary.avgSlippageProbability).toBeGreaterThanOrEqual(0);
      expect(result.summary.avgSlippageProbability).toBeLessThanOrEqual(100);
      expect(result.summary.urgentActionRequired).toBeGreaterThanOrEqual(0);
    });

    it('should filter high risk only when requested', async () => {
      const request: BatchRiskPredictionRequest = {
        dealIds: ['deal_1', 'deal_2', 'deal_3'],
        organizationId: 'org_test',
        highRiskOnly: true,
      };

      const result = await predictBatchDealRisk(request);

      // Should only include high/critical risk deals
      result.predictions.forEach((prediction: any) => {
        expect(['critical', 'high']).toContain(prediction.riskLevel);
      });
    });

    it('should handle partial failures in batch', async () => {
      // Mock: first deal succeeds, second fails
      jest.mocked(getDeal)
        .mockResolvedValueOnce(mockDeal)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockDeal);

      const request: BatchRiskPredictionRequest = {
        dealIds: ['deal_1', 'deal_2', 'deal_3'],
        organizationId: 'org_test',
      };

      const result = await predictBatchDealRisk(request);

      // Should have predictions for successful deals only
      expect(result.predictions.size).toBeLessThan(3);
      expect(result.predictions.size).toBeGreaterThan(0);
    });
  });

  describe('Risk Trends', () => {
    it('should analyze risk trend', async () => {
      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction.trend).toBeDefined();
      expect(prediction.trend.direction).toMatch(/increasing|stable|decreasing/);
      expect(prediction.trend.description).toBeDefined();
    });
  });

  describe('Custom Configuration', () => {
    it('should respect custom risk thresholds', async () => {
      const customConfig: Partial<RiskEngineConfig> = {
        thresholds: {
          critical: 90,
          high: 70,
          medium: 50,
          low: 30,
          minimal: 0,
        },
      };

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request, customConfig);

      expect(prediction).toBeDefined();
      // Risk level classification should use custom thresholds
    });

    it('should limit interventions to max count', async () => {
      const customConfig: Partial<RiskEngineConfig> = {
        maxInterventions: 2,
      };

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
        includeInterventions: true,
      };

      const prediction = await predictDealRisk(request, customConfig);

      expect(prediction.interventions.length).toBeLessThanOrEqual(2);
    });

    it('should use gpt-4o-mini when specified', async () => {
      const customConfig: Partial<RiskEngineConfig> = {
        aiModel: 'gpt-4o-mini' as const,
      };

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
        includeInterventions: true,
      };

      const prediction = await predictDealRisk(request, customConfig);

      expect(prediction.metadata.aiModel).toBe('gpt-4o-mini');
    });
  });

  describe('Edge Cases', () => {
    it('should handle deal with no expected close date', async () => {
      jest.mocked(getDeal).mockResolvedValue({
        ...mockDeal,
        expectedCloseDate: null,
      });

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction).toBeDefined();
      expect(prediction.predictedSlippageDate).toBeNull();
    });

    it('should handle overdue deal', async () => {
      jest.mocked(getDeal).mockResolvedValue({
        ...mockDeal,
        expectedCloseDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days overdue
      });

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction).toBeDefined();
      expect(prediction.riskFactors.some(f => f.category === 'timing')).toBe(true);
    });

    it('should handle very old deal', async () => {
      jest.mocked(getDeal).mockResolvedValue({
        ...mockDeal,
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days old
      });

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction).toBeDefined();
      expect(prediction.riskFactors.some(f => f.description.includes('days'))).toBe(true);
    });

    it('should handle deal in early stage', async () => {
      jest.mocked(getDeal).mockResolvedValue({
        ...mockDeal,
        stage: 'prospecting',
      });

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction).toBeDefined();
    });

    it('should handle closed deal', async () => {
      jest.mocked(getDeal).mockResolvedValue({
        ...mockDeal,
        stage: 'closed_won',
        actualCloseDate: new Date(),
      });

      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
      };

      const prediction = await predictDealRisk(request);

      expect(prediction).toBeDefined();
      // Closed deals should have minimal risk
      expect(prediction.riskLevel).toMatch(/minimal|low/);
    });
  });

  describe('Performance', () => {
    it('should complete prediction in reasonable time', async () => {
      const request: RiskPredictionRequest = {
        dealId: 'deal_test_123',
        organizationId: 'org_test',
        includeInterventions: true,
      };

      const startTime = Date.now();
      await predictDealRisk(request);
      const duration = Date.now() - startTime;

      // Should complete in under 5 seconds (allowing for mocks)
      expect(duration).toBeLessThan(5000);
    });
  });
});
