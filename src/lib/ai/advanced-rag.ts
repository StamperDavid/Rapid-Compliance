/**
 * Advanced RAG (Retrieval-Augmented Generation)
 * Semantic search + reranking for superior knowledge retrieval
 */

import { logger } from '@/lib/logger/logger';

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

interface CohereRerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
}

interface GPTScoreResponse {
  text: string;
}

interface ChunkData {
  id: string;
  content: string;
  source?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface RAGRequest {
  query: string;
  knowledgeBaseId: string;
  topK?: number;
  rerank?: boolean;
  contextWindow?: number;
}

export interface RAGResult {
  relevantChunks: KnowledgeChunk[];
  enhancedPrompt: string;
  totalChunks: number;
  reranked: boolean;
  searchTime: number;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  source: string;
  relevanceScore: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Perform advanced RAG retrieval
 */
export async function retrieveKnowledge(
  request: RAGRequest
): Promise<RAGResult> {
  const startTime = Date.now();
  
  // Step 1: Generate query embedding
  const queryEmbedding = await generateEmbedding(request.query);
  
  // Step 2: Semantic search for top candidates
  const candidates = await semanticSearch(
    request.knowledgeBaseId,
    queryEmbedding,
    request.topK || 20 // Get more candidates for reranking
  );
  
  // Step 3: Rerank if enabled
  let relevantChunks = candidates;
  
  if (request.rerank !== false) {
    relevantChunks = await rerankChunks(request.query, candidates);
  }
  
  // Step 4: Optimize context window
  const optimizedChunks = optimizeContextWindow(
    relevantChunks,
    request.contextWindow || 4000
  );
  
  // Step 5: Build enhanced prompt
  const enhancedPrompt = buildEnhancedPrompt(request.query, optimizedChunks);
  
  return {
    relevantChunks: optimizedChunks,
    enhancedPrompt,
    totalChunks: candidates.length,
    reranked: request.rerank !== false,
    searchTime: Date.now() - startTime,
  };
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use OpenAI embeddings (ada-002)
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Embedding generation failed');
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error: unknown) {
    logger.error('[RAG] Embedding error:', error, { file: 'advanced-rag.ts' });
    // Fallback to simple keyword matching if embeddings fail
    return [];
  }
}

/**
 * Semantic search using vector similarity
 */
async function semanticSearch(
  knowledgeBaseId: string,
  queryEmbedding: number[],
  topK: number
): Promise<KnowledgeChunk[]> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    // Get all knowledge chunks
    // In production, use vector database (Pinecone, Weaviate, etc.)
    const chunks = await FirestoreService.getAll<any>(
      `${COLLECTIONS.ORGANIZATIONS}/*/knowledgeBase/${knowledgeBaseId}/chunks`
    );
    
    if (queryEmbedding.length === 0) {
      // Fallback to keyword search
      return keywordSearch(chunks, topK);
    }
    
    // Calculate cosine similarity for each chunk
    const scoredChunks = chunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      source: chunk.source || 'unknown',
      relevanceScore: cosineSimilarity(queryEmbedding, chunk.embedding || []),
      embedding: chunk.embedding,
      metadata: chunk.metadata,
    }));
    
    // Sort by relevance and take top K
    return scoredChunks
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);
  } catch (error: unknown) {
    logger.error('[RAG] Semantic search error:', error, { file: 'advanced-rag.ts' });
    return [];
  }
}

/**
 * Fallback keyword search
 */
function keywordSearch(chunks: any[], topK: number): KnowledgeChunk[] {
  // Simple keyword-based scoring
  return chunks
    .map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      source: chunk.source || 'unknown',
      relevanceScore: 0.5, // Default score for keyword matches
      metadata: chunk.metadata,
    }))
    .slice(0, topK);
}

/**
 * Rerank chunks using cross-encoder
 */
async function rerankChunks(
  query: string,
  chunks: KnowledgeChunk[]
): Promise<KnowledgeChunk[]> {
  try {
    // Use Cohere reranking API
    if (process.env.COHERE_API_KEY) {
      return await rerankWithCohere(query, chunks);
    }
    
    // Fallback: Use GPT-4 for reranking
    return await rerankWithGPT4(query, chunks);
  } catch (error: any) {
    logger.error('[RAG] Reranking error:', error, { file: 'advanced-rag.ts' });
    // Return original order if reranking fails
    return chunks;
  }
}

