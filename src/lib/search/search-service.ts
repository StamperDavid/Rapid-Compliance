/**
 * Search Service
 * Workspace-wide entity search using Firestore with server-side filtering.
 *
 * Optimizations over the naive full-scan approach:
 * - Uses admin SDK (server-side, no auth context issues)
 * - Queries schemas in parallel
 * - Caps per-schema reads (MAX_PER_SCHEMA) to bound cost
 * - Early termination once enough results are found
 * - Prioritizes title/name field matches over body text
 *
 * For truly large datasets, integrate Algolia or Typesense.
 */

import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

export interface SearchResult {
  id: string;
  type: 'record' | 'contact' | 'company' | 'deal' | 'lead';
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
  metadata?: Record<string, unknown>;
  /** Higher = better match. Title matches score higher than body matches. */
  relevance: number;
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

/** Max records to read per entity type to bound Firestore reads */
const MAX_PER_SCHEMA = 200;

/** Fields most likely to contain the record's display title */
const TITLE_FIELDS = ['name', 'title', 'first_name', 'company_name', 'deal_name', 'subject', 'label'];

/** Fields most likely to contain searchable body text */
const BODY_FIELDS = ['notes', 'description', 'email', 'phone', 'company', 'last_name', 'address', 'city'];

/**
 * Search across all entities
 */
export async function searchWorkspace(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = query.toLowerCase().trim();
  const globalLimit = options.limit ?? 50;

  try {
    if (!adminDb) {
      logger.error('Search unavailable: admin Firestore not initialized', new Error('adminDb is null'), { file: 'search-service.ts' });
      return [];
    }

    // Get all schemas to know what entities exist
    const schemasSnap = await adminDb
      .collection(`organizations/${PLATFORM_ID}/schemas`)
      .get();

    const schemas = schemasSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{ id: string; name: string; fields?: SchemaField[] }>;

    // Search all entity types in parallel
    const schemaResults = await Promise.all(
      schemas.map(schema => searchEntityType(schema, searchTerm, globalLimit))
    );

    // Flatten, sort by relevance (highest first), and cap at limit
    const allResults = schemaResults
      .flat()
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, globalLimit);

    return allResults;
  } catch (error) {
    logger.error(
      'Error searching workspace:',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'search-service.ts' }
    );
    return [];
  }
}

/**
 * Search a single entity type (schema) for matching records.
 */
async function searchEntityType(
  schema: { id: string; name: string; fields?: SchemaField[] },
  searchTerm: string,
  limit: number
): Promise<SearchResult[]> {
  const collectionPath = `organizations/${PLATFORM_ID}/records/${schema.id}`;
  const results: SearchResult[] = [];

  try {
    if (!adminDb) {return results;}

    const snap = await adminDb
      .collection(collectionPath)
      .limit(MAX_PER_SCHEMA)
      .get();

    for (const doc of snap.docs) {
      if (results.length >= limit) {break;}

      const record = { id: doc.id, ...doc.data() } as Record<string, unknown>;
      const match = scoreRecord(record, searchTerm, schema);

      if (match.relevance > 0) {
        results.push({
          id: doc.id,
          type: schema.id as SearchResult['type'],
          title: match.title,
          subtitle: schema.name,
          description: match.description,
          url: `/entities/${schema.id}/${doc.id}`,
          metadata: record,
          relevance: match.relevance,
        });
      }
    }
  } catch (error) {
    // Log but don't fail the entire search for one entity type
    logger.warn(`Search failed for entity type ${schema.id}`, {
      error: error instanceof Error ? error.message : String(error),
      file: 'search-service.ts',
    });
  }

  return results;
}

/**
 * Score a single record against the search term.
 * Returns relevance > 0 for matches, 0 for non-matches.
 *
 * Scoring:
 *  - Exact title match: 100
 *  - Title starts with search term: 80
 *  - Title contains search term: 60
 *  - Body field starts with search term: 40
 *  - Body field contains search term: 20
 */
function scoreRecord(
  record: Record<string, unknown>,
  searchTerm: string,
  schema: { fields?: SchemaField[] }
): { relevance: number; title: string; description: string | undefined } {
  let relevance = 0;
  let title = 'Untitled';
  let description: string | undefined;

  // Extract title from known fields or schema-defined fields
  const schemaFieldKeys = schema.fields?.map(f => f.key) ?? [];
  const titleCandidates = [...TITLE_FIELDS, ...schemaFieldKeys.filter(k => TITLE_FIELDS.includes(k))];

  for (const field of titleCandidates) {
    const val = record[field];
    if (typeof val === 'string' && val.trim() !== '') {
      title = val;
      break;
    }
  }

  // Extract description
  for (const field of ['notes', 'description']) {
    const val = record[field];
    if (typeof val === 'string' && val.trim() !== '') {
      description = val.length > 200 ? `${val.substring(0, 200)}...` : val;
      break;
    }
  }

  // Score title match
  const titleLower = title.toLowerCase();
  if (titleLower === searchTerm) {
    relevance = 100;
  } else if (titleLower.startsWith(searchTerm)) {
    relevance = 80;
  } else if (titleLower.includes(searchTerm)) {
    relevance = 60;
  }

  // If no title match, check body fields
  if (relevance === 0) {
    for (const field of BODY_FIELDS) {
      const val = record[field];
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.startsWith(searchTerm)) {
          relevance = Math.max(relevance, 40);
          break;
        } else if (lower.includes(searchTerm)) {
          relevance = Math.max(relevance, 20);
        }
      }
    }
  }

  // Last resort: check ALL string fields (catch-all for custom schemas)
  if (relevance === 0) {
    for (const [key, val] of Object.entries(record)) {
      if (key.startsWith('_') || key === 'id') {continue;}
      if (typeof val === 'string' && val.toLowerCase().includes(searchTerm)) {
        relevance = 10;
        break;
      }
    }
  }

  return { relevance, title, description };
}

/**
 * Index a record for search.
 * Currently a no-op — records are searched directly from Firestore.
 * When Algolia/Typesense is integrated, this will push to the search index.
 */
export function indexRecord(
  entityName: string,
  recordId: string,
  _recordData: Record<string, unknown>
): void {
  logger.debug('Indexing record', { entityName, recordId, file: 'search-service.ts' });
}

/**
 * Remove a record from search index.
 */
export function unindexRecord(
  entityName: string,
  recordId: string
): void {
  logger.debug('Unindexing record', { entityName, recordId, file: 'search-service.ts' });
}

/**
 * Initialize search.
 */
export function initializeSearch(): void {
  logger.info('Search initialized (Firestore-based with server-side filtering)', { file: 'search-service.ts' });
}
