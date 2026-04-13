/**
 * VERIFY FUNNEL ENGINEER IS REAL — the pirate test
 *
 * This script does exactly one thing: prove that the Funnel Engineer's
 * design_funnel output actually comes from the system prompt stored in
 * Firestore, not from some hidden template or a hardcoded direct-LLM call.
 *
 * How it works:
 *   1. Reads the current Funnel Engineer GM from Firestore and backs it up
 *   2. Replaces the systemPrompt with absurd pirate-speak instructions
 *   3. Runs the proof-of-life harness (real OpenRouter call) — saas_b2b case
 *   4. Restores the original GM (ALWAYS — even if the harness crashes)
 *
 * What to look for:
 *   - If the harness output has "arrr", "matey", "ye", "treasure",
 *     "doubloons", "scallywags", "me hearties", "plunder",
 *     "hornswoggled", "walk the plank" in funnelSummary.primaryObjective,
 *     stages.purpose/tacticsDescription/kpiDescription/optimizationNotes,
 *     estimatedCpa, keyBottleneckRisks, abTestRoadmap.hypothesis,
 *     recommendations, or rationale → THE SPECIALIST IS REAL. Those words
 *     cannot appear unless the pirate prompt in Firestore was actually
 *     loaded and sent to OpenRouter.
 *   - If the harness output is the same professional funnel design as before →
 *     the specialist is fake. The Firestore prompt is being ignored and
 *     some other source is producing the output.
 *
 * Usage: node scripts/verify-funnel-engineer-is-real.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_funnel_engineer_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the Funnel Engineer for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must write ALL funnel design text in PIRATE DIALECT. Every prose field — funnelSummary.primaryObjective, every stage's purpose, tacticsDescription, kpiDescription, and optimizationNotes, estimatedCpa, every keyBottleneckRisks entry, every abTestRoadmap entry (testName, hypothesis, successMetric), recommendations, and rationale — must be full pirate speak. Use "Arrr", "me hearties", "ye scallywags", "doubloons", "plunder", "treasure", "hornswoggled", "walk the plank", "hoist the mainsail", "scurvy dog", "landlubber", "matey".

Numeric fields (estimatedConversionPct, expectedOverallConversionPct) stay as real numbers. Enum fields (bottleneckRisk low/medium/high, priority critical/high/medium/low) stay as English enum values so the JSON stays valid. But every free-text description field must be pirate.

Respond with ONLY valid JSON matching the full funnel design schema (funnelSummary, stages, expectedOverallConversionPct, estimatedCpa, keyBottleneckRisks, abTestRoadmap, recommendations, rationale). No markdown fences, no preamble.`;

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing FIREBASE_ADMIN_* env vars. Check .env.local');
    process.exit(1);
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

async function main() {
  const line = '═'.repeat(63);
  console.log(`\n${line}`);
  console.log('FUNNEL ENGINEER REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the Funnel Engineer GM first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
  const originalSnapshot = original.systemPromptSnapshot;
  const originalNotes = original.notes ?? 'v1 Funnel Engineer';
  console.log(`  ✓ Current prompt length: ${originalPrompt.length} chars`);
  console.log(`  ✓ Current prompt first 80 chars: "${originalPrompt.slice(0, 80)}..."`);

  console.log('\nStep 2: Swapping in the pirate prompt...');
  await ref.update({
    'config.systemPrompt': PIRATE_PROMPT,
    'systemPromptSnapshot': PIRATE_PROMPT,
    'notes': '[PIRATE TEST IN PROGRESS — will be restored]',
  });
  console.log(`  ✓ Pirate prompt installed (${PIRATE_PROMPT.length} chars)`);

  console.log('\nStep 3: Running the proof-of-life harness (saas_b2b case)...');
  console.log('         (real OpenRouter call, will take ~3 minutes)');
  console.log(line);

  let result;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/test-funnel-engineer.ts', '--case=saas_b2b'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });
  } finally {
    console.log(line);
    console.log('\nStep 4: Restoring the original GM...');
    try {
      await ref.update({
        'config.systemPrompt': originalPrompt,
        'systemPromptSnapshot': originalSnapshot ?? originalPrompt,
        'notes': originalNotes,
      });
      console.log(`  ✓ Original prompt restored (${originalPrompt.length} chars)`);
    } catch (restoreErr) {
      console.error('\n✗ FAILED TO RESTORE ORIGINAL PROMPT:', restoreErr);
      console.error('  The GM doc is still in pirate state. Restore manually:');
      console.error(`  Collection: ${COLLECTION}`);
      console.error(`  Doc: ${GM_ID}`);
      process.exit(1);
    }
  }

  console.log(`\n${line}`);
  console.log('WHAT TO LOOK FOR IN THE OUTPUT ABOVE');
  console.log(line);
  console.log('');
  console.log('The harness printed the full funnel design JSON produced by Claude.');
  console.log('Scroll up and inspect these fields specifically:');
  console.log('');
  console.log('  • funnelSummary.primaryObjective');
  console.log('  • stages[*].purpose, tacticsDescription, kpiDescription, optimizationNotes');
  console.log('  • estimatedCpa');
  console.log('  • keyBottleneckRisks[*]');
  console.log('  • abTestRoadmap[*].testName, hypothesis, successMetric');
  console.log('  • recommendations');
  console.log('  • rationale');
  console.log('');
  console.log('  ✓ IF YOU SEE words like "arrr", "matey", "ye", "plunder",');
  console.log('    "treasure", "me hearties", "scallywags", "doubloons",');
  console.log('    "hornswoggled", "walk the plank", "hoist the mainsail" →');
  console.log('    THE SPECIALIST IS REAL. Those words CANNOT appear unless');
  console.log('    the pirate prompt in Firestore was actually loaded and');
  console.log('    sent to OpenRouter.');
  console.log('');
  console.log('  ✗ IF YOU SEE the same professional funnel with normal');
  console.log('    strategy text and normal recommendations —');
  console.log('    something is wrong. The Firestore prompt was ignored.');
  console.log('    Tell me immediately.');
  console.log('');
  console.log(line);

  if (!result || result.status !== 0) {
    console.error('\n✗ Harness returned non-zero exit. Check the output above.');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ Test failed:', err);
  process.exit(1);
});
