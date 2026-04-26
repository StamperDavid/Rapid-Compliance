import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

async function main() {
  if (!adminDb) { console.error('no adminDb'); process.exit(1); }
  const snap = await adminDb
    .collection(getSubCollection('inboundSocialEvents'))
    .orderBy('receivedAt', 'desc')
    .limit(15)
    .get();
  if (snap.empty) {
    console.log('No inboundSocialEvents found at all.');
    process.exit(0);
  }
  console.log(`Found ${snap.size} recent inbound events:`);
  for (const doc of snap.docs) {
    const ev = doc.data();
    console.log('---');
    console.log('id:', ev.id);
    console.log('  provider:', ev.provider);
    console.log('  kind:', ev.kind);
    console.log('  receivedAt:', ev.receivedAt);
    console.log('  processed:', ev.processed);
    console.log('  mission_initiated:', ev.mission_initiated ?? '(none)');
    console.log('  missionId:', ev.missionId ?? '(none)');
    if (ev.skippedReason) console.log('  skippedReason:', ev.skippedReason);
    if (ev.error) console.log('  error:', ev.error);
    if (ev.reply) console.log('  reply:', JSON.stringify(ev.reply).slice(0, 300));
    // dump dm payload preview
    const dmEvents = ev.payload?.direct_message_events ?? [];
    if (dmEvents.length > 0) {
      const dm = dmEvents[0];
      const text = dm?.message_create?.message_data?.text;
      const sender = dm?.message_create?.sender_id;
      console.log(`  dm.sender_id: ${sender ?? '(none)'}`);
      console.log(`  dm.text: ${text ? String(text).slice(0, 200) : '(none)'}`);
    }
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
