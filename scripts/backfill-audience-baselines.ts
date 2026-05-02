/**
 * Backfill Audience Baselines
 *
 * One-shot: for every currently-connected social account, fetch the live
 * audience counts and write a baseline doc with `source: 'backfill'` so
 * the per-platform improvement metric has a starting point.
 *
 * Idempotent — re-running preserves existing baselines and overwrites
 * today's snapshot with the latest counts.
 *
 * Usage:
 *   npx tsx scripts/backfill-audience-baselines.ts
 */

/* eslint-disable no-console */

process.stdout.write('[backfill] starting\n');

async function main(): Promise<void> {
  const { adminDb } = await import('../src/lib/firebase/admin');
  if (!adminDb) {
    console.error('[backfill] Firebase Admin not initialized');
    process.exit(1);
  }
  console.log('[backfill] firebase admin ready');

  const accountsSnap = await adminDb
    .collection('organizations/rapid-compliance-root/social_accounts')
    .get();

  console.log(`[backfill] found ${accountsSnap.size} account doc(s)`);

  if (accountsSnap.empty) {
    console.log('[backfill] No social accounts connected — nothing to backfill.');
    return;
  }

  const { fetchAudienceCounts } = await import('../src/lib/social/audience-counts-fetcher');
  const { AudienceBaselineService } = await import('../src/lib/social/audience-baseline-service');

  let captured = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of accountsSnap.docs) {
    const account = doc.data() as {
      platform: string;
      status: string;
      handle?: string;
      accountName?: string;
    };
    const accountId = doc.id;
    const tag = `${account.platform}/${accountId}`;

    if (account.status !== 'active') {
      console.log(`[backfill] skip   ${tag} — status=${account.status}`);
      skipped++;
      continue;
    }

    try {
      console.log(`[backfill] fetch  ${tag} ...`);
      const counts = await fetchAudienceCounts(
        account.platform as Parameters<typeof fetchAudienceCounts>[0],
      );
      if (!counts) {
        console.log(`[backfill] skip   ${tag} — fetcher returned null (platform not yet supported)`);
        skipped++;
        continue;
      }

      await AudienceBaselineService.captureBaseline(
        account.platform as Parameters<typeof AudienceBaselineService.captureBaseline>[0],
        accountId,
        counts,
        'backfill',
      );

      console.log(`[backfill] OK     ${tag} — followers=${counts.followersCount}`);
      captured++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[backfill] FAIL   ${tag} — ${msg}`);
      failed++;
    }
  }

  console.log(`\n[backfill] Done. captured=${captured} skipped=${skipped} failed=${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfill] fatal:', err);
    process.exit(1);
  });
