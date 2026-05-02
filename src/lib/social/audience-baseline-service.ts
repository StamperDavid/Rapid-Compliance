/**
 * Audience Baseline Service
 *
 * Tracks each connected social account's audience metrics from the moment it
 * was connected to SalesVelocity, plus a daily snapshot history powering the
 * per-platform sparkline + "improvement since connecting" pill.
 *
 * Data model:
 *   organizations/{PLATFORM_ID}/audience_baselines/{platform}_{accountId}
 *     - capturedAt:       ISO when the baseline was taken
 *     - followersCount:   audience size at connect time
 *     - followingCount:   accounts the brand follows at connect time
 *     - postsCount:       total posts on the platform at connect time
 *     - source:           "oauth_connect" | "backfill" | "manual"
 *
 *   organizations/{PLATFORM_ID}/audience_snapshots/{platform}_{accountId}_{yyyy-mm-dd}
 *     - same numeric fields, plus:
 *     - capturedAt:       ISO timestamp
 *     - dayKey:           yyyy-mm-dd (used as natural primary key)
 *
 * Read-only at runtime (no GM mutation, Standing Rule #2 compliant). Writes
 * happen at OAuth connect time, on the daily-snapshot cron, and from the
 * one-time backfill script.
 */

import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type { SocialPlatform } from '@/types/social';

const BASELINES_COLLECTION = 'audience_baselines';
const SNAPSHOTS_COLLECTION = 'audience_snapshots';
const FILE = 'social/audience-baseline-service.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface AudienceCounts {
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

export interface AudienceBaseline extends AudienceCounts {
  id: string;
  platform: SocialPlatform;
  accountId: string;
  capturedAt: string;
  source: 'oauth_connect' | 'backfill' | 'manual';
}

export interface AudienceSnapshot extends AudienceCounts {
  id: string;
  platform: SocialPlatform;
  accountId: string;
  dayKey: string;
  capturedAt: string;
}

export interface AudienceImprovement {
  followers: { absolute: number; percentage: number };
  following: { absolute: number; percentage: number };
  posts: { absolute: number; percentage: number };
  daysSinceBaseline: number;
}

export interface AudienceTrajectory {
  baseline: AudienceBaseline | null;
  current: AudienceCounts | null;
  improvement: AudienceImprovement | null;
  history: AudienceSnapshot[];
}

// ============================================================================
// PATHS
// ============================================================================

function baselinesPath(): string {
  return getSubCollection(BASELINES_COLLECTION);
}

function snapshotsPath(): string {
  return getSubCollection(SNAPSHOTS_COLLECTION);
}

function baselineDocId(platform: SocialPlatform, accountId: string): string {
  return `${platform}_${accountId}`;
}

function snapshotDocId(platform: SocialPlatform, accountId: string, dayKey: string): string {
  return `${platform}_${accountId}_${dayKey}`;
}

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDb() {
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized — AudienceBaselineService requires server-side execution');
  }
  return adminDb;
}

function safePercentage(curr: number, base: number): number {
  if (base <= 0) {
    return curr > 0 ? 100 : 0;
  }
  return Math.round(((curr - base) / base) * 1000) / 10;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) { return 0; }
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// ============================================================================
// PUBLIC SERVICE
// ============================================================================

export class AudienceBaselineService {
  /**
   * Capture a fresh baseline for an account. If a baseline already exists
   * for this (platform, accountId), it is left untouched — baselines are
   * write-once. Use `recordSnapshot` for ongoing updates.
   *
   * Returns the existing or newly-created baseline.
   */
  static async captureBaseline(
    platform: SocialPlatform,
    accountId: string,
    counts: AudienceCounts,
    source: AudienceBaseline['source'] = 'oauth_connect',
  ): Promise<AudienceBaseline> {
    const id = baselineDocId(platform, accountId);
    const ref = getDb().collection(baselinesPath()).doc(id);
    const existing = await ref.get();

    if (existing.exists) {
      const data = existing.data() as AudienceBaseline;
      logger.info('AudienceBaselineService: baseline already exists, preserving', {
        platform,
        accountId,
        capturedAt: data.capturedAt,
        file: FILE,
      });
      return data;
    }

    const now = new Date().toISOString();
    const baseline: AudienceBaseline = {
      id,
      platform,
      accountId,
      capturedAt: now,
      source,
      ...counts,
    };

    await ref.set(baseline);

    // Also record today's snapshot so the trajectory has at least one
    // datapoint to graph on day zero.
    await AudienceBaselineService.recordSnapshot(platform, accountId, counts);

    logger.info('AudienceBaselineService: baseline captured', {
      platform,
      accountId,
      followers: counts.followersCount,
      source,
      file: FILE,
    });

    return baseline;
  }

