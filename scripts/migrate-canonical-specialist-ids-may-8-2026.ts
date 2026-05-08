/**
 * One-time migration: canonicalize specialist GM doc IDs and specialistId
 * fields in Firestore (May 8, 2026).
 *
 * After the source-code rename pass, the runtime queries look up GMs by the
 * new canonical names (X_EXPERT, SCRAPER_SPECIALIST, COPY_STRATEGIST,
 * FUNNEL_STRATEGIST, UX_UI_STRATEGIST). The existing Firestore docs still
 * carry the legacy names. This migration copies each legacy doc to a
 * new-canonical doc id with an updated specialistId field, atomically
 * swaps the active flag, and preserves the legacy doc as a deactivated
 * historical record (so we can roll back without data loss).
 *
 * Idempotent: running twice is a no-op (skips legacy docs that already
 * have a canonical successor).
 *
 * Read-only on the legacy doc structure beyond setting isActive=false +
 * deactivatedReason. Never deletes anything.
 *
 * Run: `npx tsx scripts/migrate-canonical-specialist-ids-may-8-2026.ts`
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

const PLATFORM_ID = 'rapid-compliance-root';
const SPECIALIST_GM_PATH = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_CONFIGS_PATH = `organizations/${PLATFORM_ID}/specialistConfigs`;

const RENAMES: Array<{ legacy: string; canonical: string }> = [
  { legacy: 'TWITTER_X_EXPERT', canonical: 'X_EXPERT' },
  { legacy: 'WEB_SCRAPER', canonical: 'SCRAPER_SPECIALIST' },
  { legacy: 'ARCHITECT_COPY_STRATEGIST', canonical: 'COPY_STRATEGIST' },
  { legacy: 'ARCHITECT_FUNNEL_STRATEGIST', canonical: 'FUNNEL_STRATEGIST' },
  { legacy: 'ARCHITECT_UX_UI_STRATEGIST', canonical: 'UX_UI_STRATEGIST' },
];

function buildIndustryGMDocId(specialistId: string, industryKey: string, version: number): string {
  return `sgm_${specialistId.toLowerCase()}_${industryKey}_v${version}`;
}

(async () => {
  const fsdb = admin.firestore();
  const now = new Date().toISOString();

  console.log('\n=== Canonicalization migration (May 8, 2026) ===\n');

  let totalCopied = 0;
  let totalSkipped = 0;
  let totalDeactivated = 0;

  for (const { legacy, canonical } of RENAMES) {
    console.log(`\n--- ${legacy} → ${canonical} ---`);

    // 1. Find all GM docs with legacy specialistId
    const legacySnap = await fsdb
      .collection(SPECIALIST_GM_PATH)
      .where('specialistId', '==', legacy)
      .get();

    if (legacySnap.empty) {
      console.log(`  (no legacy docs to migrate)`);
      continue;
    }

    console.log(`  Found ${legacySnap.size} legacy GM doc(s)`);

    for (const legacyDoc of legacySnap.docs) {
      const data = legacyDoc.data();
      const version = typeof data.version === 'number' ? data.version : 1;
      const industryKey = typeof data.industryKey === 'string' ? data.industryKey : 'saas_sales_ops';
      const newDocId = buildIndustryGMDocId(canonical, industryKey, version);

      // Idempotency: skip if a canonical successor already exists
      const existingNew = await fsdb.collection(SPECIALIST_GM_PATH).doc(newDocId).get();
      if (existingNew.exists) {
        console.log(`    skip ${legacyDoc.id} → ${newDocId} (already migrated)`);
        totalSkipped++;
        continue;
      }

      const newData = {
        ...data,
        id: newDocId,
        specialistId: canonical,
        migratedFrom: legacyDoc.id,
        migratedAt: now,
      };

      const batch = fsdb.batch();
      batch.set(fsdb.collection(SPECIALIST_GM_PATH).doc(newDocId), newData);

      // Deactivate the legacy doc so the active-GM query finds the new one
      batch.update(legacyDoc.ref, {
        isActive: false,
        deactivatedAt: now,
        deactivatedReason: `superseded by ${newDocId} during canonicalization migration`,
      });

      await batch.commit();
      console.log(`    copy ${legacyDoc.id} → ${newDocId} (v${version}, was active=${data.isActive ?? false})`);
      totalCopied++;
      if (data.isActive) totalDeactivated++;
    }

    // 2. Migrate specialistConfigs/{legacy} → specialistConfigs/{canonical}
    const legacyConfigDoc = await fsdb.collection(SPECIALIST_CONFIGS_PATH).doc(legacy).get();
    if (legacyConfigDoc.exists) {
      const newConfigDoc = await fsdb.collection(SPECIALIST_CONFIGS_PATH).doc(canonical).get();
      if (newConfigDoc.exists) {
        console.log(`  specialistConfigs/${canonical} already exists — skipping config copy`);
      } else {
        const data = legacyConfigDoc.data();
        await fsdb.collection(SPECIALIST_CONFIGS_PATH).doc(canonical).set({
          ...data,
          migratedFrom: legacy,
          migratedAt: now,
        });
        console.log(`  copy specialistConfigs/${legacy} → specialistConfigs/${canonical}`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  GM docs copied:      ${totalCopied}`);
  console.log(`  GM docs skipped:     ${totalSkipped} (already migrated)`);
  console.log(`  Active flags swapped: ${totalDeactivated}`);
  console.log(`\nDone.\n`);
  process.exit(0);
})().catch((err) => {
  console.error('Migration crashed:', err);
  process.exit(1);
});
