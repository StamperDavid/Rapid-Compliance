/**
 * VERIFY (real infra) — the "Save to Character Library" checkbox actually persists
 * an invented character as a reusable AvatarProfile at generation time.
 *
 * Builds a plan with ONE invented character that has reference art + saveToLibrary:
 * true, runs the real saveInventedCharactersToLibrary, and asserts a new profile was
 * created in the library (and the flag cleared). Uses a throwaway userId and DELETES
 * the test profile afterward so the real library is untouched. No fal calls.
 *
 * Usage: npx tsx scripts/verify-save-character-to-library.ts
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

const TEST_USER = 'verify-save-character-test-user';
const TEST_IMG =
  'https://firebasestorage.googleapis.com/v0/b/rapid-compliance-65f87.firebasestorage.app/o/verify-placeholder.png?alt=media&token=test';

async function main(): Promise<void> {
  const { saveInventedCharactersToLibrary } = await import('../src/lib/video/shot-plan-generation-service');
  const { listAvatarProfiles, deleteAvatarProfile } = await import('../src/lib/video/avatar-profile-service');
  const { makeBlankShotPlan } = await import('../src/lib/video/shot-plan-blank');
  const { ShotPlanSchema } = await import('../src/types/shot-plan');

  /* eslint-disable no-console */
  // Pre-clean any leftovers from a prior run.
  for (const p of await listAvatarProfiles(TEST_USER, { ownOnly: true })) {
    await deleteAvatarProfile(p.id);
  }

  console.log('STEP 1 — build a plan with an invented character (has art) + saveToLibrary:true');
  const base = makeBlankShotPlan('Save-to-Library Verification');
  const invented = {
    characterId: 'new_save_1',
    name: 'Verify Save Cole',
    referenceImageUrls: [TEST_IMG],
    role: 'lead',
    billing: 'lead' as const,
    subjectKind: 'person' as const,
    notes: 'Test invented character for the save-to-library checkbox.',
    apparentAge: 'late 40s',
    gender: 'female',
    saveToLibrary: true,
  };
  const plan = ShotPlanSchema.parse({
    ...base,
    sharedChoices: { ...base.sharedChoices, cast: [invented] },
  });

  const before = (await listAvatarProfiles(TEST_USER, { ownOnly: true })).length;

  console.log('STEP 2 — run the real saveInventedCharactersToLibrary');
  const result = await saveInventedCharactersToLibrary(plan, TEST_USER).catch((e) =>
    fail('saveInventedCharactersToLibrary', e),
  );

  console.log('STEP 3 — assertions');
  assert(!result.sharedChoices.cast[0].saveToLibrary, 'saveToLibrary flag cleared after save');
  const after = await listAvatarProfiles(TEST_USER, { ownOnly: true });
  assert(after.length === before + 1, `a new library profile was created (${before} → ${after.length})`);
  const created = after.find((p) => p.name === 'Verify Save Cole');
  assert(Boolean(created), 'created profile is findable by name');
  assert(created?.frontalImageUrl === TEST_IMG, 'created profile carries the reference image as its frontal');
  assert(created?.source === 'custom', "created profile source is 'custom' (a real saved character)");

  console.log('STEP 4 — cleanup (delete the test profile)');
  if (created) {
    await deleteAvatarProfile(created.id);
    const remaining = await listAvatarProfiles(TEST_USER, { ownOnly: true });
    assert(remaining.length === before, 'test profile deleted — library restored');
  }

  console.log('\n✅ SAVE-TO-LIBRARY VERIFY PASSED — checkbox persists an invented character.');
  process.exit(0);
  /* eslint-enable no-console */
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('\n❌ VERIFY FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
