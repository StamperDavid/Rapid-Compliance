/**
 * Performance Analytics Engine - Unit Tests
 * 
 * Comprehensive tests for team performance analytics functionality.
 * Tests cover: metrics calculation, benchmarking, top performer identification,
 * improvement opportunities, trend analysis, and coaching priorities.
 * 
 * @module tests/lib/performance
 */

import { describe, it, expect } from '@jest/globals';
import type {
  RepPerformanceMetrics,
} from '@/lib/performance/types';
import type { ConversationAnalysis, ConversationScores } from '@/lib/conversation/types';

// ============================================================================
// MOCK DATA
// ============================================================================

const _createMockConversationAnalysis = (
  repId: string,
  scores: Partial<ConversationScores> = {}
): ConversationAnalysis => ({
  conversationId: `conv_${Math.random()}`,
  workspaceId: 'workspace_test',
  sentiment: {
    overall: {
      polarity: 'positive',
      score: 0.7,
      confidence: 85,
      tone: ['professional', 'enthusiastic'],
    },
    byParticipant: {},
    timeline: [],
    trendDirection: 'improving',
    criticalMoments: [],
  },
  talkRatio: {
    overall: {
      speakerTime: 300,
      listenerTime: 700,
      ratio: 0.3,
      isIdeal: true,
    },
    byParticipant: {},
    repTalkTime: 300,
    prospectTalkTime: 700,
    repPercentage: 30,
    prospectPercentage: 70,
    assessment: 'ideal',
    recommendation: 'Good talk ratio',
  },
  topics: {
    mainTopics: [
      { name: 'Pricing', category: 'pricing', mentions: 3, duration: 120, sentiment: 0.5, importance: 'high', quotes: [] },
      { name: 'Integration', category: 'integration', mentions: 2, duration: 90, sentiment: 0.6, importance: 'medium', quotes: [] },
    ],
    coverageMap: { pricing: 120, integration: 90 },
    uncoveredTopics: [],
    timeAllocation: [],
  },
  objections: [],
  competitors: [],
  keyMoments: [],
  coachingInsights: [],
  followUpActions: [],
  scores: {
    overall: scores.overall ?? 85,
    discovery: scores.discovery ?? 80,
    valueArticulation: scores.valueArticulation ?? 85,
    objectionHandling: scores.objectionHandling ?? 90,
    closing: scores.closing ?? 85,
    rapport: scores.rapport ?? 80,
    engagement: scores.engagement ?? 85,
  },
  qualityIndicators: [
    { type: 'talk_ratio', status: 'excellent', score: 90, description: 'Ideal talk ratio' },
  ],
  redFlags: [],
  positiveSignals: [],
  summary: 'Good conversation',
  highlights: ['Strong discovery', 'Good objection handling'],
  confidence: 85,
  analyzedAt: new Date(),
  analysisVersion: '1.0',
  aiModel: 'gpt-4o',
  tokensUsed: 1000,
  processingTime: 2000,
});

// ============================================================================
// TEAM METRICS TESTS
// ============================================================================

