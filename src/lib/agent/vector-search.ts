/**
 * Vector Search Service
 * Performs semantic search on knowledge base using vector embeddings
 */

import type { Embedding, EmbeddingResult } from './embeddings-service';
import { generateEmbedding } from './embeddings-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export interface SearchResult {
  text: string;
  score: number;
  source: 'document' | 'url' | 'faq' | 'product';
  sourceId: string;
  metadata?: Record<string, any>;
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
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

/**
 * Search knowledge base using semantic search
 */
export async function searchKnowledgeBase(
  query: string,
  organizationId: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query, organizationId);
    
    // Get all knowledge base embeddings from Firestore
    const knowledgeBase = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/knowledgeBase`,
      'current'
    );
    
    if (!knowledgeBase) {
      return [];
    }
    
    // Get all embeddings
    const embeddings = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/knowledgeEmbeddings`,
      []
    );
    
    // Calculate similarity scores
    const results: SearchResult[] = [];
    
    for (const embeddingDoc of embeddings) {
      const embedding = embeddingDoc.embedding as number[];
      if (!embedding || embedding.length === 0) continue;
      
      const score = cosineSimilarity(queryEmbedding.embedding.values, embedding);
      
      results.push({
        text: embeddingDoc.text || '',
        score,
        source: embeddingDoc.source || 'document',
        sourceId: embeddingDoc.sourceId || '',
        metadata: embeddingDoc.metadata || {},
      });
    }
    
    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .filter(r => r.score > 0.3); // Minimum similarity threshold
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return [];
  }
}

/**
 * Store embedding in Firestore
 */
export async function storeEmbedding(
  organizationId: string,
  embedding: EmbeddingResult,
  source: 'document' | 'url' | 'faq' | 'product',
  sourceId: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const embeddingId = `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/knowledgeEmbeddings`,
      embeddingId,
      {
        embedding: embedding.embedding.values,
        text: embedding.embedding.text,
        source,
        sourceId,
        metadata: metadata || {},
        model: embedding.model,
        createdAt: new Date().toISOString(),
      },
      false
    );
  } catch (error) {
    console.error('Error storing embedding:', error);
    throw error;
  }
}

/**
 * Index knowledge base documents (generate and store embeddings)
 */
export async function indexKnowledgeBase(
  organizationId: string
): Promise<void> {
  try {
    // Get knowledge base
    const knowledgeBase = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/knowledgeBase`,
      'current'
    );
    
    if (!knowledgeBase) {
      return;
    }
    
    // Index documents
    if (knowledgeBase.documents && knowledgeBase.documents.length > 0) {
      for (const doc of knowledgeBase.documents) {
        if (doc.extractedContent) {
          const embedding = await generateEmbedding(doc.extractedContent, organizationId);
          await storeEmbedding(organizationId, embedding, 'document', doc.id, {
            filename: doc.filename,
            type: doc.type,
          });
        }
      }
    }
    
    // Index URLs
    if (knowledgeBase.urls && knowledgeBase.urls.length > 0) {
      for (const url of knowledgeBase.urls) {
        if (url.extractedContent) {
          const embedding = await generateEmbedding(url.extractedContent, organizationId);
          await storeEmbedding(organizationId, embedding, 'url', url.id, {
            url: url.url,
            title: url.title,
          });
        }
      }
    }
    
    // Index FAQs
    if (knowledgeBase.faqs && knowledgeBase.faqs.length > 0) {
      for (const faq of knowledgeBase.faqs) {
        const faqText = `${faq.question} ${faq.answer}`;
        const embedding = await generateEmbedding(faqText, organizationId);
        await storeEmbedding(organizationId, embedding, 'faq', faq.id, {
          question: faq.question,
          category: faq.category,
        });
      }
    }
    
    // Index products
    if (knowledgeBase.productCatalog && knowledgeBase.productCatalog.products) {
      for (const product of knowledgeBase.productCatalog.products) {
        const productText = `${product.name} ${product.description}`;
        const embedding = await generateEmbedding(productText, organizationId);
        await storeEmbedding(organizationId, embedding, 'product', product.id, {
          name: product.name,
          price: product.price,
          category: product.category,
        });
      }
    }
  } catch (error) {
    console.error('Error indexing knowledge base:', error);
    throw error;
  }
}





