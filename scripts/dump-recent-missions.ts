/* eslint-disable no-console */
import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

async function main(): Promise<void> {
  if (!adminDb) { console.error('adminDb not initialized'); process.exit(1); }
  const snap = await adminDb
    .collection(getSubCollection('missions'))
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  console.log(`Most recent ${snap.size} missions:\n`);
  for (const doc of snap.docs) {
    const m = doc.data() as { missionId?: string; title?: string; status?: string; createdAt?: string; steps?: { toolName?: string; status?: string; delegatedTo?: string }[] };
    console.log(`──────────────────────────────────────────`);
    console.log(`id:        ${m.missionId ?? doc.id}`);
    console.log(`title:     ${m.title ?? '(no title)'}`);
    console.log(`status:    ${m.status}`);
    console.log(`createdAt: ${m.createdAt}`);
    console.log(`steps (${m.steps?.length ?? 0}):`);
    for (const s of m.steps ?? []) {
      console.log(`  - tool=${s.toolName} status=${s.status}${s.delegatedTo ? ` delegatedTo=${s.delegatedTo}` : ''}`);
    }
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
