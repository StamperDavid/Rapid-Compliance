/* eslint-disable no-console */
import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

async function main(): Promise<void> {
  const missionId = process.argv[2];
  if (!missionId) { console.error('usage: dump-mission-step.ts <missionId>'); process.exit(1); }
  if (!adminDb) { console.error('adminDb not initialized'); process.exit(1); }
  const snap = await adminDb.collection(getSubCollection('missions')).doc(missionId).get();
  if (!snap.exists) { console.error('Mission not found'); process.exit(2); }
  const m = snap.data() as { steps?: Record<string, unknown>[] };
  console.log(JSON.stringify(m.steps, null, 2));
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
