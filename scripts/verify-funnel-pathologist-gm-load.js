/**
 * VERIFY FUNNEL PATHOLOGIST IS REAL — the pirate test
 *
 * Swaps the Firestore GM systemPrompt with pirate-speak, runs the
 * proof-of-life harness, and restores the GM via try/finally. If the output
 * comes back in pirate dialect, the specialist is provably loading its prompt
 * from Firestore at runtime.
 *
 * Usage: node scripts/verify-funnel-pathologist-is-real.js
 *
 * NOTE: This is the Architect-layer Funnel Pathologist (strategic funnel
 * diagnosis), NOT the Builder-layer Funnel Engineer. Different files,
 * different jobs.
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_funnel_pathologist_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the Funnel Pathologist for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must write ALL strategic funnel diagnosis prose in PIRATE DIALECT. Every prose field — frameworkReasoning, leakDiagnosis, stageRiskProfile, every entry in criticalLeakPoints, trustSignalStrategy, pricingPsychologyDirection, urgencyAndScarcityDirection, every entry in recoveryPlays, every entry in keyMetricsToWatch, and rationale — must be full pirate speak. Use "Arrr", "me hearties", "ye scallywags", "doubloons", "plunder", "treasure", "hornswoggled", "walk the plank", "hoist the mainsail", "scurvy dog", "landlubber", "matey", "shiver me timbers", "yo ho ho", "Davy Jones' locker".

The funnelFramework and primaryConversionLeak fields are ENUMS and MUST stay in plain English from the allowed enum values (LEAD_MAGNET_TRIPWIRE, FREE_TRIAL, BOOK_A_DEMO, WEBINAR, VSL_DIRECT, PRODUCT_LED, HIGH_TICKET_APPLICATION, DIRECT_CHECKOUT for framework; TOP_OF_FUNNEL_TRAFFIC, LANDING_RELEVANCE, OFFER_CLARITY, TRUST_SIGNALS, PRICING_FRICTION, CHECKOUT_DROPOFF, ACTIVATION_DROPOFF, POST_PURCHASE_RETENTION for leak) — otherwise Zod validation will reject the response and the test cannot verify.

Respond with ONLY valid JSON matching the full Funnel Pathologist schema. No markdown fences, no preamble, no explanation outside the JSON.`;

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
  console.log('FUNNEL PATHOLOGIST REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the Funnel Pathologist GM first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
  const originalSnapshot = original.systemPromptSnapshot;
  const originalNotes = original.notes ?? 'v1 Funnel Pathologist';
  console.log(`  ✓ Current prompt length: ${originalPrompt.length} chars`);
  console.log(`  ✓ Current prompt first 80 chars: "${originalPrompt.slice(0, 80)}..."`);

  console.log('\nStep 2: Swapping in the pirate prompt...');
  await ref.update({
    'config.systemPrompt': PIRATE_PROMPT,
    'systemPromptSnapshot': PIRATE_PROMPT,
    'notes': '[PIRATE TEST IN PROGRESS — will be restored]',
  });
  console.log(`  ✓ Pirate prompt installed (${PIRATE_PROMPT.length} chars)`);

  console.log('\nStep 3: Running the proof-of-life harness (saas_sales_ops_free_trial case)...');
  console.log('         (real OpenRouter call, will take ~1-2 minutes)');
  console.log(line);

  let result;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/test-funnel-pathologist.ts', '--case=saas_sales_ops_free_trial'], {
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
  console.log('WHAT TO LOOK FOR: pirate words in every prose field.');
  console.log('If you see "arrr", "matey", "ye", "plunder", "treasure",');
  console.log('"me hearties", "scallywags", "doubloons", "hornswoggled",');
  console.log('"walk the plank", "hoist the mainsail", "shiver me timbers"');
  console.log('in frameworkReasoning, leakDiagnosis, stageRiskProfile,');
  console.log('every criticalLeakPoint, trustSignalStrategy,');
  console.log('pricingPsychologyDirection, urgencyAndScarcityDirection,');
  console.log('every recoveryPlay, every keyMetricsToWatch, and rationale —');
  console.log('the specialist is REAL. Those words cannot appear unless the');
  console.log('pirate prompt was actually sent to OpenRouter.');
  console.log('(funnelFramework and primaryConversionLeak are ENUMS and stay');
  console.log('in plain English — that is correct and expected.)');
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
