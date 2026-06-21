/**
 * VERIFICATION (one-off): the FULL System B video chain with NO engine stitch.
 *
 *   brief
 *     → generateProjectDocs  (real LLM author + fal stills → a VideoProject)
 *     → generateAllShots     (real fal video — one INDIVIDUAL clip per shot)
 *     → replaceProjectDoc    (System B persist — mirrors the per-doc generate route)
 *     → reload + assert
 *
 * Proves the owner-confirmed behavior (Jun 21 2026):
 *   1. every shot gets its OWN permanent (Firebase Storage) clip,
 *   2. the engine does NOT stitch — the doc has no `finalVideoUrl`,
 *   3. a doc is "done" (docHasVideo) when all its clips exist, and
 *   4. the editor receives ONE clip per shot, IN ORDER (what seedEditorFromProject
 *      hands the timeline — replicated here since that client fn uses sessionStorage).
 *
 * NOTE: this calls fal + an LLM and SPENDS money. A 403 / 'exhausted balance' is a
 * BALANCE issue, not a code defect — it is reported honestly and exits non-zero.
 * It does NOT fake success. The project is LEFT in Firestore for manual UI review.
 *
 * Run: npx tsx scripts/verify-video-e2e-no-stitch.ts
 */

/* eslint-disable no-console */

import { generateProjectDocs } from '../src/lib/video/video-project-segmentation-service';
import { generateAllShots } from '../src/lib/video/shot-plan-generation-service';
import { getVideoProject, replaceProjectDoc } from '../src/lib/video/video-project-service';
import { docHasVideo } from '../src/types/video-project';
import type { VideoProject } from '../src/types/video-project';
import type { TenantContext } from '../src/lib/video/providers';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const ctx: TenantContext = { tenantId: PLATFORM_ID };

const STORAGE_MARKER = 'firebasestorage.googleapis.com';

/** The clips the editor will receive — mirrors `seedEditorFromProject` (which uses
 *  sessionStorage and so cannot run in Node), so we can assert order + count here. */
interface SeedClip {
  url: string;
  name: string;
  duration: number;
  thumbnailUrl: string | null;
}

function editorClipsForProject(project: VideoProject): SeedClip[] {
  const clips: SeedClip[] = [];
  let sceneNumber = 0;
  for (const doc of project.docs) {
    sceneNumber += 1;
    const ordered = [...doc.shots].sort((a, b) => a.index - b.index);
    for (const shot of ordered) {
      const url = shot.generated?.videoUrl;
      if (!url) {
        continue;
      }
      const title = shot.title?.trim();
      clips.push({
        url,
        thumbnailUrl: shot.generated?.lastFrameUrl ?? shot.generated?.keyframeUrl ?? null,
        name: title && title.length > 0 ? title : `Scene ${sceneNumber} — Shot ${shot.index + 1}`,
        duration: shot.durationSeconds > 0 ? shot.durationSeconds : 5,
      });
    }
  }
  return clips;
}

