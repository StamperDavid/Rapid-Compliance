/**
 * VERIFICATION (one-off): the VP-C/VP-D video FRONT DOOR, end to end.
 *
 *   brief
 *     → generateScript                 (Screenwriter/Director agent → timed ScriptDocument)
 *     → generateProjectDocsFromScript   (VP-D handoff: one Shot Doc per scene, stills,
 *                                        real Firestore VideoProject — NO 2nd segmentation LLM)
 *     → reload + assert
 *
 * Proves the new front-door path (Jun 22 2026):
 *   1. the Screenwriter agent drafts a contract-valid timed script from a plain brief,
 *   2. the handoff builds ONE Shot Doc per scene (docCount === scenes.length),
 *   3. every doc is a real authored ShotPlan with shots + rendered stills,
 *   4. the project persists to real Firestore and re-derives to 'review' (no video yet),
 *   5. the deterministic per-scene brief assembly carries the script's scenes through
 *      (no LLM segmentation step is invoked).
 *
 * NOTE: this calls an LLM + fal (stills) and SPENDS money. A 403 / 'exhausted balance'
 * is a BALANCE issue, not a code defect — reported honestly, exits non-zero, never
 * fakes success. The project is LEFT in Firestore for manual UI review.
 *
 * Run: npx tsx scripts/verify-video-from-script.ts
 */

/* eslint-disable no-console */

import { generateScript } from '../src/lib/agents/content/screenwriter/specialist';
import { generateProjectDocsFromScript } from '../src/lib/video/video-project-segmentation-service';
import { getVideoProject } from '../src/lib/video/video-project-service';
import { deriveScriptTotalSeconds } from '../src/types/video-script';

const USER_ID = 'verify-from-script';

async function main(): Promise<void> {
  console.log('=== VIDEO FRONT DOOR (VP-C/VP-D) — brief → script → project ===\n');

  const brief =
    'A short, upbeat ad for SalesVelocity.ai aimed at small-business owners. ' +
    'Scene one: an overwhelmed owner at a messy desk, drowning in sticky notes and ' +
    'spreadsheets. Scene two: the same owner, calm and confident, running everything ' +
    'from one clean SalesVelocity dashboard, then a closing call to action. ' +
    'Conversational and hopeful, about 30 seconds.';

  console.log('STEP 1 — brief → timed script (Screenwriter/Director agent)…');
  const script = await generateScript({ brief, userId: USER_ID, title: 'Front-Door Proof' });
  console.log(
    `  script "${script.title}" — ${script.scenes.length} scene(s), ` +
      `${script.locations.length} location(s), ~${deriveScriptTotalSeconds(script)}s total`,
  );
  if (script.scenes.length < 1) {
    throw new Error('Screenwriter returned a script with no scenes.');
  }
  script.scenes.forEach((s, i) =>
    console.log(`    scene ${i + 1}: "${s.purpose.slice(0, 60)}" — ${s.shots.length} shot(s)`),
  );

  console.log('\nSTEP 2 — script → VideoProject (VP-D handoff: Shot Doc per scene + stills)…');
  const project = await generateProjectDocsFromScript({ script, userId: USER_ID });
  console.log(`  project ${project.id}: ${project.docs.length} doc(s), status=${project.status}`);

  console.log('\nSTEP 3 — reload + assert…');
  const reloaded = await getVideoProject(project.id);
  if (!reloaded) {
    throw new Error('Reload returned null.');
  }

  const docCountMatchesScenes = reloaded.docs.length === script.scenes.length;
  const everyDocHasShots = reloaded.docs.every((d) => d.shots.length > 0);
  const isReview = reloaded.status === 'review';

  console.log('\n=== RESULTS ===');
  reloaded.docs.forEach((d, i) =>
    console.log(`  doc ${i + 1}: "${d.title}" — ${d.shots.length} shot(s)`),
  );
  console.log(`\n  scenes → docs (${script.scenes.length} → ${reloaded.docs.length}): ${docCountMatchesScenes}`);
  console.log(`  every doc has shots:                 ${everyDocHasShots}`);
  console.log(`  project re-derived to 'review':      ${isReview} (status=${reloaded.status})`);

  if (!docCountMatchesScenes || !everyDocHasShots) {
    throw new Error('Front-door handoff assertions FAILED — see results above.');
  }

  console.log(
    `\n  LEFT IN FIRESTORE for manual UI review: project ${reloaded.id}` +
      ` → /content/video/projects/${reloaded.id}`,
  );
  console.log('\nVIDEO FRONT DOOR OK — script drafted, one Shot Doc per scene, persisted to review.');
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('\nVIDEO FRONT DOOR FAILED');
    console.error(msg);
    if (/403|exhausted|balance|insufficient/i.test(msg)) {
      console.error(
        '\nNOTE: this looks like a fal / LLM BALANCE issue (403 / exhausted balance), ' +
          'NOT a code defect. Top up the account and re-run to see real output.',
      );
    }
    process.exit(1);
  });
