/**
 * Lead Routing Engine Tests
 * 
 * Comprehensive unit tests for the intelligent lead routing system.
 * Tests cover lead quality assessment, rep scoring, routing strategies,
 * and assignment generation.
 */

import { LeadRoutingEngine } from '@/lib/routing/routing-engine';
import type {
  Lead,
  SalesRep,
  RoutingConfiguration,
  RoutingRule,
  RoutingCondition,
} from '@/lib/routing/types';

describe('LeadRoutingEngine', () => {
  let engine: LeadRoutingEngine;
  let mockLead: Lead;
  let mockReps: SalesRep[];
  let mockConfig: RoutingConfiguration;

  beforeEach(() => {
    engine = new LeadRoutingEngine();

    // Mock lead
    mockLead = {
      id: 'lead_test_123',
      orgId: 'org_test',
      companyName: 'Test Company',
      contactName: 'John Doe',
      contactEmail: 'john@test.com',
      source: 'inbound_website',
      qualityScore: 85,
      intentScore: 90,
      fitScore: 80,
      priority: 'hot',
      estimatedValue: 50000,
      companySize: 'mid_market',
      industry: 'Technology',
      country: 'USA',
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock sales reps
    mockReps = [
      {
        id: 'rep_1',
        orgId: 'org_test',
        name: 'Alice Johnson',
        email: 'alice@company.com',
        performanceTier: 'top_performer',
        overallScore: 92,
        skillScores: {
          prospecting: 95,
          discovery: 90,
          needsAnalysis: 88,
          presentation: 92,
          objectionHandling: 90,
          negotiation: 87,
          closing: 94,
          relationshipBuilding: 91,
          productKnowledge: 89,
          crmHygiene: 85,
          timeManagement: 88,
          aiToolAdoption: 93,
        },
        capacity: {
          maxActiveLeads: 50,
          maxNewLeadsPerDay: 5,
          maxNewLeadsPerWeek: 20,
        },
        currentWorkload: {
          activeLeads: 30,
          leadsAssignedToday: 2,
          leadsAssignedThisWeek: 8,
          totalPipelineValue: 500000,
          utilizationPercentage: 60,
          isAtCapacity: false,
          remainingCapacity: {
            leads: 20,
            dailyLeads: 3,
            weeklyLeads: 12,
          },
        },
        specializations: {
          industries: ['Technology', 'SaaS'],
          companySizes: ['enterprise', 'mid_market'],
        },
        territories: [],
        isAvailable: true,
        availabilityStatus: 'available',
        routingPreferences: {
          preferredSources: ['inbound_website', 'inbound_form'],
          autoAccept: true,
          notifyOnAssignment: true,
          notifyOnHotLead: true,
        },
      },
      {
        id: 'rep_2',
        orgId: 'org_test',
        name: 'Bob Smith',
        email: 'bob@company.com',
        performanceTier: 'high_performer',
        overallScore: 85,
        skillScores: {
          prospecting: 82,
          discovery: 88,
          needsAnalysis: 85,
          presentation: 87,
          objectionHandling: 84,
          negotiation: 83,
          closing: 86,
          relationshipBuilding: 88,
          productKnowledge: 82,
          crmHygiene: 80,
          timeManagement: 85,
          aiToolAdoption: 84,
        },
        capacity: {
          maxActiveLeads: 40,
          maxNewLeadsPerDay: 4,
          maxNewLeadsPerWeek: 16,
        },
        currentWorkload: {
          activeLeads: 20,
          leadsAssignedToday: 1,
          leadsAssignedThisWeek: 4,
          totalPipelineValue: 300000,
          utilizationPercentage: 50,
          isAtCapacity: false,
          remainingCapacity: {
            leads: 20,
            dailyLeads: 3,
            weeklyLeads: 12,
          },
        },
        specializations: {
          industries: ['Healthcare', 'Finance'],
          companySizes: ['mid_market', 'smb'],
        },
        territories: [],
        isAvailable: true,
        availabilityStatus: 'available',
        routingPreferences: {
          autoAccept: true,
          notifyOnAssignment: true,
          notifyOnHotLead: true,
        },
      },
      {
        id: 'rep_3',
        orgId: 'org_test',
        name: 'Carol Davis',
        email: 'carol@company.com',
        performanceTier: 'average',
        overallScore: 72,
        skillScores: {
          prospecting: 70,
          discovery: 75,
          needsAnalysis: 72,
          presentation: 74,
          objectionHandling: 70,
          negotiation: 68,
          closing: 73,
          relationshipBuilding: 76,
          productKnowledge: 71,
          crmHygiene: 69,
          timeManagement: 72,
          aiToolAdoption: 75,
        },
        capacity: {
          maxActiveLeads: 30,
          maxNewLeadsPerDay: 3,
          maxNewLeadsPerWeek: 12,
        },
        currentWorkload: {
          activeLeads: 28,
          leadsAssignedToday: 3,
          leadsAssignedThisWeek: 11,
          totalPipelineValue: 200000,
          utilizationPercentage: 93,
          isAtCapacity: true, // At capacity
          remainingCapacity: {
            leads: 2,
            dailyLeads: 0,
            weeklyLeads: 1,
          },
        },
        specializations: {
          industries: ['Retail', 'E-commerce'],
          companySizes: ['smb', 'startup'],
        },
        territories: [],
        isAvailable: true,
        availabilityStatus: 'busy',
        routingPreferences: {
          autoAccept: false,
          notifyOnAssignment: true,
          notifyOnHotLead: true,
        },
      },
    ];

    // Mock routing configuration
    mockConfig = {
      orgId: 'org_test',
      defaultStrategy: 'performance_weighted',
      strategyWeights: {
        performance: 0.35,
        capacity: 0.20,
        specialization: 0.25,
        territory: 0.15,
        availability: 0.05,
      },
      hotLeadRouting: {
        enabled: true,
        threshold: 80,
        routeToTopPerformers: true,
        topPerformerPercentile: 20,
      },
      workloadBalancing: {
        enabled: true,
        balanceThreshold: 30,
        rebalanceInterval: 24,
      },
      roundRobin: {
        enabled: false,
        resetInterval: 'daily',
        skipAtCapacity: true,
      },
      reassignment: {
        allowReassignment: true,
        maxReassignments: 3,
        reassignAfterDays: 7,
        reassignIfNoContact: true,
      },
      queue: {
        enabled: true,
        maxQueueTime: 24,
        escalateAfter: 4,
      },
      notifications: {
        notifyRepOnAssignment: true,
        notifyManagerOnHotLead: true,
        notifyOnQueueEscalation: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('Lead Quality Assessment', () => {
    test('should assess high-quality hot lead correctly', () => {
      const quality = engine.assessLeadQuality(mockLead);

      expect(quality.overallScore).toBeGreaterThanOrEqual(80);
      expect(quality.tier).toBe('premium');
      expect(quality.routingPriority).toBeGreaterThanOrEqual(8);
      expect(quality.scores.intent).toBe(90);
      expect(quality.scores.fit).toBe(80);
    });

    test('should assess medium-quality lead correctly', () => {
      const mediumLead = {
        ...mockLead,
        qualityScore: 65,
        intentScore: 60,
        fitScore: 70,
        priority: 'warm' as const,
        estimatedValue: 25000,
      };

      const quality = engine.assessLeadQuality(mediumLead);

      expect(quality.overallScore).toBeGreaterThanOrEqual(60);
      expect(quality.overallScore).toBeLessThan(80);
      expect(quality.tier).toBe('standard');
      expect(quality.routingPriority).toBeGreaterThanOrEqual(6);
      expect(quality.routingPriority).toBeLessThan(8);
    });

    test('should assess low-quality lead correctly', () => {
      const lowLead = {
        ...mockLead,
        qualityScore: 45,
        intentScore: 40,
        fitScore: 50,
        priority: 'cold' as const,
        estimatedValue: 5000,
      };

      const quality = engine.assessLeadQuality(lowLead);

      expect(quality.overallScore).toBeLessThan(60);
      expect(quality.tier).toBe('basic');
      expect(quality.routingPriority).toBeLessThan(6);
    });

    test('should handle lead without intent/fit scores', () => {
      const leadNoScores = {
        ...mockLead,
        intentScore: undefined,
        fitScore: undefined,
      };

      const quality = engine.assessLeadQuality(leadNoScores);

      expect(quality.overallScore).toBeGreaterThan(0);
      expect(quality.scores.intent).toBe(mockLead.qualityScore);
      expect(quality.scores.fit).toBe(mockLead.qualityScore);
    });

    test('should include quality indicators', () => {
      const quality = engine.assessLeadQuality(mockLead);

      expect(quality.indicators).toHaveLength(4);
      expect(quality.indicators[0].indicator).toBe('Intent Score');
      expect(quality.indicators[1].indicator).toBe('Fit Score');
      expect(quality.indicators[2].indicator).toBe('Engagement Score');
      expect(quality.indicators[3].indicator).toBe('Potential Score');
    });
  });

  describe('Rep Filtering', () => {
    test('should filter out reps at capacity', () => {
      const eligible = engine.filterEligibleReps(mockReps, mockLead);

      expect(eligible).toHaveLength(2);
      expect(eligible.find(r => r.id === 'rep_3')).toBeUndefined(); // At capacity
    });

    test('should filter out unavailable reps', () => {
      const unavailableReps = [...mockReps];
      unavailableReps[0] = { ...unavailableReps[0], isAvailable: false };

      const eligible = engine.filterEligibleReps(unavailableReps, mockLead);

      expect(eligible.find(r => r.id === 'rep_1')).toBeUndefined();
    });

    test('should filter out reps who exceeded daily limit', () => {
      const dailyLimitReps = [...mockReps];
      dailyLimitReps[0] = {
        ...dailyLimitReps[0],
        currentWorkload: {
          ...dailyLimitReps[0].currentWorkload,
          leadsAssignedToday: 5, // At daily limit
        },
      };

      const eligible = engine.filterEligibleReps(dailyLimitReps, mockLead);

      expect(eligible.find(r => r.id === 'rep_1')).toBeUndefined();
    });

    test('should filter out reps who exceeded weekly limit', () => {
      const weeklyLimitReps = [...mockReps];
      weeklyLimitReps[0] = {
        ...weeklyLimitReps[0],
        currentWorkload: {
          ...weeklyLimitReps[0].currentWorkload,
          leadsAssignedThisWeek: 20, // At weekly limit
        },
      };

      const eligible = engine.filterEligibleReps(weeklyLimitReps, mockLead);

      expect(eligible.find(r => r.id === 'rep_1')).toBeUndefined();
    });
  });

  describe('Rep Scoring', () => {
    test('should score reps with performance weighting', () => {
      const leadQuality = engine.assessLeadQuality(mockLead);
      const scores = engine.scoreRepsForLead(
        mockLead,
        mockReps.slice(0, 2), // Just first 2 reps
        leadQuality,
        mockConfig
      );

      expect(scores).toHaveLength(2);
      expect(scores[0].matchScore).toBeGreaterThan(0);
      expect(scores[0].matchScore).toBeLessThanOrEqual(100);
      expect(scores[0].scores).toHaveProperty('performance');
      expect(scores[0].scores).toHaveProperty('capacity');
      expect(scores[0].scores).toHaveProperty('specialization');
      expect(scores[0].scores).toHaveProperty('territory');
      expect(scores[0].scores).toHaveProperty('availability');
    });

    test('should give higher scores to top performers', () => {
      const leadQuality = engine.assessLeadQuality(mockLead);
      const scores = engine.scoreRepsForLead(
        mockLead,
        mockReps.slice(0, 2),
        leadQuality,
        mockConfig
      );

      const topPerformerScore = scores.find(s => s.repId === 'rep_1');
      const highPerformerScore = scores.find(s => s.repId === 'rep_2');

      expect(topPerformerScore!.scores.performance).toBeGreaterThan(
        highPerformerScore!.scores.performance
      );
    });

    test('should give higher scores to reps with more capacity', () => {
      const leadQuality = engine.assessLeadQuality(mockLead);
      const scores = engine.scoreRepsForLead(
        mockLead,
        mockReps.slice(0, 2),
        leadQuality,
        mockConfig
      );

      const rep1Score = scores.find(s => s.repId === 'rep_1'); // 60% utilization
      const rep2Score = scores.find(s => s.repId === 'rep_2'); // 50% utilization

      expect(rep2Score!.scores.capacity).toBeGreaterThan(rep1Score!.scores.capacity);
    });

    test('should give higher scores for specialization match', () => {
      const leadQuality = engine.assessLeadQuality(mockLead);
      const scores = engine.scoreRepsForLead(
        mockLead,
        mockReps.slice(0, 2),
        leadQuality,
        mockConfig
      );

      const rep1Score = scores.find(s => s.repId === 'rep_1'); // Has Technology
      const rep2Score = scores.find(s => s.repId === 'rep_2'); // No Technology

      expect(rep1Score!.scores.specialization).toBeGreaterThan(
        rep2Score!.scores.specialization
      );
    });

    test('should identify match details correctly', () => {
      const leadQuality = engine.assessLeadQuality(mockLead);
      const scores = engine.scoreRepsForLead(
        mockLead,
        mockReps.slice(0, 1),
        leadQuality,
        mockConfig
      );

      expect(scores[0].matchDetails).toHaveProperty('performanceTier');
      expect(scores[0].matchDetails).toHaveProperty('currentWorkload');
      expect(scores[0].matchDetails).toHaveProperty('capacityAvailable');
      expect(scores[0].matchDetails.specializationMatch).toContain('Industry');
      expect(scores[0].matchDetails.specializationMatch).toContain('Company Size');
    });
  });

  describe('Routing Rules', () => {
    test('should apply territory rule correctly', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule_1',
          orgId: 'org_test',
          name: 'USA Territory Rule',
          type: 'territory',
          priority: 10,
          enabled: true,
          conditions: [
            { field: 'country', operator: 'equals', value: 'USA' },
          ],
          actions: [
            { type: 'assign_to_team', params: { teamId: 'team_usa' } },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin',
        },
      ];

      const repsWithTerritory = [...mockReps];
      repsWithTerritory[0] = {
        ...repsWithTerritory[0],
        territories: [
          {
            id: 'terr_1',
            name: 'USA',
            type: 'geographic',
            geographic: { countries: ['USA'] },
            priority: 5,
          },
        ],
      };

      const result = engine.applyRoutingRules(mockLead, repsWithTerritory, rules);

      expect(result.matchedRules).toContain('rule_1');
    });

    test('should apply performance rule for hot leads', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule_2',
          orgId: 'org_test',
          name: 'Hot Lead to Top Performers',
          type: 'performance',
          priority: 10,
          enabled: true,
          conditions: [
            { field: 'priority', operator: 'equals', value: 'hot' },
          ],
          actions: [
            { type: 'assign_by_performance', params: {} },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin',
        },
      ];

      const result = engine.applyRoutingRules(mockLead, mockReps, rules);

      expect(result.matchedRules).toContain('rule_2');
      // Should filter to top performers
      expect(result.reps.every(r => 
        r.performanceTier === 'top_performer' || r.performanceTier === 'high_performer'
      )).toBe(true);
    });

    test('should skip disabled rules', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule_disabled',
          orgId: 'org_test',
          name: 'Disabled Rule',
          type: 'custom',
          priority: 10,
          enabled: false, // Disabled
          conditions: [
            { field: 'priority', operator: 'equals', value: 'hot' },
          ],
          actions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin',
        },
      ];

      const result = engine.applyRoutingRules(mockLead, mockReps, rules);

      expect(result.matchedRules).not.toContain('rule_disabled');
    });

    test('should fall back to original reps if rules filter out all reps', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule_3',
          orgId: 'org_test',
          name: 'Impossible Rule',
          type: 'territory',
          priority: 10,
          enabled: true,
          conditions: [
            { field: 'country', operator: 'equals', value: 'NonExistent' },
          ],
          actions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin',
        },
      ];

      const result = engine.applyRoutingRules(mockLead, mockReps, rules);

      expect(result.reps.length).toBe(mockReps.length);
    });
  });

  describe('Full Routing Flow', () => {
    test('should route lead successfully with performance strategy', async () => {
      const eligibleReps = mockReps.filter(r => !r.currentWorkload.isAtCapacity);
      
      const analysis = await engine.routeLead(
        mockLead,
        eligibleReps,
        mockConfig
      );

      expect(analysis.leadId).toBe(mockLead.id);
      expect(analysis.leadQuality).toBeDefined();
      expect(analysis.availableReps.length).toBeGreaterThan(0);
      expect(analysis.recommendation).toBeDefined();
      expect(analysis.recommendation.repId).toBe('rep_1'); // Top performer
      expect(analysis.alternatives).toHaveLength(1);
      expect(analysis.metadata.strategyUsed).toBe('performance_weighted');
    });

    test('should throw error if no eligible reps available', async () => {
      const noReps: SalesRep[] = [];

      await expect(
        engine.routeLead(mockLead, noReps, mockConfig)
      ).rejects.toThrow('No eligible reps available');
    });

    test('should include processing time in metadata', async () => {
      const eligibleReps = mockReps.filter(r => !r.currentWorkload.isAtCapacity);
      
      const analysis = await engine.routeLead(
        mockLead,
        eligibleReps,
        mockConfig
      );

      expect(analysis.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('should generate assignment with correct details', async () => {
      const eligibleReps = mockReps.filter(r => !r.currentWorkload.isAtCapacity);
      
      const analysis = await engine.routeLead(
        mockLead,
        eligibleReps,
        mockConfig
      );

      const assignment = engine.createAssignment(
        mockLead,
        analysis,
        'automatic',
        mockConfig.defaultStrategy
      );

      expect(assignment.leadId).toBe(mockLead.id);
      expect(assignment.repId).toBe(analysis.recommendation.repId);
      expect(assignment.orgId).toBe(mockLead.orgId);
      expect(assignment.assignmentMethod).toBe('automatic');
      expect(assignment.strategy).toBe('performance_weighted');
      expect(assignment.matchScore).toBe(analysis.recommendation.matchScore);
      expect(assignment.confidence).toBe(analysis.recommendation.confidence);
      expect(assignment.status).toBe('pending');
      expect(assignment.alternatives).toBeDefined();
    });
  });

  describe('Recommendation Generation', () => {
    test('should generate high-confidence recommendation for top match', () => {
      const leadQuality = engine.assessLeadQuality(mockLead);
      const scores = engine.scoreRepsForLead(
        mockLead,
        mockReps.slice(0, 1),
        leadQuality,
        mockConfig
      );

      const recommendation = engine.generateRecommendation(
        scores[0],
        leadQuality,
        mockConfig
      );

      expect(recommendation.confidence).toBeGreaterThan(0.5);
      expect(recommendation.matchScore).toBeGreaterThan(0);
      expect(recommendation.reasons).toHaveLength(4); // Should have multiple reasons
      expect(recommendation.expectedOutcomes).toBeDefined();
      expect(recommendation.expectedOutcomes.conversionProbability).toBeGreaterThan(0);
      expect(recommendation.expectedOutcomes.expectedTimeToContact).toBeGreaterThan(0);
      expect(recommendation.expectedOutcomes.expectedTimeToQualify).toBeGreaterThan(0);
    });

    test('should include warnings for non-optimal matches', () => {
      const leadQuality = engine.assessLeadQuality(mockLead);
      
      // Create rep at high utilization
      const highUtilRep = {
        ...mockReps[1],
        currentWorkload: {
          ...mockReps[1].currentWorkload,
          utilizationPercentage: 85,
        },
        specializations: {
          industries: ['Different Industry'],
          companySizes: ['smb'],
        },
      };

      const scores = engine.scoreRepsForLead(
        mockLead,
        [highUtilRep],
        leadQuality,
        mockConfig
      );

      const recommendation = engine.generateRecommendation(
        scores[0],
        leadQuality,
        mockConfig
      );

      expect(recommendation.warnings).toBeDefined();
      expect(recommendation.warnings!.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle lead with minimal data', () => {
      const minimalLead: Lead = {
        id: 'lead_minimal',
        orgId: 'org_test',
        companyName: 'Minimal Co',
        contactName: 'Jane Doe',
        contactEmail: 'jane@minimal.com',
        source: 'other',
        qualityScore: 50,
        priority: 'cold',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const quality = engine.assessLeadQuality(minimalLead);

      expect(quality.overallScore).toBeGreaterThan(0);
      expect(quality.tier).toBeDefined();
    });

    test('should handle rep with no specializations', () => {
      const repNoSpec = {
        ...mockReps[0],
        specializations: {},
      };

      const leadQuality = engine.assessLeadQuality(mockLead);
      const scores = engine.scoreRepsForLead(
        mockLead,
        [repNoSpec],
        leadQuality,
        mockConfig
      );

      expect(scores).toHaveLength(1);
      expect(scores[0].matchScore).toBeGreaterThan(0);
    });

    test('should handle empty routing rules gracefully', async () => {
      const eligibleReps = mockReps.filter(r => !r.currentWorkload.isAtCapacity);
      
      const analysis = await engine.routeLead(
        mockLead,
        eligibleReps,
        mockConfig,
        [] // Empty rules array
      );

      expect(analysis).toBeDefined();
      expect(analysis.metadata.rulesEvaluated).toBe(0);
    });
  });
});
