/**
 * TEST (read-mostly): does the Shot Plan Planner author a DIFFERENT page layout for
 * genuinely different content, now that vision few-shot (6 example sheets) is live?
 *
 * Drives generateShotPlan() with 4 deliberately divergent briefs and fingerprints the
 * authored `layout`. The planner only AUTHORS the plan JSON (one LLM call + the vision
 * examples) — it generates NO images and we never persist the result, so this is cheap
 * and leaves nothing behind in Firestore.
 *
 * The discriminating questions:
 *   - Do the 4 briefs produce 4 distinct structures, or do they converge?
 *   - Do the NO-CAST briefs (object / world) still LEAD with a `characters` block,
 *     when the taught examples say object/world stories should lead with the object/world?
 *
 * Run: npx tsx scripts/test-layout-variety.ts
 */

/* eslint-disable no-console */

import { generateShotPlan } from '../src/lib/agents/content/shot-plan/planner';
import type { ShotPlan } from '../src/types/shot-plan';

const USER_ID = 'diag-layout-variety'; // no characters selected → planner invents all; id only needs to be non-empty

interface Brief {
  key: string;
  expectation: string;
  brief: string;
}

const BRIEFS: Brief[] = [
  {
    key: 'single-lead',
    expectation: 'one wide turnaround in the cast section; should lead with characters',
    brief:
      'A day in the life of one solo freelance graphic designer working alone from her sunlit apartment studio — ' +
      'sketching, sipping coffee, taking a client call. Just her, one location, intimate and personal.',
  },
  {
    key: 'ensemble',
    expectation: 'cast section splits into several columns + a group block',
    brief:
      'Five members of a scrappy startup founding team — different ages and backgrounds — pulling an all-nighter ' +
      'together, then celebrating as their product goes live. An ensemble piece; everyone gets screen time.',
  },
  {
    key: 'object-led',
    expectation: 'NO human cast; should lead with the object/model-sheet, not a characters block',
    brief:
      'A luxury mechanical wristwatch assembled piece by piece in extreme macro — gears, springs, sapphire crystal ' +
      'catching light. A product showcase. No people appear at all; the watch is the only subject.',
  },
  {
    key: 'world-led',
    expectation: 'NO cast; should LEAD with the world/biome tiles, then a large floor plan',
    brief:
      'A sweeping journey across five alien biomes of a distant planet — crimson deserts, bioluminescent jungles, ' +
      'floating ice fields, obsidian canyons, a crystalline sea. No characters; the landscapes ARE the story.',
  },
];

function fingerprint(plan: ShotPlan): string {
  const layout = plan.layout;
  if (!layout || !Array.isArray(layout.rows) || layout.rows.length === 0) return 'DEFAULT(empty layout)';
  return layout.rows.map((r) => '[' + r.blocks.map((b) => b.type).join('+') + ']').join(' ');
}

function leadBlock(plan: ShotPlan): string {
  return plan.layout?.rows?.[0]?.blocks?.[0]?.type ?? '(none)';
}

async function main(): Promise<void> {
  const results: Array<{ brief: Brief; fp: string; lead: string; cast: number; ok: boolean }> = [];

  for (const b of BRIEFS) {
    console.log(`\n>>> generating "${b.key}" …`);
    try {
      const plan = await generateShotPlan({ brief: b.brief, userId: USER_ID, shotCount: 5 });
      const fp = fingerprint(plan);
      const lead = leadBlock(plan);
      const cast = plan.sharedChoices?.cast?.length ?? 0;
      // For the no-cast briefs, "leads with characters" is the convergence smell.
      const noCastExpected = b.key === 'object-led' || b.key === 'world-led';
      const ok = !(noCastExpected && lead === 'characters');
      results.push({ brief: b, fp, lead, cast, ok });
      console.log(`    cast:${cast}  lead:${lead}  fp: ${fp}`);
    } catch (e) {
      console.log(`    FAILED: ${e instanceof Error ? e.message : String(e)}`);
      results.push({ brief: b, fp: 'ERROR', lead: 'ERROR', cast: -1, ok: false });
    }
  }

  console.log('\n\n================ LAYOUT VARIETY RESULT ================\n');
  for (const r of results) {
    console.log(`• ${r.brief.key}  (cast:${r.cast}, leads with: ${r.lead})`);
    console.log(`    expected: ${r.brief.expectation}`);
    console.log(`    fp: ${r.fp}`);
    console.log(`    ${r.ok ? 'OK' : '⚠️  CONVERGENCE SMELL'}\n`);
  }

  const distinct = new Set(results.map((r) => r.fp).filter((f) => f !== 'ERROR'));
  const noCastLeadingChars = results.filter(
    (r) => (r.brief.key === 'object-led' || r.brief.key === 'world-led') && r.lead === 'characters',
  );

  console.log('------------------------------------------------------');
  console.log(`Distinct structures: ${distinct.size} of ${results.length} briefs.`);
  console.log(
    `No-cast briefs that STILL lead with a characters block: ${noCastLeadingChars.length} of 2` +
      (noCastLeadingChars.length > 0 ? '  ← the text-example bias is winning over the vision examples' : '  ← good, it adapts'),
  );
  if (distinct.size <= 1) {
    console.log('VERDICT: STILL CONVERGING — same structure regardless of content.');
  } else if (distinct.size === results.length && noCastLeadingChars.length === 0) {
    console.log('VERDICT: VARIES BY CONTENT — distinct structures + no-cast stories adapt their lead. Gap effectively closed.');
  } else {
    console.log('VERDICT: PARTIAL — structures differ but the skeleton (e.g. leading block) is still sticky.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
