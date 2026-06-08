/**
 * LIVE PROOF — Brand DNA re-bake bakes the CURRENT Brand DNA into a specialist's
 * Golden Master while preserving everything else, then ROLLS BACK so the tenant
 * is left exactly as found.
 *
 * This exercises the real production path against real Firestore:
 *
 *   1. Read the org Brand DNA via getBrandDNA(). Assert it carries the tagline
 *      "Accelerate your growth" in keyPhrases — that is the value we prove gets
 *      baked into the GM.
 *   2. Snapshot the active COPYWRITER:saas_sales_ops GM — capture its version
 *      (ORIGINAL_VERSION), id, and the substring of config.systemPrompt BEFORE
 *      the Brand DNA marker (bodyBefore = base body + any human training edits).
 *   3. createIndustryGMVersionFromBrandRebake(...) → a new INACTIVE version with
 *      ONLY the trailing brand block swapped for one built from current Brand DNA.
 *   4. deployIndustryGMVersion(newVersion) → activate it; re-fetch the active GM.
 *   5. ASSERT on the re-baked active GM's systemPrompt:
 *        (a) contains "Accelerate your growth"     — tagline BAKED IN
 *        (b) substring before the marker is BYTE-IDENTICAL to bodyBefore
 *            — nothing but the brand block changed (training edits untouched)
 *        (c) exactly ONE marker occurrence          — no double-bake
 *        (d) brandDNASnapshot deep-contains the new keyPhrases incl. the tagline
 *   6. finally { ROLLBACK }: re-deploy ORIGINAL_VERSION so the active GM is the
 *      pre-test one, then delete the version this test created. Assert the active
 *      version === ORIGINAL_VERSION and the tagline is gone from the body again
 *      (left exactly as found). Rollback runs even if an assertion above throws,
 *      and LOUDLY logs if rollback itself fails so a human can fix it manually.
 *
 * On success OR failure this script NEVER leaves a non-original version active.
 *
 * Usage: npx tsx scripts/verify-brand-rebake-live.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) { process.env[key] = value; }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(sakPath)) {
      const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      throw new Error('Missing FIREBASE_ADMIN_* env vars and no serviceAccountKey.json');
    }
  }
}

// Init BEFORE importing services — the admin module reads env at import time.
initAdmin();

import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import {
  getActiveSpecialistGMByIndustry,
  createIndustryGMVersionFromBrandRebake,
  deployIndustryGMVersion,
  invalidateIndustryGMCache,
} from '../src/lib/training/specialist-golden-master-service';

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------

const PLATFORM_ID = 'rapid-compliance-root';
const TARGET_SPECIALIST_ID = 'COPYWRITER';
const INDUSTRY_KEY = 'saas_sales_ops';
const TAGLINE = 'Accelerate your growth';
const MARKER = '## Brand DNA (baked into the Golden Master at seed time';
const CREATED_BY = 'verify-brand-rebake-live';
const SPECIALIST_GM_COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;

// ----------------------------------------------------------------------------
// ASSERTION HARNESS
// ----------------------------------------------------------------------------

let failures = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
  } else {
    console.log(`  ❌ FAIL  ${label}`);
    failures += 1;
  }
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) { break; }
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

function promptOf(gm: { config: { systemPrompt?: unknown }; systemPromptSnapshot?: string }): string {
  return typeof gm.config.systemPrompt === 'string'
    ? gm.config.systemPrompt
    : gm.systemPromptSnapshot ?? '';
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  const db = admin.firestore();

  console.log('========================================================================');
  console.log('  LIVE PROOF — Brand DNA re-bake bakes current Brand DNA, preserves rest');
  console.log(`  target: ${TARGET_SPECIALIST_ID}:${INDUSTRY_KEY}`);
  console.log('========================================================================');

  // [2] State we must capture before mutating anything so the finally block can
  // restore exactly. Initialized null; only the rollback runs once set.
  let originalVersion: number | null = null;
  let createdVersion: number | null = null;
  let createdDocId: string | null = null;
  // Captured in [2]; read again in the finally rollback check — must live at
  // function scope (NOT inside the try, where the finally block can't see it).
  let bodyBefore = '';

  try {
    // [1] Read the current org Brand DNA.
    console.log('\n[1] Read org Brand DNA via getBrandDNA()...');
    const brandDNA = await getBrandDNA();
    if (!brandDNA) {
      throw new Error('getBrandDNA() returned null — no Brand DNA configured on the org. Cannot run.');
    }
    const keyPhrases = Array.isArray(brandDNA.keyPhrases) ? brandDNA.keyPhrases : [];
    console.log(`  keyPhrases: [${keyPhrases.join(', ')}]`);
    assert(`(pre) Brand DNA keyPhrases contains the tagline "${TAGLINE}"`, keyPhrases.includes(TAGLINE));
    if (!keyPhrases.includes(TAGLINE)) {
      throw new Error(
        `Brand DNA keyPhrases does not contain "${TAGLINE}". This is the value the test proves ` +
        `gets baked in — without it the proof is meaningless. Add it in /settings/brand-dna and re-run.`,
      );
    }

    // [2] Snapshot the active GM (ORIGINAL_VERSION, id, bodyBefore).
    console.log('\n[2] Snapshot the active COPYWRITER GM...');
    invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    const original = await getActiveSpecialistGMByIndustry(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    if (!original) {
      throw new Error(`No active ${TARGET_SPECIALIST_ID}:${INDUSTRY_KEY} GM — test cannot run.`);
    }
    originalVersion = original.version;
    const originalPrompt = promptOf(original);
    const markerIdxOriginal = originalPrompt.indexOf(MARKER);
    if (markerIdxOriginal === -1) {
      throw new Error(
        `Active GM ${original.id} has no Brand DNA marker — seed-time anomaly. ` +
        `Re-bake would refuse (no double-bake). Aborting.`,
      );
    }
    bodyBefore = originalPrompt.slice(0, markerIdxOriginal);
    const taglineInBodyBefore = bodyBefore.includes(TAGLINE);
    console.log(`  active GM: ${original.id} (v${originalVersion}, ${originalPrompt.length} chars)`);
    console.log(`  body-before-marker: ${bodyBefore.length} chars`);
    console.log(`  tagline already present in body-before-marker? ${taglineInBodyBefore ? 'YES' : 'no'} (the base body must NOT change)`);

    // [3] Create a new INACTIVE re-baked version from current Brand DNA.
    console.log('\n[3] createIndustryGMVersionFromBrandRebake(... current Brand DNA ...)...');
    const created = await createIndustryGMVersionFromBrandRebake(
      TARGET_SPECIALIST_ID,
      INDUSTRY_KEY,
      brandDNA,
      CREATED_BY,
    );
    assert('(3) createIndustryGMVersionFromBrandRebake returned a non-null GM', created !== null);
    if (!created) {
      throw new Error('Re-bake returned null — cannot continue. (Marker missing or DB unavailable.)');
    }
    createdVersion = created.version;
    createdDocId = created.id;
    console.log(`  created ${created.id} (v${created.version}, isActive=${created.isActive})`);
    assert('(3b) created version is INACTIVE until deployed', created.isActive === false);
    assert('(3c) created version is exactly ORIGINAL_VERSION + 1', created.version === originalVersion + 1);

    // [4] Deploy the new version, re-fetch the active GM.
    console.log('\n[4] deployIndustryGMVersion(created.version) — activate the re-bake...');
    const deployResult = await deployIndustryGMVersion(TARGET_SPECIALIST_ID, INDUSTRY_KEY, created.version);
    if (!deployResult.success) {
      throw new Error(`Deploy of v${created.version} failed: ${deployResult.error ?? 'unknown error'}`);
    }
    invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    const rebaked = await getActiveSpecialistGMByIndustry(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
    if (!rebaked) {
      throw new Error('No active GM after deploy — deploy did not activate the new version.');
    }
    if (rebaked.version !== created.version) {
      throw new Error(`Expected active v${created.version}, got v${rebaked.version}.`);
    }
    console.log(`  active GM is now ${rebaked.id} (v${rebaked.version})`);

    // [5] Assertions on the re-baked active GM.
    console.log('\n[5] Assert the re-bake baked the tagline and preserved everything else...');
    const rebakedPrompt = promptOf(rebaked);

    // (a) tagline baked into the systemPrompt.
    assert(`(a) systemPrompt contains the tagline "${TAGLINE}" (BAKED IN)`, rebakedPrompt.includes(TAGLINE));

    // (b) everything before the marker is byte-identical to the captured bodyBefore.
    const markerIdxRebaked = rebakedPrompt.indexOf(MARKER);
    const rebakedBodyBefore = markerIdxRebaked === -1 ? '' : rebakedPrompt.slice(0, markerIdxRebaked);
    assert(
      '(b) substring BEFORE the marker is BYTE-IDENTICAL to original (training edits / base body untouched)',
      rebakedBodyBefore === bodyBefore,
    );

    // (c) exactly one marker — no double-bake.
    assert('(c) exactly ONE Brand DNA marker occurrence (no double-bake)', countOccurrences(rebakedPrompt, MARKER) === 1);

    // (d) brandDNASnapshot deep-contains the new keyPhrases incl. the tagline.
    const snapshot = rebaked.brandDNASnapshot;
    const snapshotKeyPhrases = snapshot && Array.isArray(snapshot.keyPhrases) ? snapshot.keyPhrases : [];
    const snapshotHasAll = keyPhrases.every((kp) => snapshotKeyPhrases.includes(kp));
    assert('(d) brandDNASnapshot exists on the re-baked GM', snapshot !== undefined && snapshot !== null);
    assert(`(d2) brandDNASnapshot.keyPhrases deep-contains the tagline "${TAGLINE}"`, snapshotKeyPhrases.includes(TAGLINE));
    assert('(d3) brandDNASnapshot.keyPhrases deep-contains ALL current Brand DNA keyPhrases', snapshotHasAll);

    console.log('\n========================================================================');
    if (failures === 0) {
      console.log('  ✓ RE-BAKE VERIFIED — tagline baked in, body byte-identical, no double-bake');
    } else {
      console.log(`  ✗ ${failures} ASSERTION(S) FAILED during the re-bake proof`);
    }
    console.log('========================================================================');
  } finally {
    // [6] ROLLBACK — always runs. Re-activates ORIGINAL_VERSION via the same
    // production primitive (deployIndustryGMVersion deactivates all others
    // atomically and activates the target), then deletes the version this test
    // created so the tenant is left EXACTLY as found. Wrapped in its own
    // try/catch so a rollback failure is LOUD and a human knows to fix it.
    console.log('\n[6] ROLLBACK — restore the tenant to exactly the pre-test state...');
    try {
      if (originalVersion === null) {
        console.log('  (nothing to roll back — no original version was ever captured)');
      } else {
        // Re-activate the original version (deactivates the re-baked one atomically).
        const restore = await deployIndustryGMVersion(TARGET_SPECIALIST_ID, INDUSTRY_KEY, originalVersion);
        if (!restore.success) {
          throw new Error(`Re-deploy of ORIGINAL_VERSION v${originalVersion} failed: ${restore.error ?? 'unknown error'}`);
        }
        console.log(`  ✓ re-deployed ORIGINAL_VERSION v${originalVersion}`);

        // Delete the version this test created so history is left untouched.
        if (createdDocId && createdVersion !== null && createdVersion !== originalVersion) {
          await db.collection(SPECIALIST_GM_COLLECTION).doc(createdDocId).delete();
          console.log(`  ✓ deleted test-created version ${createdDocId} (v${createdVersion})`);
        }

        // Verify we are left EXACTLY as found.
        invalidateIndustryGMCache(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
        const afterRollback = await getActiveSpecialistGMByIndustry(TARGET_SPECIALIST_ID, INDUSTRY_KEY);
        if (!afterRollback) {
          throw new Error('No active GM after rollback — tenant left in a BROKEN state. FIX MANUALLY.');
        }
        assert(`(rollback) active version === ORIGINAL_VERSION (${originalVersion})`, afterRollback.version === originalVersion);

        // The tagline must be gone from the BODY again (the brand block of the
        // original may or may not carry it depending on when it was last seeded;
        // what we assert is the body-before-marker is restored unchanged).
        const afterPrompt = promptOf(afterRollback);
        const afterMarkerIdx = afterPrompt.indexOf(MARKER);
        const afterBodyBefore = afterMarkerIdx === -1 ? afterPrompt : afterPrompt.slice(0, afterMarkerIdx);
        assert('(rollback) body-before-marker is byte-identical to the pre-test original', afterBodyBefore === bodyBefore);

        if (afterRollback.version === originalVersion) {
          console.log('  ✓ tenant left EXACTLY as found — original version active, no test version remaining');
        }
      }
    } catch (rollbackErr) {
      failures += 1;
      console.error('');
      console.error('  ============================================================');
      console.error('  ‼️  ROLLBACK FAILED — TENANT MAY BE LEFT ON A NON-ORIGINAL GM');
      console.error('  ‼️  A HUMAN MUST MANUALLY RE-ACTIVATE THE ORIGINAL VERSION:');
      console.error(`  ‼️    specialist : ${TARGET_SPECIALIST_ID}`);
      console.error(`  ‼️    industry   : ${INDUSTRY_KEY}`);
      console.error(`  ‼️    restore to : v${originalVersion ?? '?'}`);
      console.error(`  ‼️    delete doc : ${createdDocId ?? '(none)'}`);
      console.error(`  ‼️    error      : ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`);
      console.error('  ============================================================');
      console.error('');
    }
  }

  console.log('\n========================================================================');
  if (failures === 0) {
    console.log('  ALL ASSERTIONS PASSED ✅  (tenant left exactly as found)');
    console.log('========================================================================\n');
    process.exit(0);
  } else {
    console.log(`  ${failures} ASSERTION(S) FAILED ❌`);
    console.log('========================================================================\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
