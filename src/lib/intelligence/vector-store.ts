/**
 * Vector Store - The Memory
 *
 * RAG (Retrieval-Augmented Generation) architecture for knowledge management.
 * Handles document chunking, embedding generation, and semantic search.
 *
 * STRICT ZONE COMPLIANCE:
 * - Zero `any` types
 * - All external responses validated via Zod
 * - Result<T, E> pattern for error handling
 * - void pattern for background indexing
 * - Explicit timeout handling for embedding operations
 *
 * @module lib/intelligence
 */

import { logger } from '@/lib/logger/logger';
import { retryWithBackoff, ExternalAPIRetryOptions } from '@/lib/utils/retry';
import {
  DEFAULT_KNOWLEDGE_BASE_CONFIG,
  DEFAULT_RETRIEVAL_OPTIONS,
  IntelligenceError,
  IntelligenceErrorCode,
  type KnowledgeBase,
  type KnowledgeBaseConfig,
  type KnowledgeChunk,
  type KnowledgeDocument,
  type RetrievalFilters,
  type RetrievalResult,
  type Result,
} from './types';
import { validateRetrievalRequest } from './validation';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// ============================================================================
// RESULT HELPERS
// ============================================================================

/**
 * Create a success result
 */
function success<T>(data: T): Result<T, IntelligenceError> {
  return { success: true, data };
}

/**
 * Create an error result
 */
function failure(
  message: string,
  code: string,
  statusCode = 500,
  context?: Record<string, unknown>
): Result<never, IntelligenceError> {
  return {
    success: false,
    error: new IntelligenceError(message, code, statusCode, context),
    code,
  };
}

// ============================================================================
// EMBEDDING PROVIDER INTERFACE
// ============================================================================

/**
 * Embedding provider interface
 */
interface EmbeddingProvider {
  embed(texts: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<number>>>;
  readonly model: string;
  readonly dimensions: number;
}

/**
 * Mock embedding provider for development/testing
 * Replace with actual OpenAI/Cohere embedding service
 */
const mockEmbeddingProvider: EmbeddingProvider = {
  model: 'text-embedding-3-small',
  dimensions: 1536,

  async embed(texts: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<number>>> {
    // Simulate embedding latency
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });

    // Generate deterministic mock embeddings based on text content
    return texts.map((text) => {
      const embedding: number[] = [];
      for (let i = 0; i < 1536; i++) {
        // Simple hash-based embedding for consistency
        const hash = text.charCodeAt(i % text.length) / 255;
        embedding.push(Math.sin(hash * i) * 0.5 + 0.5);
      }
      return embedding;
    });
  },
};

// ============================================================================
// DOCUMENT CHUNKING
// ============================================================================

/**
 * Chunking options
 */
interface ChunkingOptions {
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly preserveParagraphs: boolean;
}

/**
 * Default chunking options
 */
const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  chunkSize: 512,
  chunkOverlap: 50,
  preserveParagraphs: true,
};

/**
 * Split text into chunks
 */
function chunkText(
  text: string,
  options: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS
): ReadonlyArray<string> {
  const { chunkSize, chunkOverlap, preserveParagraphs } = options;

  if (text.length <= chunkSize) {
    return [text.trim()];
  }

  const chunks: string[] = [];

  if (preserveParagraphs) {
    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) {
        continue;
      }

      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + trimmedParagraph.length > chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }

        // If paragraph itself is too large, split it
        if (trimmedParagraph.length > chunkSize) {
          const subChunks = splitBySize(trimmedParagraph, chunkSize, chunkOverlap);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = trimmedParagraph;
        }
      } else {
        currentChunk = currentChunk
          ? `${currentChunk}\n\n${trimmedParagraph}`
          : trimmedParagraph;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
  } else {
    // Simple size-based splitting
    chunks.push(...splitBySize(text, chunkSize, chunkOverlap));
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Split text by size with overlap
 */
function splitBySize(
  text: string,
  chunkSize: number,
  overlap: number
): ReadonlyArray<string> {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastQuestion = chunk.lastIndexOf('?');
      const lastExclamation = chunk.lastIndexOf('!');
      const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclamation);

      if (lastBreak > chunkSize * 0.5) {
        chunk = chunk.slice(0, lastBreak + 1);
      }
    }

    chunks.push(chunk.trim());
    start = start + chunk.length - overlap;

    // Prevent infinite loop
    if (start <= chunks.length * chunkSize - chunks.length * overlap - overlap) {
      start = end;
    }
  }

  return chunks;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

