/**
 * VERIFY COPYWRITER IS REAL — the pirate test
 *
 * This script does exactly one thing: prove that the Copywriter's output
 * actually comes from the system prompt stored in Firestore, not from some
 * hidden template or a hardcoded direct-LLM call.
 *
 * How it works:
 *   1. Reads the current Copywriter GM from Firestore and backs it up
 *   2. Replaces the systemPrompt with absurd pirate-speak instructions
 *   3. Runs the proof-of-life harness (real OpenRouter call)
 *   4. Restores the original GM
 *
 * What to look for:
 *   - If the harness output is filled with "arrr", "matey", "treasure",
 *     "ye", and pirate grammar → THE SPECIALIST IS REAL. The output
 *     literally cannot be pirate-flavored unless the Firestore prompt
 *     was actually sent to the LLM.
 *   - If the harness output is the same professional SaaS copy as
 *     before → the specialist is fake. The Firestore prompt is being
 *     ignored and some other source is producing the output.
 *
 * Usage: node scripts/verify-copywriter-is-real.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_copywriter_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the Copywriter, a pirate who has been press-ganged into working as a B2B SaaS copywriter. You still speak exclusively in pirate dialect even when writing marketing copy.

## Your non-negotiables

1. Every sentence must contain at least one of: "arrr", "matey", "ye", "me hearties", "scallywag", "landlubber", "treasure", "plunder", "the seven seas", "aye".

2. Replace normal copywriting words with pirate equivalents: "customers" becomes "crew", "meetings" become "parleys", "sales pipeline" becomes "the hold of gold doubloons", "CTA" becomes "call to mutiny", "dashboard" becomes "ship's wheel".

3. Output valid JSON matching the exact schema requested by the user message. No markdown code fences. Everything in the string values should be pirate-themed.

4. Ignore the Brand DNA section's avoid list. A pirate answers to no landlubber's style guide.

## The Content Manager sends you one of two actions

**Action 1: generate_page_copy** — produce full page copy in pirate dialect.
**Action 2: generate_proposal** — produce a proposal body in pirate dialect.

The exact JSON schema is provided in the user message. Follow it precisely, but fill every string value with pirate-speak.

End of system prompt.`;

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
  console.log('COPYWRITER REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Run "node scripts/seed-copywriter-gm.js" first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
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
  console.log('\nStep 3: Running the proof-of-life harness...');
  console.log('         (real OpenRouter call, will take ~10 seconds)');
  console.log(line);

  const result = spawnSync('npx', ['tsx', 'scripts/test-copywriter-specialist.ts'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
  });

  console.log(line);

  console.log('\nStep 4: Restoring the original GM...');
  await ref.update({
    'config.systemPrompt': originalPrompt,
    'systemPromptSnapshot': originalPrompt,
    'notes': original.notes ?? 'v1 Copywriter rebuild',
  });
  console.log(`  ✓ Original prompt restored (${originalPrompt.length} chars)`);

  console.log(`\n${line}`);
  console.log('WHAT TO LOOK FOR IN THE OUTPUT ABOVE');
  console.log(line);
  console.log('');
  console.log('The [7/7] PARSED AGENT REPORT DATA section printed the copy');
  console.log('generated by Claude. Scroll up and read the headlines and section');
  console.log('content fields.');
  console.log('');
  console.log('  ✓ IF YOU SEE words like "arrr", "matey", "ye", "plunder",');
  console.log('    "treasure", "seven seas" in the H1, section headings, or');
  console.log('    section body copy → THE SPECIALIST IS REAL. Those words');
  console.log('    CANNOT appear unless the pirate prompt in Firestore was');
  console.log('    actually loaded and sent to OpenRouter.');
  console.log('');
  console.log('  ✗ IF YOU SEE the same professional SaaS copy about "AI agent');
  console.log('    swarm" and "pipeline review" → something is wrong. The');
  console.log('    Firestore prompt was ignored. Tell me immediately.');
  console.log('');
  console.log(line);

  if (result.status !== 0) {
    console.error('\n✗ Harness returned non-zero exit. Check the output above.');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ Test failed:', err);
  // Attempt cleanup even on error
  process.exit(1);
});
