/**
 * Verifies the BUDGET_STRATEGIST snapshot persistence layer.
 *
 *   1. Write a synthetic snapshot via persistBudgetSnapshot.
 *   2. Read it back via getLatestSnapshot — assert shape, content match.
 *   3. List snapshots — assert the new one is first.
 *   4. Clean up: delete the test snapshot from Firestore.
 *
 * No LLM calls. Validates schema only.
 *
 * Run: `npx tsx scripts/verify-budget-snapshot-service.ts`
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

const envPath = 'D:/Future Rapid Compliance/.env.local';
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) {
    const v = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sa = JSON.parse(
  fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'),
);
admin.initializeApp({ credential: admin.credential.cert(sa) });

(async () => {
  console.log('\n=== BUDGET_STRATEGIST snapshot persistence — live verification ===\n');

  const { persistBudgetSnapshot, getLatestSnapshot, listSnapshots } = await import(
    '../src/lib/marketing/budget-snapshot-service'
  );
  const { getMarketingBudgetSnapshotsCollection } = await import(
    '../src/lib/firebase/collections'
  );

  const TEST_USER_ID = '__verify_budget_snapshot__';
  let createdSnapshotId: string | null = null;

  try {
    // 1. Persist a synthetic snapshot
    const syntheticInputs = {
      action: 'analyze_budget' as const,
      totalBudgetUsd: 4000,
      windowDays: 14,
      platforms: [
        {
          platform: 'google_ads',
          displayName: 'Google Ads',
          currentSpendUsd: 1500,
          conversions: 18,
          conversionSource: 'crm' as const,
        },
      ],
    };
    const syntheticResult = {
      recommendations: [{
        platform: 'google_ads',
        displayName: 'Google Ads',
        currentSpendUsd: 1500,
        recommendedSpendUsd: 2000,
        deltaUsd: 500,
        actionType: 'increase' as const,
        rationale: 'Synthetic test rationale.',
        confidence: 'high' as const,
        requiresManualMissionTask: false,
      }],
      summaryRationale: 'Synthetic test summary.',
      insufficientData: false,
    };

    console.log('Writing synthetic snapshot…');
    createdSnapshotId = await persistBudgetSnapshot({
      inputs: syntheticInputs,
      result: syntheticResult,
      createdBy: 'operator',
      userId: TEST_USER_ID,
      modelUsed: 'claude-sonnet-4.6',
    });
    console.log(`  ✓ Persisted snapshot id=${createdSnapshotId}`);

    // 2. Read latest
    const latest = await getLatestSnapshot();
    if (!latest) {
      throw new Error('getLatestSnapshot returned null after a successful write');
    }
    if (latest.id !== createdSnapshotId) {
      throw new Error(`Latest snapshot id mismatch: expected ${createdSnapshotId}, got ${latest.id}`);
    }
    if (latest.inputs.totalBudgetUsd !== syntheticInputs.totalBudgetUsd) {
      throw new Error('Latest snapshot inputs mismatch');
    }
    if (latest.result.recommendations[0]?.platform !== 'google_ads') {
      throw new Error('Latest snapshot result mismatch');
    }
    console.log(`  ✓ Latest snapshot matches the one just written`);
    console.log(`  ✓ Round-trip OK (createdBy=${latest.createdBy}, model=${latest.modelUsed})`);

    // 3. List
    const list = await listSnapshots(5);
    if (list.length === 0) {
      throw new Error('listSnapshots returned empty after a successful write');
    }
    if (list[0]?.id !== createdSnapshotId) {
      throw new Error(`listSnapshots ordering wrong — first entry should be the latest write`);
    }
    console.log(`  ✓ listSnapshots returned ${list.length} snapshot(s), latest first`);

    console.log('\n=== Summary: 4/4 passed ===\n');
  } finally {
    // 4. Cleanup
    if (createdSnapshotId) {
      try {
        const path = getMarketingBudgetSnapshotsCollection();
        await admin.firestore().collection(path).doc(createdSnapshotId).delete();
        console.log(`(cleanup) Deleted test snapshot ${createdSnapshotId}`);
      } catch (cleanupErr) {
        console.error('(cleanup) Failed to delete test snapshot:', cleanupErr);
      }
    }
  }
  process.exit(0);
})().catch((err) => {
  console.error('Snapshot verification failed:', err);
  process.exit(1);
});
