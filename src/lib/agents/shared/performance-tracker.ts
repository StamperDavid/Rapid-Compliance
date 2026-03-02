/**
 * Performance Tracker — Persistent Agent Execution Metrics
 *
 * Records every agent execution (customer-facing or swarm specialist)
 * into Firestore + MemoryVault for trend analysis, auto-flagging, and
 * dashboard display.
 *
 * STORAGE:
 * - Firestore: `organizations/rapid-compliance-root/agentPerformance`
 * - MemoryVault: PERFORMANCE category (fast agent-accessible state)
 *
 * TTL: 90-day retention with periodic cleanup.
 *
 * @module agents/shared/performance-tracker
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getMemoryVault } from './memory-vault';
import type { AgentReport } from '../types';
import type { ReviewResult } from '../base-manager';
import type {
  AgentPerformanceEntry,
  AgentPerformanceAggregation,
  AgentDomain,
} from '@/types/training';

// ============================================================================
// CONSTANTS
// ============================================================================

const PERFORMANCE_COLLECTION = 'agentPerformance';
const TTL_DAYS = 90;
const MS_PER_DAY = 86_400_000;

/**
 * Returns the Firestore collection path for agent performance entries.
 */
function getPerformanceCollectionPath(): string {
  return getSubCollection(PERFORMANCE_COLLECTION);
}

// ============================================================================
// CORE TRACKER
// ============================================================================

/**
 * Record a single agent execution into Firestore and MemoryVault.
 *
 * Called after every `delegateWithReview()` or customer-facing session completion.
 */
