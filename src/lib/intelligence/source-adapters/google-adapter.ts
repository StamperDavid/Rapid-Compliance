/**
 * Google Adapter — Searches Google/Serper for company contact info
 *
 * Reuses searchCompany() from the enrichment search service.
 */

import { searchCompany } from '@/lib/enrichment/search-service';
import { logger } from '@/lib/logger/logger';
import { createEmptyAdapterResult, createEmptyContactFields, type SourceAdapter, type EnrichmentContext, type AdapterResult } from './index';

const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function extractFromSnippets(snippets: string[]): {
  phones: string[];
  emails: string[];
  urls: string[];
} {
  const phones: Set<string> = new Set();
  const emails: Set<string> = new Set();
  const urls: Set<string> = new Set();

  for (const snippet of snippets) {
    const phoneMatches = snippet.match(PHONE_REGEX);
    if (phoneMatches) {
      for (const p of phoneMatches) { phones.add(p.trim()); }
    }

    const emailMatches = snippet.match(EMAIL_REGEX);
    if (emailMatches) {
      for (const e of emailMatches) { emails.add(e.toLowerCase()); }
    }

    // Extract URLs from search results
    const urlMatch = snippet.match(/https?:\/\/[^\s<>"]+/g);
    if (urlMatch) {
      for (const u of urlMatch) { urls.add(u); }
    }
  }

  return {
    phones: Array.from(phones).slice(0, 5),
    emails: Array.from(emails).slice(0, 5),
    urls: Array.from(urls).slice(0, 10),
  };
}

export class GoogleAdapter implements SourceAdapter {
  name = 'google_search';

  async search(query: string, context: EnrichmentContext): Promise<AdapterResult> {
    const start = Date.now();
    const result = createEmptyAdapterResult(this.name);

    try {
      // Build targeted search query
      const searchQuery = context.address
        ? `${context.entityName} ${context.address} phone email contact`
        : `${context.entityName} phone email contact`;

      const searchResults = await searchCompany(searchQuery);

      if (searchResults.length === 0) {
        result.status = 'failed';
        result.durationMs = Date.now() - start;
        return result;
      }

      // Extract contact info from snippets and results
      const snippets = searchResults.map((r) => `${r.snippet} ${r.website}`);
      const extracted = extractFromSnippets(snippets);

      const contacts = createEmptyContactFields();
      contacts.phones = extracted.phones;
      contacts.emails = extracted.emails;

      // Find company website from search results
      const companyResult = searchResults[0];
      if (companyResult?.website) {
        contacts.website = companyResult.website;
      }

      // Detect social media URLs
      for (const url of extracted.urls) {
        if (url.includes('linkedin.com')) { contacts.socialMedia.linkedin = url; }
        else if (url.includes('facebook.com')) { contacts.socialMedia.facebook = url; }
        else if (url.includes('twitter.com') || url.includes('x.com')) { contacts.socialMedia.twitter = url; }
        else if (url.includes('instagram.com')) { contacts.socialMedia.instagram = url; }
      }

      result.contacts = contacts;
      result.url = `google.com/search?q=${encodeURIComponent(searchQuery)}`;
      result.rawContentSize = snippets.join('').length;

      const fieldsFound: string[] = [];
      if (contacts.phones.length > 0) { fieldsFound.push('phone'); }
      if (contacts.emails.length > 0) { fieldsFound.push('email'); }
      if (contacts.website) { fieldsFound.push('website'); }
      if (Object.keys(contacts.socialMedia).length > 0) { fieldsFound.push('social'); }

      result.fieldsFound = fieldsFound;
      result.status = fieldsFound.length > 0 ? 'success' : 'partial';
      result.confidence = Math.min(fieldsFound.length * 20, 70);
      result.durationMs = Date.now() - start;

      return result;
    } catch (err: unknown) {
      logger.error('[GoogleAdapter] Search failed', err instanceof Error ? err : new Error(String(err)));
      result.status = 'failed';
      result.durationMs = Date.now() - start;
      return result;
    }
  }
}
