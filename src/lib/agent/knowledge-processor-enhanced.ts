/**
 * Enhanced Knowledge Processor
 * Processes knowledge base and automatically indexes it
 */

import { logger } from '@/lib/logger/logger';
import { processKnowledgeBase, type KnowledgeProcessorOptions } from './knowledge-processor';
import { indexKnowledgeBase } from './vector-search';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

/**
 * Process and index knowledge base in one step
 */
export async function processAndIndexKnowledgeBase(
  options: KnowledgeProcessorOptions
) {
  // Process knowledge base
  const knowledgeBase = await processKnowledgeBase(options);
  
  // Save to Firestore
  await FirestoreService.set(
    getSubCollection('knowledgeBase'),
    'current',
    {
      ...knowledgeBase,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    false
  );
  
  // Index for vector search
  try {
    await indexKnowledgeBase();
  } catch (error) {
    logger.warn('Failed to index knowledge base', {
      errorMessage: error instanceof Error ? error.message : String(error),
      file: 'knowledge-processor-enhanced.ts'
    });
    // Continue even if indexing fails
  }
  
  return knowledgeBase;
}



















