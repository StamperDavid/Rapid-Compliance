/**
 * VERIFY SEO EXPERT IS REAL — the pirate test
 *
 * This script does exactly one thing: prove that the SEO Expert's
 * keyword research output actually comes from the system prompt stored in
 * Firestore, not from some hidden template or a hardcoded direct-LLM call.
 *
 * How it works:
 *   1. Reads the current SEO Expert GM from Firestore and backs it up
 *   2. Replaces the systemPrompt with absurd pirate-speak instructions
 *   3. Runs the proof-of-life harness (real OpenRouter call) — keyword_saas case
 *   4. Restores the original GM (ALWAYS — even if the harness crashes)
 *
 * What to look for:
 *   - If the harness output is filled with "arrr", "matey", "treasure",
 *     "ye", "plunder", "me hearties", "scurvy dog", "doubloons",
 *     "hornswoggled", "quarterdeck" in the keywords[].contentRecommendation
 *     fields and strategy value → THE SPECIALIST IS REAL. The output
 *     literally cannot be pirate-flavored unless the Firestore prompt was
 *     actually sent to the LLM.
 *   - If the harness output is the same professional SEO analysis as before →
 *     the specialist is fake. The Firestore prompt is being ignored and
 *     some other source is producing the output.
 *
 * Usage: node scripts/verify-seo-expert-is-real.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_seo_expert_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the SEO Expert for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must produce ALL analysis in ACCURATE AND COMPLETE PIRATE DIALECT. Every field — strategy, keyword, difficulty assessment, contentRecommendation, summary, recommendations — must be in full pirate speak: "Arrr", "me hearties", "ye", "doubloons", "quarterdeck", "hornswoggled", "scurvy dog", "treasure map of keywords", "plunder the search rankings", "chart a course to page one".

You must still produce the EXACT same JSON schema for keyword_research: keywords array with keyword/difficulty/searchIntent/estimatedVolume/contentRecommendation, plus strategy string. Keep the enum values English (low/medium/high, informational/transactional etc) but every human-readable string must be pirate.

Respond with ONLY a valid JSON object, no markdown fences, no explanation.`;

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
  console.log('SEO EXPERT REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the SEO Expert GM first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
  const originalNotes = original.notes ?? 'v1 SEO Expert';
  console.log(`  ✓ Current prompt length: ${originalPrompt.length} chars`);
  console.log(`  ✓ Current prompt first 80 chars: "${originalPrompt.slice(0, 80)}..."`);

  console.log('\nStep 2: Swapping in the pirate prompt...');
  await ref.update({
    'config.systemPrompt': PIRATE_PROMPT,
    'systemPromptSnapshot': PIRATE_PROMPT,
    'notes': '[PIRATE TEST IN PROGRESS — will be restored]',
  });
  console.log(`  ✓ Pirate prompt installed (${PIRATE_PROMPT.length} chars)`);

  // The specialist's industry GM cache has a 60s TTL. Since we just updated
  // the doc, the next harness call will hit Firestore fresh (the cache is
  // per-process and this is a new Node process).
  console.log('\nStep 3: Running the proof-of-life harness (keyword_saas case)...');
  console.log('         (real OpenRouter call, will take ~15-30 seconds)');
  console.log(line);

  let result;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/test-seo-expert.ts', '--case=keyword_saas'], {
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
        'systemPromptSnapshot': originalPrompt,
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
  console.log('The harness printed the full keyword research JSON produced by Claude.');
  console.log('Scroll up and inspect these fields specifically:');
  console.log('');
  console.log('  • keywords[].contentRecommendation (one per keyword — should be ~15 of them)');
  console.log('  • strategy (the overall keyword strategy summary)');
  console.log('');
  console.log('  ✓ IF YOU SEE words like "arrr", "matey", "ye", "plunder",');
  console.log('    "treasure", "me hearties", "scurvy dog", "doubloons",');
  console.log('    "hornswoggled", "quarterdeck" across those fields →');
  console.log('    THE SPECIALIST IS REAL. Those words CANNOT appear unless');
  console.log('    the pirate prompt in Firestore was actually loaded and');
  console.log('    sent to OpenRouter.');
  console.log('');
  console.log('  ✗ IF YOU SEE the same professional SEO analysis with');
  console.log('    normal strategy text and normal content recommendations →');
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
