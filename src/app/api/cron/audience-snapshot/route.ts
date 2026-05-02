/**
 * Audience Snapshot Cron Endpoint
 *
 * Daily snapshot of audience counts for every connected social account.
 * Powers the per-platform sparkline + "improvement since connecting" pill.
 *
 * Recommended schedule: once per day
 * Authentication: Bearer token via CRON_SECRET
 *
 * GET /api/cron/audience-snapshot
 *
 * Idempotent — running twice in the same day overwrites that day's
 * snapshot for each account so we always have the latest counts.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { AudienceBaselineService } from '@/lib/social/audience-baseline-service';
import { fetchAudienceCounts } from '@/lib/social/audience-counts-fetcher';
import { SocialAccountService } from '@/lib/social/social-account-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface SnapshotRecord {
  platform: string;
  accountId: string;
  followersCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request, '/api/cron/audience-snapshot');
    if (authError) { return authError; }

    logger.info('Starting audience snapshot collection', {
      route: '/api/cron/audience-snapshot',
    });

    const accounts = await SocialAccountService.listAccounts();
    const records: SnapshotRecord[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const account of accounts) {
      if (account.status !== 'active') {
        skipped++;
        continue;
      }

      try {
        const counts = await fetchAudienceCounts(account.platform);
        if (!counts) {
          // Coming-soon platform — fetcher returns null. Treat as skip.
          skipped++;
          continue;
        }

        // Capture baseline if missing — this only happens once per
        // account. Subsequent runs return the existing doc untouched.
        await AudienceBaselineService.captureBaseline(
          account.platform,
          account.id,
          counts,
          'backfill',
        );

        // Record today's snapshot.
        await AudienceBaselineService.recordSnapshot(account.platform, account.id, counts);

        records.push({
          platform: account.platform,
          accountId: account.id,
          followersCount: counts.followersCount,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${account.platform}/${account.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      snapshots: records.length,
      skipped,
      errors,
      records,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Audience snapshot cron error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/cron/audience-snapshot' });

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
