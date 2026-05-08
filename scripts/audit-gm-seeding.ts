/**
 * Audit specialist + manager Golden Master seeding state.
 *
 * Cross-references:
 * - SpecialistRegistry.tsx (canonical UI/admin specialist IDs)
 * - Agent registry (orchestrator-known specialist IDs)
 * - Runtime delegation maps in marketing/manager.ts (what specialist IDs
 *   actually flow into specialistsUsed at runtime)
 * - seed-*-gm.{js,ts} SPECIALIST_ID values (what GMs are seeded as)
 * - specialistGoldenMasters collection (what's actually live in Firestore)
 * - managerGoldenMasters collection (what manager GMs are live)
 *
 * Reports:
 * - Specialists with no active GM for the configured industry
 * - Specialists where the seed-script ID does NOT match a runtime ID
 * - Managers with no active GM
 * - Industries that have GMs but aren't being requested at runtime
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const envPath = 'D:/Future Rapid Compliance/.env.local';
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) {
    const v = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sa = JSON.parse(fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });

const PLATFORM_ID = 'rapid-compliance-root';
const ACTIVE_INDUSTRY = 'saas_sales_ops';

const MANAGERS = [
  'INTELLIGENCE_MANAGER',
  'MARKETING_MANAGER',
  'BUILDER_MANAGER',
  'ARCHITECT_MANAGER',
  'COMMERCE_MANAGER',
  'OUTREACH_MANAGER',
  'CONTENT_MANAGER',
  'OPERATIONS_MANAGER',
  'REPUTATION_MANAGER',
];

(async () => {
  const fsdb = admin.firestore();

  // ─── 1. SEED SCRIPT IDS ──────────────────────────────────────────────────
  const scriptsDir = path.resolve(__dirname);
  const seedScripts = fs.readdirSync(scriptsDir).filter((f) => /^seed-.*-gm\.(js|ts)$/.test(f));
  const seededSpecialistIds = new Set<string>();
  const seededManagerIds = new Set<string>();
  const seedToFile = new Map<string, string>();
  for (const file of seedScripts) {
    const content = fs.readFileSync(path.join(scriptsDir, file), 'utf-8');
    const idMatch = /^const\s+SPECIALIST_ID\s*=\s*['"]([A-Z_]+)['"]/m.exec(content);
    if (idMatch) {
      const id = idMatch[1];
      if (id.endsWith('_MANAGER')) {
        seededManagerIds.add(id);
      } else {
        seededSpecialistIds.add(id);
      }
      seedToFile.set(id, file);
    }
    const mgrMatch = /^const\s+MANAGER_ID\s*=\s*['"]([A-Z_]+)['"]/m.exec(content);
    if (mgrMatch) {
      seededManagerIds.add(mgrMatch[1]);
      seedToFile.set(mgrMatch[1], file);
    }
  }

  // ─── 2. RUNTIME SPECIALIST IDS (from marketing/manager.ts platform map) ───
  const mgrSrc = fs.readFileSync(
    path.resolve(scriptsDir, '..', 'src/lib/agents/marketing/manager.ts'),
    'utf-8',
  );
  const runtimeSpecialistIds = new Set<string>();
  for (const m of mgrSrc.matchAll(/['"]([A-Z][A-Z_]+_(EXPERT|SPECIALIST|ANALYST|STRATEGIST|GENERATOR|RESEARCHER|SCOUT|HANDLER|QUALIFIER|COORDINATOR|WRITER|CLOSER|ENGINEER|OPTIMIZER|ARCHITECT|DIRECTOR|AGENT))['"]/g)) {
    runtimeSpecialistIds.add(m[1]);
  }

  // ─── 3. ADMIN REGISTRY SPECIALIST IDS (SpecialistRegistry.tsx) ────────────
  const registrySrc = fs.readFileSync(
    path.resolve(scriptsDir, '..', 'src/components/admin/SpecialistRegistry.tsx'),
    'utf-8',
  );
  const adminRegistryIds = new Set<string>();
  for (const m of registrySrc.matchAll(/^\s*id:\s*['"]([A-Z_]+)['"]/gm)) {
    adminRegistryIds.add(m[1]);
  }

  // ─── 4. LIVE FIRESTORE: active specialist GMs for this industry ──────────
  const specialistGmSnap = await fsdb
    .collection(`organizations/${PLATFORM_ID}/specialistGoldenMasters`)
    .where('isActive', '==', true)
    .where('industryKey', '==', ACTIVE_INDUSTRY)
    .get();
  const liveSpecialistIds = new Set<string>();
  for (const d of specialistGmSnap.docs) {
    const sid = d.data().specialistId as string | undefined;
    if (sid) liveSpecialistIds.add(sid);
  }

  // Check for GMs in OTHER industries (so we know if it's an industry-key
  // mismatch vs. a never-seeded specialist).
  const allSpecialistGmSnap = await fsdb
    .collection(`organizations/${PLATFORM_ID}/specialistGoldenMasters`)
    .where('isActive', '==', true)
    .get();
  const otherIndustryGms = new Map<string, string[]>();
  for (const d of allSpecialistGmSnap.docs) {
    const sid = d.data().specialistId as string | undefined;
    const ind = d.data().industryKey as string | undefined;
    if (sid && ind && ind !== ACTIVE_INDUSTRY) {
      const arr = otherIndustryGms.get(sid) ?? [];
      arr.push(ind);
      otherIndustryGms.set(sid, arr);
    }
  }

  // ─── 5. LIVE FIRESTORE: active manager GMs ───────────────────────────────
  const managerGmSnap = await fsdb
    .collection(`organizations/${PLATFORM_ID}/managerGoldenMasters`)
    .where('isActive', '==', true)
    .get();
  const liveManagerIds = new Set<string>();
  for (const d of managerGmSnap.docs) {
    const mid = (d.data().managerId ?? d.data().agentType) as string | undefined;
    if (mid) liveManagerIds.add(mid);
  }

  // ─── 6. REPORT ────────────────────────────────────────────────────────────
  const allKnownSpecialists = new Set<string>([
    ...adminRegistryIds,
    ...runtimeSpecialistIds,
    ...seededSpecialistIds,
    ...liveSpecialistIds,
  ]);

  console.log(`\n=== GM SEEDING AUDIT — industry=${ACTIVE_INDUSTRY} ===\n`);
  console.log('Sources:');
  console.log(`  Admin registry (UI): ${adminRegistryIds.size}`);
  console.log(`  Runtime mappings (marketing/manager.ts): ${runtimeSpecialistIds.size}`);
  console.log(`  Seed scripts: ${seededSpecialistIds.size}`);
  console.log(`  Live (Firestore, active+industry): ${liveSpecialistIds.size}`);

  const missingForActiveIndustry: Array<{ id: string; otherIndustries: string[]; hasSeedScript: boolean }> = [];
  for (const sid of [...allKnownSpecialists].sort()) {
    if (!liveSpecialistIds.has(sid)) {
      missingForActiveIndustry.push({
        id: sid,
        otherIndustries: otherIndustryGms.get(sid) ?? [],
        hasSeedScript: seededSpecialistIds.has(sid),
      });
    }
  }

  console.log(`\n--- MISSING active GM for industry=${ACTIVE_INDUSTRY} (${missingForActiveIndustry.length}) ---`);
  for (const r of missingForActiveIndustry) {
    const otherStr = r.otherIndustries.length > 0 ? ` [seeded for: ${r.otherIndustries.join(', ')}]` : '';
    const seedStr = r.hasSeedScript ? ` [seed script: ${seedToFile.get(r.id) ?? '?'}]` : ' [NO SEED SCRIPT]';
    console.log(`  ✗ ${r.id}${otherStr}${seedStr}`);
  }

  // Specialists that ARE known to runtime but seed script uses a DIFFERENT id
  const runtimeOnly = [...runtimeSpecialistIds].filter((s) => !seededSpecialistIds.has(s) && !liveSpecialistIds.has(s));
  if (runtimeOnly.length > 0) {
    console.log(`\n--- Runtime-referenced but no matching seed script (${runtimeOnly.length}) ---`);
    for (const s of runtimeOnly.sort()) console.log(`  ⚠ ${s}`);
  }

  console.log(`\n--- MANAGER GMs ---`);
  console.log(`  Live (Firestore): ${liveManagerIds.size} → ${[...liveManagerIds].sort().join(', ')}`);
  const missingManagers = MANAGERS.filter((m) => !liveManagerIds.has(m));
  console.log(`  Missing (${missingManagers.length}): ${missingManagers.join(', ') || '(none)'}`);
  for (const m of missingManagers) {
    const seedFile = seedToFile.get(m);
    if (seedFile) {
      console.log(`    ${m} → seed script available: ${seedFile}`);
    } else {
      console.log(`    ${m} → NO SEED SCRIPT`);
    }
  }

  console.log(`\nDone.\n`);
  process.exit(0);
})();
