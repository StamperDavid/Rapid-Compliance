/**
 * Verifies the BUDGET_STRATEGIST conversion aggregator against real Firestore.
 *
 *   1. Pull aggregation for a 30-day window.
 *   2. Log the per-platform counts so the operator can spot-check attribution.
 *   3. Sanity-assert the response shape.
 *
 * Read-only. Does not mutate state.
 *
 * Run: `npx tsx scripts/verify-budget-conversion-aggregator.ts`
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
  console.log('\n=== BUDGET_STRATEGIST conversion aggregator — live verification ===\n');

  const { aggregateConversionsByPlatform, normalizeSourceToPlatform } = await import(
    '../src/lib/marketing/budget-conversion-aggregator'
  );

  // Unit-level sanity on the normalizer first (deterministic, no Firestore).
  const cases: Array<[string, string]> = [
    ['google_ads/cpc', 'google_ads'],
    ['Google_Ads', 'google_ads'],
    ['meta_ads', 'meta_ads'],
    ['facebook/social', 'facebook'],
    ['early_access_signup', 'direct'],
    ['contact_form', 'direct'],
    ['form', 'direct'],
    ['direct', 'direct'],
    ['', 'direct'],
  ];
  let unitPass = 0;
  for (const [input, expected] of cases) {
    const got = normalizeSourceToPlatform(input);
    if (got === expected) {
      unitPass++;
    } else {
      console.log(`  ✗ normalize("${input}") = "${got}", expected "${expected}"`);
    }
  }
  console.log(`Normalizer unit checks: ${unitPass}/${cases.length} pass`);

  // Live Firestore pull
  console.log('\nPulling 30-day aggregation from Firestore…');
  const startMs = Date.now();
  const result = await aggregateConversionsByPlatform(30);
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(2);
  console.log(`Query complete in ${elapsed}s.\n`);

  console.log(`Window: ${result.windowStartIso} → ${result.windowEndIso}`);
  console.log(`Total leads in window: ${result.totalLeadsInWindow}`);
  console.log(`Leads with source field: ${result.leadsWithSource}`);
  console.log(`Platforms represented: ${result.byPlatform.length}\n`);

  if (result.byPlatform.length === 0) {
    console.log('(No source-attributed leads in window. UTM-capture is wired but no traffic has flowed through it yet.)');
  } else {
    console.log('Per-platform breakdown:');
    for (const p of result.byPlatform) {
      const rawList = p.rawSources.length > 1 ? ` [raw: ${p.rawSources.join(', ')}]` : '';
      console.log(`  ${p.platform.padEnd(20)} ${String(p.count).padStart(4)} conversions${rawList}`);
    }
  }

  // Shape assertions
  const shapeOk =
    typeof result.windowDays === 'number' &&
    typeof result.totalLeadsInWindow === 'number' &&
    typeof result.leadsWithSource === 'number' &&
    Array.isArray(result.byPlatform);
  console.log(`\n${shapeOk ? '✓' : '✗'} Response shape is valid`);

  const allFails = unitPass < cases.length || !shapeOk;
  process.exit(allFails ? 1 : 0);
})().catch((err) => {
  console.error('Aggregator verification crashed:', err);
  process.exit(2);
});
