/**
 * Vector Search Service
 * Performs semantic search on knowledge base using vector embeddings
 */

import { generateEmbedding, type EmbeddingResult } from './embeddings-service';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { where } from 'firebase/firestore';

export interface SearchResult {
  text: string;
  score: number;
  source: 'document' | 'url' | 'faq' | 'product';
  sourceId: string;
  metadata?: Record<string, unknown>;
}

// Type definitions for knowledge base data from Firestore
interface KnowledgeEmbeddingDoc {
  embedding?: number[];
  text?: string;
  source?: 'document' | 'url' | 'faq' | 'product';
  sourceId?: string;
  metadata?: Record<string, unknown>;
  agentId?: string;
}

interface KnowledgeBaseDocument {
  id: string;
  filename?: string;
  type?: string;
  extractedContent?: string;
}

interface KnowledgeBaseUrl {
  id: string;
  url?: string;
  title?: string;
  extractedContent?: string;
}

interface KnowledgeBaseFaq {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

interface KnowledgeBaseProduct {
  id: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
}

interface KnowledgeBase {
  documents?: KnowledgeBaseDocument[];
  urls?: KnowledgeBaseUrl[];
  faqs?: KnowledgeBaseFaq[];
  productCatalog?: {
    products?: KnowledgeBaseProduct[];
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) {return 0;}
  
  return dotProduct / denominator;
}

/**
 * Search knowledge base using semantic search
 */
export async function searchKnowledgeBase(
  query: string,
  limit: number = 5,
  agentId?: string,
): Promise<SearchResult[]> {
  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Per-agent isolation: when agentId is given, read ONLY that agent's source
    // doc + embeddings (filtered by agentId). Without agentId, falls back to the
    // legacy global knowledge base (the chat/Jasper RAG path) — backward compatible.
    const kbDocId = agentId ?? 'current';
    const knowledgeBase = await AdminFirestoreService.get<KnowledgeBase>(
      getSubCollection('knowledgeBase'),
      kbDocId
    );

    if (!knowledgeBase) {
      return [];
    }

    // Get embeddings (scoped to the agent when agentId is provided)
    const embeddings = await AdminFirestoreService.getAll<KnowledgeEmbeddingDoc>(
      getSubCollection('knowledgeEmbeddings'),
      agentId ? [where('agentId', '==', agentId)] : [],
    );

    // Isolation both ways: the global path (no agentId) must NOT pull any
    // agent-private vectors into the shared chat/Jasper RAG. The per-agent path
    // is already scoped by the Firestore filter above. (In-memory drop keeps
    // existing un-tagged global vectors working without a reindex.)
    const scopedEmbeddings = agentId ? embeddings : embeddings.filter((e) => !e.agentId);

    // Calculate similarity scores
    const results: SearchResult[] = [];

    for (const embeddingDoc of scopedEmbeddings) {
      const embedding = embeddingDoc.embedding;
      if (!embedding || embedding.length === 0) {continue;}

      const score = cosineSimilarity(queryEmbedding.embedding.values, embedding);

      // Extract string fields - empty strings are invalid (Explicit Ternary for STRINGS)
      const docText = (embeddingDoc.text !== '' && embeddingDoc.text != null) ? embeddingDoc.text : '';
      const docSource: 'document' | 'url' | 'faq' | 'product' = embeddingDoc.source ?? 'document';
      const docSourceId = (embeddingDoc.sourceId !== '' && embeddingDoc.sourceId != null) ? embeddingDoc.sourceId : '';

      results.push({
        text: docText,
        score,
        source: docSource,
        sourceId: docSourceId,
        metadata: embeddingDoc.metadata ?? {},
      });
    }
    
    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .filter(r => r.score > 0.3); // Minimum similarity threshold
  } catch (error) {
    logger.error('Error searching knowledge base:', error instanceof Error ? error : new Error(String(error)), { file: 'vector-search.ts' });
    return [];
  }
}

/**
 * Store embedding in Firestore
 */
export async function storeEmbedding(
  embedding: EmbeddingResult,
  source: 'document' | 'url' | 'faq' | 'product',
  sourceId: string,
  metadata?: Record<string, unknown>,
  agentId?: string,
): Promise<void> {
  try {
    const embeddingId = `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await AdminFirestoreService.set(
      getSubCollection('knowledgeEmbeddings'),
      embeddingId,
      {
        embedding: embedding.embedding.values,
        text: embedding.embedding.text,
        source,
        sourceId,
        metadata: metadata ?? {},
        model: embedding.model,
        createdAt: new Date().toISOString(),
        ...(agentId ? { agentId } : {}),
      },
      false
    );
  } catch (error) {
    logger.error('Error storing embedding:', error instanceof Error ? error : new Error(String(error)), { file: 'vector-search.ts' });
    throw error;
  }
}

/**
 * Index knowledge base documents (generate and store embeddings)
 */
export async function indexKnowledgeBase(agentId?: string): Promise<void> {
  try {
    // Per-agent doc when agentId given; legacy global 'current' otherwise.
    const knowledgeBaseData = await AdminFirestoreService.get<KnowledgeBase>(
      getSubCollection('knowledgeBase'),
      agentId ?? 'current'
    );

    if (!knowledgeBaseData) {
      return;
    }

    // Re-index replaces this agent's vectors: delete its old embeddings first so
    // a re-upload doesn't leave stale duplicates (embedding ids are random).
    if (agentId) {
      const stale = await AdminFirestoreService.getAll<{ id: string }>(
        getSubCollection('knowledgeEmbeddings'),
        [where('agentId', '==', agentId)],
      );
      for (const old of stale) {
        await AdminFirestoreService.delete(getSubCollection('knowledgeEmbeddings'), old.id);
      }
    }

    // Index documents
    if (knowledgeBaseData.documents && knowledgeBaseData.documents.length > 0) {
      for (const doc of knowledgeBaseData.documents) {
        if (doc.extractedContent) {
          const embedding = await generateEmbedding(doc.extractedContent);
          await storeEmbedding(embedding, 'document', doc.id, {
            filename: doc.filename,
            type: doc.type,
          }, agentId);
        }
      }
    }

    // Index URLs
    if (knowledgeBaseData.urls && knowledgeBaseData.urls.length > 0) {
      for (const url of knowledgeBaseData.urls) {
        if (url.extractedContent) {
          const embedding = await generateEmbedding(url.extractedContent);
          await storeEmbedding(embedding, 'url', url.id, {
            url: url.url,
            title: url.title,
          }, agentId);
        }
      }
    }

    // Index FAQs
    if (knowledgeBaseData.faqs && knowledgeBaseData.faqs.length > 0) {
      for (const faq of knowledgeBaseData.faqs) {
        const faqText = `${faq.question} ${faq.answer}`;
        const embedding = await generateEmbedding(faqText);
        await storeEmbedding(embedding, 'faq', faq.id, {
          question: faq.question,
          category: faq.category,
        }, agentId);
      }
    }

    // Index products
    if (knowledgeBaseData.productCatalog?.products) {
      for (const product of knowledgeBaseData.productCatalog.products) {
        const productText = `${product.name} ${product.description ?? ''}`;
        const embedding = await generateEmbedding(productText);
        await storeEmbedding(embedding, 'product', product.id, {
          name: product.name,
          price: product.price,
          category: product.category,
        }, agentId);
      }
    }
  } catch (error) {
    logger.error('Error indexing knowledge base:', error instanceof Error ? error : new Error(String(error)), { file: 'vector-search.ts' });
    throw error;
  }
}






















