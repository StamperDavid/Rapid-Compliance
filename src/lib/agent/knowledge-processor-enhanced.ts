/**
 * Enhanced Knowledge Processor
 * Processes knowledge base and automatically indexes it
 */

import { logger } from '@/lib/logger/logger';
import { processKnowledgeBase, KnowledgeProcessorOptions } from './knowledge-processor';
import { indexKnowledgeBase } from './vector-search';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

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
    `${COLLECTIONS.ORGANIZATIONS}/${options.organizationId}/knowledgeBase`,
    'current',
    {
      ...knowledgeBase,
      organizationId: options.organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    false
  );
  
  // Index for vector search
  try {
    await indexKnowledgeBase(options.organizationId);
  } catch (error) {
    logger.warn('Failed to index knowledge base', { error, file: 'knowledge-processor-enhanced.ts' });
    // Continue even if indexing fails
  }
  
  return knowledgeBase;
}



















