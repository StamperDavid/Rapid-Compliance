/**
 * Website Adapter — Scrapes a company website for contact info
 *
 * Uses smartScrape (static → browser fallback) + extractDataPoints + AI extraction.
 */

import { smartScrape } from '@/lib/enrichment/browser-scraper';
import { extractDataPoints, scrapeAboutPage } from '@/lib/enrichment/web-scraper';
import { extractCompanyData } from '@/lib/enrichment/ai-extractor';
import { logger } from '@/lib/logger/logger';
import { createEmptyAdapterResult, createEmptyContactFields, type SourceAdapter, type EnrichmentContext, type AdapterResult } from './index';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const SOCIAL_PATTERNS: Array<{ platform: string; pattern: RegExp }> = [
  { platform: 'linkedin', pattern: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>]+/gi },
  { platform: 'facebook', pattern: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi },
  { platform: 'twitter', pattern: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>]+/gi },
  { platform: 'instagram', pattern: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi },
];

export class WebsiteAdapter implements SourceAdapter {
  name = 'website_scrape';

  async search(_query: string, context: EnrichmentContext): Promise<AdapterResult> {
    const start = Date.now();
    const result = createEmptyAdapterResult(this.name);

    const websiteUrl = context.existingWebsite;
    if (!websiteUrl) {
      result.status = 'skipped';
      result.durationMs = Date.now() - start;
      return result;
    }

    try {
      // Scrape main page
      const mainContent = await smartScrape(websiteUrl);
      result.rawContentSize = mainContent.cleanedText.length;
      result.url = websiteUrl;

      const contacts = createEmptyContactFields();
      contacts.website = websiteUrl;

      // Extract basic data points (email, phone, social links)
      const dataPoints = extractDataPoints(mainContent);
      if (dataPoints.potentialPhone) { contacts.phones.push(dataPoints.potentialPhone); }
      if (dataPoints.potentialEmail) { contacts.emails.push(dataPoints.potentialEmail); }

      // Deep regex extraction from cleaned text
      const allText = mainContent.cleanedText + (mainContent.rawHtml ?? '');

      const phoneMatches = allText.match(PHONE_REGEX);
      if (phoneMatches) {
        for (const p of phoneMatches) {
          const cleaned = p.trim();
          if (!contacts.phones.includes(cleaned)) { contacts.phones.push(cleaned); }
        }
      }

      const emailMatches = allText.match(EMAIL_REGEX);
      if (emailMatches) {
        for (const e of emailMatches) {
          const cleaned = e.toLowerCase();
          // Filter out common non-contact emails
          if (!cleaned.includes('example.com') && !cleaned.includes('sentry.io') && !cleaned.includes('webpack')) {
            if (!contacts.emails.includes(cleaned)) { contacts.emails.push(cleaned); }
          }
        }
      }

      // Extract social media links
      for (const { platform, pattern } of SOCIAL_PATTERNS) {
        const matches = allText.match(pattern);
        if (matches?.[0]) {
          contacts.socialMedia[platform] = matches[0];
        }
      }

      // Also scrape the about page for additional contact info
      try {
        const aboutContent = await scrapeAboutPage(websiteUrl);
        if (aboutContent) {
          const aboutData = extractDataPoints(aboutContent);
          if (aboutData.potentialPhone && !contacts.phones.includes(aboutData.potentialPhone)) {
            contacts.phones.push(aboutData.potentialPhone);
          }
          if (aboutData.potentialEmail && !contacts.emails.includes(aboutData.potentialEmail)) {
            contacts.emails.push(aboutData.potentialEmail);
          }
          result.rawContentSize += aboutContent.cleanedText.length;
        }
      } catch {
        // About page not found — not an error
      }

      // AI-powered extraction for structured data
      try {
        const aiData = await extractCompanyData(mainContent, context.entityName);
        if (aiData.contactPhone && !contacts.phones.includes(aiData.contactPhone)) {
          contacts.phones.push(aiData.contactPhone);
        }
        if (aiData.contactEmail && !contacts.emails.includes(aiData.contactEmail)) {
          contacts.emails.push(aiData.contactEmail);
        }
        if (aiData.socialMedia?.linkedin && !contacts.socialMedia.linkedin) {
          contacts.socialMedia.linkedin = aiData.socialMedia.linkedin;
        }
        if (aiData.socialMedia?.facebook && !contacts.socialMedia.facebook) {
          contacts.socialMedia.facebook = aiData.socialMedia.facebook;
        }
        if (aiData.socialMedia?.twitter && !contacts.socialMedia.twitter) {
          contacts.socialMedia.twitter = aiData.socialMedia.twitter;
        }
      } catch {
        // AI extraction failed — continue with regex results
      }

      // Deduplicate and limit
      contacts.phones = [...new Set(contacts.phones)].slice(0, 5);
      contacts.emails = [...new Set(contacts.emails)].slice(0, 5);

      result.contacts = contacts;

      const fieldsFound: string[] = ['website'];
      if (contacts.phones.length > 0) { fieldsFound.push('phone'); }
      if (contacts.emails.length > 0) { fieldsFound.push('email'); }
      if (Object.keys(contacts.socialMedia).length > 0) { fieldsFound.push('social'); }

      result.fieldsFound = fieldsFound;
      result.status = fieldsFound.length > 1 ? 'success' : 'partial';
      result.confidence = Math.min(fieldsFound.length * 25, 85);
      result.durationMs = Date.now() - start;

      return result;
    } catch (err: unknown) {
      logger.error('[WebsiteAdapter] Scrape failed', err instanceof Error ? err : new Error(String(err)));
      result.status = 'failed';
      result.durationMs = Date.now() - start;
      return result;
    }
  }
}