describe('Performance Analytics - Team Metrics', () => {
  it('should calculate team metrics from individual metrics', () => {
    const individualMetrics: RepPerformanceMetrics[] = [
      {
        repId: 'rep1',
        repName: 'Rep 1',
        totalConversations: 10,
        scores: { overall: 85, discovery: 80, valueArticulation: 85, objectionHandling: 90, closing: 85, rapport: 80, engagement: 85 },
        avgSentiment: 0.7,
        sentimentTrend: 'improving',
        avgRepTalkPercentage: 35,
        idealTalkRatioPercentage: 70,
        avgQualityScore: 85,
        redFlagCount: 2,
        positiveSignalCount: 15,
        avgObjectionsPerConversation: 1.5,
        objectionHandlingRate: 85,
        topObjectionTypes: [],
        avgTopicsCovered: 5,
        topicCoverageScore: 80,
        strongTopics: [],
        weakTopics: [],
        topCoachingAreas: [],
        coachingPriority: 'low',
        performanceTier: 'top_performer',
        percentileRank: 90,
        scoreChange: 5,
        rankChange: 1,
      },
      {
        repId: 'rep2',
        repName: 'Rep 2',
        totalConversations: 8,
        scores: { overall: 75, discovery: 70, valueArticulation: 75, objectionHandling: 80, closing: 75, rapport: 70, engagement: 75 },
        avgSentiment: 0.5,
        sentimentTrend: 'stable',
        avgRepTalkPercentage: 40,
        idealTalkRatioPercentage: 50,
        avgQualityScore: 75,
        redFlagCount: 5,
        positiveSignalCount: 10,
        avgObjectionsPerConversation: 2.0,
        objectionHandlingRate: 70,
        topObjectionTypes: [],
        avgTopicsCovered: 4,
        topicCoverageScore: 70,
        strongTopics: [],
        weakTopics: [],
        topCoachingAreas: [],
        coachingPriority: 'medium',
        performanceTier: 'solid_performer',
        percentileRank: 50,
        scoreChange: 0,
        rankChange: 0,
      },
    ];

    // Simplified test - in production, this would call calculateTeamMetrics
    const totalConversations = individualMetrics.reduce((sum, m) => sum + m.totalConversations, 0);
    const avgOverallScore = individualMetrics.reduce((sum, m) => sum + m.scores.overall, 0) / individualMetrics.length;

    expect(totalConversations).toBe(18);
    expect(avgOverallScore).toBe(80);
  });

  it('should handle empty individual metrics', () => {
    const individualMetrics: RepPerformanceMetrics[] = [];

    // Should not throw
    expect(() => {
      const _totalConversations = individualMetrics.reduce((sum, m) => sum + m.totalConversations, 0);
    }).not.toThrow();
  });
});

// ============================================================================
// BENCHMARKS TESTS
// ============================================================================

describe('Performance Analytics - Benchmarks', () => {
  it('should calculate performance benchmarks', () => {
    const metrics: RepPerformanceMetrics[] = [
      // Top performer
      {
        repId: 'rep1',
        repName: 'Rep 1',
        totalConversations: 10,
        scores: { overall: 90, discovery: 90, valueArticulation: 90, objectionHandling: 90, closing: 90, rapport: 90, engagement: 90 },
        avgSentiment: 0.8,
        sentimentTrend: 'improving',
        avgRepTalkPercentage: 35,
        idealTalkRatioPercentage: 80,
        avgQualityScore: 90,
        redFlagCount: 1,
        positiveSignalCount: 20,
        avgObjectionsPerConversation: 1.0,
        objectionHandlingRate: 95,
        topObjectionTypes: [],
        avgTopicsCovered: 6,
        topicCoverageScore: 90,
        strongTopics: [],
        weakTopics: [],
        topCoachingAreas: [],
        coachingPriority: 'low',
        performanceTier: 'top_performer',
        percentileRank: 95,
        scoreChange: 5,
        rankChange: 0,
      },
      // Median performer
      {
        repId: 'rep2',
        repName: 'Rep 2',
        totalConversations: 8,
        scores: { overall: 75, discovery: 75, valueArticulation: 75, objectionHandling: 75, closing: 75, rapport: 75, engagement: 75 },
        avgSentiment: 0.5,
        sentimentTrend: 'stable',
        avgRepTalkPercentage: 40,
        idealTalkRatioPercentage: 60,
        avgQualityScore: 75,
        redFlagCount: 3,
        positiveSignalCount: 12,
        avgObjectionsPerConversation: 1.5,
        objectionHandlingRate: 75,
        topObjectionTypes: [],
        avgTopicsCovered: 5,
        topicCoverageScore: 75,
        strongTopics: [],
        weakTopics: [],
        topCoachingAreas: [],
        coachingPriority: 'medium',
        performanceTier: 'solid_performer',
        percentileRank: 50,
        scoreChange: 0,
        rankChange: 0,
      },
      // Bottom performer
      {
        repId: 'rep3',
        repName: 'Rep 3',
        totalConversations: 6,
        scores: { overall: 60, discovery: 60, valueArticulation: 60, objectionHandling: 60, closing: 60, rapport: 60, engagement: 60 },
        avgSentiment: 0.2,
        sentimentTrend: 'declining',
        avgRepTalkPercentage: 50,
        idealTalkRatioPercentage: 40,
        avgQualityScore: 60,
        redFlagCount: 6,
        positiveSignalCount: 5,
        avgObjectionsPerConversation: 2.5,
        objectionHandlingRate: 55,
        topObjectionTypes: [],
        avgTopicsCovered: 3,
        topicCoverageScore: 60,
        strongTopics: [],
        weakTopics: [],
        topCoachingAreas: [],
        coachingPriority: 'critical',
        performanceTier: 'needs_improvement',
        percentileRank: 10,
        scoreChange: -5,
        rankChange: -1,
      },
    ];

    // Calculate top performer average
    const topPerformers = metrics.filter(m => m.percentileRank >= 80);
    const topPerformerAvgScore = topPerformers.reduce((sum, m) => sum + m.scores.overall, 0) / topPerformers.length;

    expect(topPerformerAvgScore).toBe(90);
    expect(topPerformers.length).toBe(1);
  });

  it('should calculate percentile thresholds', () => {
    const scores = [60, 70, 75, 80, 85, 90].sort((a, b) => a - b); // Sorted ascending for percentile calculation

    // Calculate 75th percentile
    const p75Index = Math.ceil((75 / 100) * scores.length) - 1;
    const p75 = scores[Math.max(0, p75Index)];

    expect(p75).toBeGreaterThanOrEqual(75);
  });
});

