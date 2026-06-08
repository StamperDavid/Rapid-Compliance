/**
 * AUDIT: which agents in AGENT_REGISTRY have an ACTIVE Golden Master, and which
 * don't. Read-only. Answers "is the re-bake actually hitting ALL of them?"
 *
 * Checks all three GM collections:
 *   - specialistGoldenMasters (isActive)  → specialistId
 *   - managerGoldenMasters    (isActive)  → managerId
 *   - goldenMasters           (orchestrator: Jasper / master)
 *
 * Usage: npx tsx scripts/audit-gm-coverage.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) {
        const [, k, raw] = m;
        const v = raw.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[k]) { process.env[k] = v; }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    const sak = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(sak)) { throw new Error('No admin creds'); }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(sak, 'utf-8')) as admin.ServiceAccount) });
  }
}

initAdmin();

import { AGENT_REGISTRY } from '../src/lib/agents/agent-registry';

const PLATFORM_ID = 'rapid-compliance-root';

async function main(): Promise<void> {
  const db = admin.firestore();
  const covered = new Set<string>();

  // specialists
  const spec = await db.collection(`organizations/${PLATFORM_ID}/specialistGoldenMasters`).where('isActive', '==', true).get();
  for (const d of spec.docs) { const v = d.data().specialistId; if (typeof v === 'string') { covered.add(v); } }

  // managers
  const mgr = await db.collection(`organizations/${PLATFORM_ID}/managerGoldenMasters`).where('isActive', '==', true).get();
  for (const d of mgr.docs) { const v = d.data().managerId; if (typeof v === 'string') { covered.add(v); } }

  // orchestrators (goldenMasters) — collect any agent-id-ish field
  const orch = await db.collection(`organizations/${PLATFORM_ID}/goldenMasters`).get();
  const orchInfo: string[] = [];
  for (const d of orch.docs) {
    const data = d.data() as Record<string, unknown>;
    const aid = (data.specialistId ?? data.agentId ?? data.orchestratorId ?? data.managerId) as string | undefined;
    const active = data.isActive;
    orchInfo.push(`${d.id}  agentId=${aid ?? '(none)'}  isActive=${String(active)}`);
    if (typeof aid === 'string' && active !== false) { covered.add(aid); }
  }

  console.log(`\nActive GM coverage — specialist:${spec.size} manager:${mgr.size} goldenMasters-docs:${orch.size}`);
  console.log(`goldenMasters collection contents:`);
  for (const line of orchInfo) { console.log(`   ${line}`); }

  // Compare to registry
  const byTier: Record<string, { covered: string[]; missing: string[] }> = {};
  for (const agent of AGENT_REGISTRY) {
    const tier = agent.tier ?? '(none)';
    byTier[tier] ??= { covered: [], missing: [] };
    if (covered.has(agent.id)) { byTier[tier].covered.push(agent.id); }
    else { byTier[tier].missing.push(agent.id); }
  }

  console.log(`\n=== REGISTRY COVERAGE (total agents: ${AGENT_REGISTRY.length}) ===`);
  let totalMissing = 0;
  for (const tier of Object.keys(byTier).sort()) {
    const { covered: c, missing: m } = byTier[tier];
    totalMissing += m.length;
    console.log(`\n  ${tier}: ${c.length} covered, ${m.length} MISSING a Golden Master`);
    if (m.length > 0) { console.log(`     MISSING: ${m.join(', ')}`); }
  }

  // GMs that exist but aren't in the registry (orphans)
  const registryIds = new Set(AGENT_REGISTRY.map((a) => a.id));
  const orphans = [...covered].filter((id) => !registryIds.has(id));

  console.log(`\n========================================================================`);
  console.log(`  Registry agents WITH an active GM : ${AGENT_REGISTRY.length - totalMissing}`);
  console.log(`  Registry agents MISSING a GM      : ${totalMissing}`);
  console.log(`  GMs not in the registry (orphans) : ${orphans.length}${orphans.length ? ' → ' + orphans.join(', ') : ''}`);
  console.log(`========================================================================\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
