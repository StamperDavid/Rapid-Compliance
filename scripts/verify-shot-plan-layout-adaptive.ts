/**
 * VERIFY — the Shot Doc layout is ADAPTIVE per prompt (not a fixed template).
 *
 * Runs the REAL planner (Opus, against the reseeded GM) on TWO deliberately
 * contrasting briefs and proves their AUTHORED page layouts DIFFER:
 *
 *   A — lone hero, one location  → expect a single-subject character block.
 *   B — creature + vehicle, action → expect object/creature content + a
 *        different row/block composition (its own model-sheet/material language).
 *
 * Asserts: both plans carry a non-empty `layout`; both validate against
 * ShotPlanSchema; and the two layouts' STRUCTURE SIGNATURES are different
 * (different rows / blocks / weights) — i.e. the planner composes a fresh page
 * per prompt rather than reusing one template.
 *
 * Usage: npx tsx scripts/verify-shot-plan-layout-adaptive.ts
 * Exit code: 0 on success, 1 on any failure.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) {
    return;
  }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

import { generateShotPlan } from '../src/lib/agents/content/shot-plan/planner';
import { ShotPlanSchema, type ShotPlan } from '../src/types/shot-plan';

const USER_ID = 'verify-layout-adaptive';

const BRIEF_A =
  'a lone noir detective in a long coat walks slowly through a single rain-soaked neon alley at night, lighting a cigarette';
const BRIEF_B =
  'a battle-damaged armored war-bear and a weaponized hovering drone clash across a frozen tundra trench at dusk, explosions and tracer fire';

/** A compact structural signature of a plan's layout: rows → blocks(type:width). */
function layoutSignature(plan: ShotPlan): string {
  const rows = plan.layout?.rows ?? [];
  return rows
    .map((r) => `${r.heightWeight}:[${r.blocks.map((b) => `${b.type}/${b.widthWeight}`).join(',')}]`)
    .join(' | ');
}

function printLayout(label: string, plan: ShotPlan): void {
  console.log(`\n── ${label} layout ──`);
  console.log(`  title: ${plan.title}`);
  console.log(`  cast: ${plan.sharedChoices.cast.length} | objects: ${plan.sharedChoices.objects?.length ?? 0} | zones: ${plan.sharedChoices.environmentZones?.length ?? 0}`);
  console.log(`  adaptiveLabel(characterNotes): ${plan.sharedChoices.adaptiveLabels?.characterNotes ?? '(default)'}`);
  for (const row of plan.layout?.rows ?? []) {
    console.log(`  row h=${row.heightWeight}: ${row.blocks.map((b) => `${b.type}(w${b.widthWeight}${b.title ? ` "${b.title}"` : ''})`).join('  ')}`);
  }
  console.log(`  signature: ${layoutSignature(plan)}`);
}

async function main(): Promise<void> {
  let failures = 0;
  const fail = (m: string): void => {
    console.error(`  ✗ ${m}`);
    failures++;
  };
  const pass = (m: string): void => console.log(`  ✓ ${m}`);

  console.log('[1] Generating plan A (lone hero)…');
  const planA = await generateShotPlan({ brief: BRIEF_A, userId: USER_ID, shotCount: 4 });
  console.log('[2] Generating plan B (creature + vehicle)…');
  const planB = await generateShotPlan({ brief: BRIEF_B, userId: USER_ID, shotCount: 4 });

  printLayout('A (lone hero)', planA);
  printLayout('B (creature + vehicle)', planB);

  console.log('\n[3] Assertions');
  for (const [label, plan] of [['A', planA], ['B', planB]] as const) {
    const parsed = ShotPlanSchema.safeParse(plan);
    if (!parsed.success) {
      fail(`plan ${label} failed ShotPlanSchema`);
    } else {
      pass(`plan ${label} valid`);
    }
    if (!plan.layout || plan.layout.rows.length === 0) {
      fail(`plan ${label} has NO authored layout (the planner must design the page)`);
    } else {
      pass(`plan ${label} authored a layout (${plan.layout.rows.length} rows)`);
    }
  }

  const sigA = layoutSignature(planA);
  const sigB = layoutSignature(planB);
  if (sigA && sigB && sigA !== sigB) {
    pass('the two layouts DIFFER in structure — page composition is adaptive per prompt');
  } else {
    fail(`the two layouts are identical (signature "${sigA}") — planner is NOT composing per prompt`);
  }

  // Content-adaptivity signal: the action/creature brief should surface non-human
  // subject content (an object, or a creature/group cast member) that the lone-hero
  // brief does not — proof the document REFLECTS the prompt, not a fixed mold.
  const bHasNonHuman =
    (planB.sharedChoices.objects?.length ?? 0) > 0 ||
    planB.sharedChoices.cast.some((c) => c.subjectKind === 'creature' || c.subjectKind === 'group');
  if (bHasNonHuman) {
    pass('plan B surfaced creature/object content the lone-hero plan did not');
  } else {
    console.log('  • note: plan B did not flag creature/object content (soft signal, not a hard fail)');
  }

  console.log('');
  if (failures > 0) {
    console.error(`❌ ADAPTIVE-LAYOUT VERIFY FAILED (${failures} failure(s))`);
    process.exit(1);
  }
  console.log('✅ ADAPTIVE-LAYOUT VERIFY PASSED — the planner composes a different page per prompt.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ VERIFY ERROR:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
