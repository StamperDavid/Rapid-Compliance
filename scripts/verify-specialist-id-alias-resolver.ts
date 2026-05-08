/**
 * Verifies the SPECIALIST_ID_ALIASES resolver wired into
 * `src/lib/training/specialist-golden-master-service.ts`.
 *
 * For each admin-side alias, calls `getActiveSpecialistGMByIndustry` with
 * the alias and confirms that:
 *   - the lookup returns a non-null GM
 *   - the returned GM's `specialistId` is the canonical (resolved) form
 *   - the same lookup with the canonical id returns the same doc id
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

const ALIASES: Array<{ alias: string; canonical: string }> = [
  { alias: 'X_EXPERT', canonical: 'TWITTER_X_EXPERT' },
  { alias: 'WEB_SCRAPER', canonical: 'SCRAPER_SPECIALIST' },
  { alias: 'ARCHITECT_COPY_STRATEGIST', canonical: 'COPY_STRATEGIST' },
  { alias: 'ARCHITECT_FUNNEL_STRATEGIST', canonical: 'FUNNEL_STRATEGIST' },
  { alias: 'ARCHITECT_UX_UI_STRATEGIST', canonical: 'UX_UI_STRATEGIST' },
];

(async () => {
  const {
    getActiveSpecialistGMByIndustry,
    resolveSpecialistIdAlias,
  } = await import('../src/lib/training/specialist-golden-master-service');

  console.log('\n=== SPECIALIST_ID_ALIASES resolver verification ===\n');
  console.log(`Industry: ${INDUSTRY}\n`);

  let pass = 0;
  let fail = 0;

  for (const { alias, canonical } of ALIASES) {
    const resolved = resolveSpecialistIdAlias(alias);
    const expectedMatch = resolved === canonical;

    const aliasGM = await getActiveSpecialistGMByIndustry(alias, INDUSTRY);
    const canonicalGM = await getActiveSpecialistGMByIndustry(canonical, INDUSTRY);

    const aliasFound = aliasGM !== null;
    const canonicalFound = canonicalGM !== null;
    const sameDoc = aliasGM?.id === canonicalGM?.id;
    const correctSpecialistId = aliasGM?.specialistId === canonical;

    const ok = expectedMatch && aliasFound && canonicalFound && sameDoc && correctSpecialistId;

    if (ok) {
      pass++;
      console.log(`✓ ${alias} → ${canonical}`);
      console.log(`    resolved id: ${resolved}`);
      console.log(`    GM doc id:   ${aliasGM!.id} (v${aliasGM!.version}, isActive=${aliasGM!.isActive})`);
    } else {
      fail++;
      console.log(`✗ ${alias} → ${canonical}  FAILED`);
      console.log(`    resolveSpecialistIdAlias returned: ${resolved} (expected ${canonical})`);
      console.log(`    alias lookup found GM: ${aliasFound} (id=${aliasGM?.id ?? 'null'})`);
      console.log(`    canonical lookup found GM: ${canonicalFound} (id=${canonicalGM?.id ?? 'null'})`);
      console.log(`    same doc id: ${sameDoc}`);
      console.log(`    GM.specialistId: ${aliasGM?.specialistId ?? 'null'} (expected ${canonical})`);
    }
  }

  console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(2);
});