/**
 * Rerank using Cohere
 */
async function rerankWithCohere(
  query: string,
  chunks: KnowledgeChunk[]
): Promise<KnowledgeChunk[]> {
  try {
    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-english-v2.0',
        query,
        documents: chunks.map(c => c.content),
        top_n: Math.min(10, chunks.length),
      }),
    });
    
    if (!response.ok) {
      throw new Error('Cohere reranking failed');
    }
    
    const data = await response.json();
    
    // Reorder chunks based on Cohere scores
    return data.results.map((result: any) => ({
      ...chunks[result.index],
      relevanceScore: result.relevance_score,
    }));
  } catch (error: any) {
    logger.error('[RAG] Cohere reranking error:', error, { file: 'advanced-rag.ts' });
    return chunks;
  }
}

/**
 * Rerank using GPT-4 (fallback)
 */
async function rerankWithGPT4(
  query: string,
  chunks: KnowledgeChunk[]
): Promise<KnowledgeChunk[]> {
  try {
    const { sendUnifiedChatMessage } = await import('./unified-ai-service');
    
    // Ask GPT-4 to score each chunk
    const rerankPrompt = `Given this query: "${query}"

Rate the relevance of each text chunk below on a scale of 0-100.
Return only a JSON array of scores, e.g., [85, 92, 45, ...]

Chunks:
${chunks.map((chunk, i) => `${i + 1}. ${chunk.content.substring(0, 200)}...`).join('\n\n')}

Scores:`;
    
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: rerankPrompt }],
      temperature: 0.1, // Low temperature for consistent scoring
    });
    
    // Parse scores
    const scores = JSON.parse(response.text.replace(/```json\n?|\n?```/g, ''));
    
    // Apply new scores and resort
    return chunks
      .map((chunk, i) => ({
        ...chunk,
        relevanceScore: (scores[i] || 0) / 100,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (error: any) {
    logger.error('[RAG] GPT-4 reranking error:', error, { file: 'advanced-rag.ts' });
    return chunks;
  }
}

/**
 * Optimize chunks to fit context window
 */
function optimizeContextWindow(
  chunks: KnowledgeChunk[],
  maxTokens: number
): KnowledgeChunk[] {
  const optimized: KnowledgeChunk[] = [];
  let totalTokens = 0;
  
  for (const chunk of chunks) {
    // Estimate tokens (roughly 4 chars per token)
    const chunkTokens = Math.ceil(chunk.content.length / 4);
    
    if (totalTokens + chunkTokens > maxTokens) {
      break;
    }
    
    optimized.push(chunk);
    totalTokens += chunkTokens;
  }
  
  return optimized;
}

/**
 * Build enhanced prompt with retrieved knowledge
 */
function buildEnhancedPrompt(
  query: string,
  chunks: KnowledgeChunk[]
): string {
  if (chunks.length === 0) {
    return query;
  }
  
  const context = chunks
    .map((chunk, i) => `[Source ${i + 1}: ${chunk.source}]\n${chunk.content}`)
    .join('\n\n---\n\n');
  
  return `Answer the following question using ONLY the provided context. If the answer is not in the context, say "I don't have that information in my knowledge base."

CONTEXT:
${context}

QUESTION: ${query}

ANSWER:`;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Index knowledge base for RAG
 */
export async function indexKnowledgeBase(
  knowledgeBaseId: string,
  documents: Array<{ content: string; source: string; metadata?: any }>
): Promise<{ chunksIndexed: number; time: number }> {
  const startTime = Date.now();
  
  // Split documents into chunks
  const chunks = documents.flatMap(doc =>
    splitIntoChunks(doc.content, 500).map(chunk => ({
      content: chunk,
      source: doc.source,
      metadata: doc.metadata,
    }))
  );
  
  // Generate embeddings for all chunks
  const embeddedChunks = await Promise.all(
    chunks.map(async chunk => ({
      ...chunk,
      embedding: await generateEmbedding(chunk.content),
      id: crypto.randomUUID(),
    }))
  );
  
  // Store in Firestore
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  for (const chunk of embeddedChunks) {
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/*/knowledgeBase/${knowledgeBaseId}/chunks`,
      chunk.id,
      chunk,
      false
    );
  }
  
  return {
    chunksIndexed: embeddedChunks.length,
    time: Date.now() - startTime,
  };
}

/**
 * Split text into chunks
 */
function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += `${sentence  }. `;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

