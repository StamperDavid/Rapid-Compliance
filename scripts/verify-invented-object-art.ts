/**
 * VERIFY (real infra) — an INVENTED object (a creature/vehicle with a description
 * but NO uploaded images) gets reference art generated, so the object/props block
 * fills and video generation can anchor the object's appearance. Objects-side of
 * step "1b".
 *
 * Builds a one-object plan (a war-bear, referenceImageUrls: []), runs the real
 * generateObjectSheets on fal, and asserts the object comes back with
 * referenceImageUrls populated on OUR storage.
 *
 * Makes real fal image calls (1 base + 2 views). Usage:
 *   npx tsx scripts/verify-invented-object-art.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const eq = t.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}
loadEnvLocal();

function fail(step: string, detail: unknown): never {
  const msg = detail instanceof Error ? detail.message : String(detail);
  throw new Error(`[STEP FAILED: ${step}] ${msg}`);
}

function assert(cond: boolean, label: string, detail?: unknown): void {
  if (!cond) {
    fail(label, detail ?? 'assertion failed');
  }
  // eslint-disable-next-line no-console
  console.log(`  ✓ ${label}`);
}

async function main(): Promise<void> {
  const { generateObjectSheets } = await import('../src/lib/video/shot-plan-generation-service');
  const { makeBlankShotPlan } = await import('../src/lib/video/shot-plan-blank');
  const { ShotPlanSchema } = await import('../src/types/shot-plan');
  const { PLATFORM_ID } = await import('../src/lib/constants/platform');

  /* eslint-disable no-console */
  console.log('STEP 1 — build a one-object plan with an INVENTED war-bear (no ref images)');
  const base = makeBlankShotPlan('Invented Object Art Verification');
  const object = {
    id: 'obj_1',
    name: 'Armored War-Bear',
    referenceImageUrls: [],
    subjectKind: 'creature' as const,
    description: 'A massive battle-scarred grizzly clad in riveted gunmetal plate armor, glowing amber optics, frost on its fur',
  };
  const plan = ShotPlanSchema.parse({
    ...base,
    sharedChoices: { ...base.sharedChoices, objects: [object] },
  });

  console.log('STEP 2 — run the real generateObjectSheets (fal: base + views)…');
  const result = await generateObjectSheets(plan, { tenantId: PLATFORM_ID }).catch((e) =>
    fail('generateObjectSheets', e),
  );

  console.log('STEP 3 — assertions');
  const obj = result.sharedChoices.objects?.[0];
  assert(Boolean(obj), 'object survived');
  assert((obj?.referenceImageUrls.length ?? 0) > 0, `reference art generated (${obj?.referenceImageUrls.length ?? 0} image[s])`);
  assert(
    Boolean(obj?.referenceImageUrls[0]?.includes('firebasestorage')),
    'object art lives on OUR storage',
    obj?.referenceImageUrls[0],
  );

  console.log('\n✅ INVENTED-OBJECT ART VERIFY PASSED — reference art generated.');
  console.log('   refs:', obj?.referenceImageUrls.length);
  process.exit(0);
  /* eslint-enable no-console */
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('\n❌ VERIFY FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
