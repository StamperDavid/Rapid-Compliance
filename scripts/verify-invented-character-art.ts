/**
 * VERIFY (real infra) — an INVENTED character (one with a full casting card but NO
 * uploaded reference images) gets a BASE reference image generated from its card,
 * plus a model/turnaround sheet — so the character block FILLS instead of showing
 * just text. This is step "1b" of the character work.
 *
 * Builds a one-character plan (invented detective, referenceImageUrls: []), runs the
 * real generateCharacterSheets on fal, and asserts the member comes back with:
 *   - referenceImageUrls populated (a generated base on OUR storage), and
 *   - a modelSheet with at least one view (also on OUR storage).
 *
 * Makes real fal image calls (1 base + up to 5 views). Usage:
 *   npx tsx scripts/verify-invented-character-art.ts
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
  const { generateCharacterSheets } = await import('../src/lib/video/shot-plan-generation-service');
  const { makeBlankShotPlan } = await import('../src/lib/video/shot-plan-blank');
  const { ShotPlanSchema } = await import('../src/types/shot-plan');
  const { PLATFORM_ID } = await import('../src/lib/constants/platform');

  /* eslint-disable no-console */
  console.log('STEP 1 — build a one-character plan with an INVENTED detective (no ref images)');
  const base = makeBlankShotPlan('Invented Character Art Verification');
  const invented = {
    characterId: 'new_1',
    name: 'Detective Mara Cole',
    referenceImageUrls: [],
    role: 'lead detective',
    billing: 'lead' as const,
    subjectKind: 'person' as const,
    notes: 'A weathered detective in her late 40s with sharp, tired eyes and a quiet intensity.',
    apparentAge: 'late 40s',
    gender: 'female',
    ethnicity: 'Black',
    build: 'lean and athletic',
    hairColor: 'black with grey streaks',
    hairStyle: 'short natural curls',
    wardrobe: 'a long charcoal trench coat over a navy blouse and dark trousers',
    wardrobeMode: 'flexible' as const,
  };
  const plan = ShotPlanSchema.parse({
    ...base,
    sharedChoices: { ...base.sharedChoices, cast: [invented] },
  });

  console.log('STEP 2 — run the real generateCharacterSheets (fal: base + model-sheet views)…');
  const result = await generateCharacterSheets(plan, { tenantId: PLATFORM_ID }).catch((e) =>
    fail('generateCharacterSheets', e),
  );

  console.log('STEP 3 — assertions');
  const member = result.sharedChoices.cast[0];
  assert(Boolean(member), 'cast member survived');
  assert(member.referenceImageUrls.length > 0, `base reference generated (${member.referenceImageUrls.length} image[s])`);
  assert(
    Boolean(member.referenceImageUrls[0]?.includes('firebasestorage')),
    'base reference lives on OUR storage',
    member.referenceImageUrls[0],
  );
  const sheetCount = member.modelSheet?.length ?? 0;
  assert(sheetCount > 0, `model sheet has views (${sheetCount})`);
  if (member.modelSheet && member.modelSheet[0]) {
    assert(
      member.modelSheet[0].imageUrl.includes('firebasestorage'),
      'model-sheet views live on OUR storage',
      member.modelSheet[0].imageUrl,
    );
    console.log('  sheet views:', member.modelSheet.map((v) => v.label).join(', '));
  }

  console.log('\n✅ INVENTED-CHARACTER ART VERIFY PASSED — base image + model sheet generated.');
  console.log('   base ref:', member.referenceImageUrls[0]);
  process.exit(0);
  /* eslint-enable no-console */
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('\n❌ VERIFY FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
