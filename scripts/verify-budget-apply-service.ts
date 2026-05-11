/**
 * Verifies the BUDGET_STRATEGIST Apply pipeline end-to-end against Firestore.
 *
 *   1. Persist a synthetic snapshot containing one manual + one google_ads + one meta_ads recommendation.
 *   2. Call applyRecommendation for each:
 *        - manual platform → expect outcome=manual_mission_required + missionPrompt populated.
 *        - google_ads → expect outcome=not_configured (no creds wired yet).
 *        - meta_ads → expect outcome=not_configured (no creds wired yet).
 *   3. Cleanup: delete the test snapshot.
 *
 * No LLM calls. No real budget movement (the platforms aren't configured).
 *
 * Run: `npx tsx scripts/verify-budget-apply-service.ts`
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

interface AssertCtx {
  pass: number;
  fail: number;
  failures: string[];
}

function assert(ctx: AssertCtx, ok: boolean, label: string) {
  if (ok) { ctx.pass++; console.log(`  ✓ ${label}`); }
  else { ctx.fail++; console.log(`  ✗ ${label}`); ctx.failures.push(label); }
}

(async () => {
  console.log('\n=== BUDGET_STRATEGIST Apply pipeline — live verification ===\n');

  const ctx: AssertCtx = { pass: 0, fail: 0, failures: [] };
  let createdSnapshotId: string | null = null;

  try {
    const { persistBudgetSnapshot } = await import('../src/lib/marketing/budget-snapshot-service');
    const { applyRecommendation } = await import('../src/lib/marketing/budget-apply-service');
    const { getMarketingBudgetSnapshotsCollection } = await import('../src/lib/firebase/collections');

    // Build synthetic snapshot with 3 recommendations across 3 outcome paths.
    const syntheticInputs = {
      action: 'analyze_budget' as const,
      totalBudgetUsd: 3000,
      windowDays: 30,
      platforms: [
        { platform: 'google_ads', displayName: 'Google Ads', currentSpendUsd: 1000, conversions: 12, conversionSource: 'crm' as const },
        { platform: 'meta_ads', displayName: 'Meta Ads', currentSpendUsd: 800, conversions: 3, conversionSource: 'crm' as const },
        { platform: 'seo_retainer', displayName: 'SEO Retainer', currentSpendUsd: 600, conversions: 4, conversionSource: 'crm' as const, requiresManualBudgetChange: true },
      ],
    };
    const syntheticResult = {
      recommendations: [
        { platform: 'google_ads', displayName: 'Google Ads', currentSpendUsd: 1000, recommendedSpendUsd: 1400, deltaUsd: 400, actionType: 'increase' as const, rationale: 'Synthetic.', confidence: 'high' as const, requiresManualMissionTask: false },
        { platform: 'meta_ads', displayName: 'Meta Ads', currentSpendUsd: 800, recommendedSpendUsd: 500, deltaUsd: -300, actionType: 'decrease' as const, rationale: 'Synthetic.', confidence: 'high' as const, requiresManualMissionTask: false },
        { platform: 'seo_retainer', displayName: 'SEO Retainer', currentSpendUsd: 600, recommendedSpendUsd: 1100, deltaUsd: 500, actionType: 'increase' as const, rationale: 'Synthetic.', confidence: 'medium' as const, requiresManualMissionTask: true, manualMissionPrompt: 'Please increase the SEO retainer budget from $600 to $1,100 for the next 30-day window. Notify the agency and confirm.' },
      ],
      summaryRationale: 'Synthetic test summary.',
      insufficientData: false,
    };

    createdSnapshotId = await persistBudgetSnapshot({
      inputs: syntheticInputs,
      result: syntheticResult,
      createdBy: 'operator',
      userId: '__verify_apply_service__',
    });
    console.log(`Created snapshot ${createdSnapshotId}\n`);

    // Test 1: Manual platform (SEO retainer)
    console.log('Test 1: Manual platform (requiresManualMissionTask=true)');
    const manualResult = await applyRecommendation(syntheticResult.recommendations[2]!, { windowDays: 30 });
    assert(ctx, manualResult.outcome === 'manual_mission_required', 'outcome is manual_mission_required');
    assert(ctx, typeof manualResult.missionPrompt === 'string' && manualResult.missionPrompt.length > 20, 'missionPrompt is populated');
    assert(ctx, manualResult.summary.toLowerCase().includes('seo retainer') || manualResult.summary.toLowerCase().includes('doesn\'t have'), 'summary references the platform name or lack of API');

    // Test 2: Google Ads not configured
    console.log('\nTest 2: Google Ads (not configured)');
    const googleResult = await applyRecommendation(syntheticResult.recommendations[0]!, { windowDays: 30 });
    assert(ctx, googleResult.outcome === 'not_configured', `Google Ads outcome=not_configured (got ${googleResult.outcome})`);
    assert(ctx, googleResult.summary.toLowerCase().includes('not configured') || googleResult.summary.toLowerCase().includes('settings'), 'summary points operator to settings');

    // Test 3: Meta Ads not configured
    console.log('\nTest 3: Meta Ads (not configured)');
    const metaResult = await applyRecommendation(syntheticResult.recommendations[1]!, { windowDays: 30 });
    assert(ctx, metaResult.outcome === 'not_configured', `Meta Ads outcome=not_configured (got ${metaResult.outcome})`);

    // Test 4: Proportional distribution math
    console.log('\nTest 4: Proportional distribution math');
    const { windowSpendToDailyBudget } = await import('../src/lib/marketing/budget-apply-service');
    const daily = windowSpendToDailyBudget(900, 30);
    assert(ctx, Math.abs(daily - 30) < 0.01, `windowSpendToDailyBudget($900, 30d) ≈ $30 (got $${daily})`);
    const daily14 = windowSpendToDailyBudget(700, 14);
    assert(ctx, Math.abs(daily14 - 50) < 0.01, `windowSpendToDailyBudget($700, 14d) ≈ $50 (got $${daily14})`);
    const dailyZero = windowSpendToDailyBudget(100, 0);
    assert(ctx, dailyZero === 0, 'windowSpendToDailyBudget handles zero windowDays without dividing-by-zero');

    console.log(`\n=== Summary: ${ctx.pass} passed, ${ctx.fail} failed ===\n`);
    if (ctx.failures.length > 0) {
      console.log('Failures:');
      for (const f of ctx.failures) console.log(`  - ${f}`);
    }
  } finally {
    // Cleanup
    if (createdSnapshotId) {
      try {
        const { getMarketingBudgetSnapshotsCollection } = await import('../src/lib/firebase/collections');
        const path = getMarketingBudgetSnapshotsCollection();
        await admin.firestore().collection(path).doc(createdSnapshotId).delete();
        console.log(`(cleanup) Deleted test snapshot ${createdSnapshotId}`);
      } catch (cleanupErr) {
        console.error('(cleanup) Failed to delete test snapshot:', cleanupErr);
      }
    }
  }
  process.exit(ctx.fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Apply verification crashed:', err);
  process.exit(2);
});