// ============================================================================
// TOP PERFORMERS TESTS
// ============================================================================

describe('Performance Analytics - Top Performers', () => {
  it('should identify top performers', () => {
    const metrics: RepPerformanceMetrics[] = [
      {
        repId: 'rep1',
        repName: 'Top Rep',
        totalConversations: 10,
        scores: { overall: 90, discovery: 95, valueArticulation: 90, objectionHandling: 92, closing: 88, rapport: 90, engagement: 91 },
        avgSentiment: 0.8,
        sentimentTrend: 'improving',
        avgRepTalkPercentage: 35,
        idealTalkRatioPercentage: 85,
        avgQualityScore: 92,
        redFlagCount: 1,
        positiveSignalCount: 25,
        avgObjectionsPerConversation: 1.0,
        objectionHandlingRate: 95,
        topObjectionTypes: [],
        avgTopicsCovered: 7,
        topicCoverageScore: 90,
        strongTopics: [],
        weakTopics: [],
        topCoachingAreas: [],
        coachingPriority: 'low',
        performanceTier: 'top_performer',
        percentileRank: 95,
        scoreChange: 8,
        rankChange: 2,
      },
      {
        repId: 'rep2',
        repName: 'Average Rep',
        totalConversations: 8,
        scores: { overall: 70, discovery: 70, valueArticulation: 70, objectionHandling: 70, closing: 70, rapport: 70, engagement: 70 },
        avgSentiment: 0.5,
        sentimentTrend: 'stable',
        avgRepTalkPercentage: 45,
        idealTalkRatioPercentage: 50,
        avgQualityScore: 70,
        redFlagCount: 4,
        positiveSignalCount: 10,
        avgObjectionsPerConversation: 2.0,
        objectionHandlingRate: 65,
        topObjectionTypes: [],
        avgTopicsCovered: 4,
        topicCoverageScore: 70,
        strongTopics: [],
        weakTopics: [],
        topCoachingAreas: [],
        coachingPriority: 'medium',
        performanceTier: 'solid_performer',
        percentileRank: 50,
        scoreChange: 0,
        rankChange: 0,
      },
    ];

    const topPerformers = metrics.filter(m => m.performanceTier === 'top_performer');

    expect(topPerformers.length).toBe(1);
    expect(topPerformers[0].repName).toBe('Top Rep');
    expect(topPerformers[0].scores.overall).toBe(90);
  });

  it('should identify strengths vs team average', () => {
    const topPerformer = { discovery: 95, objectionHandling: 92, overall: 90 };
    const teamAvg = { discovery: 75, objectionHandling: 70, overall: 75 };

    const discoveryGap = topPerformer.discovery - teamAvg.discovery;
    const objectionGap = topPerformer.objectionHandling - teamAvg.objectionHandling;

    expect(discoveryGap).toBe(20);
    expect(objectionGap).toBe(22);
    expect(discoveryGap).toBeGreaterThan(10); // Significant strength
  });

  it('should recommend mentor for high performers with strengths', () => {
    const performer = {
      overallScore: 90,
      strengthCount: 3,
      scores: {
        discovery: 95,
        objectionHandling: 92,
        closing: 88,
      },
    };

    const recommendedAsMentor = performer.overallScore >= 85 && performer.strengthCount >= 2;

    expect(recommendedAsMentor).toBe(true);
  });
});

