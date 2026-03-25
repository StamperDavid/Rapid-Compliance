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
import { generateContentHash, checkDuplicate, extractFieldConflicts } from './dedup-conflicts';

// ============================================================================
// CONFIG
// ============================================================================

const rateLimiter = createDomainRateLimiter({
  maxRequests: 10,
  windowMs: 60000,
  minDelayMs: 1000,
});

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

// ============================================================================
// RETRY WITH EXPONENTIAL BACKOFF
// ============================================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = RETRY_CONFIG.maxRetries,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
          RETRY_CONFIG.maxDelayMs,
        );
        logger.warn(`[MultiHopEnricher] ${label} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms`, {
          error: lastError.message,
        });
        await new Promise<void>((resolve) => { setTimeout(resolve, delay); });
      }
    }
  }

  throw lastError ?? new Error(`${label} failed after ${maxRetries + 1} attempts`);
}

// ============================================================================
// CAPTCHA / BLOCKING DETECTION
// ============================================================================

const CAPTCHA_INDICATORS = [
  'captcha', 'recaptcha', 'hcaptcha', 'challenge-platform',
  'cf-browser-verification', 'cloudflare', 'just a moment',
  'checking your browser', 'ray id', 'attention required',
  'access denied', 'forbidden', '403 forbidden',
  'bot detection', 'are you a robot', 'verify you are human',
];

function detectBlocking(content: string): { blocked: boolean; reason?: string } {
  const lower = content.toLowerCase();

  // Very short responses are suspicious
  if (content.length < 200 && content.length > 0) {
    for (const indicator of CAPTCHA_INDICATORS) {
      if (lower.includes(indicator)) {
        return { blocked: true, reason: `Blocked: detected "${indicator}" in response` };
      }
    }
  }

  // Check regardless of length for strong indicators
  if (lower.includes('cf-browser-verification') || lower.includes('challenge-platform')) {
    return { blocked: true, reason: 'Cloudflare challenge detected' };
  }
  if (lower.includes('recaptcha') && lower.includes('g-recaptcha')) {
    return { blocked: true, reason: 'reCAPTCHA detected' };
  }
  if (lower.includes('hcaptcha') && lower.includes('h-captcha')) {
    return { blocked: true, reason: 'hCaptcha detected' };
  }

  return { blocked: false };
}

export { detectBlocking };

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

  // Generate content hash for duplicate detection
  const contentHash = generateContentHash(seed);
  const duplicateOf = await checkDuplicate(contentHash, finding.id);
  if (duplicateOf) {
    logger.info('[MultiHopEnricher] Duplicate detected, marking finding', {
      findingId: finding.id,
      duplicateOf,
    });
  }

  logger.info('[MultiHopEnricher] Starting enrichment', {
    findingId: finding.id,
    entityName,
    depth,
    contentHash,
    isDuplicate: duplicateOf !== null,
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

  // ── Hop 1: Google Search (with retry) ─────────────────────────────────
  const googleResult = await runHop(
    finding,
    'google_search',
    () => withRetry(async () => {
      const adapter = new GoogleAdapter();
      return adapter.search(entityName, context);
    }, 'google_search'),
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

  // ── Hops 2+3: Website Scrape + Social Search (parallelized) ──────────
  // Website depends on Google (needs URL), but Social is independent.
  // For standard/deep, run them in parallel.
  const parallelHops: Array<Promise<{ name: string; result: AdapterResult }>> = [];

  if (context.existingWebsite) {
    parallelHops.push((async () => {
      try {
        const domain = new URL(context.existingWebsite ?? '').hostname;
        await rateLimiter.waitForSlot(domain);
      } catch {
        // Invalid URL or rate limit — continue anyway
      }

      const result = await runHop(
        finding,
        'website_scrape',
        () => withRetry(async () => {
          const adapter = new WebsiteAdapter();
          return adapter.search(entityName, context);
        }, 'website_scrape'),
      );
      return { name: 'website_scrape', result };
    })());
  }

  if (depth === 'standard' || depth === 'deep') {
    parallelHops.push((async () => {
      const result = await runHop(
        finding,
        'social_search',
        () => withRetry(async () => {
          const adapter = new SocialAdapter();
          return adapter.search(entityName, context);
        }, 'social_search'),
      );
      return { name: 'social_search', result };
    })());
  }

  // Wait for parallel hops to settle
  const parallelResults = await Promise.allSettled(parallelHops);
  for (const settled of parallelResults) {
    if (settled.status === 'fulfilled') {
      adapterResults.push(settled.value.result);

      // Update context from website scrape results
      if (settled.value.name === 'website_scrape') {
        if (settled.value.result.contacts.emails.length > 0 && !context.existingEmail) {
          context.existingEmail = settled.value.result.contacts.emails[0];
        }
      }
    }
  }

  // ── Hop 4: AI Re-Analysis (deep depth, with retry) ────────────────────
  if (depth === 'deep' && context.existingWebsite) {
    const websiteUrl = context.existingWebsite;
    const aiResult = await runHop(
      finding,
      'ai_reanalysis',
      () => withRetry(async () => {
        const result = createEmptyAdapterResult('ai_reanalysis');
        const start = Date.now();

        try {
          const content = await smartScrape(websiteUrl);

          // Check for CAPTCHA/blocking before processing
          const blockCheck = detectBlocking(content.cleanedText);
          if (blockCheck.blocked) {
            logger.warn('[MultiHopEnricher] Blocking detected during AI re-analysis', {
              reason: blockCheck.reason,
              url: websiteUrl,
            });
            result.status = 'failed';
            result.durationMs = Date.now() - start;
            return result;
          }

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
      }, 'ai_reanalysis', 1), // Only 1 retry for AI (expensive)
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

  // Extract field conflicts for resolution UI
  const enrichedFinding: DiscoveryFinding = {
    ...finding,
    enrichedData: merged.contactInfo,
    enrichmentSources: merged.enrichmentSources,
  };
  const fieldConflicts = extractFieldConflicts(merged.enrichmentSources, enrichedFinding);

  // Save enrichment results (including hash, duplicate marker, and conflicts)
  await updateFindingEnrichment(
    finding.id,
    merged.contactInfo,
    merged.enrichmentSources,
    merged.confidenceScores,
    merged.overallConfidence,
    enrichmentStatus,
    {
      contentHash,
      duplicateOf: duplicateOf ?? null,
      fieldConflicts: Object.keys(fieldConflicts).length > 0 ? fieldConflicts : undefined,
    },
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
