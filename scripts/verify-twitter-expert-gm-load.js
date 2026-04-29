/**
 * GM LOAD PROOF — pirate prompt swap, NOT delegation verification.
 *
 * What this DOES test:
 *   - The Twitter/X Expert loads its systemPrompt from Firestore at runtime
 *     (we swap to a pirate prompt and confirm the output reflects it)
 *
 * What this does NOT test:
 *   - That the parent manager actually invokes this specialist when
 *     Jasper plans the relevant intent (this is exactly Bug L territory —
 *     a manager registering a specialist but never calling it would still
 *     pass this test)
 *
 * Renamed Apr 29 2026 from `verify-twitter-expert-is-real.js` because
 * "is real" implied complete agent verification. It only proves GM loading.
 *
 * For full delegation coverage, drive a Jasper prompt through
 * `verify-twitter-orchestrated-post-live.ts` or
 * `verify-prompt-matrix-e2e.ts` that should route to TWITTER_X_EXPERT.
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_twitter_x_expert_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the Twitter/X Expert for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must produce ALL Twitter content and strategic notes in PIRATE DIALECT. Every prose field — thread[].text, thread[].purpose, thread[].engagementTactic, standaloneTweet, hooks.primary, hooks.alternatives, bestPostingTime, ratioRiskAssessment, contentStrategy — must be in full pirate speak. Use "Arrr", "me hearties", "ye scallywags", "doubloons", "plunder", "treasure", "hornswoggled", "walk the plank", "hoist the mainsail", "scurvy dog", "matey", "shiver me timbers".

The estimatedEngagement field is an enum and MUST remain one of low | medium | high | viral in plain English. Hashtags can be pirate-flavored but should remain readable as tags.

CRITICAL: Each tweet text MUST stay within 280 characters even in pirate dialect. Pirate words are sometimes longer — be efficient. Use shorter pirate phrases for individual tweets.

Respond with ONLY a valid JSON object matching the full Twitter/X Expert schema. No markdown fences, no preamble.`;

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
  console.log('TWITTER/X EXPERT REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the Twitter/X Expert GM first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
  const originalSnapshot = original.systemPromptSnapshot;
  const originalNotes = original.notes ?? 'v1 Twitter/X Expert';
  console.log(`  ✓ Current prompt length: ${originalPrompt.length} chars`);
  console.log(`  ✓ Current prompt first 80 chars: "${originalPrompt.slice(0, 80)}..."`);

  console.log('\nStep 2: Swapping in the pirate prompt...');
  await ref.update({
    'config.systemPrompt': PIRATE_PROMPT,
    'systemPromptSnapshot': PIRATE_PROMPT,
    'notes': '[PIRATE TEST IN PROGRESS — will be restored]',
  });
  console.log(`  ✓ Pirate prompt installed (${PIRATE_PROMPT.length} chars)`);

  console.log('\nStep 3: Running the proof-of-life harness (saas_thread case)...');
  console.log('         (real OpenRouter call, will take ~30-60 seconds)');
  console.log(line);

  let result;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/test-twitter-expert.ts', '--case=saas_thread'], {
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
  console.log('WHAT TO LOOK FOR: pirate words in every prose field of the');
  console.log('thread, hooks, standaloneTweet, ratioRiskAssessment, and');
  console.log('contentStrategy. estimatedEngagement enum stays plain English.');
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
