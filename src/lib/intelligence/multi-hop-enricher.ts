/**
 * Multi-Hop Enricher — Core enrichment pipeline for Intelligence Discovery
 *
 * Takes a DiscoveryFinding with seed data and enriches it across multiple
 * sources in a configurable chain. Each "hop" follows clues from the
 * previous hop (e.g., if Google finds a website, the next hop scrapes it).
 *
 * Enrichment chain:
 *   1. Google search → find website, phone, email
 *   2. Website scrape → extract contact info, social links (if website found)
 *   3. Social search → LinkedIn, Facebook, Google Business
 *   4. AI contact extraction → re-analyze best content for missed data
 *   5. Merge & score → cross-validate, calculate confidence
 *
 * Every hop logs a DiscoveryAction for the audit trail.
 *
 * @module intelligence/multi-hop-enricher
 */

import { logger } from '@/lib/logger/logger';
import { createDomainRateLimiter } from '@/lib/scraper-intelligence/domain-rate-limiter';
import { smartScrape } from '@/lib/enrichment/browser-scraper';
import { extractContactInfo } from './contact-extractor';
import { mergeAdapterResults } from './confidence-merger';
import {
  logAction,
  updateFindingEnrichment,
  updateAction,
  updateOperationStats,
  getOperation,
} from './discovery-service';

import { GoogleAdapter } from './source-adapters/google-adapter';
import { WebsiteAdapter } from './source-adapters/website-adapter';
import { SocialAdapter } from './source-adapters/social-adapter';

import type { DiscoveryFinding, EnrichmentStatus } from '@/types/intelligence-discovery';
import { createEmptyAdapterResult, type EnrichmentContext, type AdapterResult } from './source-adapters/index';

// ============================================================================
// CONFIG
// ============================================================================

const rateLimiter = createDomainRateLimiter({
  maxRequests: 10,
  windowMs: 60000,
  minDelayMs: 1000,
});

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run multi-hop enrichment on a single finding.
 *
 * @param finding The finding to enrich (must have seedData)
 * @param depth Enrichment depth: basic (Google + website), standard (+ social), deep (all + re-analyze)
 */
export async function enrichFinding(
  finding: DiscoveryFinding,
  depth: 'basic' | 'standard' | 'deep' = 'standard'
): Promise<void> {
  const seed = finding.seedData;
  const entityName = seed.company_name ?? seed.business_name ?? seed.entity_name ?? 'Unknown';
  const address = seed.physical_address ?? seed.principal_address ?? '';
  const ownerName = seed.owner_name ?? seed.officer_name ?? seed.poc_name ?? '';
  const seedPhone = seed.phone ?? null;

  logger.info('[MultiHopEnricher] Starting enrichment', {
    findingId: finding.id,
    entityName,
    depth,
  });

  const context: EnrichmentContext = {
    entityName,
    address,
    ownerName,
    existingPhone: seedPhone,
    existingEmail: null,
    existingWebsite: null,
    depth,
  };

  const adapterResults: AdapterResult[] = [];

  // ── Hop 1: Google Search ──────────────────────────────────────────────
  const googleResult = await runHop(
    finding,
    'google_search',
    async () => {
      const adapter = new GoogleAdapter();
      return adapter.search(entityName, context);
    }
  );
  adapterResults.push(googleResult);

  // Update context with findings from Google
  if (googleResult.contacts.website) {
    context.existingWebsite = googleResult.contacts.website;
  }
  if (googleResult.contacts.phones.length > 0) {
    context.existingPhone = googleResult.contacts.phones[0];
  }
  if (googleResult.contacts.emails.length > 0) {
    context.existingEmail = googleResult.contacts.emails[0];
  }

  // ── Hop 2: Website Scrape (if website found) ─────────────────────────
  if (context.existingWebsite) {
    try {
      const domain = new URL(context.existingWebsite).hostname;
      await rateLimiter.waitForSlot(domain);
    } catch {
      // Invalid URL or rate limit — continue anyway
    }

    const websiteResult = await runHop(
      finding,
      'website_scrape',
      async () => {
        const adapter = new WebsiteAdapter();
        return adapter.search(entityName, context);
      }
    );
    adapterResults.push(websiteResult);

    // Update context with website findings
    if (websiteResult.contacts.emails.length > 0 && !context.existingEmail) {
      context.existingEmail = websiteResult.contacts.emails[0];
    }
  }

  // ── Hop 3: Social Search (standard + deep depth) ─────────────────────
  if (depth === 'standard' || depth === 'deep') {
    const socialResult = await runHop(
      finding,
      'social_search',
      async () => {
        const adapter = new SocialAdapter();
        return adapter.search(entityName, context);
      }
    );
    adapterResults.push(socialResult);
  }

  // ── Hop 4: AI Re-Analysis (deep depth) ───────────────────────────────
  if (depth === 'deep' && context.existingWebsite) {
    const websiteUrl = context.existingWebsite;
    const aiResult = await runHop(
      finding,
      'ai_reanalysis',
      async () => {
        const result = createEmptyAdapterResult('ai_reanalysis');
        const start = Date.now();

        try {
          const content = await smartScrape(websiteUrl);
          const contacts = await extractContactInfo(content, entityName);

          result.contacts = contacts;
          result.url = websiteUrl;
          result.rawContentSize = content.cleanedText.length;

          const fieldsFound: string[] = [];
          if (contacts.phones.length > 0) { fieldsFound.push('phone'); }
          if (contacts.emails.length > 0) { fieldsFound.push('email'); }
          if (contacts.website) { fieldsFound.push('website'); }
          if (Object.keys(contacts.socialMedia).length > 0) { fieldsFound.push('social'); }
          if (contacts.ownerName) { fieldsFound.push('owner'); }

          result.fieldsFound = fieldsFound;
          result.status = fieldsFound.length > 0 ? 'success' : 'partial';
          result.confidence = Math.min(fieldsFound.length * 20, 80);
        } catch (err: unknown) {
          logger.warn('[MultiHopEnricher] AI re-analysis failed', {
            error: err instanceof Error ? err.message : String(err),
          });
          result.status = 'failed';
        }

        result.durationMs = Date.now() - start;
        return result;
      }
    );
    adapterResults.push(aiResult);
  }

  // ── Hop 5: Merge & Score ──────────────────────────────────────────────
  const merged = mergeAdapterResults(adapterResults);

  // Determine enrichment status based on what we found
  let enrichmentStatus: EnrichmentStatus;
  const hasPhone = merged.contactInfo.phones.length > 0;
  const hasEmail = merged.contactInfo.emails.length > 0;

  if (hasPhone && hasEmail) {
    enrichmentStatus = 'enriched';
  } else if (hasPhone || hasEmail || merged.contactInfo.website !== null) {
    enrichmentStatus = 'partial';
  } else {
    enrichmentStatus = 'failed';
  }

  // Save enrichment results
  await updateFindingEnrichment(
    finding.id,
    merged.contactInfo,
    merged.enrichmentSources,
    merged.confidenceScores,
    merged.overallConfidence,
    enrichmentStatus
  );

  // Update operation stats
  try {
    const operation = await getOperation(finding.operationId);
    if (operation) {
      const statUpdate = enrichmentStatus === 'enriched' || enrichmentStatus === 'partial'
        ? { totalEnriched: operation.stats.totalEnriched + 1 }
        : { totalFailed: operation.stats.totalFailed + 1 };
      await updateOperationStats(finding.operationId, statUpdate);
    }
  } catch {
    // Non-critical — stats update failure shouldn't block enrichment
  }

  // Log completion action
  await logAction({
    operationId: finding.operationId,
    findingId: finding.id,
    actionType: 'validate',
    sourceUrl: 'multi-hop-enricher',
    status: 'completed',
    data: {
      summary: `Enrichment ${enrichmentStatus}: ${merged.contactInfo.phones.length} phones, ${merged.contactInfo.emails.length} emails, ${Object.keys(merged.contactInfo.socialMedia).length} social profiles`,
      confidence: merged.overallConfidence,
    },
  });

  logger.info('[MultiHopEnricher] Enrichment complete', {
    findingId: finding.id,
    entityName,
    enrichmentStatus,
    overallConfidence: merged.overallConfidence,
    phonesFound: merged.contactInfo.phones.length,
    emailsFound: merged.contactInfo.emails.length,
    socialFound: Object.keys(merged.contactInfo.socialMedia).length,
    hopsRun: adapterResults.length,
  });
}

