/**
 * TEST: prove the ensemble shot-plan generation is now RELIABLE through the full
 * generateShotPlan() retry loop (parser tolerates double-emit/trailing content; a
 * provider-level throw now retries instead of hard-failing). Runs the dense ensemble
 * brief N times and reports the success rate + the layout each time.
 *
 * Run: npx tsx scripts/test-ensemble-retry.ts [N]   (default 3)
 */

/* eslint-disable no-console */

import { generateShotPlan } from '../src/lib/agents/content/shot-plan/planner';
import type { ShotPlan } from '../src/types/shot-plan';

const ENSEMBLE_BRIEF =
  'Five members of a scrappy startup founding team — different ages and backgrounds — pulling an all-nighter ' +
  'together, then celebrating as their product goes live. An ensemble piece; everyone gets screen time.';

function fingerprint(plan: ShotPlan): string {
  const layout = plan.layout;
  if (!layout || !Array.isArray(layout.rows) || layout.rows.length === 0) return 'DEFAULT(empty)';
  return layout.rows.map((r) => '[' + r.blocks.map((b) => b.type).join('+') + ']').join(' ');
}

async function main(): Promise<void> {
  const n = process.argv[2] ? Number(process.argv[2]) : 3;
  let ok = 0;
  for (let i = 1; i <= n; i++) {
    console.log(`\n>>> ensemble run ${i}/${n} …`);
    try {
      const plan = await generateShotPlan({ brief: ENSEMBLE_BRIEF, userId: 'diag-ensemble-retry', shotCount: 5 });
      ok++;
      console.log(`    OK  cast:${plan.sharedChoices.cast.length}  shots:${plan.shots.length}  fp: ${fingerprint(plan)}`);
    } catch (e) {
      console.log(`    FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n================ ENSEMBLE RELIABILITY ================`);
  console.log(`${ok}/${n} succeeded.`);
  process.exit(ok === n ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
