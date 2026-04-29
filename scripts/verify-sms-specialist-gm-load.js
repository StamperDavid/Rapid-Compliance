/**
 * VERIFY SMS SPECIALIST IS REAL — the pirate test
 *
 * Swaps the Firestore GM systemPrompt with pirate-speak, runs the
 * proof-of-life harness, and restores the GM via try/finally. If the output
 * comes back in pirate dialect, the specialist is provably loading its prompt
 * from Firestore at runtime.
 *
 * Usage: node scripts/verify-sms-specialist-is-real.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_sms_specialist_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the SMS Specialist for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must write ALL SMS content and strategic notes in PIRATE DIALECT. Every prose field — primaryMessage, ctaText, complianceFooter, linkPlacementNotes, personalizationNotes, toneAndAngleReasoning, followupSuggestion, complianceRisks, and rationale — must be full pirate speak. Use "Arrr", "me hearties", "ye scallywags", "doubloons", "plunder", "treasure", "hornswoggled", "walk the plank", "hoist the mainsail", "scurvy dog", "matey", "shiver me timbers", "yo ho ho", "Davy Jones' locker".

The smsPurpose field is a SLUG from the SMS Purpose Taxonomy list in the user prompt — it MUST remain one of those exact slugs in plain English (flash_offer, appointment_reminder, shipping_update, winback, event_alert, payment_reminder, warm_followup, cold_outreach), otherwise runtime validation will reject the response and the test cannot verify.

The segmentStrategy field is an enum and MUST remain one of single_segment | concat_short | concat_medium | concat_long | concat_max in plain English.

The charCount field is a number and cannot be pirate-ified.

The primaryMessage + complianceFooter combined length MUST still fit within the injected maxCharCap at runtime (likely 480), even in pirate dialect — pirate dialect is more verbose so use concat_medium or concat_long strategies for extra room, but do not exceed the cap.

Respond with ONLY valid JSON matching the full SMS Specialist schema. No markdown fences, no preamble, no explanation outside the JSON.`;

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
  console.log('SMS SPECIALIST REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the SMS Specialist GM first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
  const originalSnapshot = original.systemPromptSnapshot;
  const originalNotes = original.notes ?? 'v1 SMS Specialist';
  console.log(`  ✓ Current prompt length: ${originalPrompt.length} chars`);
  console.log(`  ✓ Current prompt first 80 chars: "${originalPrompt.slice(0, 80)}..."`);

  console.log('\nStep 2: Swapping in the pirate prompt...');
  await ref.update({
    'config.systemPrompt': PIRATE_PROMPT,
    'systemPromptSnapshot': PIRATE_PROMPT,
    'notes': '[PIRATE TEST IN PROGRESS — will be restored]',
  });
  console.log(`  ✓ Pirate prompt installed (${PIRATE_PROMPT.length} chars)`);

  console.log('\nStep 3: Running the proof-of-life harness (saas_flash_offer case)...');
  console.log('         (real OpenRouter call, will take ~1-2 minutes)');
  console.log(line);

  let result;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/test-sms-specialist.ts', '--case=saas_flash_offer'], {
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
  console.log('in primaryMessage, ctaText, complianceFooter, linkPlacementNotes,');
  console.log('personalizationNotes, toneAndAngleReasoning, followupSuggestion,');
  console.log('complianceRisks, and rationale — the specialist is REAL.');
  console.log('(smsPurpose and segmentStrategy are enums and stay in plain');
  console.log('English — that is correct and expected.)');
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