  /**
   * Read the baseline for an account, or null when none exists yet.
   */
  static async getBaseline(
    platform: SocialPlatform,
    accountId: string,
  ): Promise<AudienceBaseline | null> {
    const id = baselineDocId(platform, accountId);
    const snap = await getDb().collection(baselinesPath()).doc(id).get();
    if (!snap.exists) { return null; }
    return snap.data() as AudienceBaseline;
  }

  /**
   * Record today's audience snapshot. Idempotent on (platform, accountId, day) —
   * calling twice in the same day overwrites the prior write so we always
   * have the latest values for that day.
   */
  static async recordSnapshot(
    platform: SocialPlatform,
    accountId: string,
    counts: AudienceCounts,
  ): Promise<AudienceSnapshot> {
    const dayKey = todayKey();
    const id = snapshotDocId(platform, accountId, dayKey);
    const snapshot: AudienceSnapshot = {
      id,
      platform,
      accountId,
      dayKey,
      capturedAt: new Date().toISOString(),
      ...counts,
    };

    await getDb().collection(snapshotsPath()).doc(id).set(snapshot);

    return snapshot;
  }

  /**
   * Return the most recent N days of snapshots for an account, sorted ASC
   * by dayKey. Used by the sparkline UI.
   *
   * Defensive query pattern: single-field `where` + in-JS filter/sort.
   * The 3-condition where + orderBy combo would require a Firestore
   * composite index that isn't deployed (same constraint as
   * `metrics-service.ts`). Snapshots per (platform, accountId) are at
   * most ~365/year, so the in-process filter is trivial.
   */
  static async getSnapshotHistory(
    platform: SocialPlatform,
    accountId: string,
    days: number,
  ): Promise<AudienceSnapshot[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - Math.max(0, days - 1));
    const yyyy = since.getFullYear();
    const mm = String(since.getMonth() + 1).padStart(2, '0');
    const dd = String(since.getDate()).padStart(2, '0');
    const sinceKey = `${yyyy}-${mm}-${dd}`;

    const snap = await getDb()
      .collection(snapshotsPath())
      .where('platform', '==', platform)
      .get();

    const all = snap.docs
      .map((d) => d.data() as AudienceSnapshot)
      .filter((s) => s.accountId === accountId && s.dayKey >= sinceKey);

    all.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    return all;
  }

  /**
   * Compute the delta between a baseline and current counts. Returns null
   * when no baseline exists yet (caller should treat this as "not enough
   * data to display improvement").
   */
  static computeImprovement(
    baseline: AudienceBaseline,
    current: AudienceCounts,
  ): AudienceImprovement {
    return {
      followers: {
        absolute: current.followersCount - baseline.followersCount,
        percentage: safePercentage(current.followersCount, baseline.followersCount),
      },
      following: {
        absolute: current.followingCount - baseline.followingCount,
        percentage: safePercentage(current.followingCount, baseline.followingCount),
      },
      posts: {
        absolute: current.postsCount - baseline.postsCount,
        percentage: safePercentage(current.postsCount, baseline.postsCount),
      },
      daysSinceBaseline: daysBetween(baseline.capturedAt, new Date().toISOString()),
    };
  }

  /**
   * Convenience: load baseline + history + computed improvement in one
   * call. Used by the per-platform metrics endpoint.
   */
  static async getTrajectory(
    platform: SocialPlatform,
    accountId: string,
    historyDays: number,
    current: AudienceCounts | null,
  ): Promise<AudienceTrajectory> {
    const [baseline, history] = await Promise.all([
      AudienceBaselineService.getBaseline(platform, accountId),
      AudienceBaselineService.getSnapshotHistory(platform, accountId, historyDays),
    ]);

    const improvement = baseline && current
      ? AudienceBaselineService.computeImprovement(baseline, current)
      : null;

    return { baseline, current, improvement, history };
  }
}
