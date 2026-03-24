/**
 * Confidence Merger — Cross-validates and merges data from multiple source adapters
 *
 * When multiple sources return data for the same field (e.g., two different phone
 * numbers), this module cross-validates, boosts confidence for corroborated data,
 * and selects the highest-confidence value per field.
 *
 * @module intelligence/confidence-merger
 */

import { aggregateConfidences } from '@/lib/scraper-intelligence/confidence-scorer';
import type { ContactFields, AdapterResult } from './source-adapters/index';
import type { ContactInfo, EnrichmentSourceResult } from '@/types/intelligence-discovery';

interface MergedResult {
  contactInfo: ContactInfo;
  enrichmentSources: EnrichmentSourceResult[];
  confidenceScores: Record<string, number>;
  overallConfidence: number;
}

/**
 * Merge results from multiple source adapters into a unified ContactInfo
 * with per-field confidence scores.
 */
export function mergeAdapterResults(adapterResults: AdapterResult[]): MergedResult {
  const successfulResults = adapterResults.filter(
    (r) => r.status === 'success' || r.status === 'partial'
  );

  // Collect all field values across sources
  const allPhones = collectFieldValues(successfulResults, (r) => r.contacts.phones);
  const allEmails = collectFieldValues(successfulResults, (r) => r.contacts.emails);
  const allWebsites = collectFieldValues(successfulResults, (r) =>
    r.contacts.website ? [r.contacts.website] : []
  );
  const allSocial = collectSocialValues(successfulResults);

  // Score and select best values
  const phonesWithConfidence = scoreValues(allPhones);
  const emailsWithConfidence = scoreValues(allEmails);
  const websitesWithConfidence = scoreValues(allWebsites);

  // Build ContactInfo
  const contactInfo: ContactInfo = {
    phones: phonesWithConfidence.map((v) => v.value),
    emails: emailsWithConfidence.map((v) => v.value),
    website: websitesWithConfidence[0]?.value ?? null,
    socialMedia: allSocial,
    additionalContacts: buildAdditionalContacts(successfulResults),
  };

  // Build per-field confidence scores
  const confidenceScores: Record<string, number> = {};
  if (phonesWithConfidence.length > 0) {
    confidenceScores.phone = phonesWithConfidence[0].confidence;
  }
  if (emailsWithConfidence.length > 0) {
    confidenceScores.email = emailsWithConfidence[0].confidence;
  }
  if (websitesWithConfidence.length > 0) {
    confidenceScores.website = websitesWithConfidence[0].confidence;
  }
  if (Object.keys(allSocial).length > 0) {
    confidenceScores.social = Math.min(Object.keys(allSocial).length * 30, 80);
  }

  // Calculate overall confidence using the aggregator
  const sourceConfidences = successfulResults
    .filter((r) => r.confidence > 0)
    .map((r) => ({
      source: r.sourceName,
      confidence: r.confidence,
      weight: r.status === 'success' ? 1 : 0.5,
    }));

  let overallConfidence = 0;
  if (sourceConfidences.length > 0) {
    const aggregated = aggregateConfidences(sourceConfidences);
    overallConfidence = Math.round(aggregated.aggregatedConfidence);
  }

  // Boost overall confidence based on how many contact fields we found
  const fieldCount = [
    contactInfo.phones.length > 0,
    contactInfo.emails.length > 0,
    contactInfo.website !== null,
    Object.keys(contactInfo.socialMedia).length > 0,
  ].filter(Boolean).length;

  overallConfidence = Math.min(
    overallConfidence + fieldCount * 5,
    95
  );

  // Build enrichment sources for audit trail
  const enrichmentSources: EnrichmentSourceResult[] = adapterResults.map((r) => ({
    sourceName: r.sourceName,
    url: r.url,
    status: r.status,
    fieldsFound: r.fieldsFound,
    data: flattenContactFields(r.contacts),
    confidence: r.confidence,
    durationMs: r.durationMs,
  }));

  return {
    contactInfo,
    enrichmentSources,
    confidenceScores,
    overallConfidence,
  };
}

// ============================================================================
// INTERNALS
// ============================================================================

interface ValueWithSources {
  value: string;
  sources: string[];
  confidence: number;
}

/**
 * Collect all values for a field across adapters, tracking which sources provided each.
 */
function collectFieldValues(
  results: AdapterResult[],
  getter: (r: AdapterResult) => string[]
): Map<string, string[]> {
  const valueToSources = new Map<string, string[]>();

  for (const result of results) {
    const values = getter(result);
    for (const value of values) {
      const normalized = value.trim().toLowerCase();
      if (!normalized) { continue; }

      const existing = valueToSources.get(normalized) ?? [];
      existing.push(result.sourceName);
      valueToSources.set(normalized, existing);
    }
  }

  return valueToSources;
}

/**
 * Score values based on how many sources corroborate them.
 * Values found in multiple sources get a confidence boost.
 */
function scoreValues(valueToSources: Map<string, string[]>): ValueWithSources[] {
  const scored: ValueWithSources[] = [];

  for (const [value, sources] of valueToSources) {
    // Base confidence: 40 for a single source
    // Each additional corroborating source adds 20 (up to 90)
    const confidence = Math.min(40 + (sources.length - 1) * 20, 90);

    scored.push({
      value,
      sources,
      confidence,
    });
  }

  // Sort by confidence descending, then by number of sources
  scored.sort((a, b) => b.confidence - a.confidence || b.sources.length - a.sources.length);

  // Limit to top 5 values
  return scored.slice(0, 5);
}

/**
 * Merge social media URLs from all sources. If multiple sources found the same
 * platform, prefer the one from a higher-confidence source.
 */
function collectSocialValues(results: AdapterResult[]): Record<string, string> {
  const social: Record<string, string> = {};

  // Sort by confidence descending so higher-confidence values win
  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);

  for (const result of sorted) {
    for (const [platform, url] of Object.entries(result.contacts.socialMedia)) {
      if (!social[platform] && url) {
        social[platform] = url;
      }
    }
  }

  return social;
}

/**
 * Build additional contacts (owner/decision-maker info) from adapter results.
 */
function buildAdditionalContacts(
  results: AdapterResult[]
): ContactInfo['additionalContacts'] {
  const contacts: ContactInfo['additionalContacts'] = [];
  const seenNames = new Set<string>();

  for (const result of results) {
    const name = result.contacts.ownerName;
    if (name && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      contacts.push({
        name,
        title: result.contacts.ownerTitle ?? '',
        phone: result.contacts.phones[0] ?? null,
        email: result.contacts.emails[0] ?? null,
      });
    }
  }

  return contacts;
}

/**
 * Flatten ContactFields into a Record<string, string> for storage.
 */
function flattenContactFields(contacts: ContactFields): Record<string, string> {
  const flat: Record<string, string> = {};

  if (contacts.phones.length > 0) { flat.phone = contacts.phones.join(', '); }
  if (contacts.emails.length > 0) { flat.email = contacts.emails.join(', '); }
  if (contacts.website) { flat.website = contacts.website; }
  if (contacts.ownerName) { flat.ownerName = contacts.ownerName; }
  if (contacts.ownerTitle) { flat.ownerTitle = contacts.ownerTitle; }
  for (const [platform, url] of Object.entries(contacts.socialMedia)) {
    flat[`social_${platform}`] = url;
  }

  return flat;
}
