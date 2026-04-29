/**
 * GM LOAD PROOF — pirate prompt swap, NOT delegation verification.
 *
 * What this DOES test:
 *   - The Copy Specialist loads its systemPrompt from Firestore at runtime
 *     (we swap to a pirate prompt and confirm the output reflects it)
 *
 * What this does NOT test:
 *   - That the parent manager actually invokes this specialist when
 *     Jasper plans the relevant intent (this is exactly Bug L territory —
 *     a manager registering a specialist but never calling it would still
 *     pass this test)
 *
 * Renamed Apr 29 2026 from `verify-copy-specialist-is-real.js` because
 * "is real" implied complete agent verification. It only proves GM loading.
 *
 * NOTE: This is the Architect-layer Copy Specialist (strategic messaging
 * picker), NOT the Content-layer Copywriter. Different files, different jobs.
 *
 * For full delegation coverage, drive a Jasper prompt through
 * `verify-prompt-matrix-e2e.ts` that should route to COPY_SPECIALIST.
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_copy_specialist_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the Copy Specialist for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must write ALL strategic messaging text in PIRATE DIALECT. Every single prose field — frameworkReasoning, ctaStrategyReasoning, voiceAndToneDirection, every entry in siteWideMessagingPillars, every entry in keyObjections, socialProofPlacementDescription, pageMessagingNotes, headlineDirection, and rationale — must be full pirate speak. Use "Arrr", "me hearties", "ye scallywags", "doubloons", "plunder", "treasure", "hornswoggled", "walk the plank", "hoist the mainsail", "scurvy dog", "landlubber", "matey", "shiver me timbers", "yo ho ho".

Enum fields stay valid English. The framework field MUST be exactly one of: PAS, AIDA, BAB, FAB, FOUR_PS, STORYBRAND. The ctaStrategy field MUST be exactly one of: urgency, value, risk_reversal, action, social_proof. Do NOT pirate-ify the enum values — they must match the literal strings or the JSON will be rejected. But every prose description and reasoning field must be pirate.

Respond with ONLY valid JSON matching the full Copy Specialist schema. No markdown fences, no preamble, no explanation outside the JSON.`;

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
  console.log('COPY SPECIALIST REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the Copy Specialist GM first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
  const originalSnapshot = original.systemPromptSnapshot;
  const originalNotes = original.notes ?? 'v1 Copy Specialist';
  console.log(`  ✓ Current prompt length: ${originalPrompt.length} chars`);
  console.log(`  ✓ Current prompt first 80 chars: "${originalPrompt.slice(0, 80)}..."`);

  console.log('\nStep 2: Swapping in the pirate prompt...');
  await ref.update({
    'config.systemPrompt': PIRATE_PROMPT,
    'systemPromptSnapshot': PIRATE_PROMPT,
    'notes': '[PIRATE TEST IN PROGRESS — will be restored]',
  });
  console.log(`  ✓ Pirate prompt installed (${PIRATE_PROMPT.length} chars)`);

  console.log('\nStep 3: Running the proof-of-life harness (saas_sales_ops_landing case)...');
  console.log('         (real OpenRouter call, will take ~1-2 minutes)');
  console.log(line);

  let result;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/test-copy-specialist.ts', '--case=saas_sales_ops_landing'], {
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
  console.log('in frameworkReasoning, ctaStrategyReasoning, voiceAndToneDirection,');
  console.log('every messaging pillar, every key objection, socialProofPlacementDescription,');
  console.log('pageMessagingNotes, headlineDirection, and rationale —');
  console.log('the specialist is REAL. Those words cannot appear');
  console.log('unless the pirate prompt was actually sent to OpenRouter.');
  console.log('framework + ctaStrategy enum fields stay English so JSON is valid.');
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
