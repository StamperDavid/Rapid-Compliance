/**
 * Embeddings Service
 * Generates vector embeddings using Vertex AI Embeddings API
 */

import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

export interface Embedding {
  values: number[];
  text: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingResult {
  embedding: Embedding;
  model: string;
}

/**
 * Every vector in the system MUST be this length. cosineSimilarity returns 0 on
 * a length mismatch, so a model that emits a different size would silently fail
 * to match anything. OpenAI v3 models are pinned to this via the `dimensions`
 * param; Google text-embedding-004 already returns 768; the hash fallback too.
 */
const EMBEDDING_DIMENSIONS = 768;

/**
 * Preferred provider: OpenAI embeddings via the central (platform-owned) key —
 * no client setup, same shape as OpenRouter powering the agent brains. Pinned to
 * 768 dims for compatibility. Returns null (not throw) so the caller falls
 * through to Google, then the deterministic hash.
 */
async function tryOpenAIEmbedding(text: string): Promise<EmbeddingResult | null> {
  try {
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const raw = await apiKeyService.getServiceKey(PLATFORM_ID, 'openai') as string | { apiKey: string } | null;
    const apiKey = typeof raw === 'string' ? raw : raw?.apiKey;
    if (!apiKey) {
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      logger.warn('OpenAI embedding call failed — trying next provider', {
        file: 'embeddings-service.ts',
        status: response.status,
      });
      return null;
    }

    const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
    const values = data.data?.[0]?.embedding;
    if (!values || values.length === 0) {
      return null;
    }
    return { embedding: { values, text }, model: 'text-embedding-3-small' };
  } catch (error: unknown) {
    logger.warn('OpenAI embedding threw — trying next provider', {
      file: 'embeddings-service.ts',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string
): Promise<EmbeddingResult> {
  // 1. OpenAI (central key, works today). Falls through on any failure.
  const openaiResult = await tryOpenAIEmbedding(text);
  if (openaiResult) {
    return openaiResult;
  }

  try {
    // 2. Google Gemini (legacy path — kept as a fallback)
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const geminiKey = await apiKeyService.getServiceKey(PLATFORM_ID, 'gemini') as string | { apiKey: string } | null;

    if (!geminiKey) {
      throw new Error('Gemini API key not configured');
    }
    
    // Use Vertex AI Embeddings API
    // For now, we'll use Gemini's embedding capability
    // In production, use Vertex AI text-embedding-004 or similar
    
    const apiKey = typeof geminiKey === 'string' ? geminiKey : geminiKey.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }
    
    // Use Google Generative AI for embeddings
    // Note: Gemini doesn't have direct embedding API, so we'll use a workaround
    // In production, use Vertex AI Embeddings API
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text: text.substring(0, 10000) }], // Limit text length
          },
        }),
      }
    );
    
    if (!response.ok) {
      // Fallback: Use Gemini to generate a text representation for embedding
      // In production, use proper Vertex AI Embeddings API
      logger.warn('Embedding API not available, using fallback', { file: 'embeddings-service.ts' });
      return generateEmbeddingFallback(text);
    }
    
    const data = await response.json() as { embedding?: { values?: number[] } };
    const embedding = data.embedding?.values ?? [];
    
    return {
      embedding: {
        values: embedding,
        text,
      },
      model: 'text-embedding-004',
    };
  } catch (error: unknown) {
    logger.error('Error generating embedding:', error instanceof Error ? error : new Error(String(error)), { file: 'embeddings-service.ts' });
    // Fallback to simple hash-based embedding for now
    return generateEmbeddingFallback(text);
  }
}

/**
 * Fallback embedding generation (simple hash-based)
 * In production, this should use proper Vertex AI Embeddings
 */
function generateEmbeddingFallback(text: string): EmbeddingResult {
  // Simple hash-based embedding (not semantic, but works for testing)
  // In production, MUST use Vertex AI Embeddings API
  const embedding: number[] = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  const words = text.toLowerCase().split(/\s+/);
  
  words.forEach((word, index) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash = hash & hash;
    }
    const pos = Math.abs(hash) % embedding.length;
    embedding[pos] += 1 / (index + 1);
  });
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + (val * val), 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return {
    embedding: {
      values: embedding,
      text,
    },
    model: 'fallback-hash',
  };
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  // Process in batches to avoid rate limits
  const batchSize = 10;
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );
    results.push(...batchResults);
    
    // Rate limiting: wait between batches
    if (i + batchSize < texts.length) {
      await new Promise<void>(resolve => {
        setTimeout(() => {
          resolve();
        }, 1000);
      });
    }
  }
  
  return results;
}

/**
 * Chunk text into smaller pieces for embedding
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > start) {
        end = breakPoint + 1;
      }
    }
    
    chunks.push(text.substring(start, end).trim());
    start = end - overlap; // Overlap for context
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}



















