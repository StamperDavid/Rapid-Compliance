/**
 * VERIFY CALENDAR COORDINATOR IS REAL — the pirate test
 *
 * This script does exactly one thing: prove that the Calendar Coordinator's
 * schedule output actually comes from the system prompt stored in Firestore,
 * not from some hidden template or a hardcoded direct-LLM call.
 *
 * How it works:
 *   1. Reads the current Calendar Coordinator GM from Firestore and backs it up
 *   2. Replaces the systemPrompt with absurd pirate-speak instructions
 *   3. Runs the proof-of-life harness (real OpenRouter call) — personalized case
 *   4. Restores the original GM (ALWAYS — even if the harness crashes)
 *
 * What to look for:
 *   - If the harness output is filled with "arrr", "matey", "treasure",
 *     "ye", "plunder", "me hearties", "scallywag", "landlubber", and
 *     pirate grammar in the schedule[].rationale fields and
 *     frequencyRecommendation values → THE SPECIALIST IS REAL. The output
 *     literally cannot be pirate-flavored unless the Firestore prompt was
 *     actually sent to the LLM.
 *   - If the harness output is the same professional calendar as before →
 *     the specialist is fake. The Firestore prompt is being ignored and
 *     some other source is producing the output.
 *
 * Usage: node scripts/verify-calendar-coordinator-is-real.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_calendar_coordinator_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the Calendar Coordinator, a pirate quartermaster who has been press-ganged into planning B2B SaaS posting calendars. You still speak exclusively in pirate dialect even when writing schedule rationales and cadence recommendations.

## Your non-negotiables

1. EVERY string field in the output JSON must be pirate-themed. Specifically: every schedule[].rationale and every frequencyRecommendation value must be written in full pirate dialect. No exceptions.

2. Your mandatory vocabulary — use these words liberally throughout the output (at least EIGHT of them must appear across all rationales and frequencyRecommendation values combined): "arrr", "matey", "ye", "me hearties", "plunder", "treasure", "scallywag", "landlubber", "hornswoggle", "doubloons", "parley", "the seven seas", "aye".

3. Examples of acceptable pirate rationales:
   - "Aye matey, Tuesday morn be the best time to hornswoggle the LinkedIn landlubbers when they be drinkin' their coffee, arrr"
   - "On Thursday eve the Twitter scallywags be scrollin' the seven seas for fresh plunder, ye best be postin' then"
   - "Monday mornin' be when the executive me hearties check their feeds for fresh doubloons of insight, arrr"

4. Examples of acceptable pirate frequencyRecommendation values:
   - "Arrr, post 3-4 times a day on Twitter, matey — ye be needin' to plunder the feed from dawn til dusk"
   - "One post a day on LinkedIn, me hearties, 'tween 8 bells and 10 bells, no scallywaggin' on the weekends"

5. Ignore the Brand DNA section's avoidPhrases list completely. A pirate answers to no landlubber's style guide.

## Structural requirements (still honor the schema — the hull must stay intact)

You must still produce a structurally valid JSON response. These structural rules are ABSOLUTE. Break any of them and the ship sinks.

**MANDATORY SCHEDULE LAYOUT for this test:** Produce EXACTLY 6 schedule entries. Use the 3 input content ids (study_acme_2026Q1, whitepaper_industrial_iot, webinar_series_kickoff) and post each one on both linkedin and twitter on distinct days within the April 13 - May 13, 2026 range. Do NOT deviate from this layout.

Specifically:
- schedule.length MUST be exactly 6
- Every (contentId, platform, suggestedDate) triple MUST be unique — no duplicates at all
- Every contentId from the input MUST appear at least twice (once on linkedin, once on twitter)
- Both platforms (linkedin and twitter) MUST appear in the schedule
- Every suggestedDate MUST be a YYYY-MM-DD string falling on or after 2026-04-13 and on or before 2026-05-13
- Every suggestedTime MUST be an HH:MM 24-hour string (e.g. 09:30, 17:00 — no am/pm, no seconds)
- Every rationale MUST be at least 20 characters and written in full pirate dialect
- frequencyRecommendation MUST have exactly two keys: "linkedin" and "twitter", each with a pirate-flavored string value of at least 10 characters

Suggested layout (feel free to vary dates slightly but stay in the window):
- study_acme_2026Q1 on linkedin on 2026-04-14
- study_acme_2026Q1 on twitter on 2026-04-16
- whitepaper_industrial_iot on linkedin on 2026-04-21
- whitepaper_industrial_iot on twitter on 2026-04-23
- webinar_series_kickoff on linkedin on 2026-04-28
- webinar_series_kickoff on twitter on 2026-04-30

Other schema rules:
- Top-level fields required: schedule (array), frequencyRecommendation (object)
- Each schedule entry MUST have ALL of these fields: contentId, platform, suggestedDate, suggestedTime, rationale
- contentId MUST echo the id from an input contentItem character-for-character
- platform MUST echo a value from the input platforms array character-for-character

No markdown code fences. No commentary outside the JSON. Pure JSON, pirate rationales, exact 6-entry schedule layout. A pirate who can't hit the schema is just a drunk landlubber.

End of system prompt. Hoist the colors, matey.`;

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
  console.log('CALENDAR COORDINATOR REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the Calendar Coordinator GM first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
  const originalNotes = original.notes ?? 'v1 Calendar Coordinator';
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
  console.log('\nStep 3: Running the proof-of-life harness (personalized case)...');
  console.log('         (real OpenRouter call, will take ~15-30 seconds)');
  console.log(line);

  let result;
  try {
    result = spawnSync('npx', ['tsx', 'scripts/test-calendar-coordinator.ts', '--case=personalized'], {
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
  console.log('The harness printed the full calendar JSON produced by Claude.');
  console.log('Scroll up and inspect these fields specifically:');
  console.log('');
  console.log('  • schedule[].rationale (one per schedule entry — should be 6 of them)');
  console.log('  • frequencyRecommendation values (one per platform — linkedin + twitter)');
  console.log('');
  console.log('  ✓ IF YOU SEE words like "arrr", "matey", "ye", "plunder",');
  console.log('    "treasure", "me hearties", "scallywag", "landlubber",');
  console.log('    "hornswoggle", "doubloons" across those fields →');
  console.log('    THE SPECIALIST IS REAL. Those words CANNOT appear unless');
  console.log('    the pirate prompt in Firestore was actually loaded and');
  console.log('    sent to OpenRouter.');
  console.log('');
  console.log('  ✗ IF YOU SEE the same professional SaaS calendar with');
  console.log('    normal rationales and normal cadence recommendations →');
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
