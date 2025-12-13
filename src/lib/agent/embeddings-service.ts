/**
 * Embeddings Service
 * Generates vector embeddings using Vertex AI Embeddings API
 */

export interface Embedding {
  values: number[];
  text: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  embedding: Embedding;
  model: string;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  organizationId: string
): Promise<EmbeddingResult> {
  try {
    // Get API key
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
    const geminiKey = await apiKeyService.getServiceKey(organizationId, 'gemini');
    
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
      console.warn('Embedding API not available, using fallback');
      return generateEmbeddingFallback(text);
    }
    
    const data = await response.json();
    const embedding = data.embedding?.values || [];
    
    return {
      embedding: {
        values: embedding,
        text,
      },
      model: 'text-embedding-004',
    };
  } catch (error: any) {
    console.error('Error generating embedding:', error);
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
  const embedding = new Array(768).fill(0);
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
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
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
  texts: string[],
  organizationId: string
): Promise<EmbeddingResult[]> {
  // Process in batches to avoid rate limits
  const batchSize = 10;
  const results: EmbeddingResult[] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text, organizationId))
    );
    results.push(...batchResults);
    
    // Rate limiting: wait between batches
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
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













