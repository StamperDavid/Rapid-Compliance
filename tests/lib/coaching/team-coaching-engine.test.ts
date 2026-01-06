/**
 * Team Coaching Engine Tests
 * 
 * Tests for team-level coaching insights, skill gap analysis, and priorities
 */

import { TeamCoachingEngine } from '@/lib/coaching/team-coaching-engine';
import { CoachingAnalyticsEngine } from '@/lib/coaching/coaching-analytics-engine';
import type {
  RepPerformanceMetrics,
  TeamCoachingInsights,
  GenerateTeamCoachingRequest,
  PerformanceTier
} from '@/lib/coaching/types';

// Mock CoachingAnalyticsEngine
jest.mock('@/lib/coaching/coaching-analytics-engine');

describe('TeamCoachingEngine', () => {
  let teamEngine: TeamCoachingEngine;
  let mockAnalyticsEngine: jest.Mocked<CoachingAnalyticsEngine>;
  
  beforeEach(() => {
    // Create mock analytics engine
    mockAnalyticsEngine = new CoachingAnalyticsEngine(null as any) as jest.Mocked<CoachingAnalyticsEngine>;
    
    // Create team coaching engine
    teamEngine = new TeamCoachingEngine(mockAnalyticsEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTeamInsights', () => {
    const mockRequest: GenerateTeamCoachingRequest = {
      teamId: 'team_001',
      period: 'last_30_days',
      includeRepDetails: true
    };

    const mockRepPerformance: RepPerformanceMetrics[] = [
      {
        repId: 'rep_001',
        repName: 'John Doe',
        repEmail: 'john@example.com',
        period: 'last_30_days',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        deals: {
          totalDeals: 20,
          activeDeals: 10,
          dealsWon: 8,
          dealsLost: 2,
          winRate: 0.8,
          averageDealSize: 50000,
          averageCycleDays: 30,
          dealVelocity: 2.0,
          atRiskDeals: 1,
          healthDistribution: { healthy: 7, warning: 2, critical: 1 }
        },
        communication: {
          emailsGenerated: 50,
          emailsSent: 45,
          emailResponseRate: 0.8,
          averageResponseTime: 2,
          aiEmailUsageRate: 0.7,
          personalizationScore: 85,
          followUpConsistency: 90
        },
        activity: {
          totalActivities: 100,
          activitiesPerDay: 5,
          callsMade: 30,
          meetingsHeld: 15,
          tasksCompleted: 40,
          taskCompletionRate: 0.9,
          workflowsTriggered: 10,
          crmUpdates: 50
        },
        conversion: {
          leadToOpportunity: 0.6,
          opportunityToProposal: 0.7,
          proposalToClose: 0.8,
          overallConversion: 0.34,
          dropOffPoints: []
        },
        revenue: {
          totalRevenue: 400000,
          quota: 400000,
          quotaAttainment: 1.0,
          pipelineValue: 500000,
          weightedPipeline: 350000,
          forecastAccuracy: 0.9,
          acv: 50000,
          growthRate: 0.15
        },
        efficiency: {
          timeToFirstContact: 1,
          timeToProposal: 10,
          timeToClose: 30,
          meetingsPerDeal: 3,
          emailsPerDeal: 10,
          touchPointsPerDeal: 15,
          automationUsage: 0.8,
          hoursSaved: 10
        },
        skills: {
          prospecting: 85,
          discovery: 90,
          needsAnalysis: 88,
          presentation: 82,
          objectionHandling: 80,
          negotiation: 85,
          closing: 88,
          relationshipBuilding: 92,
          productKnowledge: 85,
          crmHygiene: 90,
          timeManagement: 85,
          aiToolAdoption: 95
        },
        overallScore: 87,
        tier: 'top_performer',
        vsTeamAverage: {
          overallScoreDelta: 10,
          winRateDelta: 0.1,
          revenueDelta: 50000,
          activityDelta: 10,
          efficiencyDelta: 5,
          percentileRank: 90
        }
      },
      {
        repId: 'rep_002',
        repName: 'Jane Smith',
        repEmail: 'jane@example.com',
        period: 'last_30_days',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        deals: {
          totalDeals: 15,
          activeDeals: 8,
          dealsWon: 5,
          dealsLost: 2,
          winRate: 0.71,
          averageDealSize: 45000,
          averageCycleDays: 35,
          dealVelocity: 1.5,
          atRiskDeals: 2,
          healthDistribution: { healthy: 5, warning: 2, critical: 1 }
        },
        communication: {
          emailsGenerated: 40,
          emailsSent: 35,
          emailResponseRate: 0.7,
          averageResponseTime: 3,
          aiEmailUsageRate: 0.6,
          personalizationScore: 75,
          followUpConsistency: 80
        },
        activity: {
          totalActivities: 80,
          activitiesPerDay: 4,
          callsMade: 25,
          meetingsHeld: 12,
          tasksCompleted: 30,
          taskCompletionRate: 0.8,
          workflowsTriggered: 8,
          crmUpdates: 40
        },
        conversion: {
          leadToOpportunity: 0.5,
          opportunityToProposal: 0.6,
          proposalToClose: 0.7,
          overallConversion: 0.21,
          dropOffPoints: []
        },
        revenue: {
          totalRevenue: 225000,
          quota: 300000,
          quotaAttainment: 0.75,
          pipelineValue: 350000,
          weightedPipeline: 245000,
          forecastAccuracy: 0.8,
          acv: 45000,
          growthRate: 0.08
        },
        efficiency: {
          timeToFirstContact: 2,
          timeToProposal: 12,
          timeToClose: 35,
          meetingsPerDeal: 3.5,
          emailsPerDeal: 12,
          touchPointsPerDeal: 18,
          automationUsage: 0.6,
          hoursSaved: 6
        },
        skills: {
          prospecting: 75,
          discovery: 78,
          needsAnalysis: 72,
          presentation: 70,
          objectionHandling: 65,
          negotiation: 68,
          closing: 70,
          relationshipBuilding: 80,
          productKnowledge: 75,
          crmHygiene: 85,
          timeManagement: 72,
          aiToolAdoption: 70
        },
        overallScore: 73,
        tier: 'high_performer',
        vsTeamAverage: {
          overallScoreDelta: -4,
          winRateDelta: 0.01,
          revenueDelta: -125000,
          activityDelta: -10,
          efficiencyDelta: -2,
          percentileRank: 60
        }
      },
      {
        repId: 'rep_003',
        repName: 'Bob Johnson',
        repEmail: 'bob@example.com',
        period: 'last_30_days',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        deals: {
          totalDeals: 10,
          activeDeals: 6,
          dealsWon: 3,
          dealsLost: 1,
          winRate: 0.75,
          averageDealSize: 40000,
          averageCycleDays: 40,
          dealVelocity: 1.0,
          atRiskDeals: 3,
          healthDistribution: { healthy: 3, warning: 2, critical: 1 }
        },
        communication: {
          emailsGenerated: 30,
          emailsSent: 25,
          emailResponseRate: 0.5,
          averageResponseTime: 5,
          aiEmailUsageRate: 0.4,
          personalizationScore: 60,
          followUpConsistency: 65
        },
        activity: {
          totalActivities: 60,
          activitiesPerDay: 3,
          callsMade: 20,
          meetingsHeld: 10,
          tasksCompleted: 20,
          taskCompletionRate: 0.7,
          workflowsTriggered: 5,
          crmUpdates: 30
        },
        conversion: {
          leadToOpportunity: 0.4,
          opportunityToProposal: 0.5,
          proposalToClose: 0.6,
          overallConversion: 0.12,
          dropOffPoints: []
        },
        revenue: {
          totalRevenue: 120000,
          quota: 300000,
          quotaAttainment: 0.4,
          pipelineValue: 200000,
          weightedPipeline: 140000,
          forecastAccuracy: 0.6,
          acv: 40000,
          growthRate: -0.05
        },
        efficiency: {
          timeToFirstContact: 4,
          timeToProposal: 15,
          timeToClose: 45,
          meetingsPerDeal: 4,
          emailsPerDeal: 15,
          touchPointsPerDeal: 20,
          automationUsage: 0.3,
          hoursSaved: 3
        },
        skills: {
          prospecting: 60,
          discovery: 62,
          needsAnalysis: 58,
          presentation: 55,
          objectionHandling: 50,
          negotiation: 52,
          closing: 55,
          relationshipBuilding: 65,
          productKnowledge: 60,
          crmHygiene: 70,
          timeManagement: 55,
          aiToolAdoption: 45
        },
        overallScore: 58,
        tier: 'needs_improvement',
        vsTeamAverage: {
          overallScoreDelta: -19,
          winRateDelta: 0.05,
          revenueDelta: -230000,
          activityDelta: -30,
          efficiencyDelta: -10,
          percentileRank: 25
        }
      }
    ];

    beforeEach(() => {
      // Mock analyzeRepPerformance to return rep performance
      mockAnalyticsEngine.analyzeRepPerformance = jest.fn()
        .mockImplementation(async (repId: string) => {
          return mockRepPerformance.find(r => r.repId === repId)!;
        });
    });

    it('should generate team insights successfully', async () => {
      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      expect(result).toBeDefined();
      expect(result.teamId).toBe('team_001');
      expect(result.teamName).toBe('Sales Team Alpha');
      expect(result.period).toBe('last_30_days');
    });

    it('should aggregate team metrics correctly', async () => {
      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      const summary = result.teamSummary;

      expect(summary.totalReps).toBe(3);
      expect(summary.performanceDistribution).toHaveLength(5); // All tiers
      expect(summary.teamAverages.overallScore).toBeGreaterThan(0);
      expect(summary.teamAverages.winRate).toBeGreaterThan(0);
      expect(summary.teamAverages.quotaAttainment).toBeGreaterThan(0);
    });

    it('should identify top performers correctly', async () => {
      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      expect(result.topPerformers.length).toBeGreaterThan(0);
      expect(result.topPerformers[0].repId).toBe('rep_001'); // John Doe is top performer
      expect(result.topPerformers[0].score).toBe(87);
      expect(result.topPerformers[0].strengths.length).toBeGreaterThan(0);
    });

    it('should identify reps needing support correctly', async () => {
      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      expect(result.needsSupport.length).toBeGreaterThan(0);
      expect(result.needsSupport[0].repId).toBe('rep_003'); // Bob Johnson needs improvement
      expect(result.needsSupport[0].score).toBe(58);
      expect(result.needsSupport[0].criticalAreas.length).toBeGreaterThan(0);
    });

    it('should analyze skill gaps correctly', async () => {
      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      expect(result.skillGaps.length).toBeGreaterThan(0);
      
      // Verify skill gap structure
      result.skillGaps.forEach(gap => {
        expect(gap).toHaveProperty('skill');
        expect(gap).toHaveProperty('teamAverage');
        expect(gap).toHaveProperty('topPerformerAverage');
        expect(gap).toHaveProperty('gap');
        expect(gap).toHaveProperty('repsAffected');
        
        // Gap should be positive (top performers > team average)
        expect(gap.gap).toBeGreaterThan(0);
      });
    });

    it('should extract best practices from top performers', async () => {
      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      expect(result.bestPracticesToShare).toBeDefined();
      
      // Verify best practice structure
      result.bestPracticesToShare.forEach(practice => {
        expect(practice).toHaveProperty('title');
        expect(practice).toHaveProperty('description');
        expect(practice).toHaveProperty('category');
        expect(practice).toHaveProperty('topPerformers');
        expect(practice).toHaveProperty('successMetrics');
        expect(practice).toHaveProperty('implementationSteps');
        expect(practice).toHaveProperty('expectedImpact');
        
        expect(practice.implementationSteps.length).toBeGreaterThan(0);
      });
    });

    it('should determine team priorities correctly', async () => {
      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      expect(result.teamPriorities.length).toBeGreaterThan(0);
      
      // Verify priority structure
      result.teamPriorities.forEach(priority => {
        expect(priority).toHaveProperty('area');
        expect(priority).toHaveProperty('importance');
        expect(priority).toHaveProperty('repsAffected');
        expect(priority).toHaveProperty('potentialImpact');
        
        // Importance should be 0-100
        expect(priority.importance).toBeGreaterThanOrEqual(0);
        expect(priority.importance).toBeLessThanOrEqual(100);
      });

      // Priorities should be sorted by importance (descending)
      for (let i = 0; i < result.teamPriorities.length - 1; i++) {
        expect(result.teamPriorities[i].importance).toBeGreaterThanOrEqual(
          result.teamPriorities[i + 1].importance
        );
      }
    });

    it('should identify team strengths correctly', async () => {
      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      expect(result.teamStrengths).toBeDefined();
      expect(Array.isArray(result.teamStrengths)).toBe(true);
      
      // Should have some strengths
      result.teamStrengths.forEach(strength => {
        expect(typeof strength).toBe('string');
        expect(strength.length).toBeGreaterThan(0);
      });
    });

    it('should identify team weaknesses correctly', async () => {
      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      expect(result.teamWeaknesses).toBeDefined();
      expect(Array.isArray(result.teamWeaknesses)).toBe(true);
      
      // Should have some weaknesses (Bob is at 40% quota)
      expect(result.teamWeaknesses.length).toBeGreaterThan(0);
      
      result.teamWeaknesses.forEach(weakness => {
        expect(typeof weakness).toBe('string');
        expect(weakness.length).toBeGreaterThan(0);
      });
    });

    it('should handle custom date range correctly', async () => {
      const customRequest: GenerateTeamCoachingRequest = {
        teamId: 'team_001',
        period: 'custom',
        customRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        },
        includeRepDetails: true
      };

      const teamMemberIds = ['rep_001', 'rep_002'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        customRequest,
        teamMemberIds,
        teamName
      );

      expect(result.startDate).toEqual(customRequest.customRange!.startDate);
      expect(result.endDate).toEqual(customRequest.customRange!.endDate);
    });

    it('should respect includeRepDetails flag', async () => {
      const requestWithoutDetails: GenerateTeamCoachingRequest = {
        teamId: 'team_001',
        period: 'last_30_days',
        includeRepDetails: false
      };

      const teamMemberIds = ['rep_001', 'rep_002', 'rep_003'];
      const teamName = 'Sales Team Alpha';

      const result = await teamEngine.generateTeamInsights(
        requestWithoutDetails,
        teamMemberIds,
        teamName
      );

      // Should not include rep details
      expect(result.repInsights).toHaveLength(0);
      
      // But should still have summary
      expect(result.teamSummary).toBeDefined();
      expect(result.topPerformers).toBeDefined();
      expect(result.needsSupport).toBeDefined();
    });

    it('should cache team insights', async () => {
      const teamMemberIds = ['rep_001', 'rep_002'];
      const teamName = 'Sales Team Alpha';

      // First call
      const result1 = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      // Second call (should be cached)
      const result2 = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      // Should return same result
      expect(result1.generatedAt).toEqual(result2.generatedAt);
      
      // Analytics engine should only be called once per rep (first call)
      expect(mockAnalyticsEngine.analyzeRepPerformance).toHaveBeenCalledTimes(2);
    });

    it('should clear cache correctly', async () => {
      const teamMemberIds = ['rep_001'];
      const teamName = 'Sales Team Alpha';

      // First call
      await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      // Clear cache
      teamEngine.clearCache();

      // Second call (should regenerate)
      await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      // Analytics engine should be called twice (once per call)
      expect(mockAnalyticsEngine.analyzeRepPerformance).toHaveBeenCalledTimes(2);
    });

    it('should handle empty team correctly', async () => {
      const teamMemberIds: string[] = [];
      const teamName = 'Empty Team';

      const result = await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      expect(result.teamSummary.totalReps).toBe(0);
      expect(result.topPerformers).toHaveLength(0);
      expect(result.needsSupport).toHaveLength(0);
      expect(result.skillGaps).toHaveLength(0);
    });

    it('should process reps in batches', async () => {
      // Create a team with 12 members (should be 3 batches of 5)
      const teamMemberIds = Array.from({ length: 12 }, (_, i) => `rep_${i.toString().padStart(3, '0')}`);
      const teamName = 'Large Team';

      // Mock performance for all reps
      mockAnalyticsEngine.analyzeRepPerformance = jest.fn()
        .mockResolvedValue(mockRepPerformance[0]);

      await teamEngine.generateTeamInsights(
        mockRequest,
        teamMemberIds,
        teamName
      );

      // Should have called analyzeRepPerformance 12 times
      expect(mockAnalyticsEngine.analyzeRepPerformance).toHaveBeenCalledTimes(12);
    });
  });

  describe('date range calculation', () => {
    it('should calculate last_7_days correctly', async () => {
      const request: GenerateTeamCoachingRequest = {
        teamId: 'team_001',
        period: 'last_7_days',
        includeRepDetails: false
      };

      mockAnalyticsEngine.analyzeRepPerformance = jest.fn()
        .mockResolvedValue({} as any);

      const result = await teamEngine.generateTeamInsights(
        request,
        [],
        'Test Team'
      );

      const daysDiff = Math.floor(
        (result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      expect(daysDiff).toBeCloseTo(7, 0);
    });

    it('should calculate last_30_days correctly', async () => {
      const request: GenerateTeamCoachingRequest = {
        teamId: 'team_001',
        period: 'last_30_days',
        includeRepDetails: false
      };

      mockAnalyticsEngine.analyzeRepPerformance = jest.fn()
        .mockResolvedValue({} as any);

      const result = await teamEngine.generateTeamInsights(
        request,
        [],
        'Test Team'
      );

      const daysDiff = Math.floor(
        (result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      expect(daysDiff).toBeCloseTo(30, 0);
    });

    it('should calculate this_quarter correctly', async () => {
      const request: GenerateTeamCoachingRequest = {
        teamId: 'team_001',
        period: 'this_quarter',
        includeRepDetails: false
      };

      mockAnalyticsEngine.analyzeRepPerformance = jest.fn()
        .mockResolvedValue({} as any);

      const result = await teamEngine.generateTeamInsights(
        request,
        [],
        'Test Team'
      );

      // Start date should be first day of current quarter
      const currentDate = new Date();
      const quarter = Math.floor(currentDate.getMonth() / 3);
      const expectedStartMonth = quarter * 3;
      
      expect(result.startDate.getMonth()).toBe(expectedStartMonth);
      expect(result.startDate.getDate()).toBe(1);
    });
  });
});
