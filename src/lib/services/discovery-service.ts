/**
 * Discovery Service
 *
 * Orchestrates company discovery using existing enrichment services,
 * scores results against ICP profiles, and manages the review workflow.
 *
 * Uses AdminFirestoreService (server-side only).
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { scoreCompanyAgainstIcp, getIcpProfile } from './icp-profile-service';
import type {
  DiscoveryBatch,
  DiscoveryResult,
  DiscoverySearchCriteria,
  DiscoveryResultStatus,
} from '@/types/discovery-batch';
import type { EnrichmentData } from '@/types/crm-entities';

const BATCHES_COLLECTION = 'discovery-batches';
const RESULTS_COLLECTION = 'discovery-results';

function getBatchesPath(): string {
  return getSubCollection(BATCHES_COLLECTION);
}

function getResultsPath(): string {
  return getSubCollection(RESULTS_COLLECTION);
}

// ── Batch Management ────────────────────────────────────────────────────────

export async function startDiscoveryBatch(
  icpProfileId: string,
  searchCriteria: DiscoverySearchCriteria,
  userId: string
): Promise<DiscoveryBatch> {
  const profile = await getIcpProfile(icpProfileId);
  if (!profile) {
    throw new Error(`ICP profile not found: ${icpProfileId}`);
  }

  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  const batch: DiscoveryBatch = {
    id: batchId,
    icpProfileId,
    icpProfileName: profile.name,
    status: 'running',
    searchCriteria,
    totalFound: 0,
    totalScored: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalConverted: 0,
    startedAt: now,
    createdBy: userId,
  };

  await AdminFirestoreService.set(getBatchesPath(), batchId, batch as unknown as Record<string, unknown>, false);
  logger.info('Discovery batch started', { batchId, icpProfileId, keywords: searchCriteria.keywords });

  // Run discovery in background (fire-and-forget)
  void runDiscovery(batchId, profile, searchCriteria).catch(err => {
    logger.error('Discovery batch failed', err instanceof Error ? err : new Error(String(err)), { batchId });
  });

  return batch;
}

async function runDiscovery(
  batchId: string,
  profile: Awaited<ReturnType<typeof getIcpProfile>> & object,
  criteria: DiscoverySearchCriteria
): Promise<void> {
  try {
    const { searchCompany } = await import('@/lib/enrichment/search-service');
    const { enrichCompanies } = await import('@/lib/enrichment/enrichment-service');

    // Step 1: Gather search results from all keywords + company names
    const searchQueries: string[] = [
      ...criteria.keywords,
      ...(criteria.companyNames ?? []),
    ];

    const allSearchResults: Array<{ name: string; domain: string; website: string }> = [];
    const seenDomains = new Set<string>();

    for (const query of searchQueries) {
      try {
        const results = await searchCompany(query);
        for (const r of results) {
          if (!seenDomains.has(r.domain) && allSearchResults.length < criteria.maxResults) {
            seenDomains.add(r.domain);
            allSearchResults.push(r);
          }
        }
      } catch (err) {
        logger.warn('Search query failed, continuing', { query, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Add explicit domains
    for (const domain of criteria.domains ?? []) {
      if (!seenDomains.has(domain) && allSearchResults.length < criteria.maxResults) {
        seenDomains.add(domain);
        allSearchResults.push({ name: domain, domain, website: `https://${domain}` });
      }
    }

    // Update batch count
    await AdminFirestoreService.update(getBatchesPath(), batchId, {
      totalFound: allSearchResults.length,
    });

    // Step 2: Enrich companies (batch, max 5 concurrent)
    const enrichmentRequests = allSearchResults.map(r => ({
      companyName: r.name,
      domain: r.domain,
      website: r.website,
    }));

    const enrichmentResults = await enrichCompanies(enrichmentRequests, { maxConcurrent: 5 });

    // Step 3: Score each against ICP and save results
    let scoredCount = 0;

    for (let i = 0; i < enrichmentResults.length; i++) {
      const enrichResult = enrichmentResults[i];
      const searchResult = allSearchResults[i];

      if (!enrichResult.success || !enrichResult.data) {
        continue;
      }

      const companyData = enrichResult.data as unknown as EnrichmentData;
      // Ensure company name and domain are populated
      companyData.companyName ??= searchResult.name;
      companyData.domain ??= searchResult.domain;
      companyData.website ??= searchResult.website;

      const scoreResult = scoreCompanyAgainstIcp(companyData, profile);

      const resultId = `result-${batchId}-${Math.random().toString(36).slice(2, 9)}`;
      const discoveryResult: DiscoveryResult = {
        id: resultId,
        batchId,
        icpProfileId: profile.id,
        companyData,
        icpScore: scoreResult.totalScore,
        icpScoreBreakdown: scoreResult.breakdown,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await AdminFirestoreService.set(
        getResultsPath(),
        resultId,
        discoveryResult as unknown as Record<string, unknown>,
        false
      );
      scoredCount++;
    }

    // Step 4: Mark batch as completed
    await AdminFirestoreService.update(getBatchesPath(), batchId, {
      status: 'completed',
      totalScored: scoredCount,
      completedAt: new Date().toISOString(),
    });

    logger.info('Discovery batch completed', { batchId, found: allSearchResults.length, scored: scoredCount });
  } catch (error) {
    await AdminFirestoreService.update(getBatchesPath(), batchId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}

// ── Batch Queries ───────────────────────────────────────────────────────────

export async function getDiscoveryBatch(batchId: string): Promise<DiscoveryBatch | null> {
  const doc = await AdminFirestoreService.get(getBatchesPath(), batchId);
  return doc as DiscoveryBatch | null;
}

export async function listDiscoveryBatches(): Promise<DiscoveryBatch[]> {
  const { orderBy } = await import('firebase/firestore');
  const docs = await AdminFirestoreService.getAll(getBatchesPath(), [
    orderBy('startedAt', 'desc'),
  ]);
  return docs as unknown as DiscoveryBatch[];
}

// ── Result Queries ──────────────────────────────────────────────────────────

export interface DiscoveryResultFilters {
  status?: DiscoveryResultStatus;
  minIcpScore?: number;
  maxIcpScore?: number;
}

export async function getDiscoveryResults(
  batchId: string,
  filters?: DiscoveryResultFilters
): Promise<DiscoveryResult[]> {
  const { where, orderBy } = await import('firebase/firestore');
  const constraints = [
    where('batchId', '==', batchId),
    orderBy('icpScore', 'desc'),
  ];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  const docs = await AdminFirestoreService.getAll(getResultsPath(), constraints);
  let results = docs as unknown as DiscoveryResult[];

  // Client-side score filtering (Firestore doesn't support range + orderBy on different fields without composite index)
  if (filters?.minIcpScore !== undefined) {
    results = results.filter(r => r.icpScore >= (filters.minIcpScore ?? 0));
  }
  if (filters?.maxIcpScore !== undefined) {
    results = results.filter(r => r.icpScore <= (filters.maxIcpScore ?? 100));
  }

  return results;
}

// ── Review Actions ──────────────────────────────────────────────────────────

export async function approveResult(resultId: string, userId: string): Promise<void> {
  await AdminFirestoreService.update(getResultsPath(), resultId, {
    status: 'approved',
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
  });

  // Update batch counters
  const result = await AdminFirestoreService.get(getResultsPath(), resultId) as unknown as DiscoveryResult;
  if (result) {
    const batch = await getDiscoveryBatch(result.batchId);
    if (batch) {
      await AdminFirestoreService.update(getBatchesPath(), batch.id, {
        totalApproved: (batch.totalApproved ?? 0) + 1,
      });
    }
  }
}

export async function rejectResult(resultId: string, userId: string, notes?: string): Promise<void> {
  await AdminFirestoreService.update(getResultsPath(), resultId, {
    status: 'rejected',
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
    ...(notes && { rejectionNotes: notes }),
  });

  const result = await AdminFirestoreService.get(getResultsPath(), resultId) as unknown as DiscoveryResult;
  if (result) {
    const batch = await getDiscoveryBatch(result.batchId);
    if (batch) {
      await AdminFirestoreService.update(getBatchesPath(), batch.id, {
        totalRejected: (batch.totalRejected ?? 0) + 1,
      });
    }
  }
}

export async function convertToLead(resultId: string, userId: string): Promise<string> {
  const result = await AdminFirestoreService.get(getResultsPath(), resultId) as unknown as DiscoveryResult;
  if (!result) {throw new Error(`Discovery result not found: ${resultId}`);}
  if (result.status === 'converted') {throw new Error('Result already converted');}

  const { createLead } = await import('@/lib/crm/lead-service');

  const companyData = result.companyData;
  const lead = await createLead(
    {
      firstName: companyData.companyName ?? companyData.domain ?? 'Unknown',
      lastName: '',
      email: companyData.contactEmail ?? `info@${companyData.domain ?? 'unknown.com'}`,
      company: companyData.companyName,
      title: companyData.title,
      source: 'website-scraper',
      status: 'new',
      acquisitionMethod: 'scraped',
      icpScore: result.icpScore,
      icpProfileId: result.icpProfileId,
      discoveryBatchId: result.batchId,
      enrichmentData: companyData,
      approvedAt: new Date(),
      approvedBy: userId,
    },
    { autoEnrich: false } // Already enriched
  );

  // Mark result as converted
  await AdminFirestoreService.update(getResultsPath(), resultId, {
    status: 'converted',
    leadId: lead.id,
    convertedAt: new Date().toISOString(),
  });

  // Update batch counter
  const batch = await getDiscoveryBatch(result.batchId);
  if (batch) {
    await AdminFirestoreService.update(getBatchesPath(), batch.id, {
      totalConverted: (batch.totalConverted ?? 0) + 1,
    });
  }

  logger.info('Discovery result converted to lead', { resultId, leadId: lead.id });
  return lead.id;
}

// ── Bulk Operations ─────────────────────────────────────────────────────────

export async function bulkApprove(resultIds: string[], userId: string): Promise<number> {
  let count = 0;
  for (const id of resultIds) {
    try {
      await approveResult(id, userId);
      count++;
    } catch (err) {
      logger.warn('Bulk approve failed for result', { resultId: id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return count;
}

export async function bulkConvertToLeads(resultIds: string[], userId: string): Promise<{ converted: number; leadIds: string[] }> {
  const leadIds: string[] = [];
  for (const id of resultIds) {
    try {
      const leadId = await convertToLead(id, userId);
      leadIds.push(leadId);
    } catch (err) {
      logger.warn('Bulk convert failed for result', { resultId: id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { converted: leadIds.length, leadIds };
}
