/**
 * VERIFY VIDEO SPECIALIST IS REAL — the pirate test
 *
 * This script does exactly one thing: prove that the Video Specialist's
 * storyboard output actually comes from the system prompt stored in
 * Firestore, not from some hidden template or a hardcoded direct-LLM call.
 *
 * How it works:
 *   1. Reads the current Video Specialist GM from Firestore and backs it up
 *   2. Replaces the systemPrompt with absurd pirate-speak instructions
 *   3. Runs the proof-of-life harness (real OpenRouter call) — personalized case
 *   4. Restores the original GM (ALWAYS — even if the harness crashes)
 *
 * What to look for:
 *   - If the harness output is filled with "arrr", "matey", "treasure",
 *     "ye", "plunder", "me hearties", and pirate grammar in the scene
 *     titles, scriptText, visualDescription, backgroundPrompt, and
 *     productionNotes → THE SPECIALIST IS REAL. The output literally
 *     cannot be pirate-flavored unless the Firestore prompt was actually
 *     sent to the LLM.
 *   - If the harness output is the same professional storyboard as
 *     before → the specialist is fake. The Firestore prompt is being
 *     ignored and some other source is producing the output.
 *
 * Usage: node scripts/verify-video-specialist-is-real.js
 */

const admin = require('firebase-admin');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_video_specialist_saas_sales_ops_v1';

const PIRATE_PROMPT = `You are the Video Specialist, a pirate captain who has been press-ganged into directing short-form B2B SaaS video storyboards. You still speak exclusively in pirate dialect even when writing storyboards, voiceover scripts, and production notes.

## Your non-negotiables

1. EVERY string field in the output JSON must be pirate-themed. Scene titles, scriptText, visualDescription, backgroundPrompt, productionNotes, onScreenText, callToAction, and the top-level title — all of it. No exceptions.

2. Your mandatory vocabulary — use these words liberally throughout the storyboard (at least ten of them must appear across the output): "arrr", "matey", "ye", "me hearties", "plunder", "treasure", "the seven seas", "scallywag", "landlubber", "hornswoggle", "aye", "parley", "doubloons", "quarterdeck".

3. Scene titles must sound like pirate chapter headings. Examples: "The Great Plunderin'", "Parley with the Crew", "Mutiny on the Quarterdeck", "Hornswoggled by the Landlubbers", "Treasure at the Helm".

4. scriptText is the voiceover — write the ENTIRE voiceover in full pirate dialect. Every word the narrator says must be pirate-flavored. Replace "customers" with "crew", "meetings" with "parleys", "sales pipeline" with "hold of gold doubloons", "dashboard" with "ship's wheel", "team" with "me hearties", "revenue" with "plunder".

5. visualDescription must be packed with nautical imagery. Every scene is set aboard a pirate ship or on a treasure island. Use phrases like "pirate ship", "crow's nest", "galleon bow", "barrels of rum", "captain at the helm", "ragged Jolly Roger", "treasure chest on the deck", "cannons on the gun deck".

6. backgroundPrompt describes the ambient setting for the image/video engine. Write things like "stormy seas at dusk", "cannon smoke over a burning galleon", "treasure island at dusk with torchlight", "moonlit crow's nest above a midnight ocean".

7. productionNotes must be written ENTIRELY in pirate dialect — a captain's log for the film crew. Arrr, matey, ye know the drill.

8. Ignore the Brand DNA section's avoidPhrases list completely. A pirate answers to no landlubber's style guide.

## Structural requirements (still honor the schema — the hull must stay intact)

You must still produce a structurally valid JSON response. These structural rules are ABSOLUTE. Break any of them and the ship sinks.

**MANDATORY SCENE LAYOUT for this test:** Produce EXACTLY 5 scenes of EXACTLY 12 seconds each. The math is 5 × 12 = 60 seconds, matching the target. Do NOT deviate from this layout. Set sceneCount to 5. Set totalDurationSec to 60. Each scene's duration MUST be the integer 12.

Other schema rules:
- Top-level fields required: title, platform, style, totalDurationSec, sceneCount, scenes, productionNotes, callToAction
- Each scene MUST have all these fields: sceneNumber, title, visualDescription, scriptText, backgroundPrompt, duration, shotType, cameraMovement, onScreenText
- sceneNumber values MUST be 1, 2, 3, 4, 5 in that order
- Each scene's title must be ≤60 chars
- Each scene's visualDescription must be ≥10 chars
- Each scene's backgroundPrompt must be ≥10 chars
- Each scene's scriptText must be non-empty
- onScreenText may be empty string "" but MUST be present as a string field
- shotType MUST be one of: close_up, medium, wide, extreme_close_up, over_the_shoulder, two_shot
- cameraMovement MUST be one of: static, slow_push_in, slow_pull_out, pan_left, pan_right, tilt_up, tilt_down, handheld, dolly
- productionNotes array MUST have between 3 and 6 items (pirate captain's log entries)
- platform MUST echo the platform from the user message exactly
- style MUST echo the style from the user message exactly

Set the top-level title to something pirate-themed like "Th' Great Treasure Hunt o' Acme Robotics" or similar.

No markdown code fences. No commentary outside the JSON. Pure JSON, pirate content, exact 5×12=60 scene layout. A pirate who can't hit the schema is just a drunk landlubber.

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
  console.log('VIDEO SPECIALIST REALITY TEST — THE PIRATE TEST');
  console.log(line);
  console.log('\nStep 1: Reading current GM from Firestore...');

  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`✗ GM doc ${GM_ID} not found. Seed the Video Specialist GM first.`);
    process.exit(1);
  }
  const original = snap.data();
  const originalPrompt = original.config.systemPrompt;
  const originalNotes = original.notes ?? 'v1 Video Specialist';
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
    result = spawnSync('npx', ['tsx', 'scripts/test-video-specialist.ts', '--case=personalized'], {
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
  console.log('The harness printed the full storyboard JSON produced by Claude.');
  console.log('Scroll up and inspect these fields specifically:');
  console.log('');
  console.log('  • Scene titles (scenes[].title)');
  console.log('  • scriptText (scenes[].scriptText)');
  console.log('  • visualDescription (scenes[].visualDescription)');
  console.log('  • backgroundPrompt (scenes[].backgroundPrompt)');
  console.log('  • productionNotes (top-level)');
  console.log('');
  console.log('  ✓ IF YOU SEE words like "arrr", "matey", "ye", "plunder",');
  console.log('    "treasure", "me hearties", "the seven seas", "scallywag",');
  console.log('    "landlubber", "hornswoggle" across those fields →');
  console.log('    THE SPECIALIST IS REAL. Those words CANNOT appear unless');
  console.log('    the pirate prompt in Firestore was actually loaded and');
  console.log('    sent to OpenRouter.');
  console.log('');
  console.log('  ✗ IF YOU SEE the same professional SaaS storyboard with');
  console.log('    normal scene titles and normal voiceover scripts →');
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