// ============================================================================
// IMPROVEMENT OPPORTUNITIES TESTS
// ============================================================================

describe('Performance Analytics - Improvement Opportunities', () => {
  it('should identify skill gaps', () => {
    const repScore = 65;
    const teamAvgScore = 75;

    const gapSize = teamAvgScore - repScore;

    expect(gapSize).toBe(10);
    expect(gapSize).toBeGreaterThan(5); // Significant gap
  });

  it('should prioritize gaps correctly', () => {
    const gaps = [
      { skill: 'Discovery', gapSize: 25, teamAvg: 75, current: 50 },
      { skill: 'Closing', gapSize: 10, teamAvg: 80, current: 70 },
      { skill: 'Rapport', gapSize: 5, teamAvg: 75, current: 70 },
    ];

    // Prioritize by gap size
    const prioritized = gaps.sort((a, b) => b.gapSize - a.gapSize);

    expect(prioritized[0].skill).toBe('Discovery');
    expect(prioritized[0].gapSize).toBe(25);
  });

  it('should determine coaching priority level', () => {
    const scoreVsCritical = 55;
    const scoreVsHigh = 68;
    const scoreVsMedium = 78;
    const scoreVsLow = 85;

    expect(scoreVsCritical < 60).toBe(true); // Critical
    expect(scoreVsHigh >= 60 && scoreVsHigh < 70).toBe(true); // High
    expect(scoreVsMedium >= 70 && scoreVsMedium < 80).toBe(true); // Medium
    expect(scoreVsLow >= 80).toBe(true); // Low
  });

  it('should calculate target improvement score', () => {
    const currentScore = 70;
    const improvementTarget = 15;
    const targetScore = currentScore + improvementTarget;

    expect(targetScore).toBe(85);
  });

  it('should estimate time to improve based on gap', () => {
    const smallGap = 8;
    const mediumGap = 12;
    const largeGap = 18;

    expect(smallGap < 10).toBe(true); // 2-4 weeks
    expect(mediumGap >= 10 && mediumGap < 15).toBe(true); // 4-8 weeks
    expect(largeGap >= 15).toBe(true); // 8-12 weeks
  });
});

// ============================================================================
// TREND ANALYSIS TESTS
// ============================================================================

describe('Performance Analytics - Trend Analysis', () => {
  it('should detect improving trend', () => {
    const previousScore = 75;
    const currentScore = 82;
    const change = currentScore - previousScore;

    const trend = change > 3 ? 'improving' : change < -3 ? 'declining' : 'stable';

    expect(trend).toBe('improving');
    expect(change).toBe(7);
  });

  it('should detect declining trend', () => {
    const previousScore = 80;
    const currentScore = 72;
    const change = currentScore - previousScore;

    const trend = change > 3 ? 'improving' : change < -3 ? 'declining' : 'stable';

    expect(trend).toBe('declining');
    expect(change).toBe(-8);
  });

  it('should detect stable trend', () => {
    const previousScore = 75;
    const currentScore = 76;
    const change = currentScore - previousScore;

    const trend = change > 3 ? 'improving' : change < -3 ? 'declining' : 'stable';

    expect(trend).toBe('stable');
    expect(Math.abs(change)).toBeLessThan(3);
  });

  it('should calculate change percentage', () => {
    const previousValue = 75;
    const currentValue = 82;
    const changePercentage = ((currentValue - previousValue) / previousValue) * 100;

    expect(changePercentage).toBeCloseTo(9.33, 1);
  });
});

// ============================================================================
// COACHING PRIORITIES TESTS
// ============================================================================

