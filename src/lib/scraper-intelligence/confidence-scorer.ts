/**
 * Confidence Scorer
 * 
 * Advanced confidence scoring system with Bayesian updates, decay functions,
 * reinforcement learning, multi-source aggregation, and outlier detection.
 * 
 * Features:
 * - Bayesian confidence updates (Beta distribution)
 * - Time-based decay for stale patterns
 * - Reinforcement learning from feedback
 * - Multi-source confidence aggregation
 * - Outlier detection and filtering
 * - Performance optimization (<10ms per score)
 */

import { logger } from '@/lib/logger/logger';
import type { TrainingData, ExtractedSignal } from '@/types/scraper-intelligence';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PRIOR_ALPHA = 1; // Prior belief: 1 success
const DEFAULT_PRIOR_BETA = 1; // Prior belief: 1 failure
const DECAY_HALF_LIFE_DAYS = 30; // Confidence decays by half every 30 days
const MIN_CONFIDENCE = 10; // Minimum confidence score (0-100)
const MAX_CONFIDENCE = 95; // Maximum confidence score (0-100)
const OUTLIER_THRESHOLD_STDEV = 2.5; // Z-score threshold for outliers
const REINFORCEMENT_LEARNING_RATE = 0.1; // Learning rate for RL updates

// ============================================================================
// TYPES
// ============================================================================

export interface ConfidenceScore {
  /**
   * Overall confidence score (0-100)
   */
  confidence: number;

  /**
   * Bayesian posterior confidence
   */
  bayesianConfidence: number;

  /**
   * Time-decayed confidence
   */
  decayedConfidence: number;

  /**
   * Reinforcement-adjusted confidence
   */
  reinforcementConfidence: number;

  /**
   * Whether this score is an outlier
   */
  isOutlier: boolean;

  /**
   * Breakdown of confidence sources
   */
  sources: {
    positive: number;
    negative: number;
    neutral: number;
  };

  /**
   * Metadata
   */
  metadata: {
    age: number; // Days since last update
    totalSamples: number;
    successRate: number;
    decayFactor: number;
  };
}

export interface MultiSourceScore {
  /**
   * Aggregated confidence from multiple sources
   */
  aggregatedConfidence: number;

  /**
   * Individual source confidences
   */
  sourceConfidences: Array<{
    source: string;
    confidence: number;
    weight: number;
  }>;

  /**
   * Variance across sources
   */
  variance: number;

  /**
   * Whether sources agree (low variance)
   */
  agreement: 'high' | 'medium' | 'low';
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class ConfidenceScorerError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ConfidenceScorerError';
  }
}

// ============================================================================
// BAYESIAN CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate Bayesian confidence using Beta distribution
 * 
 * Uses Beta(α, β) where:
 * - α = positive confirmations + prior
 * - β = negative confirmations + prior
 * 
 * Posterior mean = α / (α + β)
 * 
 * @param positive - Number of positive confirmations
 * @param negative - Number of negative confirmations
 * @param priorAlpha - Prior alpha (default 1)
 * @param priorBeta - Prior beta (default 1)
 * @returns Confidence score (0-100)
 */
export function calculateBayesianConfidence(
  positive: number,
  negative: number,
  priorAlpha: number = DEFAULT_PRIOR_ALPHA,
  priorBeta: number = DEFAULT_PRIOR_BETA
): number {
  if (positive < 0 || negative < 0) {
    throw new ConfidenceScorerError(
      'Positive and negative counts must be non-negative',
      'INVALID_INPUT',
      400
    );
  }

  if (priorAlpha <= 0 || priorBeta <= 0) {
    throw new ConfidenceScorerError(
      'Prior alpha and beta must be positive',
      'INVALID_PRIOR',
      400
    );
  }

  // Posterior parameters
  const alpha = positive + priorAlpha;
  const beta = negative + priorBeta;

  // Posterior mean (expected value of Beta distribution)
  const posteriorMean = alpha / (alpha + beta);

  // Scale to 0-100 and clamp
  const confidence = Math.round(posteriorMean * 100);
  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, confidence));
}

