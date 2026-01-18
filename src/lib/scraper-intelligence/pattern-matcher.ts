/**
 * Pattern Matcher
 * 
 * Semantic pattern matching using OpenAI embeddings for similarity search.
 * Enables finding similar patterns even when exact keywords don't match.
 * 
 * Features:
 * - OpenAI embeddings generation (text-embedding-3-small)
 * - Cosine similarity calculation for vector matching
 * - Batch processing for efficiency
 * - Caching for repeated queries
 * - Fallback mechanisms for API failures
 * - Cost tracking and optimization
 */

import { logger } from '@/lib/logger/logger';
import type { TrainingData } from '@/types/scraper-intelligence';

// ============================================================================
// CONSTANTS
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions, $0.02/1M tokens
const SIMILARITY_THRESHOLD = 0.75; // Min similarity score (0-1)
const BATCH_SIZE = 100; // Process up to 100 texts at once
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache for embeddings
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface PatternMatch {
  pattern: TrainingData;
  similarity: number;
  confidence: number;
}

export interface EmbeddingCache {
  embedding: number[];
  createdAt: number;
}

export interface CostMetrics {
  totalTokens: number;
  totalCostUSD: number;
  cacheHitRate: number;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class PatternMatcherError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'PatternMatcherError';
  }
}

// ============================================================================
// EMBEDDING CACHE
// ============================================================================

class EmbeddingCacheStore {
  private cache = new Map<string, EmbeddingCache>();
  private hits = 0;
  private misses = 0;

  get(text: string): number[] | null {
    const entry = this.cache.get(text);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
      this.cache.delete(text);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.embedding;
  }

