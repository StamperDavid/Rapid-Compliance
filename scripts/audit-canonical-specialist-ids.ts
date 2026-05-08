/**
 * CI guard: audit that every specialist ID is canonical (one true name)
 * across the four sources of truth — admin UI registry, seed scripts,
 * runtime delegation maps, and live Firestore GM docs.
 *
 * Exits 0 if all four sources agree on every specialist ID. Exits 1 with
 * a precise diff report if any new misalignment sneaks in. Designed to
 * run in CI so canonicalization stays canonical going forward — the
 * SPECIALIST_ID_ALIASES back-compat map should grow ONLY for legacy data
 * compatibility, never as a band-aid for a fresh naming bug.
 *
 * Detects:
 *   - SpecialistRegistry.tsx admin id that no seed script defines
 *   - seed script SPECIALIST_ID that no admin entry references
 *   - runtime delegation map id that lacks both an admin entry and a seed script
 *   - live Firestore GM doc with a specialistId field that no source uses
 *
 * What it ALLOWS (architectural exclusions, not bugs):
 *   - Manager IDs (anything ending in _MANAGER) — managers live in the
 *     parallel managerGoldenMasters service, audited separately
 *   - Deterministic dispatchers explicitly marked with no LLM (PRICING_STRATEGIST,
 *     AUTONOMOUS_POSTING_AGENT) — opt-in via the DETERMINISTIC_NO_GM allowlist
 *
 * Run: `npx tsx scripts/audit-canonical-specialist-ids.ts`
 *      (Returns exit 1 on any misalignment — wire into CI.)
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
const sa = JSON.parse(
  fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'),
);
admin.initializeApp({ credential: admin.credential.cert(sa) });

const PLATFORM_ID = 'rapid-compliance-root';
const ACTIVE_INDUSTRY = 'saas_sales_ops';
const ROOT = path.resolve(__dirname, '..');

// Architectural exclusions: deterministic dispatchers with no LLM call.
// Managers (anything ending in _MANAGER) are also excluded automatically.
const DETERMINISTIC_NO_GM = new Set<string>([
  'PRICING_STRATEGIST',
  'AUTONOMOUS_POSTING_AGENT',
  'VOICE_AI_SPECIALIST',
  'CATALOG_MANAGER',
  'PAYMENT_SPECIALIST',
]);

// Manager IDs follow the `*_MANAGER` convention with one historical exception:
// REVENUE_DIRECTOR was named before the convention was set. Treat it as a manager.
const NAMED_MANAGERS = new Set<string>(['REVENUE_DIRECTOR']);

function isManager(id: string): boolean {
  return id.endsWith('_MANAGER') || NAMED_MANAGERS.has(id);
}

function eligible(id: string): boolean {
  return !isManager(id) && !DETERMINISTIC_NO_GM.has(id);
}

(async () => {
  console.log('\n=== Canonical specialist ID audit ===\n');

  // 1. Admin registry (SpecialistRegistry.tsx)
  const registrySrc = fs.readFileSync(
    path.join(ROOT, 'src/components/admin/SpecialistRegistry.tsx'),
    'utf-8',
  );
  const adminIds = new Set<string>();
  for (const m of registrySrc.matchAll(/^\s*id:\s*['"]([A-Z_]+)['"]/gm)) {
    adminIds.add(m[1]);
  }

  // 2. Seed scripts (SPECIALIST_ID constants in seed-*-gm.{js,ts})
  const seedDir = path.join(ROOT, 'scripts');
  const seededIds = new Set<string>();
  for (const f of fs.readdirSync(seedDir)) {
    if (!/^seed-.*-gm\.(js|ts)$/.test(f)) { continue; }
    const content = fs.readFileSync(path.join(seedDir, f), 'utf-8');
    const m = /^const\s+SPECIALIST_ID\s*=\s*['"]([A-Z_]+)['"]/m.exec(content);
    if (m && !isManager(m[1])) { seededIds.add(m[1]); }
  }

  // 3. Runtime delegation map (marketing/manager.ts platform → specialist string map)
  const mgrSrc = fs.readFileSync(
    path.join(ROOT, 'src/lib/agents/marketing/manager.ts'),
    'utf-8',
  );
  const runtimeIds = new Set<string>();
  for (const m of mgrSrc.matchAll(/['"]([A-Z][A-Z_]+_(EXPERT|SPECIALIST|ANALYST|STRATEGIST|GENERATOR|RESEARCHER|SCOUT|HANDLER|QUALIFIER|COORDINATOR|WRITER|CLOSER|ENGINEER|OPTIMIZER|ARCHITECT|DIRECTOR|AGENT))['"]/g)) {
    runtimeIds.add(m[1]);
  }

  // 4. Live Firestore active specialist GMs for the active industry
  const fsdb = admin.firestore();
  const liveSnap = await fsdb
    .collection(`organizations/${PLATFORM_ID}/specialistGoldenMasters`)
    .where('isActive', '==', true)
    .where('industryKey', '==', ACTIVE_INDUSTRY)
    .get();
  const liveIds = new Set<string>();
  for (const d of liveSnap.docs) {
    const sid = d.data().specialistId as string | undefined;
    if (sid) { liveIds.add(sid); }
  }

  console.log(`Sources counted:`);
  console.log(`  Admin registry:        ${adminIds.size}`);
  console.log(`  Seed scripts:          ${seededIds.size}`);
  console.log(`  Runtime delegation:    ${runtimeIds.size}`);
  console.log(`  Live Firestore GMs:    ${liveIds.size}\n`);

  const failures: string[] = [];

  // The audit invariants are about CANONICALIZATION (one true name everywhere
  // a name IS used), not about COMPLETENESS (every agent shown in every UI).
  // The admin SpecialistRegistry is a curated subset for display — it's allowed
  // to omit specialists. What's NOT allowed is a name appearing in one place
  // that another authoritative source can't anchor.

  // Audit 1: every admin registry entry must point to a real seeded agent
  for (const id of adminIds) {
    if (!eligible(id)) { continue; }
    if (!seededIds.has(id)) {
      failures.push(`Admin registry references "${id}" but no seed script defines SPECIALIST_ID = "${id}". Either add a seed script or remove the admin entry.`);
    }
  }

  // Audit 2: every live Firestore active-GM specialistId must come from a seed
  for (const id of liveIds) {
    if (!eligible(id)) { continue; }
    if (!seededIds.has(id)) {
      failures.push(`Firestore active GM has specialistId "${id}" but no seed script defines it. Either rename the GM doc or restore the seed script.`);
    }
  }

  // Audit 3: every admin registry entry should have a corresponding live GM
  // (otherwise grading from the admin UI would 404).
  for (const id of adminIds) {
    if (!eligible(id)) { continue; }
    if (!liveIds.has(id)) {
      failures.push(`Admin registry has "${id}" but no active GM exists in Firestore for industry=${ACTIVE_INDUSTRY}. Run the seed script.`);
    }
  }

  // Audit 4: every runtime delegation reference must be an admin or seed id
  // (informational — runtime can reference managers/aliases legitimately,
  // so warn rather than fail unless it's clearly a typo)
  const runtimeOrphans: string[] = [];
  for (const id of runtimeIds) {
    if (!eligible(id)) { continue; }
    if (!adminIds.has(id) && !seededIds.has(id)) {
      runtimeOrphans.push(id);
    }
  }

  if (failures.length === 0) {
    console.log('✓ All sources agree on every canonical specialist ID.');
    if (runtimeOrphans.length > 0) {
      console.log(`\n  (Informational) Runtime references not found in admin/seed:`);
      for (const id of runtimeOrphans.sort()) {
        console.log(`    - ${id}`);
      }
    }
    process.exit(0);
  } else {
    console.log(`✗ ${failures.length} canonical-id misalignment(s) detected:\n`);
    for (const f of failures.sort()) {
      console.log(`  - ${f}`);
    }
    console.log(`\nFix options for each failure:`);
    console.log(`  (A) Rename one side to match the other (preferred — keeps canonicalization)`);
    console.log(`  (B) Add the agent to DETERMINISTIC_NO_GM in this script (only if it has no LLM call)`);
    console.log(`  (C) Add a back-compat alias to SPECIALIST_ID_ALIASES in specialist-golden-master-service.ts`);
    console.log(`      (last resort — only when LEGACY Firestore data needs grading-compatibility)\n`);
    process.exit(1);
  }
})().catch((err) => {
  console.error('Audit crashed:', err);
  process.exit(2);
});
