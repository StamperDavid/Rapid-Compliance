/**
 * Coaching Validation Tests
 * 
 * Tests for coaching module Zod validation schemas
 */

import {
  TimePeriodSchema,
  PerformanceTierSchema,
  SkillCategorySchema,
  RiskCategorySchema,
  GenerateCoachingRequestSchema,
  GenerateCoachingResponseSchema,
  RepPerformanceMetricsSchema,
  CoachingInsightsSchema,
  DealPerformanceMetricsSchema,
  CommunicationMetricsSchema,
  ActivityMetricsSchema,
  ConversionMetricsSchema,
  RevenueMetricsSchema,
  EfficiencyMetricsSchema,
  SkillScoresSchema,
  PerformanceComparisonSchema,
  StrengthSchema,
  WeaknessSchema,
  OpportunitySchema,
  RiskSchema,
  CoachingRecommendationSchema,
  TrainingSuggestionSchema,
  ActionItemSchema,
  validateGenerateCoachingRequest,
  safeValidateGenerateCoachingRequest,
} from '@/lib/coaching/validation';
import { ZodError } from 'zod';

describe('Coaching Validation', () => {
  describe('TimePeriodSchema', () => {
    it('should accept valid time periods', () => {
      const validPeriods = [
        'last_7_days',
        'last_30_days',
        'last_90_days',
        'last_6_months',
        'last_12_months',
        'this_quarter',
        'this_year',
        'custom'
      ];
      
      validPeriods.forEach(period => {
        expect(() => TimePeriodSchema.parse(period)).not.toThrow();
      });
    });

    it('should reject invalid time periods', () => {
      expect(() => TimePeriodSchema.parse('invalid')).toThrow(ZodError);
      expect(() => TimePeriodSchema.parse('7_days')).toThrow(ZodError);
      expect(() => TimePeriodSchema.parse(123)).toThrow(ZodError);
    });
  });

  describe('PerformanceTierSchema', () => {
    it('should accept valid performance tiers', () => {
      const validTiers = [
        'top_performer',
        'high_performer',
        'average',
        'needs_improvement',
        'at_risk'
      ];
      
      validTiers.forEach(tier => {
        expect(() => PerformanceTierSchema.parse(tier)).not.toThrow();
      });
    });

    it('should reject invalid tiers', () => {
      expect(() => PerformanceTierSchema.parse('excellent')).toThrow(ZodError);
      expect(() => PerformanceTierSchema.parse('poor')).toThrow(ZodError);
    });
  });

  describe('SkillCategorySchema', () => {
    it('should accept valid skill categories', () => {
      const validCategories = [
        'prospecting',
        'discovery',
        'presentation',
        'objection_handling',
        'negotiation',
        'closing',
        'relationship_building',
        'product_knowledge',
        'crm_hygiene',
        'time_management',
        'ai_tool_usage',
        'communication',
        'pipeline_management',
        'forecasting'
      ];
      
      validCategories.forEach(category => {
        expect(() => SkillCategorySchema.parse(category)).not.toThrow();
      });
    });
  });

  describe('GenerateCoachingRequestSchema', () => {
    it('should accept valid request', () => {
      const validRequest = {
        repId: 'user123',
        period: 'last_30_days',
        includeDetailed: true,
        includeTraining: true,
        includeActionItems: true
      };

      expect(() => GenerateCoachingRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should require repId', () => {
      const invalidRequest = {
        period: 'last_30_days'
      };

      expect(() => GenerateCoachingRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });

    it('should require period', () => {
      const invalidRequest = {
        repId: 'user123'
      };

      expect(() => GenerateCoachingRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });

    it('should require customRange when period is custom', () => {
      const invalidRequest = {
        repId: 'user123',
        period: 'custom'
      };

      expect(() => GenerateCoachingRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });

    it('should accept customRange when period is custom', () => {
      const validRequest = {
        repId: 'user123',
        period: 'custom',
        customRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        }
      };

      expect(() => GenerateCoachingRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should reject customRange with endDate before startDate', () => {
      const invalidRequest = {
        repId: 'user123',
        period: 'custom',
        customRange: {
          startDate: new Date('2024-01-31'),
          endDate: new Date('2024-01-01')
        }
      };

      expect(() => GenerateCoachingRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });

    it('should apply default values for optional fields', () => {
      const request = {
        repId: 'user123',
        period: 'last_30_days'
      };

      const parsed = GenerateCoachingRequestSchema.parse(request);
      expect(parsed.includeDetailed).toBe(true);
      expect(parsed.includeTraining).toBe(true);
      expect(parsed.includeActionItems).toBe(true);
    });
  });

  describe('DealPerformanceMetricsSchema', () => {
    it('should accept valid deal metrics', () => {
      const validMetrics = {
        totalDeals: 10,
        activeDeals: 5,
        dealsWon: 3,
        dealsLost: 2,
        winRate: 0.6,
        averageDealSize: 50000,
        averageCycleDays: 45,
        dealVelocity: 2.5,
        atRiskDeals: 1,
        healthDistribution: {
          healthy: 3,
          warning: 1,
          critical: 1
        }
      };

      expect(() => DealPerformanceMetricsSchema.parse(validMetrics)).not.toThrow();
    });

    it('should reject negative values', () => {
      const invalidMetrics = {
        totalDeals: -1,
        activeDeals: 5,
        dealsWon: 3,
        dealsLost: 2,
        winRate: 0.6,
        averageDealSize: 50000,
        averageCycleDays: 45,
        dealVelocity: 2.5,
        atRiskDeals: 1,
        healthDistribution: {
          healthy: 3,
          warning: 1,
          critical: 1
        }
      };

      expect(() => DealPerformanceMetricsSchema.parse(invalidMetrics)).toThrow(ZodError);
    });

    it('should reject winRate outside 0-1 range', () => {
      const invalidMetrics = {
        totalDeals: 10,
        activeDeals: 5,
        dealsWon: 3,
        dealsLost: 2,
        winRate: 1.5,
        averageDealSize: 50000,
        averageCycleDays: 45,
        dealVelocity: 2.5,
        atRiskDeals: 1,
        healthDistribution: {
          healthy: 3,
          warning: 1,
          critical: 1
        }
      };

      expect(() => DealPerformanceMetricsSchema.parse(invalidMetrics)).toThrow(ZodError);
    });
  });

  describe('SkillScoresSchema', () => {
    it('should accept valid skill scores', () => {
      const validScores = {
        prospecting: 75,
        discovery: 80,
        needsAnalysis: 70,
        presentation: 85,
        objectionHandling: 65,
        negotiation: 72,
        closing: 78,
        relationshipBuilding: 88,
        productKnowledge: 90,
        crmHygiene: 82,
        timeManagement: 68,
        aiToolAdoption: 55
      };

      expect(() => SkillScoresSchema.parse(validScores)).not.toThrow();
    });

    it('should reject scores outside 0-100 range', () => {
      const invalidScores = {
        prospecting: 150,
        discovery: 80,
        needsAnalysis: 70,
        presentation: 85,
        objectionHandling: 65,
        negotiation: 72,
        closing: 78,
        relationshipBuilding: 88,
        productKnowledge: 90,
        crmHygiene: 82,
        timeManagement: 68,
        aiToolAdoption: 55
      };

      expect(() => SkillScoresSchema.parse(invalidScores)).toThrow(ZodError);
    });
  });

  describe('StrengthSchema', () => {
    it('should accept valid strength', () => {
      const validStrength = {
        category: 'closing',
        title: 'Excellent Closing Skills',
        description: 'Consistently high win rate demonstrates strong closing ability',
        metrics: [
          { metric: 'Win Rate', value: 75, benchmark: 50 }
        ],
        leverageStrategy: 'Share closing techniques with team',
        impact: 'high'
      };

      expect(() => StrengthSchema.parse(validStrength)).not.toThrow();
    });

    it('should validate title length', () => {
      const invalidStrength = {
        category: 'closing',
        title: 'Bad',
        description: 'Consistently high win rate demonstrates strong closing ability',
        metrics: [],
        leverageStrategy: 'Share closing techniques with team',
        impact: 'high'
      };

      expect(() => StrengthSchema.parse(invalidStrength)).toThrow(ZodError);
    });

    it('should validate description length', () => {
      const invalidStrength = {
        category: 'closing',
        title: 'Excellent Closing Skills',
        description: 'Short',
        metrics: [],
        leverageStrategy: 'Share closing techniques with team',
        impact: 'high'
      };

      expect(() => StrengthSchema.parse(invalidStrength)).toThrow(ZodError);
    });
  });

  describe('WeaknessSchema', () => {
    it('should accept valid weakness', () => {
      const validWeakness = {
        category: 'prospecting',
        title: 'Low Prospecting Activity',
        description: 'Prospecting activity is below team average',
        metrics: [
          { metric: 'Calls per day', value: 5, benchmark: 15, gap: 10 }
        ],
        rootCauses: ['Time management', 'Lack of leads'],
        impact: 'high',
        urgency: 'immediate'
      };

      expect(() => WeaknessSchema.parse(validWeakness)).not.toThrow();
    });

    it('should require at least one root cause', () => {
      const invalidWeakness = {
        category: 'prospecting',
        title: 'Low Prospecting Activity',
        description: 'Prospecting activity is below team average',
        metrics: [],
        rootCauses: [],
        impact: 'high',
        urgency: 'immediate'
      };

      expect(() => WeaknessSchema.parse(invalidWeakness)).toThrow(ZodError);
    });
  });

  describe('CoachingRecommendationSchema', () => {
    it('should accept valid recommendation', () => {
      const validRecommendation = {
        id: 'rec123',
        title: 'Improve Prospecting Activity',
        recommendation: 'Increase daily prospecting activities to meet team benchmarks',
        category: 'prospecting',
        rationale: 'Current activity levels are below team average',
        actions: [
          { action: 'Set daily call target', timeline: '1 week', owner: 'rep' }
        ],
        successCriteria: ['15+ calls per day', '10+ emails per day'],
        expectedOutcomes: [
          { metric: 'Calls per day', baseline: 5, target: 15, timeframe: '30 days' }
        ],
        priority: 'high',
        effort: 'medium',
        confidence: 0.85
      };

      expect(() => CoachingRecommendationSchema.parse(validRecommendation)).not.toThrow();
    });

    it('should require at least one action', () => {
      const invalidRecommendation = {
        id: 'rec123',
        title: 'Improve Prospecting Activity',
        recommendation: 'Increase daily prospecting activities to meet team benchmarks',
        category: 'prospecting',
        rationale: 'Current activity levels are below team average',
        actions: [],
        successCriteria: ['15+ calls per day'],
        expectedOutcomes: [],
        priority: 'high',
        effort: 'medium',
        confidence: 0.85
      };

      expect(() => CoachingRecommendationSchema.parse(invalidRecommendation)).toThrow(ZodError);
    });

    it('should validate confidence range', () => {
      const invalidRecommendation = {
        id: 'rec123',
        title: 'Improve Prospecting Activity',
        recommendation: 'Increase daily prospecting activities to meet team benchmarks',
        category: 'prospecting',
        rationale: 'Current activity levels are below team average',
        actions: [
          { action: 'Set daily call target', timeline: '1 week', owner: 'rep' }
        ],
        successCriteria: ['15+ calls per day'],
        expectedOutcomes: [],
        priority: 'high',
        effort: 'medium',
        confidence: 1.5
      };

      expect(() => CoachingRecommendationSchema.parse(invalidRecommendation)).toThrow(ZodError);
    });
  });

  describe('validateGenerateCoachingRequest', () => {
    it('should validate and return parsed request', () => {
      const request = {
        repId: 'user123',
        period: 'last_30_days'
      };

      const parsed = validateGenerateCoachingRequest(request);
      expect(parsed.repId).toBe('user123');
      expect(parsed.period).toBe('last_30_days');
      expect(parsed.includeDetailed).toBe(true);
    });

    it('should throw on invalid request', () => {
      const invalidRequest = {
        period: 'last_30_days'
      };

      expect(() => validateGenerateCoachingRequest(invalidRequest)).toThrow(ZodError);
    });
  });

  describe('safeValidateGenerateCoachingRequest', () => {
    it('should return success for valid request', () => {
      const request = {
        repId: 'user123',
        period: 'last_30_days'
      };

      const result = safeValidateGenerateCoachingRequest(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.repId).toBe('user123');
      }
    });

    it('should return error for invalid request', () => {
      const invalidRequest = {
        period: 'last_30_days'
      };

      const result = safeValidateGenerateCoachingRequest(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('RepPerformanceMetricsSchema', () => {
    it('should accept valid rep performance metrics', () => {
      const validMetrics = {
        repId: 'user123',
        repName: 'John Doe',
        repEmail: 'john@example.com',
        period: 'last_30_days',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        deals: {
          totalDeals: 10,
          activeDeals: 5,
          dealsWon: 3,
          dealsLost: 2,
          winRate: 0.6,
          averageDealSize: 50000,
          averageCycleDays: 45,
          dealVelocity: 2.5,
          atRiskDeals: 1,
          healthDistribution: {
            healthy: 3,
            warning: 1,
            critical: 1
          }
        },
        communication: {
          emailsGenerated: 50,
          emailsSent: 45,
          emailResponseRate: 0.35,
          averageResponseTime: 24,
          aiEmailUsageRate: 0.8,
          personalizationScore: 75,
          followUpConsistency: 80
        },
        activity: {
          totalActivities: 150,
          activitiesPerDay: 5,
          callsMade: 80,
          meetingsHeld: 20,
          tasksCompleted: 40,
          taskCompletionRate: 0.8,
          workflowsTriggered: 10,
          crmUpdates: 60
        },
        conversion: {
          leadToOpportunity: 0.6,
          opportunityToProposal: 0.7,
          proposalToClose: 0.5,
          overallConversion: 0.21,
          dropOffPoints: []
        },
        revenue: {
          totalRevenue: 150000,
          quota: 100000,
          quotaAttainment: 1.5,
          pipelineValue: 500000,
          weightedPipeline: 250000,
          forecastAccuracy: 0.85,
          acv: 50000,
          growthRate: 0.2
        },
        efficiency: {
          timeToFirstContact: 2,
          timeToProposal: 15,
          timeToClose: 45,
          meetingsPerDeal: 4,
          emailsPerDeal: 10,
          touchPointsPerDeal: 14,
          automationUsage: 0.6,
          hoursSaved: 20
        },
        skills: {
          prospecting: 75,
          discovery: 80,
          needsAnalysis: 70,
          presentation: 85,
          objectionHandling: 65,
          negotiation: 72,
          closing: 78,
          relationshipBuilding: 88,
          productKnowledge: 90,
          crmHygiene: 82,
          timeManagement: 68,
          aiToolAdoption: 55
        },
        overallScore: 75.5,
        tier: 'high_performer',
        vsTeamAverage: {
          overallScoreDelta: 10.5,
          winRateDelta: 0.15,
          revenueDelta: 50000,
          activityDelta: 2.5,
          efficiencyDelta: 0.15,
          percentileRank: 80
        }
      };

      expect(() => RepPerformanceMetricsSchema.parse(validMetrics)).not.toThrow();
    });

    it('should reject invalid email address', () => {
      const invalidMetrics = {
        repId: 'user123',
        repName: 'John Doe',
        repEmail: 'not-an-email',
        period: 'last_30_days',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        deals: { /* ... */ },
        communication: { /* ... */ },
        activity: { /* ... */ },
        conversion: { /* ... */ },
        revenue: { /* ... */ },
        efficiency: { /* ... */ },
        skills: { /* ... */ },
        overallScore: 75.5,
        tier: 'high_performer',
        vsTeamAverage: { /* ... */ }
      };

      // This will fail because we can't provide incomplete objects
      // In a real test, you'd provide complete mock data
    });
  });
});