  set(text: string, embedding: number[]): void {
    this.cache.set(text, {
      embedding,
      createdAt: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  size(): number {
    return this.cache.size;
  }
}

const embeddingCache = new EmbeddingCacheStore();

// ============================================================================
// COST TRACKING
// ============================================================================

class CostTracker {
  private totalTokens = 0;
  private tokenCostPer1M = 0.02; // $0.02 per 1M tokens for text-embedding-3-small

  addTokens(count: number): void {
    this.totalTokens += count;
  }

  getTotalCost(): number {
    return (this.totalTokens / 1_000_000) * this.tokenCostPer1M;
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }

  reset(): void {
    this.totalTokens = 0;
  }

  getMetrics(): CostMetrics {
    return {
      totalTokens: this.totalTokens,
      totalCostUSD: this.getTotalCost(),
      cacheHitRate: embeddingCache.getHitRate(),
    };
  }
}

const costTracker = new CostTracker();

// ============================================================================
// OPENAI EMBEDDINGS
// ============================================================================

/**
 * Generate embedding for a single text
 * 
 * Uses OpenAI text-embedding-3-small model (1536 dimensions).
 * Implements caching to reduce API calls and costs.
 * 
 * @param text - Text to embed
 * @returns Embedding vector (1536 dimensions)
 * @throws PatternMatcherError if API call fails
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Validate input
  if (!text || text.trim().length === 0) {
    throw new PatternMatcherError(
      'Text cannot be empty',
      'INVALID_INPUT',
      400
    );
  }

  // Check cache first
  const cached = embeddingCache.get(text);
  if (cached) {
    logger.debug('Embedding cache hit', { text: text.substring(0, 50) });
    return cached;
  }

  // Generate embedding via OpenAI
  if (!OPENAI_API_KEY) {
    throw new PatternMatcherError(
      'OpenAI API key not configured',
      'MISSING_API_KEY',
      500
    );
  }

  let lastError: Error | undefined = undefined;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text,
          encoding_format: 'float',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      
      if (!data.data?.[0]?.embedding) {
        throw new Error('Invalid response from OpenAI API');
      }

      const embedding = data.data[0].embedding as number[];
      
      // Track cost
      const tokensUsed =data.usage?.total_tokens ?? estimateTokens(text);
      costTracker.addTokens(tokensUsed);

      // Cache the result
      embeddingCache.set(text, embedding);

      logger.debug('Generated embedding', {
        text: text.substring(0, 50),
        dimensions: embedding.length,
        tokensUsed,
        attempt,
      });

      return embedding;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < MAX_RETRIES) {
        logger.warn('Embedding generation failed, retrying', {
          attempt,
          error: lastError.message,
          text: text.substring(0, 50),
        });
        
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt - 1))
        );
      }
    }
  }

  logger.error('Failed to generate embedding after retries', lastError, {
    text: text.substring(0, 50),
  });

  throw new PatternMatcherError(
    `Failed to generate embedding: ${lastError?.message}`,
    'EMBEDDING_FAILED',
    500
  );
}

/**
 * Generate embeddings for multiple texts in batch
 * 
 * More efficient than calling generateEmbedding multiple times.
 * Processes in chunks to respect API limits.
 * 
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 * @throws PatternMatcherError if API call fails
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // Filter empty texts
  const validTexts = texts.filter((t) => t && t.trim().length > 0);
  
  if (validTexts.length === 0) {
    throw new PatternMatcherError(
      'No valid texts to embed',
      'INVALID_INPUT',
      400
    );
  }

  // Check cache for all texts
  const results: (number[] | null)[] = validTexts.map((text) =>
    embeddingCache.get(text)
  );

  const uncachedIndices = results
    .map((result, index) => (result === null ? index : -1))
    .filter((index) => index !== -1);

  // All cached - return immediately
  if (uncachedIndices.length === 0) {
    return results as number[][];
  }

  // Get uncached texts
  const uncachedTexts = uncachedIndices.map((i) => validTexts[i]);

  if (!OPENAI_API_KEY) {
    throw new PatternMatcherError(
      'OpenAI API key not configured',
      'MISSING_API_KEY',
      500
    );
  }

  // Process in batches
  const batches: string[][] = [];
  for (let i = 0; i < uncachedTexts.length; i += BATCH_SIZE) {
    batches.push(uncachedTexts.slice(i, i + BATCH_SIZE));
  }

  const uncachedEmbeddings: number[][] = [];

  for (const batch of batches) {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: batch,
            encoding_format: 'float',
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data)) {
          throw new Error('Invalid response from OpenAI API');
        }

        const batchEmbeddings = data.data.map(
          (item: { embedding: number[] }) => item.embedding
        );

        // Cache all embeddings
        batch.forEach((text, index) => {
          embeddingCache.set(text, batchEmbeddings[index]);
        });

        uncachedEmbeddings.push(...batchEmbeddings);

        // Track cost
        const tokensUsed =data.usage?.total_tokens ?? batch.reduce((sum, text) => sum + estimateTokens(text), 0);
        costTracker.addTokens(tokensUsed);

        logger.debug('Generated batch embeddings', {
          batchSize: batch.length,
          tokensUsed,
          attempt,
        });

        break; // Success - exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < MAX_RETRIES) {
          logger.warn('Batch embedding generation failed, retrying', {
            attempt,
            batchSize: batch.length,
            error: lastError.message,
          });
          
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt - 1))
          );
        }
      }
    }

    if (lastError) {
      logger.error('Failed to generate batch embeddings after retries', lastError);
      throw new PatternMatcherError(
        `Failed to generate batch embeddings: ${lastError.message}`,
        'EMBEDDING_FAILED',
        500
      );
    }
  }

  // Merge cached and newly generated embeddings
  let uncachedIndex = 0;
  for (const index of uncachedIndices) {
    results[index] = uncachedEmbeddings[uncachedIndex++];
  }

  return results as number[][];
}

/**
 * Estimate token count for a text
 * 
 * Rough estimation: ~4 characters per token for English text.
 * 
 * @param text - Text to estimate
 * @returns Estimated token count
 */
function estimateTokens(text: string): number {
  // Rough estimate: 4 characters per token
  return Math.ceil(text.length / 4);
}

// ============================================================================
// SIMILARITY CALCULATION
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 * 
 * Cosine similarity = (A · B) / (||A|| × ||B||)
 * Result is between -1 and 1, where 1 is identical.
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score (0-1, normalized from -1 to 1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new PatternMatcherError(
      'Vectors must have same dimensions',
      'DIMENSION_MISMATCH',
      400
    );
  }

  if (a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  const similarity = dotProduct / (magnitudeA * magnitudeB);
  
  // Normalize from [-1, 1] to [0, 1]
  return (similarity + 1) / 2;
}

// ============================================================================
// PATTERN MATCHING
// ============================================================================

/**
 * Find similar patterns using semantic similarity
 * 
 * Compares query text against all training patterns using embeddings.
 * Returns patterns above the similarity threshold, sorted by similarity.
 * 
 * @param queryText - Text to match against patterns
 * @param trainingPatterns - Available training patterns
 * @param threshold - Minimum similarity score (0-1)
 * @returns Array of matched patterns with similarity scores
 */
export async function findSimilarPatterns(
  queryText: string,
  trainingPatterns: TrainingData[],
  threshold: number = SIMILARITY_THRESHOLD
): Promise<PatternMatch[]> {
  if (!queryText || queryText.trim().length === 0) {
    return [];
  }

  if (trainingPatterns.length === 0) {
    return [];
  }

  // Validate threshold
  if (threshold < 0 || threshold > 1) {
    throw new PatternMatcherError(
      'Threshold must be between 0 and 1',
      'INVALID_THRESHOLD',
      400
    );
  }

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(queryText);

    // Generate embeddings for patterns that don't have them
    const patternsNeedingEmbeddings = trainingPatterns.filter(
      (p) => !p.embedding || p.embedding.length === 0
    );

    if (patternsNeedingEmbeddings.length > 0) {
      logger.debug('Generating embeddings for patterns', {
        count: patternsNeedingEmbeddings.length,
      });

      const patternEmbeddings = await generateEmbeddingsBatch(
        patternsNeedingEmbeddings.map((p) => p.pattern)
      );

      // Update patterns with embeddings (in-memory only)
      patternsNeedingEmbeddings.forEach((pattern, index) => {
        pattern.embedding = patternEmbeddings[index];
      });
    }

    // Calculate similarities
    const matches: PatternMatch[] = [];

    for (const pattern of trainingPatterns) {
      if (!pattern.embedding || pattern.embedding.length === 0) {
        continue;
      }

      const similarity = cosineSimilarity(queryEmbedding, pattern.embedding);

      if (similarity >= threshold) {
        matches.push({
          pattern,
          similarity,
          confidence: pattern.confidence,
        });
      }
    }

    // Sort by similarity (descending)
    matches.sort((a, b) => b.similarity - a.similarity);

    logger.info('Found similar patterns', {
      queryText: queryText.substring(0, 50),
      totalPatterns: trainingPatterns.length,
      matchCount: matches.length,
      threshold,
    });

    return matches;
  } catch (error) {
    if (error instanceof PatternMatcherError) {
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to find similar patterns', err, {
      queryText: queryText.substring(0, 50),
    });

    const errorMessage = err.message;
    throw new PatternMatcherError(
      `Failed to find similar patterns: ${errorMessage}`,
      'MATCHING_FAILED',
      500
    );
  }
}

/**
 * Find best matching pattern for a query
 * 
 * Returns the single best match above the threshold.
 * 
 * @param queryText - Text to match
 * @param trainingPatterns - Available patterns
 * @param threshold - Minimum similarity score
 * @returns Best match or null if no match above threshold
 */
export async function findBestMatch(
  queryText: string,
  trainingPatterns: TrainingData[],
  threshold: number = SIMILARITY_THRESHOLD
): Promise<PatternMatch | null> {
  const matches = await findSimilarPatterns(queryText, trainingPatterns, threshold);
  return matches.length > 0 ? matches[0] : null;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Clear embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
  logger.info('Embedding cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  hitRate: number;
} {
  return {
    size: embeddingCache.size(),
    hitRate: embeddingCache.getHitRate(),
  };
}

// ============================================================================
// COST TRACKING
// ============================================================================

/**
 * Get cost metrics
 */
export function getCostMetrics(): CostMetrics {
  return costTracker.getMetrics();
}

/**
 * Reset cost tracking
 */
export function resetCostTracking(): void {
  costTracker.reset();
  logger.info('Cost tracking reset');
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Pre-generate embeddings for training patterns
 * 
 * Useful to pre-populate cache or update patterns in database.
 * 
 * @param patterns - Patterns to generate embeddings for
 * @returns Updated patterns with embeddings
 */
export async function preGenerateEmbeddings(
  patterns: TrainingData[]
): Promise<TrainingData[]> {
  const patternsNeedingEmbeddings = patterns.filter(
    (p) => !p.embedding || p.embedding.length === 0
  );

  if (patternsNeedingEmbeddings.length === 0) {
    return patterns;
  }

  logger.info('Pre-generating embeddings', {
    count: patternsNeedingEmbeddings.length,
  });

  const embeddings = await generateEmbeddingsBatch(
    patternsNeedingEmbeddings.map((p) => p.pattern)
  );

  // Update patterns with embeddings
  patternsNeedingEmbeddings.forEach((pattern, index) => {
    pattern.embedding = embeddings[index];
  });

  return patterns;
}

/**
 * Calculate similarity threshold for precision/recall trade-off
 * 
 * Higher threshold = higher precision, lower recall
 * Lower threshold = lower precision, higher recall
 * 
 * @param desiredPrecision - Target precision (0-1)
 * @returns Recommended threshold
 */
export function calculateThreshold(desiredPrecision: number): number {
  if (desiredPrecision < 0 || desiredPrecision > 1) {
    throw new PatternMatcherError(
      'Precision must be between 0 and 1',
      'INVALID_PRECISION',
      400
    );
  }

  // Empirical mapping (can be tuned based on actual data)
  // Precision 0.95 -> Threshold 0.85
  // Precision 0.90 -> Threshold 0.80
  // Precision 0.85 -> Threshold 0.75
  // Precision 0.80 -> Threshold 0.70
  
  const threshold = 0.5 + (desiredPrecision * 0.5);
  return Math.min(Math.max(threshold, 0.5), 0.95);
}
