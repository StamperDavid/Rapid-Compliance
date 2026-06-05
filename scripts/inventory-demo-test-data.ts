/* eslint-disable no-console */
/**
 * INVENTORY (read-only) — lists demo + dev-test records across the system so we
 * have a precise "delete later" manifest. DELETES NOTHING. Re-run anytime.
 *
 * Usage: npx tsx scripts/inventory-demo-test-data.ts
 */
import { AdminFirestoreService } from '../src/lib/db/admin-firestore-service';
import { getSubCollection } from '../src/lib/firebase/collections';

interface Rec {
  id: string;
  name?: string; firstName?: string; lastName?: string; displayName?: string;
  company?: string; companyName?: string; email?: string; role?: string; status?: string;
}

// Real accounts to KEEP (everything else in users is demo/test).
const REAL_USER_IDS = new Set([
  'tR5mQzsdzTghmwdGSZtg6FLSg6s1', // David Stamper (owner / you)
  'AsJ8jjS6MzR1dYe3ZNqcoBmjMNw2', // J David Stamper (admin)
  'q0xQAtPkepNMVomVVo0OMtEpvFB2', // YC Reviewer (real)
]);

function nm(r: Rec): string {
  return r.name ?? r.displayName ?? `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() ?? '(no name)';
}
function blob(r: Rec): string {
  return `${r.id} ${nm(r)} ${r.company ?? ''} ${r.companyName ?? ''} ${r.email ?? ''}`.toLowerCase();
}
function isDemo(r: Rec): boolean {
  return r.id.toLowerCase().startsWith('demo-') || /\(demo\)/.test(blob(r));
}
function isTest(r: Rec): boolean {
  const b = blob(r);
  return /sweep|workflow-test|test-final|@ai-agent\.|verification/.test(b)
    || /^lead-17\d{11}/.test(r.id) // dev-created leads with epoch ids
    || /^(james|jennifer|tenten thomas|james d stamper)$/.test(nm(r).toLowerCase());
}

async function scan(label: string, path: string, opts: { keepReal?: boolean } = {}): Promise<void> {
  let recs: Rec[] = [];
  try { recs = await AdminFirestoreService.getAll<Rec>(path, []); }
  catch { console.log(`\n## ${label}  (collection missing / empty)`); return; }

  const flagged = recs.filter(r => {
    if (opts.keepReal && (REAL_USER_IDS.has(r.id) || r.id.toLowerCase().startsWith('agent_'))) {return false;}
    return isDemo(r) || isTest(r) || opts.keepReal; // for users, anything not real = flag
  });
  console.log(`\n## ${label}  —  ${recs.length} total, ${flagged.length} to delete, ${recs.length - flagged.length} keep`);
  for (const r of flagged) {
    const tag = isDemo(r) ? 'DEMO' : 'TEST';
    console.log(`   [${tag}] ${nm(r)}  <${r.email ?? '-'}>  ${r.company ?? r.companyName ?? r.role ?? ''}  (${r.id})`);
  }
}

async function main(): Promise<void> {
  console.log('=== DEMO / DEV-TEST DATA INVENTORY (read-only, nothing deleted) ===');
  await scan('TEAM MEMBERS (users)', 'users', { keepReal: true });
  await scan('TEAM MEMBERS (members subcollection)', getSubCollection('members'), { keepReal: true });
  await scan('PENDING INVITES', getSubCollection('invites'));
  for (const ent of ['leads', 'contacts', 'companies', 'deals', 'activities', 'tasks', 'orders', 'products']) {
    await scan(`ENTITY: ${ent}`, getSubCollection(ent));
  }
  console.log('\n=== END. This is the delete-later manifest. Nothing was removed. ===');
  process.exit(0);
}
main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