// ============================================================================
// HOP RUNNER — Wraps each adapter call with action logging
// ============================================================================

async function runHop(
  finding: DiscoveryFinding,
  hopName: string,
  execute: () => Promise<AdapterResult>
): Promise<AdapterResult> {
  // Log the start of this hop
  const action = await logAction({
    operationId: finding.operationId,
    findingId: finding.id,
    actionType: hopName === 'ai_reanalysis' ? 'extract' : hopName.includes('search') ? 'search' : 'scrape',
    sourceUrl: hopName,
    status: 'running',
    data: {
      summary: `${hopName}: searching for ${finding.seedData.company_name ?? finding.seedData.business_name ?? 'entity'}`,
    },
  });

  try {
    const result = await execute();

    // Update the action with results
    await updateAction(action.id, {
      status: result.status === 'failed' ? 'failed' : 'completed',
      durationMs: result.durationMs,
      data: {
        summary: `${hopName}: found ${result.fieldsFound.join(', ') || 'nothing'}`,
        confidence: result.confidence,
        rawContentSize: result.rawContentSize,
        extractedContentSize: result.fieldsFound.length,
      },
    });

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await updateAction(action.id, {
      status: 'failed',
      data: {
        errorMessage: errorMsg,
        summary: `${hopName}: failed — ${errorMsg}`,
      },
    });

    logger.error(`[MultiHopEnricher] Hop ${hopName} failed`, err instanceof Error ? err : new Error(errorMsg));

    const fallback = createEmptyAdapterResult(hopName);
    fallback.status = 'failed';
    return fallback;
  }
}

// ============================================================================
// BATCH ENRICHMENT — Enrich multiple findings in parallel batches
// ============================================================================

/**
 * Enrich multiple findings in parallel batches.
 * Respects rate limits by processing in batches of `batchSize`.
 */
export async function enrichFindingsBatch(
  findings: DiscoveryFinding[],
  depth: 'basic' | 'standard' | 'deep' = 'standard',
  batchSize: number = 5
): Promise<{ enriched: number; failed: number }> {
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < findings.length; i += batchSize) {
    const batch = findings.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map((finding) => enrichFinding(finding, depth))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        enriched++;
      } else {
        failed++;
        logger.error('[MultiHopEnricher] Batch enrichment item failed', new Error(String(result.reason)));
      }
    }
  }

  return { enriched, failed };
}