/**
 * Calculate confidence interval for Bayesian estimate
 * 
 * Returns credible interval (e.g., 95% confidence interval).
 * 
 * @param positive - Number of positive confirmations
 * @param negative - Number of negative confirmations
 * @param credibilityLevel - Credibility level (e.g., 0.95 for 95%)
 * @returns Lower and upper bounds of confidence interval
 */
export function calculateCredibleInterval(
  positive: number,
  negative: number,
  credibilityLevel: number = 0.95
): { lower: number; upper: number } {
  const alpha = positive + DEFAULT_PRIOR_ALPHA;
  const beta = negative + DEFAULT_PRIOR_BETA;

  // For Beta distribution, use quantile approximation
  // Simplified Wilson score interval
  const n = positive + negative;
  const p = positive / (n || 1);
  const z = getZScore(credibilityLevel);

  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt(p * (1 - p) / n + (z * z) / (4 * n * n))) / denominator;

  return {
    lower: Math.max(0, Math.round((center - margin) * 100)),
    upper: Math.min(100, Math.round((center + margin) * 100)),
  };
}

/**
 * Get Z-score for credibility level
 */
function getZScore(credibilityLevel: number): number {
  // Common Z-scores
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };

  return zScores[credibilityLevel] || 1.96; // Default to 95%
}

// ============================================================================
// TIME DECAY
// ============================================================================

/**
 * Calculate time decay factor
 * 
 * Uses exponential decay with configurable half-life.
 * Formula: decay = 2^(-days / halfLife)
 * 
 * @param daysSinceLastUpdate - Number of days since last update
 * @param halfLifeDays - Half-life in days
 * @returns Decay factor (0-1)
 */
export function calculateDecayFactor(
  daysSinceLastUpdate: number,
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS
): number {
  if (daysSinceLastUpdate < 0) {
    throw new ConfidenceScorerError(
      'Days since last update must be non-negative',
      'INVALID_INPUT',
      400
    );
  }

  if (halfLifeDays <= 0) {
    throw new ConfidenceScorerError(
      'Half-life must be positive',
      'INVALID_HALF_LIFE',
      400
    );
  }

  // Exponential decay: decay = 2^(-t / halfLife)
  const decay = Math.pow(2, -daysSinceLastUpdate / halfLifeDays);
  return Math.max(0, Math.min(1, decay));
}

/**
 * Apply time decay to confidence score
 * 
 * Reduces confidence for patterns that haven't been seen recently.
 * 
 * @param confidence - Base confidence (0-100)
 * @param daysSinceLastUpdate - Days since last update
 * @param halfLifeDays - Half-life in days
 * @returns Decayed confidence (0-100)
 */
export function applyTimeDecay(
  confidence: number,
  daysSinceLastUpdate: number,
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS
): number {
  const decayFactor = calculateDecayFactor(daysSinceLastUpdate, halfLifeDays);
  const decayedConfidence = confidence * decayFactor;
  
  return Math.max(MIN_CONFIDENCE, Math.round(decayedConfidence));
}

// ============================================================================
// REINFORCEMENT LEARNING
// ============================================================================

/**
 * Update confidence using reinforcement learning
 * 
 * Uses Q-learning style update:
 * newConfidence = oldConfidence + learningRate * (reward - oldConfidence)
 * 
 * @param currentConfidence - Current confidence (0-100)
 * @param reward - Reward signal (0-100, where 100 = perfect match)
 * @param learningRate - Learning rate (0-1)
 * @returns Updated confidence
 */
export function reinforcementUpdate(
  currentConfidence: number,
  reward: number,
  learningRate: number = REINFORCEMENT_LEARNING_RATE
): number {
  if (currentConfidence < 0 || currentConfidence > 100) {
    throw new ConfidenceScorerError(
      'Confidence must be between 0 and 100',
      'INVALID_CONFIDENCE',
      400
    );
  }

  if (reward < 0 || reward > 100) {
    throw new ConfidenceScorerError(
      'Reward must be between 0 and 100',
      'INVALID_REWARD',
      400
    );
  }

  if (learningRate < 0 || learningRate > 1) {
    throw new ConfidenceScorerError(
      'Learning rate must be between 0 and 1',
      'INVALID_LEARNING_RATE',
      400
    );
  }

  // Q-learning update
  const delta = reward - currentConfidence;
  const newConfidence = currentConfidence + learningRate * delta;

  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, Math.round(newConfidence)));
}