// ============================================================================
// SIMILARITY CALCULATIONS
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(
  a: ReadonlyArray<number>,
  b: ReadonlyArray<number>
): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// VECTOR STORE CLASS
// ============================================================================

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  readonly knowledgeBaseConfig: KnowledgeBaseConfig;
  readonly embeddingProvider?: EmbeddingProvider;
  readonly enableBackgroundIndexing: boolean;
}

/**
 * Default vector store configuration
 */
export const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig = {
  knowledgeBaseConfig: DEFAULT_KNOWLEDGE_BASE_CONFIG,
  enableBackgroundIndexing: true,
};

/**
 * In-memory storage for chunks (replace with actual vector DB in production)
 */
interface ChunkStorage {
  readonly chunks: Map<string, KnowledgeChunk>;
  readonly documentIndex: Map<string, Set<string>>; // documentId -> chunkIds
  readonly organizationIndex: Map<string, Set<string>>; // orgId -> chunkIds
}

/**
 * Vector Store - The Memory
 *
 * Manages document storage, embedding generation, and semantic retrieval.
 */
export class VectorStore {
  private readonly config: VectorStoreConfig;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly storage: ChunkStorage;
  private readonly knowledgeBases: Map<string, KnowledgeBase>;

  constructor(config: Partial<VectorStoreConfig> = {}) {
    this.config = { ...DEFAULT_VECTOR_STORE_CONFIG, ...config };
    this.embeddingProvider = config.embeddingProvider ?? mockEmbeddingProvider;
    this.storage = {
      chunks: new Map(),
      documentIndex: new Map(),
      organizationIndex: new Map(),
    };
    this.knowledgeBases = new Map();
  }

  // ==========================================================================
  // DOCUMENT OPERATIONS
  // ==========================================================================

  /**
   * Index a document into the vector store
   */
  async indexDocument(
    document: KnowledgeDocument
  ): Promise<Result<ReadonlyArray<KnowledgeChunk>, IntelligenceError>> {
    const startTime = Date.now();

    try {
      // Validate document
      if (!document.content || document.content.trim().length === 0) {
        return failure(
          'Document content is empty',
          IntelligenceErrorCode.INPUT_VALIDATION_FAILED,
          400,
          { documentId: document.id }
        );
      }

      // Chunk the document
      const chunkTexts = chunkText(document.content, {
        chunkSize: this.config.knowledgeBaseConfig.chunkSize,
        chunkOverlap: this.config.knowledgeBaseConfig.chunkOverlap,
        preserveParagraphs: true,
      });

      if (chunkTexts.length === 0) {
        return failure(
          'Document produced no chunks',
          IntelligenceErrorCode.INPUT_VALIDATION_FAILED,
          400,
          { documentId: document.id }
        );
      }

      // Check chunk limit
      if (chunkTexts.length > this.config.knowledgeBaseConfig.maxChunksPerDocument) {
        return failure(
          `Document exceeds maximum chunks (${this.config.knowledgeBaseConfig.maxChunksPerDocument})`,
          IntelligenceErrorCode.INPUT_VALIDATION_FAILED,
          400,
          { documentId: document.id, chunkCount: chunkTexts.length }
        );
      }

      // Generate embeddings
      const embeddingResult = await this.generateEmbeddings(chunkTexts);
      if (!embeddingResult.success) {
        return embeddingResult;
      }

      const embeddings = embeddingResult.data;

      // Create chunks
      const chunks: KnowledgeChunk[] = chunkTexts.map((text, index) => ({
        id: `chunk_${document.id}_${index}`,
        documentId: document.id,
        organizationId: document.organizationId,
        content: text,
        tokens: estimateTokens(text),
        chunkIndex: index,
        totalChunks: chunkTexts.length,
        embedding: embeddings[index] ? [...embeddings[index]] : undefined,
        embeddingModel: this.embeddingProvider.model,
        metadata: {
          documentTitle: document.title,
          category: document.category,
          source: document.source,
          tags: [...document.tags],
          sectionTitle: document.title,
          previousChunkId: index > 0 ? `chunk_${document.id}_${index - 1}` : undefined,
          nextChunkId: index < chunkTexts.length - 1 ? `chunk_${document.id}_${index + 1}` : undefined,
        },
      }));

      // Store chunks
      const chunkIds = new Set<string>();
      for (const chunk of chunks) {
        this.storage.chunks.set(chunk.id, chunk);
        chunkIds.add(chunk.id);
      }

      // Update indices
      this.storage.documentIndex.set(document.id, chunkIds);

      const orgChunks = this.storage.organizationIndex.get(document.organizationId) ?? new Set();
      for (const id of chunkIds) {
        orgChunks.add(id);
      }
      this.storage.organizationIndex.set(document.organizationId, orgChunks);

      const duration = Date.now() - startTime;
      logger.info('Document indexed', {
        documentId: document.id,
        chunkCount: chunks.length,
        durationMs: duration,
      });

      return success(chunks);
    } catch (error) {
      return failure(
        `Failed to index document: ${error instanceof Error ? error.message : String(error)}`,
        IntelligenceErrorCode.EMBEDDING_FAILED,
        500,
        { documentId: document.id }
      );
    }
  }

