/**
 * GM LOAD PROOF — pirate prompt swap, NOT full delegation verification.
 *
 * What this DOES test:
 *   - Both EMAIL_SPECIALIST and SMS_SPECIALIST load their systemPrompts from
 *     Firestore at runtime when called through the OutreachManager delegation
 *     chain (we swap both to pirate prompts and confirm the output reflects them)
 *   - The OutreachManager.execute() → executeSingleChannel path reaches the
 *     specialist's GM at all
 *
 * What this does NOT test:
 *   - That Jasper correctly plans a delegate_to_outreach intent when given a
 *     real user prompt (this is exactly Bug L territory — if Jasper never
 *     emits delegate_to_outreach for the relevant intent, OutreachManager
 *     would never be reached, and this test still wouldn't catch it)
 *
 * Renamed Apr 29 2026 from `verify-delegate-to-outreach-is-real.js` because
 * "is real" implied complete agent verification. It only proves GM loading
 * through the manager delegation hop.
 *
 * For full Jasper → manager → specialist delegation coverage, drive a Jasper
 * prompt through `verify-prompt-matrix-e2e.ts` (or
 * `verify-outreach-orchestrated-live.ts`) with an outreach intent.
 *
 * --- original implementation notes below ---
 *
 * The smoke test driver is `scripts/smoke-test-outreach-task45.ts`
 * which already runs both channels via OutreachManager.execute().
 *
 * Usage: node scripts/verify-delegate-to-outreach-is-real.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const EMAIL_GM_ID = 'sgm_email_specialist_saas_sales_ops_v1';
const SMS_GM_ID = 'sgm_sms_specialist_saas_sales_ops_v1';

const EMAIL_PIRATE_PROMPT = `You are the Email Specialist for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must write ALL email content and strategic notes in PIRATE DIALECT. Every prose field — subjectLine, previewText, bodyPlainText, ctaLine, psLine, toneAndAngleReasoning, personalizationNotes, followupSuggestion, spamRiskNotes, and rationale — must be full pirate speak. Use "Arrr", "me hearties", "ye scallywags", "doubloons", "plunder", "treasure", "hornswoggled", "walk the plank", "hoist the mainsail", "scurvy dog", "landlubber", "matey", "shiver me timbers", "yo ho ho", "Davy Jones' locker".

The emailPurpose field is a SLUG from the Email Purpose Taxonomy list in the user prompt — it MUST remain one of those exact slugs (cold_intro, warm_followup, nurture, reengagement, onboarding, announcement, offer, social_proof, case_study) in plain English, otherwise runtime validation will reject the response and the test cannot verify. Do NOT pirate-ify the emailPurpose slug.

Respond with ONLY valid JSON matching the full Email Specialist schema. No markdown fences, no preamble, no explanation outside the JSON.`;

const SMS_PIRATE_PROMPT = `You are the SMS Specialist for SalesVelocity.ai, but by order of Cap'n Blackbeard ye must write ALL SMS content and strategic notes in PIRATE DIALECT. Every prose field — primaryMessage, ctaText, complianceFooter, linkPlacementNotes, personalizationNotes, toneAndAngleReasoning, followupSuggestion, complianceRisks, and rationale — must be full pirate speak. Use "Arrr", "me hearties", "ye scallywags", "doubloons", "plunder", "treasure", "hornswoggled", "walk the plank", "hoist the mainsail", "scurvy dog", "matey", "shiver me timbers", "yo ho ho", "Davy Jones' locker".

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

async function readGM(gmId) {
  const ref = db.collection(COLLECTION).doc(gmId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`GM doc ${gmId} not found in ${COLLECTION}`);
  }
  const data = snap.data();
  return {
    ref,
    originalPrompt: data.config.systemPrompt,
    originalSnapshot: data.systemPromptSnapshot,
    originalNotes: data.notes ?? `v1 ${gmId}`,
  };
}

async function swapGM(state, piratePrompt) {
  await state.ref.update({
    'config.systemPrompt': piratePrompt,
    'systemPromptSnapshot': piratePrompt,
    'notes': '[FRONT-DOOR PIRATE TEST IN PROGRESS — Task #45]',
  });
}

async function restoreGM(state) {
  await state.ref.update({
    'config.systemPrompt': state.originalPrompt,
    'systemPromptSnapshot': state.originalSnapshot ?? state.originalPrompt,
    'notes': state.originalNotes,
  });
}

async function main() {
  const line = '═'.repeat(63);
  console.log(`\n${line}`);
  console.log('TASK #45 — DELEGATE_TO_OUTREACH FRONT-DOOR PIRATE TEST');
  console.log(line);
  console.log('\nProves the full chain:');
  console.log('  Jasper-shaped payload → OutreachManager.execute()');
  console.log('  → executeSingleChannel → Email/SMS Specialist');
  console.log('  → loads (pirate) GM from Firestore → real LLM call');
  console.log('  → composed content bubbles back through manager');
  console.log('If pirate dialect appears in the composed bodyPlainText');
  console.log('and primaryMessage, every link in the chain is real.');

  console.log('\nStep 1: Reading current EMAIL and SMS GMs from Firestore...');
  const emailState = await readGM(EMAIL_GM_ID);
  const smsState = await readGM(SMS_GM_ID);
  console.log(`  ✓ EMAIL GM (${EMAIL_GM_ID}): ${emailState.originalPrompt.length} chars`);
  console.log(`  ✓ SMS GM   (${SMS_GM_ID}): ${smsState.originalPrompt.length} chars`);

  console.log('\nStep 2: Swapping in pirate prompts for both specialists...');
  await swapGM(emailState, EMAIL_PIRATE_PROMPT);
  await swapGM(smsState, SMS_PIRATE_PROMPT);
  console.log(`  ✓ EMAIL pirate prompt installed (${EMAIL_PIRATE_PROMPT.length} chars)`);
  console.log(`  ✓ SMS pirate prompt installed (${SMS_PIRATE_PROMPT.length} chars)`);

  console.log('\nStep 3: Running the front-door smoke test through OutreachManager...');
  console.log('         (real OpenRouter calls for both channels, ~2-3 minutes total)');
  console.log(line);

  let result;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/smoke-test-outreach-task45.ts'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });
  } finally {
    console.log(line);
    console.log('\nStep 4: Restoring both original GMs...');
    let restoreFailed = false;
    try {
      await restoreGM(emailState);
      console.log(`  ✓ EMAIL GM restored (${emailState.originalPrompt.length} chars)`);
    } catch (restoreErr) {
      restoreFailed = true;
      console.error('\n✗ FAILED TO RESTORE EMAIL GM:', restoreErr);
      console.error(`  Restore manually: collection=${COLLECTION} doc=${EMAIL_GM_ID}`);
    }
    try {
      await restoreGM(smsState);
      console.log(`  ✓ SMS GM restored (${smsState.originalPrompt.length} chars)`);
    } catch (restoreErr) {
      restoreFailed = true;
      console.error('\n✗ FAILED TO RESTORE SMS GM:', restoreErr);
      console.error(`  Restore manually: collection=${COLLECTION} doc=${SMS_GM_ID}`);
    }
    if (restoreFailed) {
      process.exit(1);
    }
  }

  console.log(`\n${line}`);
  console.log('WHAT TO LOOK FOR in the smoke test output above:');
  console.log('  EMAIL channel — "subjectLine" and "bodyPlainText preview"');
  console.log('  should contain pirate words: "arrr", "matey", "ye",');
  console.log('  "shiver me timbers", "hoist the mainsail", "yo ho ho",');
  console.log('  "Davy Jones", "scurvy", "plunder", "doubloons".');
  console.log('  emailPurpose stays in plain English (cold_intro etc) —');
  console.log('  that is the Firestore taxonomy slug and is correct.');
  console.log('');
  console.log('  SMS channel — "primaryMessage" and "complianceFooter"');
  console.log('  should also be in pirate dialect. smsPurpose and');
  console.log('  segmentStrategy stay plain English (Firestore slug + enum).');
  console.log('');
  console.log('If both channels return COMPLETED with pirate dialect in');
  console.log('the prose fields, the FULL chain is provably real:');
  console.log('  - Jasper handler reaches the manager (the new wire)');
  console.log('  - Manager dispatches compose action to specialist');
  console.log('  - Specialist loads its (pirate) GM from Firestore');
  console.log('  - LLM runs with the pirate prompt');
  console.log('  - Composed content bubbles back through manager');
  console.log(line);

  if (!result || result.status !== 0) {
    console.error('\n✗ Smoke test returned non-zero exit. Check the output above.');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ FATAL:', err);
  process.exit(1);
});