// ============================================================================
// MULTI-SOURCE AGGREGATION
// ============================================================================

/**
 * Aggregate confidence scores from multiple sources
 * 
 * Uses weighted average with variance-based confidence adjustment.
 * 
 * @param sources - Array of source confidences and weights
 * @returns Aggregated confidence with metadata
 */
export function aggregateConfidences(
  sources: Array<{ source: string; confidence: number; weight?: number }>
): MultiSourceScore {
  if (sources.length === 0) {
    throw new ConfidenceScorerError(
      'At least one source required',
      'NO_SOURCES',
      400
    );
  }

  // Normalize weights
  const totalWeight = sources.reduce((sum, s) => sum + (s.weight || 1), 0);
  const normalizedSources = sources.map((s) => ({
    source: s.source,
    confidence: s.confidence,
    weight: (s.weight || 1) / totalWeight,
  }));

  // Calculate weighted average
  const aggregatedConfidence = normalizedSources.reduce(
    (sum, s) => sum + s.confidence * s.weight,
    0
  );

  // Calculate variance
  const mean = aggregatedConfidence;
  const variance = normalizedSources.reduce(
    (sum, s) => sum + s.weight * Math.pow(s.confidence - mean, 2),
    0
  );

  // Determine agreement level
  const stdDev = Math.sqrt(variance);
  let agreement: 'high' | 'medium' | 'low';
  if (stdDev < 10) {
    agreement = 'high';
  } else if (stdDev < 20) {
    agreement = 'medium';
  } else {
    agreement = 'low';
  }

  return {
    aggregatedConfidence: Math.round(aggregatedConfidence),
    sourceConfidences: normalizedSources,
    variance,
    agreement,
  };
}

// ============================================================================
// OUTLIER DETECTION
// ============================================================================

/**
 * Detect outliers using Z-score method
 * 
 * Identifies confidence scores that are significantly different from the mean.
 * 
 * @param scores - Array of confidence scores
 * @param threshold - Z-score threshold (default 2.5)
 * @returns Array of boolean flags indicating outliers
 */
export function detectOutliers(
  scores: number[],
  threshold: number = OUTLIER_THRESHOLD_STDEV
): boolean[] {
  if (scores.length < 3) {
    // Too few samples to detect outliers
    return scores.map(() => false);
  }

  // Calculate mean and standard deviation
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    // All scores are identical
    return scores.map(() => false);
  }

  // Calculate Z-scores and flag outliers
  return scores.map((score) => {
    const zScore = Math.abs((score - mean) / stdDev);
    return zScore > threshold;
  });
}

/**
 * Filter out outliers from a dataset
 * 
 * Removes scores that are identified as outliers.
 * 
 * @param scores - Array of confidence scores
 * @param threshold - Z-score threshold
 * @returns Filtered array without outliers
 */
export function filterOutliers(
  scores: number[],
  threshold: number = OUTLIER_THRESHOLD_STDEV
): number[] {
  const outlierFlags = detectOutliers(scores, threshold);
  return scores.filter((_, index) => !outlierFlags[index]);
}

// ============================================================================
// COMPREHENSIVE CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate comprehensive confidence score
 * 
 * Combines Bayesian confidence, time decay, and reinforcement learning.
 * 
 * @param trainingData - Training data with feedback history
 * @param currentDate - Current date (for decay calculation)
 * @returns Comprehensive confidence score with breakdown
 */
