/**
 * Source Adapter Interface — Defines how enrichment sources work
 *
 * Each adapter knows how to search for and extract contact information
 * from a specific type of source (Google, website, social media, etc.)
 *
 * @module intelligence/source-adapters
 */

export interface EnrichmentContext {
  entityName: string;
  address: string;
  ownerName: string;
  existingPhone: string | null;
  existingEmail: string | null;
  existingWebsite: string | null;
  depth: 'basic' | 'standard' | 'deep';
}

export interface ContactFields {
  phones: string[];
  emails: string[];
  website: string | null;
  socialMedia: Record<string, string>;
  ownerName: string | null;
  ownerTitle: string | null;
}

export interface AdapterResult {
  sourceName: string;
  url: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  fieldsFound: string[];
  contacts: ContactFields;
  rawContentSize: number;
  confidence: number;
  durationMs: number;
}

export interface SourceAdapter {
  name: string;
  search(query: string, context: EnrichmentContext): Promise<AdapterResult>;
}

export function createEmptyContactFields(): ContactFields {
  return {
    phones: [],
    emails: [],
    website: null,
    socialMedia: {},
    ownerName: null,
    ownerTitle: null,
  };
}

export function createEmptyAdapterResult(sourceName: string): AdapterResult {
  return {
    sourceName,
    url: '',
    status: 'failed',
    fieldsFound: [],
    contacts: createEmptyContactFields(),
    rawContentSize: 0,
    confidence: 0,
    durationMs: 0,
  };
}
