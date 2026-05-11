/**
 * Live LLM smoke test for BUDGET_STRATEGIST.
 *
 * The May 8 load verifier proves the wiring; this script proves the agent
 * actually produces valid output from a real OpenRouter call. First live
 * exercise of the agent end-to-end.
 *
 *   1. Loads .env.local + initializes Firebase Admin (needed to read the GM).
 *   2. Synthesizes a realistic 4-platform snapshot (Google Ads, Meta Ads,
 *      Google LSA, SEO retainer) — same shape the dashboard widget will send.
 *   3. Calls `runBudgetStrategist()`, which loads the Brand-DNA-baked GM,
 *      sends it to OpenRouter, validates math + Zod schema.
 *   4. Asserts: response shape valid, allocations sum to total budget,
 *      every recommendation has a non-trivial rationale, manual-platform
 *      flag carries through.
 *
 * Cost: ~$0.05-0.20 in OpenRouter credits depending on model + token usage.
 *
 * Run: `npx tsx scripts/verify-budget-strategist-live.ts`
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

// Load env vars + initialize Firebase Admin before importing anything
// that touches Firestore (same boot pattern the May 8 verifiers use).
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

function assert(ctx: AssertCtx, ok: boolean, label: string, detail?: string) {
  if (ok) {
    ctx.pass++;
    console.log(`  ✓ ${label}`);
  } else {
    ctx.fail++;
    const msg = detail ? `${label} — ${detail}` : label;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    ctx.failures.push(msg);
  }
}

(async () => {
  console.log('\n=== BUDGET_STRATEGIST live LLM smoke test ===\n');
  console.log('This burns real OpenRouter credits (~$0.05-0.20).');
  console.log('First time the agent has been run live since May 8 ship.\n');

  const ctx: AssertCtx = { pass: 0, fail: 0, failures: [] };

  const { runBudgetStrategist } = await import(
    '../src/lib/agents/marketing/budget/specialist'
  );

  // Realistic snapshot — 30-day window, $5k total budget,
  // mixed conversion profile to exercise increase/decrease/hold/pause logic.
  const req = {
    action: 'analyze_budget' as const,
    totalBudgetUsd: 5000,
    windowDays: 30,
    platforms: [
      {
        platform: 'google_ads',
        displayName: 'Google Ads',
        currentSpendUsd: 1800,
        conversions: 22,
        conversionSource: 'crm' as const,
        platformReportedConversions: 28,
        requiresManualBudgetChange: false,
      },
      {
        platform: 'meta_ads',
        displayName: 'Meta Ads',
        currentSpendUsd: 1500,
        conversions: 4,
        conversionSource: 'crm' as const,
        platformReportedConversions: 19,
        requiresManualBudgetChange: false,
      },
      {
        platform: 'google_lsa',
        displayName: 'Google Local Service Ads',
        currentSpendUsd: 900,
        conversions: 11,
        conversionSource: 'crm' as const,
        requiresManualBudgetChange: true,
      },
      {
        platform: 'seo_retainer',
        displayName: 'SEO Retainer',
        currentSpendUsd: 800,
        conversions: 6,
        conversionSource: 'crm' as const,
        requiresManualBudgetChange: true,
      },
    ],
  };

  console.log(`Snapshot: $${req.totalBudgetUsd.toLocaleString()} over ${req.windowDays} days, ${req.platforms.length} platforms.`);
  console.log('Calling runBudgetStrategist…');

  const startMs = Date.now();
  let result;
  try {
    result = await runBudgetStrategist(req);
  } catch (err) {
    console.error('\n✗ runBudgetStrategist threw:');
    console.error(err);
    process.exit(2);
  }
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\nLLM call complete in ${elapsed}s.\n`);

  console.log('--- Output ---');
  console.log(JSON.stringify(result, null, 2));
  console.log('--- /Output ---\n');

  console.log('Assertions:');

  // Shape
  assert(ctx, Array.isArray(result.recommendations), 'recommendations is an array');
  assert(
    ctx,
    result.recommendations.length === req.platforms.length,
    `one recommendation per input platform (got ${result.recommendations.length}/${req.platforms.length})`,
  );
  assert(ctx, typeof result.summaryRationale === 'string' && result.summaryRationale.length > 30, 'summaryRationale is a non-trivial string');

  // Allocation math
  const sum = result.recommendations.reduce((acc, r) => acc + r.recommendedSpendUsd, 0);
  assert(
    ctx,
    Math.abs(sum - req.totalBudgetUsd) <= 1,
    `recommendedSpendUsd sums to within $1 of total budget`,
    `sum=$${sum.toFixed(2)} vs $${req.totalBudgetUsd}`,
  );

  // Per-platform integrity
  for (const r of result.recommendations) {
    const inputPlatform = req.platforms.find((p) => p.platform === r.platform);
    assert(ctx, inputPlatform !== undefined, `recommendation for ${r.platform} refers to a real input platform`);

    if (inputPlatform) {
      assert(
        ctx,
        Math.abs(r.currentSpendUsd - inputPlatform.currentSpendUsd) < 0.01,
        `${r.platform}: currentSpendUsd echoes input`,
        `got $${r.currentSpendUsd}, expected $${inputPlatform.currentSpendUsd}`,
      );

      assert(
        ctx,
        r.requiresManualMissionTask === Boolean(inputPlatform.requiresManualBudgetChange),
        `${r.platform}: requiresManualMissionTask matches input flag`,
      );

      if (r.requiresManualMissionTask) {
        assert(
          ctx,
          typeof r.manualMissionPrompt === 'string' && r.manualMissionPrompt.length > 20,
          `${r.platform}: has a non-trivial manualMissionPrompt`,
        );
      }
    }

    const expectedDelta = r.recommendedSpendUsd - r.currentSpendUsd;
    assert(
      ctx,
      Math.abs(expectedDelta - r.deltaUsd) < 0.5,
      `${r.platform}: deltaUsd matches recommendedSpend - currentSpend`,
    );

    assert(
      ctx,
      typeof r.rationale === 'string' && r.rationale.length > 30,
      `${r.platform}: rationale is non-trivial`,
    );

    assert(
      ctx,
      ['increase', 'decrease', 'hold', 'pause'].includes(r.actionType),
      `${r.platform}: actionType is a valid enum`,
    );

    assert(
      ctx,
      ['low', 'medium', 'high'].includes(r.confidence),
      `${r.platform}: confidence is a valid enum`,
    );
  }

  // Total conversions = 43, well above the threshold of 10
  assert(
    ctx,
    result.insufficientData === false,
    'insufficientData=false (43 conversions ≥ threshold of 10)',
  );

  // Soundness: Meta Ads ($1500 / 4 conversions = $375 CPA) is much worse than
  // Google Ads ($1800 / 22 = $82 CPA). A sensible LLM should shift money away
  // from Meta Ads (decrease or pause). Soft check — surface but don't fail.
  const metaRec = result.recommendations.find((r) => r.platform === 'meta_ads');
  if (metaRec) {
    const movesMoneyAwayFromMeta = metaRec.deltaUsd < 0;
    console.log(
      `  ${movesMoneyAwayFromMeta ? '✓' : '⚠'} (soft) Meta Ads has worst CPA — strategist ${movesMoneyAwayFromMeta ? 'recommends decrease/pause' : 'did NOT decrease'} (delta=$${metaRec.deltaUsd.toFixed(2)})`,
    );
  }

  console.log(`\n=== Summary: ${ctx.pass} passed, ${ctx.fail} failed ===\n`);
  if (ctx.failures.length > 0) {
    console.log('Failures:');
    for (const f of ctx.failures) {
      console.log(`  - ${f}`);
    }
  }
  process.exit(ctx.fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(2);
});
