/**
 * VERIFY WORKFLOW OPTIMIZER IS REAL — the pirate test
 *
 * Swaps the Firestore GM systemPrompt with pirate-speak, runs the
 * proof-of-life harness, and restores the GM. If the output comes back
 * in pirate dialect, the specialist is provably loading its prompt from
 * Firestore.
 *
 * Usage: node scripts/verify-workflow-optimizer-is-real.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_workflow_optimizer_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the Workflow Optimizer for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must write ALL workflow design text in PIRATE DIALECT. Every prose field — workflowSummary.primaryObjective, every node's purpose, inputsDescription, outputsDescription, and dependsOnDescription, parallelizationNotes, criticalPathDescription, every riskMitigation entry, successCriteria, and rationale — must be full pirate speak. Use "Arrr", "me hearties", "ye scallywags", "doubloons", "plunder", "treasure", "hornswoggled", "walk the plank", "hoist the mainsail", "scurvy dog", "landlubber", "matey".

Numeric fields (estimatedDurationSeconds, estimatedTotalDurationSeconds) stay as real integer seconds. Enum fields (retryStrategy none/linear/exponential, executionPattern sequential/parallel/fan_out/fan_in/conditional/hybrid) stay as English enum values so the JSON stays valid. Node id fields stay as short slugs (n1, n2, etc). agentId stays as the real agent ID so the invariants pass. action stays as the real action name. But every free-text description field must be pirate.

Respond with ONLY valid JSON matching the full workflow schema. No markdown fences, no preamble.`;

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
  console.log('WORKFLOW OPTIMIZER REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the Workflow Optimizer GM first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
  const originalSnapshot = original.systemPromptSnapshot;
  const originalNotes = original.notes ?? 'v1 Workflow Optimizer';
  console.log(`  ✓ Current prompt length: ${originalPrompt.length} chars`);
  console.log(`  ✓ Current prompt first 80 chars: "${originalPrompt.slice(0, 80)}..."`);

  console.log('\nStep 2: Swapping in the pirate prompt...');
  await ref.update({
    'config.systemPrompt': PIRATE_PROMPT,
    'systemPromptSnapshot': PIRATE_PROMPT,
    'notes': '[PIRATE TEST IN PROGRESS — will be restored]',
  });
  console.log(`  ✓ Pirate prompt installed (${PIRATE_PROMPT.length} chars)`);

  console.log('\nStep 3: Running the proof-of-life harness (saas_content_engine case)...');
  console.log('         (real OpenRouter call, will take ~2-3 minutes)');
  console.log(line);

  let result;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/test-workflow-optimizer.ts', '--case=saas_content_engine'], {
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
  console.log('"walk the plank", "hoist the mainsail" in workflowSummary,');
  console.log('node purposes/inputs/outputs/depends, parallelizationNotes,');
  console.log('criticalPathDescription, riskMitigation, successCriteria, or');
  console.log('rationale — the specialist is REAL. Those words cannot appear');
  console.log('unless the pirate prompt was actually sent to OpenRouter.');
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
