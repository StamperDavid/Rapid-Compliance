/**
 * Verifies the SPECIALIST_ID_ALIASES back-compat resolver wired into
 * `src/lib/training/specialist-golden-master-service.ts`.
 *
 * After the May 8, 2026 canonicalization pass, the alias map became a
 * deliberate legacy → canonical compatibility layer. This script proves the
 * resolver works in two directions:
 *
 *   1. The legacy name still resolves and lands on the canonical GM
 *      (so historical Firestore records, old scripts, and humans who refer
 *      to "twitter" or "WEB_SCRAPER" continue to work).
 *
 *   2. The canonical name itself returns the same GM doc (no double-routing).
 *
 * Read-only — does NOT submit grades, create GM versions, or mutate state.
 *
 * Run: `npx tsx scripts/verify-specialist-id-alias-resolver.ts`
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

const envPath = 'D:/Future Rapid Compliance/.env.local';
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) {
    const v = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sa = JSON.parse(
  fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'),
);
admin.initializeApp({ credential: admin.credential.cert(sa) });

const INDUSTRY = 'saas_sales_ops';

const PAIRS: Array<{ legacy: string; canonical: string }> = [
  { legacy: 'TWITTER_X_EXPERT', canonical: 'X_EXPERT' },
  { legacy: 'WEB_SCRAPER', canonical: 'SCRAPER_SPECIALIST' },
  { legacy: 'ARCHITECT_COPY_STRATEGIST', canonical: 'COPY_STRATEGIST' },
  { legacy: 'ARCHITECT_FUNNEL_STRATEGIST', canonical: 'FUNNEL_STRATEGIST' },
  { legacy: 'ARCHITECT_UX_UI_STRATEGIST', canonical: 'UX_UI_STRATEGIST' },
];

(async () => {
  const {
    getActiveSpecialistGMByIndustry,
    resolveSpecialistIdAlias,
  } = await import('../src/lib/training/specialist-golden-master-service');

  console.log('\n=== SPECIALIST_ID_ALIASES back-compat resolver verification ===\n');
  console.log(`Industry: ${INDUSTRY}\n`);

  let pass = 0;
  let fail = 0;

  for (const { legacy, canonical } of PAIRS) {
    const resolvedLegacy = resolveSpecialistIdAlias(legacy);
    const resolvedCanonical = resolveSpecialistIdAlias(canonical);

    const legacyResolvesToCanonical = resolvedLegacy === canonical;
    const canonicalIsPassThrough = resolvedCanonical === canonical;

    const legacyGM = await getActiveSpecialistGMByIndustry(legacy, INDUSTRY);
    const canonicalGM = await getActiveSpecialistGMByIndustry(canonical, INDUSTRY);

    const legacyFound = legacyGM !== null;
    const canonicalFound = canonicalGM !== null;
    const sameDoc = legacyGM?.id === canonicalGM?.id;
    const correctSpecialistId = legacyGM?.specialistId === canonical;

    const ok =
      legacyResolvesToCanonical &&
      canonicalIsPassThrough &&
      legacyFound &&
      canonicalFound &&
      sameDoc &&
      correctSpecialistId;

    if (ok) {
      pass++;
      console.log(`✓ ${legacy} → ${canonical}`);
      console.log(`    resolveSpecialistIdAlias(legacy)    = ${resolvedLegacy}`);
      console.log(`    resolveSpecialistIdAlias(canonical) = ${resolvedCanonical} (pass-through)`);
      console.log(`    GM doc id: ${legacyGM!.id} (v${legacyGM!.version}, isActive=${legacyGM!.isActive})`);
    } else {
      fail++;
      console.log(`✗ ${legacy} → ${canonical}  FAILED`);
      console.log(`    legacy resolves to canonical: ${legacyResolvesToCanonical} (got ${resolvedLegacy})`);
      console.log(`    canonical is pass-through:    ${canonicalIsPassThrough} (got ${resolvedCanonical})`);
      console.log(`    legacy lookup found GM:       ${legacyFound} (id=${legacyGM?.id ?? 'null'})`);
      console.log(`    canonical lookup found GM:    ${canonicalFound} (id=${canonicalGM?.id ?? 'null'})`);
      console.log(`    same doc id:                  ${sameDoc}`);
      console.log(`    GM.specialistId is canonical: ${correctSpecialistId} (got ${legacyGM?.specialistId ?? 'null'})`);
    }
  }

  console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(2);
});
