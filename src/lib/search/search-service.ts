/**
 * Search Service
 * Handles full-text search using Algolia or Typesense
 */

// For now, we'll implement a basic Firestore-based search
// In production, integrate with Algolia or Typesense

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import type { DocumentData } from 'firebase/firestore';

export interface SearchResult {
  id: string;
  type: 'record' | 'contact' | 'company' | 'deal' | 'lead';
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  limit?: number;
  filters?: Record<string, unknown>;
  sortBy?: string;
}

interface SchemaField {
  key: string;
  [key: string]: unknown;
}

interface _Schema {
  id: string;
  name: string;
  fields?: SchemaField[];
  [key: string]: unknown;
}

/**
 * Search across all entities in a workspace
 */
export async function searchWorkspace(
  orgId: string,
  workspaceId: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  try {
    // Search records (all entity types)
    // In production, this would use Algolia/Typesense
    // For now, we'll do a basic Firestore query

    // Get all schemas to know what entities exist
    const { SchemaService } = await import('@/lib/db/firestore-service');
    const schemas = await SchemaService.getAll(orgId, workspaceId) as Array<{
      id: string;
      name: string;
      fields?: SchemaField[];
      [key: string]: unknown;
    }>;

    // Search each entity type
    for (const schema of schemas) {
      const records = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.RECORDS}/${schema.id}`,
        []
      );

      // Filter records that match search term
      const matchingRecords = records.filter((record: DocumentData) => {
        const searchableText = Object.values(record)
          .filter(v => typeof v === 'string')
          .join(' ')
          .toLowerCase();
        return searchableText.includes(searchTerm);
      });

      // Convert to search results
      for (const record of matchingRecords.slice(0, options.limit ?? 10)) {
        const titleField = schema.fields?.find((f: SchemaField) =>
          f.key === 'name' || f.key === 'title' || f.key === 'first_name'
        );
        const titleValue = titleField ? (record[titleField.key] as string | undefined) : undefined;
        const title = titleValue && titleValue !== '' ? titleValue : 'Untitled';

        const recordId = typeof record.id === 'string' ? record.id : (record.id ? String(record.id) : '');
        const recordNotes = typeof record.notes === 'string' ? record.notes : undefined;
        const recordDescription = typeof record.description === 'string' ? record.description : undefined;

        results.push({
          id: recordId,
          type: schema.id as SearchResult['type'],
          title,
          subtitle: schema.name,
          description: recordNotes ?? recordDescription,
          url: `/workspace/${orgId}/entities/${schema.id}/${recordId}`,
          metadata: record as Record<string, unknown>,
        });
      }
    }
  } catch (error) {
    logger.error('Error searching workspace:', error instanceof Error ? error : new Error(String(error)), { file: 'search-service.ts' });
  }

  return results.slice(0, options.limit ?? 50);
}

/**
 * Index a record for search
 * In production, this would add to Algolia/Typesense index
 */
export function indexRecord(
  orgId: string,
  workspaceId: string,
  entityName: string,
  recordId: string,
  _recordData: Record<string, unknown>
): void {
  // In production, add to search index
  // For now, records are automatically searchable via Firestore queries
  logger.info('Indexing record', { orgId, workspaceId, entityName, recordId, file: 'search-service.ts' });
}

/**
 * Remove a record from search index
 */
export function unindexRecord(
  orgId: string,
  workspaceId: string,
  entityName: string,
  recordId: string
): void {
  // In production, remove from search index
  logger.info('Unindexing record', { orgId, workspaceId, entityName, recordId, file: 'search-service.ts' });
}

/**
 * Initialize search (for Algolia/Typesense setup)
 */
export function initializeSearch(): void {
  // In production, initialize Algolia/Typesense client
  // For now, using Firestore-based search
  logger.info('Search initialized (using Firestore)', { file: 'search-service.ts' });
}




















