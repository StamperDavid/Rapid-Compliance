/**
 * Cost Tracker — Creative Studio Generation Cost Logging
 *
 * Logs every generation to Firestore for spend tracking and analytics.
 * Provides summary aggregation by provider, type, campaign, and date range.
 *
 * Firestore path: organizations/{PLATFORM_ID}/studio-cost-log/{entryId}
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type {
  CostEntry,
  CostSummary,
  StudioProvider,
  GenerationType,
} from '@/types/creative-studio';

// ─── Collection Path ─────────────────────────────────────────────────

const COST_COLLECTION = getSubCollection('studio-cost-log');

// ─── Log Generation Cost ─────────────────────────────────────────────

/**
 * Log a generation cost entry to Firestore.
 * Called after every successful generation to track spend.
 *
 * @param entry - Cost entry data (without id and createdAt, which are auto-generated)
 * @returns The Firestore document ID of the created entry
 */
export async function logGenerationCost(
  entry: Omit<CostEntry, 'id' | 'createdAt'>
): Promise<string> {
  if (!adminDb) {
    logger.warn('[CostTracker] adminDb not available, skipping cost log', {
      generationId: entry.generationId,
      file: 'cost-tracker.ts',
    });
    return '';
  }

  const docRef = adminDb.collection(COST_COLLECTION).doc();

  // Filter out undefined values to prevent Firestore errors
  const cleanEntry: Record<string, unknown> = { id: docRef.id, createdAt: new Date().toISOString() };
  for (const [key, val] of Object.entries(entry)) {
    if (val !== undefined) {
      cleanEntry[key] = val;
    }
  }
  const costEntry = cleanEntry as unknown as CostEntry;

  try {
    await docRef.set(costEntry);

    logger.info('[CostTracker] Logged generation cost', {
      entryId: docRef.id,
      generationId: entry.generationId,
      provider: entry.provider,
      cost: entry.cost,
      file: 'cost-tracker.ts',
    });

    return docRef.id;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[CostTracker] Failed to log generation cost', error, {
      generationId: entry.generationId,
      provider: entry.provider,
      file: 'cost-tracker.ts',
    });
    throw error;
  }
}

// ─── Get Cost Summary ────────────────────────────────────────────────

/**
 * Build an aggregated cost summary for the given filters.
 * Sums total cost and breaks down by provider, type, and campaign.
 *
 * @param options - Optional date range, provider, and type filters
 * @returns CostSummary with aggregated totals
 */
export async function getCostSummary(options?: {
  start?: string;
  end?: string;
  provider?: StudioProvider;
  type?: GenerationType;
}): Promise<CostSummary> {
  const startDate = options?.start
    ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = options?.end ?? new Date().toISOString();

  if (!adminDb) {
    logger.warn('[CostTracker] adminDb not available, returning empty summary', {
      file: 'cost-tracker.ts',
    });
    return {
      totalCost: 0,
      byProvider: {},
      byType: {},
      byCampaign: {},
      generationCount: 0,
      period: { start: startDate, end: endDate },
    };
  }

  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection(COST_COLLECTION)
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate);

    if (options?.provider) {
      query = query.where('provider', '==', options.provider);
    }

    if (options?.type) {
      query = query.where('type', '==', options.type);
    }

    const snapshot = await query.get();

    let totalCost = 0;
    const byProvider: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byCampaign: Record<string, number> = {};

    for (const doc of snapshot.docs) {
      const entry = doc.data() as CostEntry;
      totalCost += entry.cost;
      byProvider[entry.provider] = (byProvider[entry.provider] ?? 0) + entry.cost;
      byType[entry.type] = (byType[entry.type] ?? 0) + entry.cost;
      if (entry.campaignId) {
        byCampaign[entry.campaignId] = (byCampaign[entry.campaignId] ?? 0) + entry.cost;
      }
    }

    // Round to 4 decimal places to avoid floating point drift
    const roundedTotal = Math.round(totalCost * 10000) / 10000;
    const roundedByProvider: Record<string, number> = {};
    for (const [key, val] of Object.entries(byProvider)) {
      roundedByProvider[key] = Math.round(val * 10000) / 10000;
    }
    const roundedByType: Record<string, number> = {};
    for (const [key, val] of Object.entries(byType)) {
      roundedByType[key] = Math.round(val * 10000) / 10000;
    }
    const roundedByCampaign: Record<string, number> = {};
    for (const [key, val] of Object.entries(byCampaign)) {
      roundedByCampaign[key] = Math.round(val * 10000) / 10000;
    }

    logger.info('[CostTracker] Cost summary generated', {
      totalCost: roundedTotal,
      generationCount: snapshot.size,
      providerCount: Object.keys(roundedByProvider).length,
      file: 'cost-tracker.ts',
    });

    return {
      totalCost: roundedTotal,
      byProvider: roundedByProvider,
      byType: roundedByType,
      byCampaign: roundedByCampaign,
      generationCount: snapshot.size,
      period: { start: startDate, end: endDate },
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[CostTracker] Failed to build cost summary', error, {
      file: 'cost-tracker.ts',
    });
    throw error;
  }
}

// ─── Get Recent Costs ────────────────────────────────────────────────

/**
 * Returns the most recent N cost entries, ordered by creation time descending.
 *
 * @param limit - Maximum number of entries to return (default: 50)
 * @returns Array of CostEntry documents
 */
export async function getRecentCosts(limit: number = 50): Promise<CostEntry[]> {
  if (!adminDb) {
    logger.warn('[CostTracker] adminDb not available, returning empty list', {
      file: 'cost-tracker.ts',
    });
    return [];
  }

  try {
    const snapshot = await adminDb
      .collection(COST_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const entries: CostEntry[] = [];
    for (const doc of snapshot.docs) {
      entries.push(doc.data() as CostEntry);
    }

    logger.info('[CostTracker] Fetched recent costs', {
      count: entries.length,
      limit,
      file: 'cost-tracker.ts',
    });

    return entries;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[CostTracker] Failed to fetch recent costs', error, {
      file: 'cost-tracker.ts',
    });
    throw error;
  }
}