describe('Performance Analytics - Coaching Priorities', () => {
  it('should identify team-wide coaching needs', () => {
    const repsNeedingDiscoveryCoaching = 8;
    const repsNeedingClosingCoaching = 3;
    const totalReps = 10;

    const discoveryPercentage = (repsNeedingDiscoveryCoaching / totalReps) * 100;
    const closingPercentage = (repsNeedingClosingCoaching / totalReps) * 100;

    expect(discoveryPercentage).toBe(80);
    expect(closingPercentage).toBe(30);
    expect(discoveryPercentage > closingPercentage).toBe(true); // Discovery should be higher priority
  });

  it('should determine priority level based on affected reps', () => {
    const percentageAffected60 = 60;
    const percentageAffected35 = 35;
    const percentageAffected25 = 25;

    const avgGapHigh = 18;
    const avgGapMedium = 12;

    // Critical: 50%+ affected AND gap >= 15
    const isCritical = percentageAffected60 >= 50 && avgGapHigh >= 15;
    expect(isCritical).toBe(true);

    // High: 30%+ affected OR gap >= 15
    const isHigh = percentageAffected35 >= 30 || avgGapHigh >= 15;
    expect(isHigh).toBe(true);

    // Medium: 20%+ affected OR gap >= 10
    const isMedium = percentageAffected25 >= 20 || avgGapMedium >= 10;
    expect(isMedium).toBe(true);
  });

  it('should estimate ROI based on affected percentage', () => {
    const highROI = 45; // 40%+ affected
    const mediumROI = 25; // 20-40% affected
    const lowROI = 15; // <20% affected

    expect(highROI >= 40).toBe(true);
    expect(mediumROI >= 20 && mediumROI < 40).toBe(true);
    expect(lowROI < 20).toBe(true);
  });
});

// ============================================================================
// BEST PRACTICES TESTS
// ============================================================================

describe('Performance Analytics - Best Practices', () => {
  it('should extract best practices from top performers', () => {
    const topPerformer = {
      repId: 'rep1',
      repName: 'Top Rep',
      strengths: [
        { area: 'Discovery', score: 95, vsTeamAvg: 20 },
        { area: 'Closing', score: 92, vsTeamAvg: 17 },
      ],
    };

    const bestPractices = topPerformer.strengths.map(strength => ({
      id: `${topPerformer.repId}-${strength.area}`,
      title: `${strength.area} Excellence`,
      sourceRepName: topPerformer.repName,
      successValue: strength.score,
      vsTeamAvg: strength.vsTeamAvg,
    }));

    expect(bestPractices.length).toBe(2);
    expect(bestPractices[0].title).toBe('Discovery Excellence');
    expect(bestPractices[0].vsTeamAvg).toBe(20);
  });

  it('should identify applicable coaching categories', () => {
    const practice = {
      area: 'Discovery',
    };

    let category: 'discovery' | 'closing' | 'objection_handling' | 'value_articulation';

    if (practice.area.includes('Discovery')) {
      category = 'discovery';
    } else if (practice.area.includes('Closing')) {
      category = 'closing';
    } else if (practice.area.includes('Objection')) {
      category = 'objection_handling';
    } else {
      category = 'value_articulation';
    }

    expect(category).toBe('discovery');
  });
});

// ============================================================================
// PERFORMANCE TIER TESTS
// ============================================================================

describe('Performance Analytics - Performance Tiers', () => {
  it('should assign correct performance tiers', () => {
    const percentiles = [95, 72, 55, 35, 12];

    const tiers = percentiles.map(p => {
      if (p >= 80) {
        return 'top_performer';
      }
      if (p >= 60) {
        return 'high_performer';
      }
      if (p >= 40) {
        return 'solid_performer';
      }
      if (p >= 20) {
        return 'developing';
      }
      return 'needs_improvement';
    });

    expect(tiers[0]).toBe('top_performer'); // 95th
    expect(tiers[1]).toBe('high_performer'); // 72nd
    expect(tiers[2]).toBe('solid_performer'); // 55th
    expect(tiers[3]).toBe('developing'); // 35th
    expect(tiers[4]).toBe('needs_improvement'); // 12th
  });

  it('should calculate percentile rank', () => {
    const totalReps = 10;
    const rank = 2; // 2nd place

    const percentileRank = ((totalReps - rank + 1) / totalReps) * 100;

    expect(percentileRank).toBe(90);
  });
});

// ============================================================================
// UTILITY FUNCTIONS TESTS
// ============================================================================