export function calculateComprehensiveConfidence(
  trainingData: TrainingData,
  currentDate: Date = new Date()
): ConfidenceScore {
  // 1. Bayesian confidence
  const bayesianConfidence = calculateBayesianConfidence(
    trainingData.positiveCount,
    trainingData.negativeCount
  );

  // 2. Time decay
  const daysSinceUpdate = Math.floor(
    (currentDate.getTime() - trainingData.lastSeenAt.getTime()) /
      (24 * 60 * 60 * 1000)
  );
  const decayFactor = calculateDecayFactor(daysSinceUpdate);
  const decayedConfidence = applyTimeDecay(
    bayesianConfidence,
    daysSinceUpdate
  );

  // 3. Reinforcement learning adjustment
  // Use current confidence as baseline and adjust based on recent success rate
  const totalSamples = trainingData.positiveCount + trainingData.negativeCount;
  const successRate =
    totalSamples > 0 ? trainingData.positiveCount / totalSamples : 0.5;
  const reward = successRate * 100;
  const reinforcementConfidence = reinforcementUpdate(
    decayedConfidence,
    reward
  );

  // 4. Final confidence (weighted average)
  const confidence = Math.round(
    bayesianConfidence * 0.4 +
      decayedConfidence * 0.3 +
      reinforcementConfidence * 0.3
  );

  // 5. Outlier detection (simple check)
  const isOutlier = Math.abs(confidence - bayesianConfidence) > 30;

  return {
    confidence: Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, confidence)),
    bayesianConfidence,
    decayedConfidence,
    reinforcementConfidence,
    isOutlier,
    sources: {
      positive: trainingData.positiveCount,
      negative: trainingData.negativeCount,
      neutral: 0,
    },
    metadata: {
      age: daysSinceUpdate,
      totalSamples,
      successRate,
      decayFactor,
    },
  };
}

/**
 * Calculate confidence for an extracted signal
 * 
 * Determines confidence based on multiple factors:
 * - Pattern match confidence
 * - Historical accuracy
 * - Signal priority
 * - Context relevance
 * 
 * @param signal - Extracted signal
 * @param matchedPattern - Training data that matched
 * @returns Confidence score (0-100)
 */
export function calculateSignalConfidence(
  signal: ExtractedSignal,
  matchedPattern?: TrainingData
): number {
  // Base confidence from signal
  let confidence = signal.confidence;

  // Adjust based on matched pattern if available
  if (matchedPattern) {
    const patternScore = calculateComprehensiveConfidence(matchedPattern);
    // Weighted average: 60% signal, 40% pattern
    confidence = Math.round(confidence * 0.6 + patternScore.confidence * 0.4);
  }

  // Clamp to valid range
  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, confidence));
}

/**
 * Batch calculate confidences for multiple training patterns
 * 
 * Optimized for performance (<10ms for typical dataset).
 * 
 * @param patterns - Array of training patterns
 * @param currentDate - Current date (for decay)
 * @returns Array of confidence scores
 */
export function batchCalculateConfidences(
  patterns: TrainingData[],
  currentDate: Date = new Date()
): ConfidenceScore[] {
  const startTime = Date.now();

  const scores = patterns.map((pattern) =>
    calculateComprehensiveConfidence(pattern, currentDate)
  );

  const duration = Date.now() - startTime;

  if (duration > 10) {
    logger.warn('Batch confidence calculation exceeded 10ms', {
      duration,
      patternCount: patterns.length,
    });
  }

  return scores;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Calculate success rate from training data
 */
export function calculateSuccessRate(trainingData: TrainingData): number {
  const total = trainingData.positiveCount + trainingData.negativeCount;
  return total > 0 ? trainingData.positiveCount / total : 0;
}

/**
 * Get confidence grade
 * 
 * @param confidence - Confidence score (0-100)
 * @returns Grade: A, B, C, D, or F
 */
export function getConfidenceGrade(confidence: number): string {
  if (confidence >= 90) return 'A';
  if (confidence >= 80) return 'B';
  if (confidence >= 70) return 'C';
  if (confidence >= 60) return 'D';
  return 'F';
}

/**
 * Calculate confidence trend
 * 
 * Determines if confidence is improving, stable, or declining.
 * 
 * @param historicalScores - Array of historical confidence scores (oldest first)
 * @returns Trend direction
 */
export function calculateConfidenceTrend(
  historicalScores: number[]
): 'improving' | 'stable' | 'declining' {
  if (historicalScores.length < 2) {
    return 'stable';
  }

  // Simple linear regression slope
  const n = historicalScores.length;
  const xMean = (n - 1) / 2;
  const yMean = historicalScores.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    const yDiff = historicalScores[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  const slope = numerator / denominator;

  if (slope > 1) return 'improving';
  if (slope < -1) return 'declining';
  return 'stable';
}
