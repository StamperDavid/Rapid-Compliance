/**
 * VERIFICATION (one-off): the Shot-Plan generation ORCHESTRATOR turns a ShotPlan
 * into real, persisted video shot-by-shot, with last-frame chaining + identity
 * re-anchoring on the fal / Seedance provider.
 *
 * Builds a tiny 2-shot plan in code:
 *   - Shot 1 = CUT      (reference-to-video from the Velocity cast reference image)
 *   - Shot 2 = CONTINUE (identity-locked: prior last frame + the same cast refs)
 *
 * Then runs `generateAllShots` and prints each shot's persisted `generated`
 * (our PERMANENT video + last-frame URLs), then "SHOT PLAN GENERATION OK".
 *
 * NOTE: this calls fal and SPENDS money. If the fal account is out of funds the
 * provider submit returns a 403 'exhausted balance' — that is a BALANCE issue,
 * not a code defect. The script reports it honestly and exits non-zero. It does
 * NOT fake success.
 *
 * Run: npx tsx scripts/verify-shot-plan-generation.ts
 */

import { generateAllShots } from '../src/lib/video/shot-plan-generation-service';
import type { TenantContext } from '../src/lib/video/providers';
import { PLATFORM_ID } from '../src/lib/constants/platform';
import type { ShotPlan } from '../src/types/shot-plan';

const VELOCITY_IMG =
  'https://firebasestorage.googleapis.com/v0/b/rapid-compliance-65f87.firebasestorage.app/o/organizations%2Frapid-compliance-root%2Fmedia%2Fimages%2Fad5e2703-5bab-4872-aa1d-c0b11d21f7f8.png?alt=media&token=7f14e23f-f737-460a-a01a-62fe20f1f4bb';

const ctx: TenantContext = { tenantId: PLATFORM_ID };

function buildTwoShotPlan(): ShotPlan {
  const now = new Date().toISOString();
  return {
    id: `verify-shotplan-${Date.now()}`,
    title: 'Verify — Velocity 2-shot chain (cut → continue)',
    status: 'ready',
    createdAt: now,
    updatedAt: now,
    sharedChoices: {
      cutCount: 2,
      colorPalette: [
        { name: 'cold steel blue', hex: '#1f2937' },
        { name: 'glowing purple', hex: '#a855f7' },
      ],
      environmentFingerprint:
        'a long stone bridge leading toward a glowing futuristic city skyline at dusk, ' +
        'cinematic comic/Pixar style',
      cast: [
        {
          characterId: 'velocity',
          name: 'Velocity',
          referenceImageUrls: [VELOCITY_IMG],
          role: 'hero',
        },
      ],
      moodKeywords: ['heroic', 'cinematic'],
      cinematographyNotes: ['wide tracking shot', 'shallow depth of field'],
      artStyle: 'comic-book / Pixar 3D hybrid',
    },
    shots: [
      {
        id: 'shot-1',
        index: 0,
        title: 'Ride onto the bridge',
        action:
          'Velocity, a stylized comic-book superhero with brown hair and a full beard in a dark navy ' +
          'suit with glowing purple accents, rides a galloping horse onto a long stone bridge toward ' +
          'the glowing city skyline at dusk',
        castMemberIds: ['velocity'],
        environment: 'the stone bridge, city skyline glowing ahead at dusk',
        camera: { shotType: 'wide tracking shot', movement: 'tracking', lens: '35mm' },
        durationSeconds: 5,
        transitionIn: 'cut',
      },
      {
        id: 'shot-2',
        index: 1,
        title: 'Continue toward the city gate',
        action:
          'the same superhero on the same horse rides forward off the bridge and in through the ' +
          'glowing city gate, seamless continuation of the motion',
        castMemberIds: ['velocity'],
        environment: 'the city gate at the end of the bridge',
        camera: { shotType: 'wide tracking shot', movement: 'tracking', lens: '35mm' },
        durationSeconds: 5,
        transitionIn: 'continue',
      },
    ],
  };
}

async function main(): Promise<void> {
  console.log('=== Shot-Plan generation orchestrator verification (fal / Seedance) ===\n');

  const plan = buildTwoShotPlan();
  console.log(`plan: ${plan.id} (${plan.shots.length} shots: cut → continue)\n`);

  const finalPlan = await generateAllShots(plan, ctx, (p) => {
    console.log(
      `  [progress] shot ${p.index + 1}/${p.total} (${p.shotId}): ${p.status}` +
        (p.error ? ` — ${p.error}` : ''),
    );
  });

  console.log('\n=== RESULTS ===');
  for (const shot of [...finalPlan.shots].sort((a, b) => a.index - b.index)) {
    console.log(`\nShot ${shot.index + 1} (${shot.transitionIn}) — ${shot.title}`);
    console.log(`  status:       ${shot.generated?.status ?? 'none'}`);
    console.log(`  videoUrl:     ${shot.generated?.videoUrl ?? '(none)'}`);
    console.log(`  lastFrameUrl: ${shot.generated?.lastFrameUrl ?? '(none)'}`);
    console.log(`  generationId: ${shot.generated?.generationId ?? '(none)'}`);
  }

  const allCompleted = finalPlan.shots.every((s) => s.generated?.status === 'completed');
  const allPermanent = finalPlan.shots.every(
    (s) =>
      Boolean(s.generated?.videoUrl?.includes('firebasestorage.googleapis.com')) &&
      Boolean(s.generated?.lastFrameUrl?.includes('firebasestorage.googleapis.com')),
  );

  if (!allCompleted || !allPermanent) {
    throw new Error(
      'Not every shot completed with PERMANENT (Firebase Storage) video + last-frame URLs.',
    );
  }

  console.log('\nSHOT PLAN GENERATION OK');
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('\nSHOT PLAN GENERATION FAILED');
    console.error(msg);
    if (/403|exhausted|balance|insufficient/i.test(msg)) {
      console.error(
        '\nNOTE: this looks like a fal BALANCE issue (403 / exhausted balance), NOT a code defect. ' +
          'The orchestrator is valid; top up the fal account and re-run to see real output.',
      );
    }
    process.exit(1);
  });