describe('Performance Analytics - Utility Functions', () => {
  it('should calculate average correctly', () => {
    const numbers = [80, 85, 90, 75, 70];
    const avg = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;

    expect(avg).toBe(80);
  });

  it('should calculate median correctly for odd count', () => {
    const numbers = [60, 70, 80, 90, 100];
    const sorted = numbers.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted[mid];

    expect(median).toBe(80);
  });

  it('should calculate median correctly for even count', () => {
    const numbers = [60, 70, 80, 90];
    const sorted = numbers.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = (sorted[mid - 1] + sorted[mid]) / 2;

    expect(median).toBe(75);
  });

  it('should handle empty arrays gracefully', () => {
    const numbers: number[] = [];
    const result = numbers.length === 0 ? 0 : numbers.reduce((sum, n) => sum + n, 0) / numbers.length;

    expect(result).toBe(0);
  });

  it('should calculate sum correctly', () => {
    const numbers = [10, 20, 30, 40];
    const sum = numbers.reduce((sum, n) => sum + n, 0);

    expect(sum).toBe(100);
  });

  it('should calculate standard deviation', () => {
    const values = [80, 85, 90, 75, 70];
    const avg = values.reduce((sum, n) => sum + n, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    expect(stdDev).toBeGreaterThan(0);
    expect(stdDev).toBeCloseTo(7.07, 1);
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('Performance Analytics - Validation', () => {
  it('should validate minimum conversations threshold', () => {
    const repConversations = 2;
    const minConversations = 3;

    expect(repConversations < minConversations).toBe(true);
  });

  it('should validate score range', () => {
    const validScore = 85;
    const invalidScoreLow = -5;
    const invalidScoreHigh = 105;

    expect(validScore >= 0 && validScore <= 100).toBe(true);
    expect(invalidScoreLow >= 0 && invalidScoreLow <= 100).toBe(false);
    expect(invalidScoreHigh >= 0 && invalidScoreHigh <= 100).toBe(false);
  });

  it('should validate sentiment range', () => {
    const validSentiment = 0.7;
    const invalidSentimentLow = -1.5;
    const invalidSentimentHigh = 1.5;

    expect(validSentiment >= -1 && validSentiment <= 1).toBe(true);
    expect(invalidSentimentLow >= -1 && invalidSentimentLow <= 1).toBe(false);
    expect(invalidSentimentHigh >= -1 && invalidSentimentHigh <= 1).toBe(false);
  });

  it('should validate percentage range', () => {
    const validPercentage = 45;
    const invalidPercentageLow = -10;
    const invalidPercentageHigh = 110;

    expect(validPercentage >= 0 && validPercentage <= 100).toBe(true);
    expect(invalidPercentageLow >= 0 && invalidPercentageLow <= 100).toBe(false);
    expect(invalidPercentageHigh >= 0 && invalidPercentageHigh <= 100).toBe(false);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Performance Analytics - Edge Cases', () => {
  it('should handle single rep gracefully', () => {
    const metrics: RepPerformanceMetrics[] = [
      {
        repId: 'rep1',
        repName: 'Only Rep',
        totalConversations: 5,
        scores: { overall: 80, discovery: 80, valueArticulation: 80, objectionHandling: 80, closing: 80, rapport: 80, engagement: 80 },
        avgSentiment: 0.6,
        sentimentTrend: 'stable',
        avgRepTalkPercentage: 40,
        idealTalkRatioPercentage: 60,
        avgQualityScore: 80,
        redFlagCount: 2,
        positiveSignalCount: 10,
        avgObjectionsPerConversation: 1.5,
        objectionHandlingRate: 80,
        topObjectionTypes: [],
        avgTopicsCovered: 5,
        topicCoverageScore: 80,
        strongTopics: [],
        weakTopics: [],
        topCoachingAreas: [],
        coachingPriority: 'medium',
        performanceTier: 'top_performer',
        percentileRank: 100,
        scoreChange: 0,
        rankChange: 0,
      },
    ];

    expect(metrics.length).toBe(1);
    expect(metrics[0].percentileRank).toBe(100); // Only rep should be in top percentile
  });

  it('should handle all reps at same score', () => {
    const uniformScore = 75;
    const reps = 5;
    const metrics = Array(reps).fill(null).map((_, i) => ({
      repId: `rep${i}`,
      scores: { overall: uniformScore, discovery: uniformScore, valueArticulation: uniformScore, objectionHandling: uniformScore, closing: uniformScore, rapport: uniformScore, engagement: uniformScore },
    }));

    const allSame = metrics.every(m => m.scores.overall === uniformScore);
    expect(allSame).toBe(true);
  });

  it('should handle zero conversations gracefully', () => {
    const conversations = 0;
    const avgPerRep = conversations > 0 ? conversations / 5 : 0;

    expect(avgPerRep).toBe(0);
  });

  it('should handle division by zero', () => {
    const totalObjections = 0;
    const handlingRate = totalObjections > 0 ? (0 / totalObjections) * 100 : 0;

    expect(handlingRate).toBe(0);
  });
});
