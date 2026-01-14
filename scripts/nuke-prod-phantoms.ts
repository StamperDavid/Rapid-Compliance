/**
 * NUKE PROD PHANTOMS
 * Uses serviceAccountKey-prod.json to clean production database
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

config();

const GOLDEN = new Set([
  'platform',
  'org_demo_adventuregear',
  'org_demo_auraflow',
  'org_demo_greenthumb',
  'org_demo_pixelperfect',
  'org_demo_summitwm',
]);

const DEMO_ORGS = [
  { id: 'org_demo_adventuregear', name: 'The Adventure Gear Shop', industry: 'retail' },
  { id: 'org_demo_auraflow', name: 'AuraFlow Analytics', industry: 'saas' },
  { id: 'org_demo_greenthumb', name: 'GreenThumb Landscaping', industry: 'services' },
  { id: 'org_demo_pixelperfect', name: 'PixelPerfect Design Co.', industry: 'creative' },
  { id: 'org_demo_summitwm', name: 'Summit Wealth Management', industry: 'finance' },
];

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('  NUKE PROD PHANTOMS');
  console.log('█'.repeat(60));

  // Use PRODUCTION service account
  const keyPath = path.join(process.cwd(), 'serviceAccountKey-prod.json');
  if (!fs.existsSync(keyPath)) {
    throw new Error('serviceAccountKey-prod.json not found!');
  }

  // Remove BOM if present
  let content = fs.readFileSync(keyPath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  const sa = JSON.parse(content);
  console.log(`\n🔥 PRODUCTION: ${sa.project_id}\n`);

  if (getApps().length === 0) {
    initializeApp({ credential: cert(sa) });
  }

  const db = getFirestore();

  // STEP 1: Find ALL refs using listDocuments (catches phantoms)
  console.log('📂 Finding ALL document references (including phantoms)...\n');
  const allRefs = await db.collection('organizations').listDocuments();
  console.log(`Found ${allRefs.length} references\n`);

  const toKeep: string[] = [];
  const toNuke: string[] = [];

  for (const ref of allRefs) {
    if (GOLDEN.has(ref.id)) {
      toKeep.push(ref.id);
      console.log(`✅ KEEP: ${ref.id}`);
    } else {
      toNuke.push(ref.id);
      const doc = await ref.get();
      const subcols = await ref.listCollections();
      const isPhantom = !doc.exists && subcols.length > 0;
      console.log(`💀 NUKE: ${ref.id} ${isPhantom ? '(PHANTOM)' : ''}`);
      if (subcols.length > 0) {
        console.log(`   └─ Subcollections: ${subcols.map(c => c.id).join(', ')}`);
      }
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 Keep: ${toKeep.length}, Nuke: ${toNuke.length}\n`);

  // STEP 2: NUKE non-golden
  if (toNuke.length > 0) {
    console.log(`🔥 NUKING ${toNuke.length} documents...\n`);

    let nuked = 0;
    for (const id of toNuke) {
      try {
        await db.recursiveDelete(db.collection('organizations').doc(id));
        nuked++;
        if (nuked % 20 === 0 || nuked === toNuke.length) {
          console.log(`   Nuked ${nuked}/${toNuke.length}...`);
        }
      } catch (err: any) {
        console.log(`   ❌ Failed: ${id} - ${err.message}`);
      }
    }
    console.log(`\n✅ Nuked ${nuked} documents\n`);
  }

  // STEP 3: Seed missing Golden orgs
  console.log('🌱 Seeding Golden orgs...\n');

  const platformRef = db.collection('organizations').doc('platform');
  const platformDoc = await platformRef.get();
  if (!platformDoc.exists) {
    await platformRef.set({ name: 'Platform Admin', type: 'platform', createdAt: new Date() });
    console.log('   ✅ Created: platform');
  } else {
    console.log('   ⏭️ Exists: platform');
  }

  for (const demo of DEMO_ORGS) {
    const docRef = db.collection('organizations').doc(demo.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      await docRef.set({
        name: demo.name,
        industry: demo.industry,
        plan: 'demo',
        isDemo: true,
        createdAt: new Date(),
      });
      console.log(`   ✅ Created: ${demo.id}`);
    } else {
      console.log(`   ⏭️ Exists: ${demo.id}`);
    }
  }

  // STEP 4: Verify
  console.log('\n🔍 FINAL VERIFICATION...\n');
  const finalRefs = await db.collection('organizations').listDocuments();
  console.log(`Remaining: ${finalRefs.length}\n`);

  let allGood = true;
  for (const ref of finalRefs) {
    const isGolden = GOLDEN.has(ref.id);
    console.log(`   ${isGolden ? '✅' : '❌'} ${ref.id}`);
    if (!isGolden) allGood = false;
  }

  for (const goldenId of GOLDEN) {
    if (!finalRefs.some(r => r.id === goldenId)) {
      console.log(`   ❌ MISSING: ${goldenId}`);
      allGood = false;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(allGood ? '  ✅ PRODUCTION CLEAN - ONLY GOLDEN 6 EXIST' : '  ❌ ISSUES - SEE ABOVE');
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
