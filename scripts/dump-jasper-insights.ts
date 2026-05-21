/**
 * One-off diagnostic — dump what's in jasperInsights for the dev tenant.
 * `npx tsx scripts/dump-jasper-insights.ts`
 */
import { adminDb } from '../src/lib/firebase/admin';
import { PLATFORM_ID } from '../src/lib/constants/platform';

async function main(): Promise<void> {
  if (!adminDb) {
    console.error('adminDb not initialized');
    process.exit(1);
  }
  const path = `organizations/${PLATFORM_ID}/jasperInsights`;
  const meta = await adminDb.collection(path).doc('_meta').get();
  console.log('=== _meta doc ===');
  console.log('exists:', meta.exists);
  if (meta.exists) {
    const d = meta.data() ?? {};
    console.log('lastGeneratedAt:', d.lastGeneratedAt);
    console.log('setupItems.length:', Array.isArray(d.setupItems) ? d.setupItems.length : 'not-array');
    console.log('setupItems sample:', JSON.stringify(d.setupItems, null, 2).slice(0, 500));
  }

  const all = await adminDb.collection(path).get();
  const insightDocs = all.docs.filter((d) => d.id !== '_meta');
  console.log('\n=== insight docs ===');
  console.log('total:', insightDocs.length);
  for (const d of insightDocs.slice(0, 5)) {
    const data = d.data();
    console.log(`- ${d.id}: title="${data.title}" urgency=${data.urgency} dismissedAt=${data.dismissedAt} converted=${data.convertedToMissionId} expiresAt=${data.expiresAt}`);
  }
  process.exit(0);
}

void main();
