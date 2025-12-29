/**
 * Unit Tests for Pattern Matcher
 * 
 * Tests semantic pattern matching using embeddings.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  cosineSimilarity,
  calculateThreshold,
  PatternMatcherError,
  clearEmbeddingCache,
  resetCostTracking,
} from '@/lib/scraper-intelligence/pattern-matcher';

describe('Pattern Matcher', () => {
  beforeEach(() => {
    clearEmbeddingCache();
    resetCostTracking();
  });

  describe('cosineSimilarity', () => {
    it('should calculate similarity for identical vectors', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [1, 2, 3, 4, 5];
      
      const similarity = cosineSimilarity(a, b);
      
      // Identical vectors should have similarity close to 1
      expect(similarity).toBeGreaterThan(0.99);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should calculate similarity for opposite vectors', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [-1, -2, -3, -4, -5];
      
      const similarity = cosineSimilarity(a, b);
      
      // Opposite vectors should have similarity close to 0 (after normalization)
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThan(0.1);
    });

    it('should calculate similarity for perpendicular vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      
      const similarity = cosineSimilarity(a, b);
      
      // Perpendicular vectors should have similarity around 0.5 (after normalization from 0)
      expect(similarity).toBeGreaterThan(0.4);
      expect(similarity).toBeLessThan(0.6);
    });

    it('should calculate similarity for similar but not identical vectors', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [1, 2, 3, 4, 6]; // Only last element different
      
      const similarity = cosineSimilarity(a, b);
      
      // Very similar vectors should have high similarity
      expect(similarity).toBeGreaterThan(0.9);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      
      const similarity = cosineSimilarity(a, b);
      
      expect(similarity).toBe(0);
    });

    it('should throw error for vectors of different dimensions', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3, 4];
      
      expect(() => cosineSimilarity(a, b)).toThrow(PatternMatcherError);
      expect(() => cosineSimilarity(a, b)).toThrow('same dimensions');
    });

    it('should handle empty vectors', () => {
      const a: number[] = [];
      const b: number[] = [];
      
      const similarity = cosineSimilarity(a, b);
      
      expect(similarity).toBe(0);
    });

    it('should handle single-element vectors', () => {
      const a = [5];
      const b = [3];
      
      const similarity = cosineSimilarity(a, b);
      
      // Both positive, should have high similarity (normalized)
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should handle high-dimensional vectors', () => {
      // Simulate OpenAI embeddings (1536 dimensions)
      const dim = 1536;
      const a = Array.from({ length: dim }, (_, i) => Math.sin(i));
      const b = Array.from({ length: dim }, (_, i) => Math.sin(i + 0.1));
      
      const similarity = cosineSimilarity(a, b);
      
      // Should be high similarity for similar patterns
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should be symmetric', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [2, 3, 4, 5, 6];
      
      const sim1 = cosineSimilarity(a, b);
      const sim2 = cosineSimilarity(b, a);
      
      expect(sim1).toBe(sim2);
    });

    it('should handle negative values', () => {
      const a = [-1, -2, -3];
      const b = [1, 2, 3];
      
      const similarity = cosineSimilarity(a, b);
      
      // Opposite directions should have low similarity (after normalization)
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThan(0.1);
    });

    it('should handle mixed positive and negative values', () => {
      const a = [1, -1, 2, -2, 3];
      const b = [1, -1, 2, -2, 3];
      
      const similarity = cosineSimilarity(a, b);
      
      // Identical vectors should have similarity close to 1
      expect(similarity).toBeGreaterThan(0.99);
    });
  });

  describe('calculateThreshold', () => {
    it('should return higher threshold for higher precision', () => {
      const threshold95 = calculateThreshold(0.95);
      const threshold90 = calculateThreshold(0.90);
      const threshold85 = calculateThreshold(0.85);
      
      expect(threshold95).toBeGreaterThan(threshold90);
      expect(threshold90).toBeGreaterThan(threshold85);
    });

    it('should return threshold in valid range', () => {
      const threshold = calculateThreshold(0.90);
      
      expect(threshold).toBeGreaterThanOrEqual(0.5);
      expect(threshold).toBeLessThanOrEqual(0.95);
    });

    it('should handle precision = 1.0', () => {
      const threshold = calculateThreshold(1.0);
      
      expect(threshold).toBeGreaterThan(0.9);
      expect(threshold).toBeLessThanOrEqual(1.0);
    });

    it('should handle precision = 0.5', () => {
      const threshold = calculateThreshold(0.5);
      
      expect(threshold).toBeGreaterThanOrEqual(0.5);
      expect(threshold).toBeLessThan(0.8);
    });

    it('should throw error for invalid precision', () => {
      expect(() => calculateThreshold(-0.1)).toThrow(PatternMatcherError);
      expect(() => calculateThreshold(1.1)).toThrow(PatternMatcherError);
    });

    it('should handle edge case precision = 0', () => {
      const threshold = calculateThreshold(0);
      
      expect(threshold).toBeGreaterThanOrEqual(0.5);
      expect(threshold).toBeLessThanOrEqual(0.95);
    });
  });

  describe('PatternMatcherError', () => {
    it('should create error with correct properties', () => {
      const error = new PatternMatcherError(
        'Test error',
        'TEST_ERROR',
        400
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('PatternMatcherError');
    });

    it('should default to 500 status code', () => {
      const error = new PatternMatcherError(
        'Test error',
        'TEST_ERROR'
      );

      expect(error.statusCode).toBe(500);
    });
  });

  describe('Normalization', () => {
    it('should normalize similarity scores to 0-1 range', () => {
      // Test that all similarity scores are in [0, 1]
      const testCases = [
        [[1, 2, 3], [1, 2, 3]],      // Identical
        [[1, 2, 3], [-1, -2, -3]],   // Opposite
        [[1, 0, 0], [0, 1, 0]],      // Perpendicular
        [[1, 2, 3], [2, 3, 4]],      // Similar
        [[1, 2, 3], [10, 20, 30]],   // Scaled
      ];

      for (const [a, b] of testCases) {
        const similarity = cosineSimilarity(a as number[], b as number[]);
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
      }
    });

    it('should handle scaled vectors correctly', () => {
      const a = [1, 2, 3];
      const b = [10, 20, 30]; // Scaled version of a
      
      const similarity = cosineSimilarity(a, b);
      
      // Scaled versions should have high similarity (same direction)
      expect(similarity).toBeGreaterThan(0.99);
    });
  });

  describe('Performance', () => {
    it('should handle large vectors efficiently', () => {
      const dim = 1536; // OpenAI embedding dimension
      const a = Array.from({ length: dim }, () => Math.random());
      const b = Array.from({ length: dim }, () => Math.random());
      
      const start = Date.now();
      const similarity = cosineSimilarity(a, b);
      const duration = Date.now() - start;
      
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
      expect(duration).toBeLessThan(10); // Should be very fast (<10ms)
    });

    it('should calculate similarity for 1000 pairs quickly', () => {
      const dim = 128;
      const vectors = Array.from({ length: 1000 }, () =>
        Array.from({ length: dim }, () => Math.random())
      );
      
      const start = Date.now();
      
      for (let i = 0; i < vectors.length - 1; i++) {
        cosineSimilarity(vectors[i], vectors[i + 1]);
      }
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(500); // Should handle 1000 calculations in <500ms
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small values', () => {
      const a = [0.0001, 0.0002, 0.0003];
      const b = [0.0001, 0.0002, 0.0003];
      
      const similarity = cosineSimilarity(a, b);
      
      expect(similarity).toBeGreaterThan(0.99);
    });

    it('should handle very large values', () => {
      const a = [1000000, 2000000, 3000000];
      const b = [1000000, 2000000, 3000000];
      
      const similarity = cosineSimilarity(a, b);
      
      expect(similarity).toBeGreaterThan(0.99);
    });

    it('should handle mixed magnitudes', () => {
      const a = [0.001, 1000, 0.1];
      const b = [0.001, 1000, 0.1];
      
      const similarity = cosineSimilarity(a, b);
      
      expect(similarity).toBeGreaterThan(0.99);
    });

    it('should handle NaN gracefully', () => {
      const a = [1, 2, NaN];
      const b = [1, 2, 3];
      
      const similarity = cosineSimilarity(a, b);
      
      // NaN should result in NaN or 0
      expect(isNaN(similarity) || similarity === 0).toBe(true);
    });

    it('should handle Infinity gracefully', () => {
      const a = [1, 2, Infinity];
      const b = [1, 2, 3];
      
      const similarity = cosineSimilarity(a, b);
      
      // Infinity should be handled (may be NaN or finite)
      expect(typeof similarity).toBe('number');
    });
  });

  describe('Mathematical Properties', () => {
    it('should satisfy triangle inequality approximately', () => {
      const a = [1, 2, 3];
      const b = [2, 3, 4];
      const c = [3, 4, 5];
      
      const simAB = cosineSimilarity(a, b);
      const simBC = cosineSimilarity(b, c);
      const simAC = cosineSimilarity(a, c);
      
      // For cosine similarity, transitivity is approximate
      // If A is similar to B and B is similar to C, 
      // A should be somewhat similar to C
      if (simAB > 0.9 && simBC > 0.9) {
        expect(simAC).toBeGreaterThan(0.7);
      }
    });

    it('should have maximum value of ~1 for identical vectors', () => {
      const a = [1, 2, 3, 4, 5];
      
      const similarity = cosineSimilarity(a, a);
      
      expect(similarity).toBeGreaterThan(0.999);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should be consistent for normalized vectors', () => {
      const a = [1, 2, 3];
      const aNorm = [1 / Math.sqrt(14), 2 / Math.sqrt(14), 3 / Math.sqrt(14)];
      
      const b = [2, 3, 4];
      const bNorm = [2 / Math.sqrt(29), 3 / Math.sqrt(29), 4 / Math.sqrt(29)];
      
      const sim1 = cosineSimilarity(a, b);
      const sim2 = cosineSimilarity(aNorm, bNorm);
      
      // Should be same for normalized and non-normalized
      expect(Math.abs(sim1 - sim2)).toBeLessThan(0.001);
    });
  });
});
