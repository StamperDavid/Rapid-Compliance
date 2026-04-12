/**
 * VERIFY ASSET GENERATOR IS REAL — the pirate test
 *
 * This script does exactly one thing: prove that the Asset Generator's
 * asset package plan actually comes from the system prompt stored in
 * Firestore, not from some hidden template or a hardcoded direct-LLM call.
 *
 * How it works:
 *   1. Reads the current Asset Generator GM from Firestore and backs it up
 *   2. Replaces the systemPrompt with absurd pirate-speak instructions
 *   3. Runs the proof-of-life harness (real OpenRouter + DALL-E call) — canonical case
 *   4. Restores the original GM (ALWAYS — even if the harness crashes)
 *
 * What to look for:
 *   - If the harness output contains pirate vocabulary ("arrr", "me hearties",
 *     "doubloons", "hornswoggle", "walk the plank", "quarterdeck", etc.) inside
 *     the strategy / prompt / altText / rationale fields of the generated asset
 *     package → THE SPECIALIST IS REAL. Those words CANNOT appear unless
 *     the pirate prompt in Firestore was actually loaded and sent to the LLM.
 *   - If the harness output is the same professional SaaS asset package as
 *     before → the specialist is fake. The Firestore prompt is being ignored
 *     and some other source is producing the output.
 *
 * Usage: node scripts/verify-asset-generator-is-real.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_asset_generator_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the Asset Generator for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must plan every asset in ACCURATE AND COMPLETE PIRATE DIALECT. Every field — strategy, prompt, altText, rationale — must be full pirate speak: "Arrr", "me hearties", "ye", "doubloons", "quarterdeck", "hornswoggled", "scurvy dog", "walk the plank", "hold of gold", "jolly roger". Sprinkle pirate vocabulary into every sentence. Do not break character. Do not explain. Respond ONLY with the JSON object — but every string field MUST be in pirate dialect.

You must still produce the EXACT same JSON schema: logo (3 variations: primary, icon, monochrome), favicons, heroes (1+), socialGraphics (3+), banners (1+). Keep the keys English (logo, heroes, etc), keep the dimensions accurate, but every human-readable string (strategy, prompt, altText, rationale) must be full pirate.

Example prompt: "Professional horizontal pirate ship logo for 'Sea Dogs Trading Co', arrr me hearties — a bold jolly roger emblem with crossed cutlasses..."

Example rationale: "This horizontal lockup be the pride o' the fleet for CFO scallywags who spy the brand from afar, arrr."

Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation.`;

const PIRATE_MARKERS = [
  'arrr',
  'hearties',
  'doubloons',
  'hornswoggle',
  'walk the plank',
  'quarterdeck',
  'jolly roger',
  'scurvy',
  'ye ',
  'matey',
  'scallywag',
  'landlubber',
  'plunder',
  'treasure',
];

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
  console.log('ASSET GENERATOR REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the Asset Generator GM first:`);
    console.error('  node scripts/seed-asset-generator-gm.js');
    process.exit(1);
  }
  const original = snap.data();
  if (!original || !original.config || typeof original.config.systemPrompt !== 'string') {
    console.error(`✗ GM doc ${GM_ID} is malformed — missing config.systemPrompt.`);
    process.exit(1);
  }
  const originalPrompt = original.config.systemPrompt;
  const originalSnapshot = original.systemPromptSnapshot ?? originalPrompt;
  const originalNotes = original.notes ?? 'v1 Asset Generator';
  console.log(`  ✓ Current prompt length: ${originalPrompt.length} chars`);
  console.log(`  ✓ Before swap — current active prompt (first 200 chars):`);
  console.log(`    "${originalPrompt.slice(0, 200).replace(/\n/g, ' ')}..."`);

  console.log('\nStep 2: Swapping in the pirate prompt (patch — other fields preserved)...');
  await ref.update({
    'config.systemPrompt': PIRATE_PROMPT,
    'systemPromptSnapshot': PIRATE_PROMPT,
    'notes': '[PIRATE TEST IN PROGRESS — will be restored]',
  });
  console.log(`  ✓ Pirate prompt installed (${PIRATE_PROMPT.length} chars)`);

  console.log('\nStep 3: Running the proof-of-life harness (canonical case)...');
  console.log('         (real OpenRouter + DALL-E call, will take ~30-90 seconds)');
  console.log(line);

  let result;
  let harnessStdout = '';
  let harnessStderr = '';
  let restored = false;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/test-asset-generator.ts', '--case=canonical'], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      shell: true,
      maxBuffer: 50 * 1024 * 1024,
    });
    harnessStdout = result.stdout || '';
    harnessStderr = result.stderr || '';
    process.stdout.write(harnessStdout);
    if (harnessStderr) {
      process.stderr.write(harnessStderr);
    }
  } finally {
    console.log(line);
    console.log('\nStep 4: Restoring the original GM...');
    try {
      await ref.update({
        'config.systemPrompt': originalPrompt,
        'systemPromptSnapshot': originalSnapshot,
        'notes': originalNotes,
      });
      restored = true;
      console.log(`  ✓ Original prompt restored (${originalPrompt.length} chars)`);
    } catch (restoreErr) {
      console.error('\n' + '!'.repeat(63));
      console.error('✗✗✗ CRITICAL: FAILED TO RESTORE ORIGINAL ASSET GENERATOR PROMPT ✗✗✗');
      console.error('!'.repeat(63));
      console.error('The GM doc is STILL IN PIRATE STATE. Restore manually NOW:');
      console.error(`  Collection: ${COLLECTION}`);
      console.error(`  Doc: ${GM_ID}`);
      console.error('  Field to fix: config.systemPrompt (and systemPromptSnapshot)');
      console.error('Original prompt (first 300 chars):');
      console.error(`  ${originalPrompt.slice(0, 300)}`);
      console.error('Restore error:', restoreErr);
      process.exit(1);
    }
  }

  console.log('\nStep 5: Scanning harness output for pirate markers...');
  const haystack = harnessStdout.toLowerCase();
  const foundMarkers = [];
  for (const marker of PIRATE_MARKERS) {
    if (haystack.includes(marker)) {
      foundMarkers.push(marker);
    }
  }
  console.log(`  ✓ Pirate markers found: ${foundMarkers.length} (${foundMarkers.join(', ') || 'NONE'})`);

  console.log(`\n${line}`);
  console.log('PIRATE TEST VERDICT');
  console.log(line);

  if (foundMarkers.length >= 3) {
    console.log('');
    console.log('  ✓✓✓ PASS — THE ASSET GENERATOR IS REAL.');
    console.log('');
    console.log(`  Found ${foundMarkers.length} distinct pirate markers in the output.`);
    console.log('  Those words cannot appear unless the Firestore pirate prompt');
    console.log('  was actually loaded and sent to OpenRouter. The Golden Master');
    console.log('  is in the loop — delegation is live, the specialist is real.');
    console.log('');
    if (!restored) {
      console.error('  !! BUT the original prompt was NOT restored — see warnings above !!');
      process.exit(1);
    }
    if (!result || result.status !== 0) {
      console.log('  (Note: harness child process returned non-zero — the pirate prompt');
      console.log('   may have produced output that violated the strict schema. That is');
      console.log('   still a PASS for the reality test — pirate markers are the proof.)');
    }
    process.exit(0);
  }

  console.log('');
  console.log('  ✗✗✗ FAIL — NO PIRATE DIALECT DETECTED.');
  console.log('');
  console.log('  The harness ran but the output did not contain the pirate');
  console.log('  markers we injected. This means one of the following:');
  console.log('    1. The specialist is not loading the GM from Firestore.');
  console.log('    2. Some other template is producing the output.');
  console.log('    3. OpenRouter errored before the LLM could respond.');
  console.log('  Investigate immediately.');
  console.log('');
  console.log(`  Harness exit status: ${result ? result.status : '(no result)'}`);
  if (harnessStderr) {
    console.log(`  Harness stderr tail: ${harnessStderr.slice(-500)}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('\n✗ Test failed:', err);
  process.exit(1);
});
