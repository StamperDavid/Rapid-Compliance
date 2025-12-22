/**
 * Search Service
 * Handles full-text search using Algolia or Typesense
 */

// For now, we'll implement a basic Firestore-based search
// In production, integrate with Algolia or Typesense

import { FirestoreService } from '@/lib/db/firestore-service';
import { COLLECTIONS } from '@/lib/db/firestore-service';

export interface SearchResult {
  id: string;
  type: 'record' | 'contact' | 'company' | 'deal' | 'lead';
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  limit?: number;
  filters?: Record<string, any>;
  sortBy?: string;
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
    const schemas = await SchemaService.getAll(orgId, workspaceId);

    // Search each entity type
    for (const schema of schemas) {
      const records = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.RECORDS}/${schema.id}`,
        []
      );

      // Filter records that match search term
      const matchingRecords = records.filter((record: any) => {
        const searchableText = Object.values(record)
          .filter(v => typeof v === 'string')
          .join(' ')
          .toLowerCase();
        return searchableText.includes(searchTerm);
      });

      // Convert to search results
      for (const record of matchingRecords.slice(0, options.limit || 10)) {
        const titleField = schema.fields?.find((f: any) => 
          f.key === 'name' || f.key === 'title' || f.key === 'first_name'
        );
        const title = titleField ? record[titleField.key] : record.id;

        results.push({
          id: record.id,
          type: schema.id as any,
          title: title || 'Untitled',
          subtitle: schema.name,
          description: record.notes || record.description,
          url: `/workspace/${orgId}/entities/${schema.id}/${record.id}`,
          metadata: record,
        });
      }
    }
  } catch (error) {
    console.error('Error searching workspace:', error);
  }

  return results.slice(0, options.limit || 50);
}

/**
 * Index a record for search
 * In production, this would add to Algolia/Typesense index
 */
export async function indexRecord(
  orgId: string,
  workspaceId: string,
  entityName: string,
  recordId: string,
  recordData: any
): Promise<void> {
  // In production, add to search index
  // For now, records are automatically searchable via Firestore queries
  console.log('Indexing record:', { orgId, workspaceId, entityName, recordId });
}

/**
 * Remove a record from search index
 */
export async function unindexRecord(
  orgId: string,
  workspaceId: string,
  entityName: string,
  recordId: string
): Promise<void> {
  // In production, remove from search index
  console.log('Unindexing record:', { orgId, workspaceId, entityName, recordId });
}

/**
 * Initialize search (for Algolia/Typesense setup)
 */
export async function initializeSearch(): Promise<void> {
  // In production, initialize Algolia/Typesense client
  // For now, using Firestore-based search
  console.log('Search initialized (using Firestore)');
}




