export async function recordExecution(
  report: AgentReport,
  review: ReviewResult,
  context: {
    agentType: 'swarm_specialist' | AgentDomain;
    responseTimeMs: number;
    retryCount: number;
    failureMode?: string;
  }
): Promise<AgentPerformanceEntry> {
  const entry: AgentPerformanceEntry = {
    id: `perf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    agentId: report.agentId,
    agentType: context.agentType,
    taskId: report.taskId,
    timestamp: new Date().toISOString(),
    qualityScore: review.qualityScore,
    approved: review.approved,
    retryCount: context.retryCount,
    responseTimeMs: context.responseTimeMs,
    reviewSeverity: review.severity,
    feedback: review.feedback,
    failureMode: context.failureMode,
    metadata: {
      reportStatus: report.status,
      hasErrors: (report.errors?.length ?? 0) > 0,
    },
  };

  // Dual-write: Firestore (async) + MemoryVault (sync)
  writeToMemoryVault(entry);
  await writeToFirestore(entry);

  return entry;
}

/**
 * Query Firestore for performance entries and compute an aggregation.
 */
export async function getAgentAggregation(
  agentId: string,
  period: string
): Promise<AgentPerformanceAggregation | null> {
  if (!adminDb) {
    logger.warn('[PerformanceTracker] adminDb not available — skipping aggregation');
    return null;
  }

  const cutoff = getCutoffForPeriod(period);
  const collectionPath = getPerformanceCollectionPath();

  const snapshot = await adminDb
    .collection(collectionPath)
    .where('agentId', '==', agentId)
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .get();

  if (snapshot.empty) {
    return null;
  }

  const entries = snapshot.docs.map(doc => doc.data() as AgentPerformanceEntry);
  return computeAggregation(agentId, entries, period);
}

/**
 * Compute trend across multiple periods using sliding window comparison.
 *
 * Returns aggregations for the requested number of periods (e.g., last 3 months)
 * with a trend direction computed by comparing the latest period to the earliest.
 */
export async function getAgentTrend(
  agentId: string,
  periodCount: number = 3,
  periodLengthDays: number = 30
): Promise<AgentPerformanceAggregation[]> {
  if (!adminDb) {
    logger.warn('[PerformanceTracker] adminDb not available — skipping trend');
    return [];
  }

  const now = Date.now();
  const collectionPath = getPerformanceCollectionPath();
  const aggregations: AgentPerformanceAggregation[] = [];

  for (let i = 0; i < periodCount; i++) {
    const periodEnd = new Date(now - i * periodLengthDays * MS_PER_DAY).toISOString();
    const periodStart = new Date(now - (i + 1) * periodLengthDays * MS_PER_DAY).toISOString();

    const snapshot = await adminDb
      .collection(collectionPath)
      .where('agentId', '==', agentId)
      .where('timestamp', '>=', periodStart)
      .where('timestamp', '<=', periodEnd)
      .orderBy('timestamp', 'desc')
      .get();

    if (!snapshot.empty) {
      const entries = snapshot.docs.map(doc => doc.data() as AgentPerformanceEntry);
      const periodLabel = `${periodStart.substring(0, 10)}_to_${periodEnd.substring(0, 10)}`;
      const agg = computeAggregation(agentId, entries, periodLabel);
      aggregations.push(agg);
    }
  }

  // Compute trend on the most recent aggregation by comparing to earliest
  if (aggregations.length >= 2) {
    const latest = aggregations[0];
    const earliest = aggregations[aggregations.length - 1];

    const scoreDiff = latest.averageQualityScore - earliest.averageQualityScore;
    if (scoreDiff > 3) {
      latest.qualityTrend = 'improving';
    } else if (scoreDiff < -3) {
      latest.qualityTrend = 'declining';
    } else {
      latest.qualityTrend = 'stable';
    }
  }

  return aggregations;
}

/**
 * Delete performance entries older than the TTL (90 days).
 *
 * Should be called periodically (e.g., via a scheduled job or admin action).
 */
export async function cleanupExpiredEntries(): Promise<number> {
  if (!adminDb) {
    return 0;
  }

  const cutoff = new Date(Date.now() - TTL_DAYS * MS_PER_DAY).toISOString();
  const collectionPath = getPerformanceCollectionPath();

  const snapshot = await adminDb
    .collection(collectionPath)
    .where('timestamp', '<', cutoff)
    .limit(500) // batch delete to avoid overwhelming Firestore
    .get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = adminDb.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  logger.info(`[PerformanceTracker] Cleaned up ${snapshot.size} expired entries`);
  return snapshot.size;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function writeToFirestore(entry: AgentPerformanceEntry): Promise<void> {
  if (!adminDb) {
    logger.warn('[PerformanceTracker] adminDb not available — skipping Firestore write');
    return;
  }

  try {
    const collectionPath = getPerformanceCollectionPath();
    await adminDb.collection(collectionPath).doc(entry.id).set(entry);
  } catch (error) {
    logger.error(
      '[PerformanceTracker] Firestore write failed',
      error instanceof Error ? error : new Error(String(error)),
      { entryId: entry.id }
    );
  }
}

function writeToMemoryVault(entry: AgentPerformanceEntry): void {
  try {
    const vault = getMemoryVault();
    vault.write(
      'PERFORMANCE',
      `perf_${entry.agentId}_${entry.id}`,
      {
        agentId: entry.agentId,
        agentType: entry.agentType,
        qualityScore: entry.qualityScore,
        approved: entry.approved,
        reviewSeverity: entry.reviewSeverity,
        timestamp: entry.timestamp,
      },
      entry.agentId,
      {
        priority: entry.reviewSeverity === 'BLOCK' ? 'HIGH' : 'MEDIUM',
        tags: ['performance', entry.agentType, entry.approved ? 'approved' : 'rejected'],
        ttlMs: TTL_DAYS * MS_PER_DAY,
      }
    );
  } catch (error) {
    logger.error(
      '[PerformanceTracker] MemoryVault write failed',
      error instanceof Error ? error : new Error(String(error)),
      { entryId: entry.id }
    );
  }
}

function computeAggregation(
  agentId: string,
  entries: AgentPerformanceEntry[],
  period: string
): AgentPerformanceAggregation {
  const totalExecutions = entries.length;
  const successCount = entries.filter(e => e.approved).length;
  const successRate = totalExecutions > 0 ? successCount / totalExecutions : 0;
  const averageQualityScore =
    totalExecutions > 0
      ? entries.reduce((sum, e) => sum + e.qualityScore, 0) / totalExecutions
      : 0;
  const retryEntries = entries.filter(e => e.retryCount > 0);
  const retryRate = totalExecutions > 0 ? retryEntries.length / totalExecutions : 0;

  // Compute common failure modes
  const failureCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.failureMode) {
      failureCounts.set(entry.failureMode, (failureCounts.get(entry.failureMode) ?? 0) + 1);
    }
  }
  const commonFailureModes = Array.from(failureCounts.entries())
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Default trend (needs cross-period comparison for real trend)
  const qualityTrend: AgentPerformanceAggregation['qualityTrend'] = 'stable';

  // Determine agent type from entries (all entries for same agentId should have same type)
  const agentType = entries[0]?.agentType ?? 'swarm_specialist';

  return {
    agentId,
    agentType,
    period,
    totalExecutions,
    successRate,
    averageQualityScore: Math.round(averageQualityScore * 10) / 10,
    retryRate: Math.round(retryRate * 1000) / 1000,
    commonFailureModes,
    qualityTrend,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Convert a human-readable period string to a cutoff ISO timestamp.
 */
function getCutoffForPeriod(period: string): string {
  const now = Date.now();

  switch (period) {
    case 'last_7_days':
      return new Date(now - 7 * MS_PER_DAY).toISOString();
    case 'last_30_days':
      return new Date(now - 30 * MS_PER_DAY).toISOString();
    case 'last_90_days':
      return new Date(now - 90 * MS_PER_DAY).toISOString();
    default:
      // If period looks like a number of days, parse it
      if (/^\d+$/.test(period)) {
        return new Date(now - parseInt(period, 10) * MS_PER_DAY).toISOString();
      }
      // Default to 30 days
      return new Date(now - 30 * MS_PER_DAY).toISOString();
  }
}
