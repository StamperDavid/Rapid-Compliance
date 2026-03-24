/**
 * Social Adapter — Searches LinkedIn and Facebook for company profiles
 *
 * Uses searchLinkedIn() from enrichment service and Google search for Facebook.
 */

import { searchLinkedIn, searchCompany } from '@/lib/enrichment/search-service';
import { smartScrape } from '@/lib/enrichment/browser-scraper';
import { logger } from '@/lib/logger/logger';
import { createEmptyAdapterResult, createEmptyContactFields, type SourceAdapter, type EnrichmentContext, type AdapterResult } from './index';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

export class SocialAdapter implements SourceAdapter {
  name = 'social_search';

  async search(_query: string, context: EnrichmentContext): Promise<AdapterResult> {
    const start = Date.now();
    const result = createEmptyAdapterResult(this.name);

    try {
      const contacts = createEmptyContactFields();
      const fieldsFound: string[] = [];
      let totalContentSize = 0;

      // --- LinkedIn search ---
      try {
        const linkedInUrl = await searchLinkedIn(context.entityName);
        if (linkedInUrl) {
          contacts.socialMedia.linkedin = linkedInUrl;
          fieldsFound.push('linkedin');

          // Try to scrape LinkedIn for additional info (may be rate-limited)
          try {
            const linkedInContent = await smartScrape(linkedInUrl);
            totalContentSize += linkedInContent.cleanedText.length;

            // Extract phone/email from LinkedIn content
            const phoneMatches = linkedInContent.cleanedText.match(PHONE_REGEX);
            if (phoneMatches) {
              for (const p of phoneMatches) {
                const cleaned = p.trim();
                if (!contacts.phones.includes(cleaned)) { contacts.phones.push(cleaned); }
              }
            }
            const emailMatches = linkedInContent.cleanedText.match(EMAIL_REGEX);
            if (emailMatches) {
              for (const e of emailMatches) {
                const cleaned = e.toLowerCase();
                if (!cleaned.includes('linkedin.com') && !contacts.emails.includes(cleaned)) {
                  contacts.emails.push(cleaned);
                }
              }
            }
          } catch {
            // LinkedIn scraping often blocked — expected
          }
        }
      } catch (err: unknown) {
        logger.debug('[SocialAdapter] LinkedIn search failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // --- Facebook search via Google ---
      try {
        const fbQuery = `site:facebook.com "${context.entityName}"`;
        const fbResults = await searchCompany(fbQuery);
        const fbResult = fbResults.find((r) => r.website.includes('facebook.com'));

        if (fbResult) {
          contacts.socialMedia.facebook = fbResult.website;
          fieldsFound.push('facebook');

          // Extract any contact info from the search snippet
          const phoneMatches = fbResult.snippet.match(PHONE_REGEX);
          if (phoneMatches) {
            for (const p of phoneMatches) {
              const cleaned = p.trim();
              if (!contacts.phones.includes(cleaned)) { contacts.phones.push(cleaned); }
            }
          }
          const emailMatches = fbResult.snippet.match(EMAIL_REGEX);
          if (emailMatches) {
            for (const e of emailMatches) {
              const cleaned = e.toLowerCase();
              if (!cleaned.includes('facebook.com') && !contacts.emails.includes(cleaned)) {
                contacts.emails.push(cleaned);
              }
            }
          }
        }
      } catch (err: unknown) {
        logger.debug('[SocialAdapter] Facebook search failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // --- Google Business search (for local businesses) ---
      if (context.depth === 'standard' || context.depth === 'deep') {
        try {
          const gbQuery = `"${context.entityName}" ${context.address} site:google.com/maps OR inurl:business.google`;
          const gbResults = await searchCompany(gbQuery);

          for (const gbr of gbResults) {
            const phoneMatches = gbr.snippet.match(PHONE_REGEX);
            if (phoneMatches) {
              for (const p of phoneMatches) {
                const cleaned = p.trim();
                if (!contacts.phones.includes(cleaned)) { contacts.phones.push(cleaned); }
              }
            }
          }

          if (gbResults.length > 0) {
            fieldsFound.push('google_business');
            totalContentSize += gbResults.map((r) => r.snippet).join('').length;
          }
        } catch {
          // Google Business search failed — non-critical
        }
      }

      // Deduplicate
      contacts.phones = [...new Set(contacts.phones)].slice(0, 5);
      contacts.emails = [...new Set(contacts.emails)].slice(0, 5);

      if (contacts.phones.length > 0) { fieldsFound.push('phone'); }
      if (contacts.emails.length > 0) { fieldsFound.push('email'); }

      result.contacts = contacts;
      result.fieldsFound = [...new Set(fieldsFound)];
      result.rawContentSize = totalContentSize;
      result.url = contacts.socialMedia.linkedin ?? contacts.socialMedia.facebook ?? 'social-search';
      result.status = result.fieldsFound.length > 0 ? 'success' : 'partial';
      result.confidence = Math.min(result.fieldsFound.length * 15, 60);
      result.durationMs = Date.now() - start;

      return result;
    } catch (err: unknown) {
      logger.error('[SocialAdapter] Search failed', err instanceof Error ? err : new Error(String(err)));
      result.status = 'failed';
      result.durationMs = Date.now() - start;
      return result;
    }
  }
}