  /**
   * Delete a document and its chunks
   */
  deleteDocument(documentId: string): Result<number, IntelligenceError> {
    const chunkIds = this.storage.documentIndex.get(documentId);

    if (!chunkIds) {
      return failure(
        `Document not found: ${documentId}`,
        IntelligenceErrorCode.KNOWLEDGE_NOT_FOUND,
        404,
        { documentId }
      );
    }

    let deletedCount = 0;

    for (const chunkId of chunkIds) {
      const chunk = this.storage.chunks.get(chunkId);
      if (chunk) {
        // Remove from organization index
        const orgChunks = this.storage.organizationIndex.get(chunk.organizationId);
        if (orgChunks) {
          orgChunks.delete(chunkId);
        }

        // Remove chunk
        this.storage.chunks.delete(chunkId);
        deletedCount++;
      }
    }

    // Remove document index
    this.storage.documentIndex.delete(documentId);

    logger.info('Document deleted', { documentId, chunksDeleted: deletedCount });

    return success(deletedCount);
  }

  // ==========================================================================
  // RETRIEVAL OPERATIONS
  // ==========================================================================

  /**
   * Retrieve relevant knowledge chunks
   */
  async retrieve(
    request: unknown
  ): Promise<Result<RetrievalResult, IntelligenceError>> {
    const startTime = Date.now();

    // Validate request
    const validationResult = validateRetrievalRequest(request);
    if (!validationResult.success) {
      return validationResult;
    }

    const validatedRequest = validationResult.data;
    const options = { ...DEFAULT_RETRIEVAL_OPTIONS, ...validatedRequest.options };

    try {
      // Generate query embedding
      const queryEmbeddingResult = await this.generateEmbeddings([validatedRequest.query]);
      if (!queryEmbeddingResult.success) {
        return queryEmbeddingResult;
      }

      const queryEmbedding = queryEmbeddingResult.data[0];
      if (!queryEmbedding) {
        return failure(
          'Failed to generate query embedding',
          IntelligenceErrorCode.EMBEDDING_FAILED,
          500
        );
      }

      // Get candidate chunks for the organization
      const candidateChunks = this.getCandidateChunks(
        validatedRequest.workspaceId,
        validatedRequest.filters
      );

      // Score and rank chunks
      const scoredChunks = this.scoreChunks(candidateChunks, queryEmbedding, options.minScore);

      // Sort by score descending
      scoredChunks.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      // Take top K
      const topChunks = scoredChunks.slice(0, options.topK);

      // Optionally expand context
      let resultChunks: ReadonlyArray<KnowledgeChunk> = topChunks;
      if (options.expandContext) {
        resultChunks = this.expandContext(topChunks);
      }

      const processingTime = Date.now() - startTime;

      const result: RetrievalResult = {
        chunks: resultChunks,
        totalMatches: scoredChunks.length,
        queryEmbedding: [...queryEmbedding],
        processingTimeMs: processingTime,
        tokensUsed: estimateTokens(validatedRequest.query),
      };

      logger.info('Retrieval completed', {
        organizationId: validatedRequest.organizationId,
        queryLength: validatedRequest.query.length,
        candidates: candidateChunks.length,
        matches: scoredChunks.length,
        returned: resultChunks.length,
        processingTimeMs: processingTime,
      });

      return success(result);
    } catch (error) {
      return failure(
        `Retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        IntelligenceErrorCode.VECTOR_SEARCH_FAILED,
        500
      );
    }
  }

  /**
   * Get candidate chunks based on filters
   */
  private getCandidateChunks(
    workspaceId?: string,
    filters?: RetrievalFilters
  ): ReadonlyArray<KnowledgeChunk> {
    const orgChunkIds = this.storage.organizationIndex.get(DEFAULT_ORG_ID);
    if (!orgChunkIds) {
      return [];
    }

    const candidates: KnowledgeChunk[] = [];

    for (const chunkId of orgChunkIds) {
      const chunk = this.storage.chunks.get(chunkId);
      if (!chunk) {
        continue;
      }

      // Apply filters
      if (!this.passesFilters(chunk, filters)) {
        continue;
      }

      candidates.push(chunk);
    }

    return candidates;
  }

  /**
   * Check if chunk passes filters
   */
  private passesFilters(chunk: KnowledgeChunk, filters?: RetrievalFilters): boolean {
    if (!filters) {
      return true;
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(chunk.metadata.category)) {
        return false;
      }
    }

    // Source filter
    if (filters.sources && filters.sources.length > 0) {
      if (!filters.sources.includes(chunk.metadata.source)) {
        return false;
      }
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some((tag) =>
        chunk.metadata.tags.includes(tag)
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    // Document ID filter
    if (filters.documentIds && filters.documentIds.length > 0) {
      if (!filters.documentIds.includes(chunk.documentId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Score chunks against query embedding
   */
  private scoreChunks(
    chunks: ReadonlyArray<KnowledgeChunk>,
    queryEmbedding: ReadonlyArray<number>,
    minScore: number
  ): KnowledgeChunk[] {
    const scored: KnowledgeChunk[] = [];

    for (const chunk of chunks) {
      if (!chunk.embedding) {
        continue;
      }

      const score = cosineSimilarity(queryEmbedding, chunk.embedding);

      if (score >= minScore) {
        scored.push({
          ...chunk,
          score,
          rank: 0, // Will be set after sorting
        });
      }
    }

    // Assign ranks
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return scored.map((chunk, index) => ({
      ...chunk,
      rank: index + 1,
    }));
  }

  /**
   * Expand context by including neighboring chunks
   */
  private expandContext(
    chunks: ReadonlyArray<KnowledgeChunk>
  ): ReadonlyArray<KnowledgeChunk> {
    const expandedIds = new Set<string>();
    const expanded: KnowledgeChunk[] = [];

    for (const chunk of chunks) {
      // Add the chunk itself
      if (!expandedIds.has(chunk.id)) {
        expandedIds.add(chunk.id);
        expanded.push(chunk);
      }

      // Add previous chunk if exists
      if (chunk.metadata.previousChunkId) {
        const prev = this.storage.chunks.get(chunk.metadata.previousChunkId);
        if (prev && !expandedIds.has(prev.id)) {
          expandedIds.add(prev.id);
          expanded.push({ ...prev, score: (chunk.score ?? 0) * 0.8 });
        }
      }

      // Add next chunk if exists
      if (chunk.metadata.nextChunkId) {
        const next = this.storage.chunks.get(chunk.metadata.nextChunkId);
        if (next && !expandedIds.has(next.id)) {
          expandedIds.add(next.id);
          expanded.push({ ...next, score: (chunk.score ?? 0) * 0.8 });
        }
      }
    }

    // Re-sort by original rank/score
    expanded.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return expanded;
  }

  // ==========================================================================
  // EMBEDDING OPERATIONS
  // ==========================================================================

  /**
   * Generate embeddings for texts
   */
  private async generateEmbeddings(
    texts: ReadonlyArray<string>
  ): Promise<Result<ReadonlyArray<ReadonlyArray<number>>, IntelligenceError>> {
    try {
      const embeddings = await retryWithBackoff(
        () => this.embeddingProvider.embed(texts),
        {
          ...ExternalAPIRetryOptions,
          operationName: 'embedding_generation',
        }
      );

      return success(embeddings);
    } catch (error) {
      return failure(
        `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`,
        IntelligenceErrorCode.EMBEDDING_FAILED,
        500,
        { textCount: texts.length }
      );
    }
  }

  // ==========================================================================
  // KNOWLEDGE BASE MANAGEMENT
  // ==========================================================================

  /**
   * Create a knowledge base
   */
  createKnowledgeBase(
    name: string,
    description: string,
    workspaceId?: string,
    config?: Partial<KnowledgeBaseConfig>
  ): Result<KnowledgeBase, IntelligenceError> {
    const id = `kb_${DEFAULT_ORG_ID}_${Date.now()}`;

    if (this.knowledgeBases.has(id)) {
      return failure(
        'Knowledge base already exists',
        IntelligenceErrorCode.INPUT_VALIDATION_FAILED,
        409,
        { id }
      );
    }

    const now = new Date();
    const knowledgeBase: KnowledgeBase = {
      id,
      organizationId: DEFAULT_ORG_ID,
      workspaceId,
      name,
      description,
      config: { ...this.config.knowledgeBaseConfig, ...config },
      stats: {
        documentCount: 0,
        chunkCount: 0,
        totalTokens: 0,
        avgDocumentSize: 0,
        categoryCounts: {
          product: 0,
          pricing: 0,
          competitor: 0,
          case_study: 0,
          faq: 0,
          process: 0,
          policy: 0,
          training: 0,
          template: 0,
          other: 0,
        },
        lastUpdated: now,
      },
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.knowledgeBases.set(id, knowledgeBase);

    logger.info('Knowledge base created', { id, organizationId: DEFAULT_ORG_ID, name });

    return success(knowledgeBase);
  }

  /**
   * Get knowledge base by ID
   */
  getKnowledgeBase(id: string): Result<KnowledgeBase, IntelligenceError> {
    const kb = this.knowledgeBases.get(id);
    if (!kb) {
      return failure(
        `Knowledge base not found: ${id}`,
        IntelligenceErrorCode.KNOWLEDGE_NOT_FOUND,
        404,
        { id }
      );
    }
    return success(kb);
  }

  /**
   * Get all knowledge bases for an organization
   */
  getOrganizationKnowledgeBases(): ReadonlyArray<KnowledgeBase> {
    return Array.from(this.knowledgeBases.values()).filter(
      (kb) => kb.organizationId === DEFAULT_ORG_ID
    );
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get store statistics
   */
  getStatistics(): {
    totalChunks: number;
    totalDocuments: number;
    organizationCount: number;
    knowledgeBaseCount: number;
  } {
    return {
      totalChunks: this.storage.chunks.size,
      totalDocuments: this.storage.documentIndex.size,
      organizationCount: this.storage.organizationIndex.size,
      knowledgeBaseCount: this.knowledgeBases.size,
    };
  }

  /**
   * Get chunk count for organization
   */
  getOrganizationChunkCount(): number {
    const chunks = this.storage.organizationIndex.get(DEFAULT_ORG_ID);
    return chunks?.size ?? 0;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let vectorStoreInstance: VectorStore | null = null;

/**
 * Get or create the vector store instance
 */
export function getVectorStore(
  config?: Partial<VectorStoreConfig>
): VectorStore {
  vectorStoreInstance ??= new VectorStore(config);
  return vectorStoreInstance;
}

/**
 * Reset the vector store instance (for testing)
 */
export function resetVectorStore(): void {
  vectorStoreInstance = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  chunkText,
  splitBySize,
  estimateTokens,
  cosineSimilarity,
  type ChunkingOptions,
  type EmbeddingProvider,
};
