/**
 * RAG (Retrieval Augmented Generation) Service
 * Combines vector search with AI generation for accurate responses
 */

import { searchKnowledgeBase } from './vector-search';
import type { ChatMessage } from '@/lib/ai/gemini-service';

export interface RAGContext {
  relevantChunks: Array<{
    text: string;
    score: number;
    source: string;
    sourceId: string;
  }>;
  query: string;
}

/**
 * Build RAG-enhanced prompt
 */
export async function buildRAGPrompt(
  query: string,
  baseSystemPrompt: string,
  maxChunks: number = 5
): Promise<string> {
  // Search knowledge base for relevant context
  const searchResults = await searchKnowledgeBase(query, maxChunks);
  
  if (searchResults.length === 0) {
    // No relevant context found, return base prompt
    return baseSystemPrompt;
  }
  
  // Build context section
  let contextSection = '\n\n# RELEVANT KNOWLEDGE BASE CONTEXT\n';
  contextSection += 'Use the following information from the knowledge base to answer the question accurately:\n\n';
  
  searchResults.forEach((result, index) => {
    contextSection += `[${index + 1}] Source: ${result.source} (Relevance: ${(result.score * 100).toFixed(1)}%)\n`;
    contextSection += `${result.text.substring(0, 500)}${result.text.length > 500 ? '...' : ''}\n\n`;
  });
  
  contextSection += '\n# INSTRUCTIONS\n';
  contextSection += '- Use the knowledge base context above to provide accurate answers\n';
  contextSection += '- If the context doesn\'t contain the answer, say so clearly\n';
  contextSection += '- Cite the source when using information from the knowledge base\n';
  contextSection += '- If you\'re unsure, ask clarifying questions\n';
  
  return baseSystemPrompt + contextSection;
}

/**
 * Get RAG context for a query
 */
export async function getRAGContext(
  query: string,
  maxChunks: number = 5
): Promise<RAGContext> {
  const searchResults = await searchKnowledgeBase(query, maxChunks);
  
  return {
    relevantChunks: searchResults.map(result => ({
      text: result.text,
      score: result.score,
      source: result.source,
      sourceId: result.sourceId,
    })),
    query,
  };
}

/**
 * Enhance chat messages with RAG context
 */
export async function enhanceChatWithRAG(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<{
  enhancedSystemPrompt: string;
  context: RAGContext;
}> {
  // Get the last user message as the query
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  // Extract query text - empty strings are invalid queries (Explicit Ternary for STRING)
  const queryText = lastUserMessage?.parts?.[0]?.text;
  const query = (queryText !== '' && queryText != null) ? queryText : '';

  if (!query) {
    return {
      enhancedSystemPrompt: systemPrompt,
      context: { relevantChunks: [], query: '' },
    };
  }

  // Get RAG context
  const context = await getRAGContext(query);

  // Build enhanced prompt
  const enhancedSystemPrompt = await buildRAGPrompt(query, systemPrompt);
  
  return {
    enhancedSystemPrompt,
    context,
  };
}






















