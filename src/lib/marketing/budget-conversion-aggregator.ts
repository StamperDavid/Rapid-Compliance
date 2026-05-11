/**
 * Budget conversion aggregator
 *
 * Reads leads created within a given window and aggregates conversion
 * counts per platform key. Output feeds the BUDGET_STRATEGIST analyze
 * pipeline so the operator doesn't have to type per-platform conversions
 * by hand — the data flows from the same CRM source field that public
 * forms populate via UTM capture (see src/lib/utm-tracking.ts).
 *
 * Source-string normalization mirrors the convention used by the
 * /api/public/{early-access,contact,forms/[formId]} routes:
 *   "google_ads/cpc" -> "google_ads"
 *   "meta_ads"       -> "meta_ads"
 *   "early_access_signup" / "contact_form" / "form" / "direct" -> 'direct'
 *
 * Server-only — uses Admin SDK per feedback_server_routes_must_use_admin_sdk.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

const FILE = 'marketing/budget-conversion-aggregator.ts';

/**
 * Sources we treat as non-platform attribution (no ad-channel signal).
 * Bucket together as `direct`.
 */
const DIRECT_SOURCES = new Set([
  'direct',
  'form',
  'early_access_signup',
  'contact_form',
  'manual',
  'import',
]);

export interface PlatformConversionCount {
  /** Normalized platform key — matches what BUDGET_STRATEGIST expects in its input. */
  platform: string;
  /** Number of leads created in the window with this normalized source. */
  count: number;
  /** Raw source strings that rolled up into this platform — useful for the operator to spot-check attribution. */
  rawSources: string[];
}

export interface ConversionAggregation {
  windowDays: number;
  windowStartIso: string;
  windowEndIso: string;
  totalLeadsInWindow: number;
  leadsWithSource: number;
  /** Per-platform conversion counts. */
  byPlatform: PlatformConversionCount[];
}

/**
 * Normalize a raw `source` string to a platform key. Lowercases, strips
 * the medium suffix (everything after the first `/`), and buckets known
 * non-platform sources as `direct`.
 */
export function normalizeSourceToPlatform(rawSource: string | undefined | null): string {
  if (!rawSource || typeof rawSource !== 'string') {return 'direct';}
  const trimmed = rawSource.trim().toLowerCase();
  if (trimmed.length === 0) {return 'direct';}
  const base = trimmed.split('/')[0]?.trim() ?? trimmed;
  if (DIRECT_SOURCES.has(base)) {return 'direct';}
  return base;
}

interface LeadDocShape {
  source?: string;
  createdAt?: { toDate?: () => Date } | Date | string | number;
}

function coerceCreatedAt(value: LeadDocShape['createdAt']): Date | null {
  if (!value) {return null;}
  if (value instanceof Date) {return value;}
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    try { return value.toDate(); } catch { return null; }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Aggregate leads in the trailing `windowDays` window by normalized platform.
 *
 * @param windowDays Number of days of history to include (1-365).
 */
export async function aggregateConversionsByPlatform(
  windowDays: number,
): Promise<ConversionAggregation> {
  if (!Number.isFinite(windowDays) || windowDays <= 0 || windowDays > 365) {
    throw new Error(`aggregateConversionsByPlatform: windowDays must be 1-365, got ${windowDays}`);
  }
  if (!adminDb) {
    throw new Error('Firebase Admin SDK not initialized');
  }

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const leadsPath = getSubCollection('leads');
  const snap = await adminDb
    .collection(leadsPath)
    .where('createdAt', '>=', windowStart)
    .where('createdAt', '<=', windowEnd)
    .get();

  // Group by normalized platform. Preserve raw source strings so the operator
  // can spot-check attribution.
  const counts = new Map<string, { count: number; rawSources: Set<string> }>();
  let leadsWithSource = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as LeadDocShape;
    const created = coerceCreatedAt(data.createdAt);
    if (!created || created < windowStart || created > windowEnd) {continue;}

    const platform = normalizeSourceToPlatform(data.source);
    if (data.source && typeof data.source === 'string' && data.source.trim().length > 0) {
      leadsWithSource++;
    }

    const entry = counts.get(platform) ?? { count: 0, rawSources: new Set<string>() };
    entry.count++;
    if (data.source && typeof data.source === 'string') {entry.rawSources.add(data.source);}
    counts.set(platform, entry);
  }

  const byPlatform: PlatformConversionCount[] = Array.from(counts.entries())
    .map(([platform, { count, rawSources }]) => ({
      platform,
      count,
      rawSources: Array.from(rawSources),
    }))
    .sort((a, b) => b.count - a.count);

  logger.info('[BudgetAggregator] Conversions aggregated', {
    file: FILE,
    windowDays,
    totalLeads: snap.size,
    leadsWithSource,
    platformsRepresented: byPlatform.length,
  });

  return {
    windowDays,
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
    totalLeadsInWindow: snap.size,
    leadsWithSource,
    byPlatform,
  };
}
