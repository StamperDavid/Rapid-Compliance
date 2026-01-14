/**
 * FINAL PURGE & SEED
 *
 * Golden 6:
 * - org_demo_adventuregear
 * - org_demo_auraflow
 * - org_demo_greenthumb
 * - org_demo_pixelperfect
 * - org_demo_summitwm
 * - platform
 *
 * Everything else gets NUKED. Missing Golden orgs get SEEDED.
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

config();

// THE CORRECT GOLDEN 6
const GOLDEN = new Set([
  'platform',
  'org_demo_adventuregear',
  'org_demo_auraflow',
  'org_demo_greenthumb',
  'org_demo_pixelperfect',
  'org_demo_summitwm',
]);

// Seed data for demo orgs
const DEMO_ORGS = [
  { id: 'org_demo_adventuregear', name: 'The Adventure Gear Shop', industry: 'retail' },
  { id: 'org_demo_auraflow', name: 'AuraFlow Analytics', industry: 'saas' },
  { id: 'org_demo_greenthumb', name: 'GreenThumb Landscaping', industry: 'services' },
  { id: 'org_demo_pixelperfect', name: 'PixelPerfect Design Co.', industry: 'creative' },
  { id: 'org_demo_summitwm', name: 'Summit Wealth Management', industry: 'finance' },
];

async function purgeAndSeed(db: Firestore, projectId: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  PURGE & SEED: ${projectId}`);
  console.log(`${'═'.repeat(60)}\n`);

  // STEP 1: Find ALL document references (including phantoms)
  console.log('📂 Finding all document references...\n');
  const allRefs = await db.collection('organizations').listDocuments();
  console.log(`Found ${allRefs.length} references\n`);

  // Classify
  const toKeep: string[] = [];
  const toNuke: string[] = [];

  for (const ref of allRefs) {
    if (GOLDEN.has(ref.id)) {
      toKeep.push(ref.id);
    } else {
      toNuke.push(ref.id);
    }
  }

  console.log(`✅ KEEP: ${toKeep.length} (${toKeep.join(', ') || 'none'})`);
  console.log(`💀 NUKE: ${toNuke.length}\n`);

  // STEP 2: NUKE non-golden
  if (toNuke.length > 0) {
    console.log(`🔥 Nuking ${toNuke.length} documents...\n`);

    let nuked = 0;
    for (const id of toNuke) {
      try {
        await db.recursiveDelete(db.collection('organizations').doc(id));
        nuked++;
        // Only log every 50 or last one
        if (nuked % 50 === 0 || nuked === toNuke.length) {
          console.log(`   Nuked ${nuked}/${toNuke.length}...`);
        }
      } catch (err: any) {
        console.log(`   ❌ Failed: ${id} - ${err.message}`);
      }
    }
    console.log(`\n✅ Nuked ${nuked} documents\n`);
  }

  // STEP 3: SEED missing Golden orgs
  console.log('🌱 Seeding Golden orgs...\n');

  // Check platform
  const platformRef = db.collection('organizations').doc('platform');
  const platformDoc = await platformRef.get();
  if (!platformDoc.exists) {
    await platformRef.set({
      name: 'Platform Admin',
      type: 'platform',
      createdAt: new Date(),
    });
    console.log('   ✅ Created: platform');
  } else {
    console.log('   ⏭️ Exists: platform');
  }

  // Check demo orgs
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
        settings: { aiEnabled: true },
      });
      console.log(`   ✅ Created: ${demo.id}`);
    } else {
      console.log(`   ⏭️ Exists: ${demo.id}`);
    }
  }

  // STEP 4: VERIFY
  console.log('\n🔍 Final verification...\n');
  const finalRefs = await db.collection('organizations').listDocuments();

  console.log(`Remaining: ${finalRefs.length} documents\n`);

  let allGood = true;
  for (const ref of finalRefs) {
    const isGolden = GOLDEN.has(ref.id);
    console.log(`   ${isGolden ? '✅' : '❌'} ${ref.id}`);
    if (!isGolden) allGood = false;
  }

  // Check all Golden exist
  for (const goldenId of GOLDEN) {
    const exists = finalRefs.some(r => r.id === goldenId);
    if (!exists) {
      console.log(`   ❌ MISSING: ${goldenId}`);
      allGood = false;
    }
  }

  return allGood;
}

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('  FINAL PURGE & SEED');
  console.log('█'.repeat(60));

  // Initialize with service account
  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    throw new Error('serviceAccountKey.json not found');
  }

  const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

  if (getApps().length === 0) {
    initializeApp({ credential: cert(sa) });
  }

  const db = getFirestore();
  const projectId = sa.project_id;

  console.log(`\n🔥 Project: ${projectId}`);

  const success = await purgeAndSeed(db, projectId);

  console.log('\n' + '═'.repeat(60));
  if (success) {
    console.log('  ✅ DATABASE CLEAN - ONLY GOLDEN 6 EXIST');
  } else {
    console.log('  ❌ ISSUES DETECTED - SEE ABOVE');
  }
  console.log('═'.repeat(60) + '\n');

  process.exit(success ? 0 : 1);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