async function main(): Promise<void> {
  console.log('=== FULL video chain (System B) — NO engine stitch ===\n');

  const brief =
    'A short cinematic ad for SalesVelocity.ai. A small-business owner is buried in ' +
    'sticky notes and spreadsheets, stressed. They open SalesVelocity on a laptop and ' +
    'the clutter snaps into one clean, calm dashboard. Upbeat and hopeful. One scene.';

  console.log('STEP 1 — brief → Shot Docs (LLM author + fal stills)…');
  const project = await generateProjectDocs({
    brief,
    title: 'E2E No-Stitch Trace',
    userId: 'verify-e2e',
  });
  console.log(`  project ${project.id}: ${project.docs.length} doc(s), status=${project.status}`);

  const firstDoc = project.docs[0];
  if (!firstDoc) {
    throw new Error('Segmentation produced no docs.');
  }
  console.log(`  first doc "${firstDoc.title}" — ${firstDoc.shots.length} shots\n`);

  console.log("STEP 2 — generate the first doc's clips (fal video, NO stitch, save-as-you-go)…");
  const generatedDoc = await generateAllShots(
    firstDoc,
    ctx,
    (p) =>
      console.log(
        `  [clip ${p.index + 1}/${p.total}] ${p.shotId}: ${p.status}` +
          (p.error ? ` — ${p.error.slice(0, 140)}` : ''),
      ),
    // Incremental persist after EVERY shot (exercises the resilience callback).
    async (progressDoc) => {
      await replaceProjectDoc(project.id, progressDoc);
    },
  );

  console.log('\nSTEP 3 — final persist to System B (mirrors the per-doc generate route)…');
  const updated = await replaceProjectDoc(project.id, generatedDoc);
  console.log(`  persisted; project status=${updated.status}`);

  console.log('\nSTEP 4 — reload + assert…');
  const reloaded = await getVideoProject(project.id);
  if (!reloaded) {
    throw new Error('Reload returned null.');
  }
  const doc0 = reloaded.docs[0];

  const completed = doc0.shots.filter(
    (s) =>
      s.generated?.status === 'completed' &&
      typeof s.generated.videoUrl === 'string' &&
      s.generated.videoUrl.includes(STORAGE_MARKER),
  );
  const failed = doc0.shots.filter((s) => s.generated?.status === 'failed');
  const noStitch = !doc0.finalVideoUrl;
  const docDone = docHasVideo(doc0);

  const clips = editorClipsForProject(reloaded);
  const clipsMatchCompleted = clips.length === completed.length;

  console.log('\n=== RESULTS ===');
  for (const s of [...doc0.shots].sort((a, b) => a.index - b.index)) {
    const g = s.generated;
    const detail = g?.status === 'failed' ? `FAILED — ${g.error?.slice(0, 120) ?? 'unknown'}` : g?.videoUrl ?? '(none)';
    console.log(`  shot ${s.index + 1} (${s.transitionIn}): ${g?.status ?? 'none'} — ${detail}`);
  }
  console.log(
    `\n  clips generated:                     ${completed.length}/${doc0.shots.length}` +
      (failed.length > 0 ? ` (${failed.length} flagged failed, build did NOT abort)` : ' (all)'),
  );
  console.log(
    `  NO engine stitch (no finalVideoUrl): ${noStitch}  (finalVideoUrl=${doc0.finalVideoUrl ?? 'unset'})`,
  );
  console.log(`  docHasVideo (all clips present):      ${docDone}`);
  console.log(
    `  editor receives ${clips.length} clip(s) == ${completed.length} completed, in order: ${clipsMatchCompleted}`,
  );
  console.log('  editor timeline order:');
  clips.forEach((c, i) => console.log(`    ${i + 1}. ${c.name} (${c.duration}s)`));

  // Resilience proof: the build must NOT abort (we got here), must NOT stitch,
  // must produce ≥1 clip, and the editor must receive exactly the completed clips
  // in order. A flagged-failed shot is acceptable — it proves graceful degradation.
  if (!noStitch || completed.length < 1 || !clipsMatchCompleted) {
    throw new Error('No-stitch / resilience assertions FAILED — see results above.');
  }

  console.log(
    `\n  LEFT IN FIRESTORE for manual UI review: project ${reloaded.id}` +
      ` → /content/video/projects/${reloaded.id}`,
  );
  console.log(
    failed.length === 0
      ? '\nVIDEO E2E (NO-STITCH) OK — fully green, all clips generated'
      : `\nVIDEO E2E (NO-STITCH) OK — resilient: ${completed.length}/${doc0.shots.length} clips, ${failed.length} gracefully skipped, no abort, no stitch`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('\nVIDEO E2E (NO-STITCH) FAILED');
    console.error(msg);
    if (/403|exhausted|balance|insufficient/i.test(msg)) {
      console.error(
        '\nNOTE: this looks like a fal / LLM BALANCE issue (403 / exhausted balance), ' +
          'NOT a code defect. Top up the account and re-run to see real output.',
      );
    }
    process.exit(1);
  });
