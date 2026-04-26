import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

async function main() {
  if (!adminDb) { console.error('no adminDb'); process.exit(1); }
  // Look for any mission with sourceEvent set, OR title starting "Reply to inbound"
  const snap = await adminDb
    .collection(getSubCollection('missions'))
    .orderBy('createdAt', 'desc')
    .limit(25)
    .get();
  if (snap.empty) {
    console.log('No missions found at all.');
    process.exit(0);
  }
  console.log(`Found ${snap.size} recent missions (showing all):`);
  for (const doc of snap.docs) {
    const m = doc.data();
    console.log('---');
    console.log('missionId:', m.missionId);
    console.log('  status:', m.status);
    console.log('  title:', m.title);
    console.log('  createdAt:', m.createdAt);
    console.log('  sourceEvent:', JSON.stringify(m.sourceEvent));
    console.log('  autoApprove:', m.autoApprove ?? '(none)');
    console.log('  userPrompt preview:', String(m.userPrompt ?? '').slice(0, 200).replace(/\n/g, ' / '));
    console.log('  steps:');
    for (const s of (m.steps ?? [])) {
      console.log(`    [${s.status}] ${s.toolName} -> ${s.delegatedTo}`);
      if (s.toolArgs) {
        const args = s.toolArgs;
        if (args.contentType) console.log(`        contentType: ${args.contentType}`);
        if (args.platform) console.log(`        platform: ${args.platform}`);
        if (args.goal) console.log(`        goal: ${String(args.goal).slice(0, 160)}`);
        if (args.inboundContext) console.log(`        inboundContext: ${JSON.stringify(args.inboundContext).slice(0, 200)}`);
      }
      if (s.toolResult) console.log(`        toolResult preview: ${String(s.toolResult).slice(0, 350)}`);
      if (s.error) console.log(`        ERROR: ${s.error}`);
    }
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
