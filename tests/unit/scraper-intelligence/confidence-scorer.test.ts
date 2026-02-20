/**
 * Unit Tests for Confidence Scorer
 * 
 * Tests Bayesian updates, time decay, reinforcement learning,
 * multi-source aggregation, and outlier detection.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateBayesianConfidence,
  calculateCredibleInterval,
  calculateDecayFactor,
  applyTimeDecay,
  reinforcementUpdate,
  aggregateConfidences,
  detectOutliers,
  filterOutliers,
  calculateSuccessRate,
  getConfidenceGrade,
  calculateConfidenceTrend,
  ConfidenceScorerError,
} from '@/lib/scraper-intelligence/confidence-scorer';
import type { TrainingData } from '@/types/scraper-intelligence';

/** Builds a minimal valid TrainingData fixture for unit tests. */
function makeTrainingData(overrides: Pick<TrainingData, 'positiveCount' | 'negativeCount'>): TrainingData {
  const now = new Date();
  return {
    id: 'test-id',
    signalId: 'test-signal',
    pattern: 'test-pattern',
    patternType: 'keyword',
    confidence: 50,
    seenCount: overrides.positiveCount + overrides.negativeCount,
    createdAt: now,
    lastUpdatedAt: now,
    lastSeenAt: now,
    version: 1,
    active: true,
    ...overrides,
  };
}

