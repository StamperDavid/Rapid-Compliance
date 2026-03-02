/**
 * Specialist Metrics Service
 *
 * Queries and aggregates performance data for swarm specialists.
 * Uses the AgentPerformanceEntry records written by performance-tracker.ts.
 *
 * Provides:
 * - Per-specialist aggregation (success rate, avg quality, retry rate, trends)
 * - Cross-specialist comparison and low-performer identification
 * - Sliding window trend analysis
 *
 * @module agents/shared/specialist-metrics
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { AgentPerformanceEntry, AgentPerformanceAggregation } from '@/types/training';

// ============================================================================
// CONSTANTS
// ============================================================================

const PERFORMANCE_COLLECTION = 'agentPerformance';
const MS_PER_DAY = 86_400_000;

function getPerformanceCollectionPath(): string {
  return getSubCollection(PERFORMANCE_COLLECTION);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get aggregated performance metrics for a single specialist.
 */
export async function getSpecialistMetrics(
  specialistId: string,
  periodDays: number = 30
): Promise<AgentPerformanceAggregation | null> {
  if (!adminDb) { return null; }

  const cutoff = new Date(Date.now() - periodDays * MS_PER_DAY).toISOString();

  const snap = await adminDb
    .collection(getPerformanceCollectionPath())
    .where('agentId', '==', specialistId)
    .where('agentType', '==', 'swarm_specialist')
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .get();

  if (snap.empty) { return null; }

  const entries = snap.docs.map(doc => doc.data() as AgentPerformanceEntry);
  return aggregateEntries(specialistId, entries, periodDays);
}

/**
 * Get aggregated metrics for all swarm specialists.
 */
export async function getAllSpecialistMetrics(
  periodDays: number = 30
): Promise<AgentPerformanceAggregation[]> {
  if (!adminDb) { return []; }

  const cutoff = new Date(Date.now() - periodDays * MS_PER_DAY).toISOString();

  const snap = await adminDb
    .collection(getPerformanceCollectionPath())
    .where('agentType', '==', 'swarm_specialist')
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .get();

  if (snap.empty) { return []; }

  const entries = snap.docs.map(doc => doc.data() as AgentPerformanceEntry);

  // Group by agentId
  const grouped = new Map<string, AgentPerformanceEntry[]>();
  for (const entry of entries) {
    const existing = grouped.get(entry.agentId) ?? [];
    existing.push(entry);
    grouped.set(entry.agentId, existing);
  }

  // Aggregate each specialist
  const results: AgentPerformanceAggregation[] = [];
  for (const [agentId, agentEntries] of grouped) {
    results.push(aggregateEntries(agentId, agentEntries, periodDays));
  }

  // Sort by average quality score ascending (worst performers first)
  results.sort((a, b) => a.averageQualityScore - b.averageQualityScore);

  return results;
}

/**
 * Identify specialists that are consistently performing below a quality threshold.
 */
export async function identifyLowPerformers(
  periodDays: number = 30,
  qualityThreshold: number = 70,
  minExecutions: number = 3
): Promise<AgentPerformanceAggregation[]> {
  const allMetrics = await getAllSpecialistMetrics(periodDays);

  const lowPerformers = allMetrics.filter(
    m => m.averageQualityScore < qualityThreshold && m.totalExecutions >= minExecutions
  );

  logger.info(`[SpecialistMetrics] Identified ${lowPerformers.length} low performers (threshold: ${qualityThreshold}, minExec: ${minExecutions})`);

  return lowPerformers;
}

/**
 * Get performance history entries for a specific specialist.
 */
export async function getSpecialistHistory(
  specialistId: string,
  limit: number = 50
): Promise<AgentPerformanceEntry[]> {
  if (!adminDb) { return []; }

  const snap = await adminDb
    .collection(getPerformanceCollectionPath())
    .where('agentId', '==', specialistId)
    .where('agentType', '==', 'swarm_specialist')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => doc.data() as AgentPerformanceEntry);
}

// ============================================================================
// INTERNAL
// ============================================================================

/**
 * Aggregate a set of performance entries into a summary.
 */
function aggregateEntries(
  agentId: string,
  entries: AgentPerformanceEntry[],
  periodDays: number
): AgentPerformanceAggregation {
  const total = entries.length;
  const approved = entries.filter(e => e.approved).length;
  const retried = entries.filter(e => e.retryCount > 0).length;
  const avgQuality = total > 0
    ? entries.reduce((sum, e) => sum + e.qualityScore, 0) / total
    : 0;

  // Count failure modes
  const failureCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.failureMode) {
      failureCounts.set(entry.failureMode, (failureCounts.get(entry.failureMode) ?? 0) + 1);
    }
  }

  const commonFailureModes = Array.from(failureCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([mode, count]) => ({ mode, count }));

  // Trend: compare first half to second half
  const midpoint = Math.floor(total / 2);
  const qualityTrend = computeTrend(entries, midpoint);

  return {
    agentId,
    agentType: 'swarm_specialist',
    period: `last_${periodDays}_days`,
    totalExecutions: total,
    successRate: total > 0 ? approved / total : 0,
    averageQualityScore: Math.round(avgQuality * 100) / 100,
    retryRate: total > 0 ? retried / total : 0,
    commonFailureModes,
    qualityTrend,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Compute quality trend by comparing first half vs second half of entries.
 * Entries are expected in descending timestamp order (most recent first).
 */
function computeTrend(
  entries: AgentPerformanceEntry[],
  midpoint: number
): 'improving' | 'declining' | 'stable' {
  if (entries.length < 4) { return 'stable'; }

  // Recent entries (first half) vs older entries (second half)
  const recentAvg = entries
    .slice(0, midpoint)
    .reduce((sum, e) => sum + e.qualityScore, 0) / midpoint;

  const olderAvg = entries
    .slice(midpoint)
    .reduce((sum, e) => sum + e.qualityScore, 0) / (entries.length - midpoint);

  const delta = recentAvg - olderAvg;

  if (delta > 5) { return 'improving'; }
  if (delta < -5) { return 'declining'; }
  return 'stable';
}