describe('Confidence Scorer', () => {
  describe('calculateBayesianConfidence', () => {
    it('should calculate correct confidence for positive feedback', () => {
      // 5 positive, 0 negative
      // α = 5 + 1 = 6, β = 0 + 1 = 1
      // Mean = 6 / 7 = 0.857 = 86%
      const confidence = calculateBayesianConfidence(5, 0);
      expect(confidence).toBeGreaterThan(80);
      expect(confidence).toBeLessThan(90);
    });

    it('should calculate correct confidence for negative feedback', () => {
      // 0 positive, 5 negative
      // α = 0 + 1 = 1, β = 5 + 1 = 6
      // Mean = 1 / 7 = 0.143 = 14%
      const confidence = calculateBayesianConfidence(0, 5);
      expect(confidence).toBeLessThan(20);
      expect(confidence).toBeGreaterThanOrEqual(10); // MIN_CONFIDENCE
    });

    it('should calculate correct confidence for mixed feedback', () => {
      // 7 positive, 3 negative
      // α = 8, β = 4
      // Mean = 8 / 12 = 0.667 = 67%
      const confidence = calculateBayesianConfidence(7, 3);
      expect(confidence).toBeGreaterThan(60);
      expect(confidence).toBeLessThan(75);
    });

    it('should handle no feedback (uniform prior)', () => {
      // 0 positive, 0 negative
      // α = 1, β = 1
      // Mean = 1 / 2 = 0.5 = 50%
      const confidence = calculateBayesianConfidence(0, 0);
      expect(confidence).toBeGreaterThan(45);
      expect(confidence).toBeLessThan(55);
    });

    it('should converge with large samples', () => {
      // 100 positive, 10 negative
      // α = 101, β = 11
      // Mean = 101 / 112 = 0.902 = 90%
      const confidence = calculateBayesianConfidence(100, 10);
      expect(confidence).toBeGreaterThan(85);
      expect(confidence).toBeLessThan(95);
    });

    it('should throw error for negative counts', () => {
      expect(() => calculateBayesianConfidence(-1, 5)).toThrow(
        ConfidenceScorerError
      );
      expect(() => calculateBayesianConfidence(5, -1)).toThrow(
        ConfidenceScorerError
      );
    });

    it('should throw error for invalid priors', () => {
      expect(() => calculateBayesianConfidence(5, 3, 0, 1)).toThrow(
        ConfidenceScorerError
      );
      expect(() => calculateBayesianConfidence(5, 3, 1, 0)).toThrow(
        ConfidenceScorerError
      );
    });

    it('should respect minimum confidence', () => {
      // Even with all negative feedback, should not go below MIN_CONFIDENCE
      const confidence = calculateBayesianConfidence(0, 100);
      expect(confidence).toBeGreaterThanOrEqual(10);
    });

    it('should respect maximum confidence', () => {
      // Even with all positive feedback, should not exceed MAX_CONFIDENCE
      const confidence = calculateBayesianConfidence(100, 0);
      expect(confidence).toBeLessThanOrEqual(95);
    });
  });

  describe('calculateCredibleInterval', () => {
    it('should calculate credible interval', () => {
      const interval = calculateCredibleInterval(50, 10, 0.95);
      
      expect(interval.lower).toBeGreaterThanOrEqual(0);
      expect(interval.upper).toBeLessThanOrEqual(100);
      expect(interval.upper).toBeGreaterThan(interval.lower);
    });

    it('should have wider interval for smaller samples', () => {
      const smallSample = calculateCredibleInterval(5, 1, 0.95);
      const largeSample = calculateCredibleInterval(500, 100, 0.95);
      
      const smallWidth = smallSample.upper - smallSample.lower;
      const largeWidth = largeSample.upper - largeSample.lower;
      
      expect(smallWidth).toBeGreaterThan(largeWidth);
    });

    it('should have wider interval for lower confidence levels', () => {
      const interval90 = calculateCredibleInterval(50, 10, 0.90);
      const interval95 = calculateCredibleInterval(50, 10, 0.95);
      
      const width90 = interval90.upper - interval90.lower;
      const width95 = interval95.upper - interval95.lower;
      
      expect(width95).toBeGreaterThanOrEqual(width90);
    });
  });

  describe('calculateDecayFactor', () => {
    it('should return 1 for zero days', () => {
      const decay = calculateDecayFactor(0);
      expect(decay).toBe(1);
    });

    it('should return 0.5 for half-life days', () => {
      const decay = calculateDecayFactor(30, 30);
      expect(decay).toBeCloseTo(0.5, 2);
    });

    it('should return 0.25 for double half-life days', () => {
      const decay = calculateDecayFactor(60, 30);
      expect(decay).toBeCloseTo(0.25, 2);
    });

    it('should approach 0 for very old patterns', () => {
      const decay = calculateDecayFactor(365, 30); // 1 year old
      expect(decay).toBeLessThan(0.01);
    });

    it('should throw error for negative days', () => {
      expect(() => calculateDecayFactor(-1)).toThrow(ConfidenceScorerError);
    });

    it('should throw error for non-positive half-life', () => {
      expect(() => calculateDecayFactor(10, 0)).toThrow(ConfidenceScorerError);
      expect(() => calculateDecayFactor(10, -5)).toThrow(ConfidenceScorerError);
    });

    it('should be monotonically decreasing', () => {
      const decay0 = calculateDecayFactor(0);
      const decay10 = calculateDecayFactor(10);
      const decay20 = calculateDecayFactor(20);
      const decay30 = calculateDecayFactor(30);
      
      expect(decay0).toBeGreaterThan(decay10);
      expect(decay10).toBeGreaterThan(decay20);
      expect(decay20).toBeGreaterThan(decay30);
    });
  });

  describe('applyTimeDecay', () => {
    it('should not decay confidence for recent patterns', () => {
      const decayed = applyTimeDecay(80, 0);
      expect(decayed).toBe(80);
    });

    it('should reduce confidence for old patterns', () => {
      const decayed = applyTimeDecay(80, 30); // 30 days old
      expect(decayed).toBeLessThan(80);
      expect(decayed).toBeGreaterThan(20);
    });

    it('should heavily decay very old patterns', () => {
      const decayed = applyTimeDecay(80, 365); // 1 year old
      expect(decayed).toBeLessThan(20);
    });

    it('should respect minimum confidence', () => {
      const decayed = applyTimeDecay(50, 1000); // Very old
      expect(decayed).toBeGreaterThanOrEqual(10);
    });
  });

  describe('reinforcementUpdate', () => {
    it('should increase confidence with positive reward', () => {
      const updated = reinforcementUpdate(50, 80, 0.1);
      expect(updated).toBeGreaterThan(50);
    });

    it('should decrease confidence with negative reward', () => {
      const updated = reinforcementUpdate(50, 20, 0.1);
      expect(updated).toBeLessThan(50);
    });

    it('should not change confidence if reward equals current', () => {
      const updated = reinforcementUpdate(50, 50, 0.1);
      expect(updated).toBe(50);
    });

    it('should move faster with higher learning rate', () => {
      const slow = reinforcementUpdate(50, 80, 0.1);
      const fast = reinforcementUpdate(50, 80, 0.5);
      
      expect(fast - 50).toBeGreaterThan(slow - 50);
    });

    it('should converge to reward with multiple updates', () => {
      let confidence = 50;
      const reward = 80;
      
      // Apply 100 updates
      for (let i = 0; i < 100; i++) {
        confidence = reinforcementUpdate(confidence, reward, 0.1);
      }
      
      // Should converge close to reward
      expect(Math.abs(confidence - reward)).toBeLessThan(5);
    });

    it('should throw error for invalid confidence', () => {
      expect(() => reinforcementUpdate(-1, 50, 0.1)).toThrow(
        ConfidenceScorerError
      );
      expect(() => reinforcementUpdate(101, 50, 0.1)).toThrow(
        ConfidenceScorerError
      );
    });

    it('should throw error for invalid reward', () => {
      expect(() => reinforcementUpdate(50, -1, 0.1)).toThrow(
        ConfidenceScorerError
      );
      expect(() => reinforcementUpdate(50, 101, 0.1)).toThrow(
        ConfidenceScorerError
      );
    });

    it('should throw error for invalid learning rate', () => {
      expect(() => reinforcementUpdate(50, 80, -0.1)).toThrow(
        ConfidenceScorerError
      );
      expect(() => reinforcementUpdate(50, 80, 1.1)).toThrow(
        ConfidenceScorerError
      );
    });
  });

  describe('aggregateConfidences', () => {
    it('should calculate weighted average', () => {
      const sources = [
        { source: 'source1', confidence: 80, weight: 1 },
        { source: 'source2', confidence: 60, weight: 1 },
      ];
      
      const result = aggregateConfidences(sources);
      
      expect(result.aggregatedConfidence).toBe(70); // (80 + 60) / 2
    });

    it('should handle weighted sources', () => {
      const sources = [
        { source: 'source1', confidence: 80, weight: 3 },
        { source: 'source2', confidence: 50, weight: 1 },
      ];
      
      const result = aggregateConfidences(sources);
      
      // (80*3 + 50*1) / 4 = 290 / 4 = 72.5 -> 73
      expect(result.aggregatedConfidence).toBe(73);
    });

    it('should calculate variance', () => {
      const sources = [
        { source: 'source1', confidence: 80 },
        { source: 'source2', confidence: 60 },
      ];
      
      const result = aggregateConfidences(sources);
      
      expect(result.variance).toBeGreaterThan(0);
    });

    it('should detect high agreement', () => {
      const sources = [
        { source: 'source1', confidence: 75 },
        { source: 'source2', confidence: 77 },
        { source: 'source3', confidence: 76 },
      ];
      
      const result = aggregateConfidences(sources);
      
      expect(result.agreement).toBe('high');
    });

    it('should detect low agreement', () => {
      const sources = [
        { source: 'source1', confidence: 20 },
        { source: 'source2', confidence: 80 },
        { source: 'source3', confidence: 50 },
      ];
      
      const result = aggregateConfidences(sources);
      
      expect(result.agreement).toBe('low');
    });

    it('should throw error for no sources', () => {
      expect(() => aggregateConfidences([])).toThrow(ConfidenceScorerError);
    });

    it('should handle single source', () => {
      const sources = [{ source: 'source1', confidence: 75 }];
      
      const result = aggregateConfidences(sources);
      
      expect(result.aggregatedConfidence).toBe(75);
      expect(result.variance).toBe(0);
    });
  });

  describe('detectOutliers', () => {
    it('should detect outliers in dataset', () => {
      // Use threshold=1.5 so the algorithm can detect outliers in a small dataset.
      // With [50,52,48,51,49,95]: mean≈57.5, stdDev≈16.82, Z(95)≈2.23 > 1.5
      const scores = [50, 52, 48, 51, 49, 95]; // 95 is outlier

      const outliers = detectOutliers(scores, 1.5);

      expect(outliers[5]).toBe(true); // Last element is outlier
      expect(outliers.filter((o) => o).length).toBe(1);
    });

    it('should not detect outliers in uniform dataset', () => {
      const scores = [50, 50, 50, 50, 50];
      
      const outliers = detectOutliers(scores);
      
      expect(outliers.every((o) => !o)).toBe(true);
    });

    it('should not detect outliers in normal distribution', () => {
      const scores = [45, 48, 50, 52, 55];
      
      const outliers = detectOutliers(scores);
      
      expect(outliers.every((o) => !o)).toBe(true);
    });

    it('should handle small datasets', () => {
      const scores = [50, 95];
      
      const outliers = detectOutliers(scores);
      
      // Too few samples to detect outliers
      expect(outliers.every((o) => !o)).toBe(true);
    });

    it('should detect multiple outliers', () => {
      // Use threshold=1.5 so the algorithm can flag both extremes in this small dataset.
      // With [50,52,48,10,90]: mean=50, stdDev≈25.33, Z(10)≈1.58 > 1.5, Z(90)≈1.58 > 1.5
      const scores = [50, 52, 48, 10, 90]; // 10 and 90 are outliers

      const outliers = detectOutliers(scores, 1.5);

      expect(outliers.filter((o) => o).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('filterOutliers', () => {
    it('should remove outliers from dataset', () => {
      // Use threshold=1.5 so the algorithm detects the outlier in this small dataset.
      // With [50,52,48,51,49,95]: mean≈57.5, stdDev≈16.82, Z(95)≈2.23 > 1.5
      const scores = [50, 52, 48, 51, 49, 95];

      const filtered = filterOutliers(scores, 1.5);

      expect(filtered.length).toBeLessThan(scores.length);
      expect(filtered).not.toContain(95);
    });

    it('should not remove any from uniform dataset', () => {
      const scores = [50, 50, 50, 50, 50];
      
      const filtered = filterOutliers(scores);
      
      expect(filtered.length).toBe(scores.length);
    });

    it('should preserve normal values', () => {
      const scores = [45, 48, 50, 52, 55];
      
      const filtered = filterOutliers(scores);
      
      expect(filtered.length).toBe(scores.length);
    });
  });

  describe('calculateSuccessRate', () => {
    it('should calculate correct success rate', () => {
      const trainingData: TrainingData = makeTrainingData({ positiveCount: 7, negativeCount: 3 });

      const rate = calculateSuccessRate(trainingData);

      expect(rate).toBeCloseTo(0.7, 2);
    });

    it('should return 0 for no positive feedback', () => {
      const trainingData: TrainingData = makeTrainingData({ positiveCount: 0, negativeCount: 5 });

      const rate = calculateSuccessRate(trainingData);

      expect(rate).toBe(0);
    });

    it('should return 1 for no negative feedback', () => {
      const trainingData: TrainingData = makeTrainingData({ positiveCount: 5, negativeCount: 0 });

      const rate = calculateSuccessRate(trainingData);

      expect(rate).toBe(1);
    });

    it('should return 0 for no feedback', () => {
      const trainingData: TrainingData = makeTrainingData({ positiveCount: 0, negativeCount: 0 });

      const rate = calculateSuccessRate(trainingData);

      expect(rate).toBe(0);
    });
  });

  describe('getConfidenceGrade', () => {
    it('should return A for high confidence', () => {
      expect(getConfidenceGrade(95)).toBe('A');
      expect(getConfidenceGrade(90)).toBe('A');
    });

    it('should return B for good confidence', () => {
      expect(getConfidenceGrade(85)).toBe('B');
      expect(getConfidenceGrade(80)).toBe('B');
    });

    it('should return C for average confidence', () => {
      expect(getConfidenceGrade(75)).toBe('C');
      expect(getConfidenceGrade(70)).toBe('C');
    });

    it('should return D for below average confidence', () => {
      expect(getConfidenceGrade(65)).toBe('D');
      expect(getConfidenceGrade(60)).toBe('D');
    });

    it('should return F for low confidence', () => {
      expect(getConfidenceGrade(55)).toBe('F');
      expect(getConfidenceGrade(30)).toBe('F');
    });
  });

  describe('calculateConfidenceTrend', () => {
    it('should detect improving trend', () => {
      const scores = [50, 55, 60, 65, 70];
      
      const trend = calculateConfidenceTrend(scores);
      
      expect(trend).toBe('improving');
    });

    it('should detect declining trend', () => {
      const scores = [70, 65, 60, 55, 50];
      
      const trend = calculateConfidenceTrend(scores);
      
      expect(trend).toBe('declining');
    });

    it('should detect stable trend', () => {
      const scores = [50, 51, 50, 49, 50];
      
      const trend = calculateConfidenceTrend(scores);
      
      expect(trend).toBe('stable');
    });

    it('should return stable for single data point', () => {
      const scores = [50];
      
      const trend = calculateConfidenceTrend(scores);
      
      expect(trend).toBe('stable');
    });

    it('should handle noisy but improving data', () => {
      const scores = [40, 45, 43, 50, 48, 55, 52, 60];
      
      const trend = calculateConfidenceTrend(scores);
      
      expect(trend).toBe('improving');
    });
  });

  describe('Performance', () => {
    it('should calculate Bayesian confidence quickly', () => {
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        calculateBayesianConfidence(50, 10);
      }
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // <0.1ms per calculation
    });

    it('should calculate decay factor quickly', () => {
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        calculateDecayFactor(30, 30);
      }
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
    });
  });
});
