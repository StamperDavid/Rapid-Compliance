/**
 * NUKE PHANTOMS - Targets ghost documents with orphaned subcollections
 *
 * Uses listDocuments() to find ALL document references (including phantoms)
 * then recursiveDelete() to nuke subcollections
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

config();

const GOLDEN = new Set([
  'platform',
  'org_demo_retail',
  'org_demo_saas',
  'org_demo_healthcare',
  'org_demo_realestate',
  'org_demo_finance',
]);

async function nukePhantoms() {
  if (getApps().length === 0) {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    initializeApp({ credential: cert(sa) });
    console.log(`\n🔥 Firebase: ${sa.project_id}\n`);
  }

  const db = getFirestore();

  // USE listDocuments() - THIS FINDS PHANTOMS!
  console.log('📂 Using listDocuments() to find ALL refs (including phantoms)...\n');
  const allRefs = await db.collection('organizations').listDocuments();
  console.log(`Found ${allRefs.length} document references\n`);

  const targets: string[] = [];
  const keep: string[] = [];

  for (const ref of allRefs) {
    if (GOLDEN.has(ref.id)) {
      keep.push(ref.id);
      console.log(`✅ KEEP: ${ref.id}`);
    } else {
      targets.push(ref.id);

      // Check if it's a phantom (has subcollections but no document)
      const doc = await ref.get();
      const subcols = await ref.listCollections();
      const isPhantom = !doc.exists && subcols.length > 0;

      console.log(`💀 TARGET: ${ref.id} ${isPhantom ? '(PHANTOM - has subcollections but no doc)' : ''}`);
      if (subcols.length > 0) {
        console.log(`   └─ Subcollections: ${subcols.map(c => c.id).join(', ')}`);
      }
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`\n📊 Summary: ${keep.length} to keep, ${targets.length} to NUKE\n`);

  if (targets.length === 0) {
    console.log('✅ No phantoms found!\n');
    return;
  }

  // NUKE THEM ALL
  console.log(`🔥 NUKING ${targets.length} phantom(s)...\n`);

  let nuked = 0;
  let failed = 0;

  for (const targetId of targets) {
    const docRef = db.collection('organizations').doc(targetId);

    try {
      // recursiveDelete nukes the doc AND all subcollections
      await db.recursiveDelete(docRef);
      console.log(`✅ NUKED: ${targetId}`);
      nuked++;
    } catch (err: any) {
      console.log(`❌ FAILED: ${targetId} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`\n📊 Results: ${nuked} nuked, ${failed} failed\n`);

  // VERIFY with listDocuments again
  console.log('🔍 POST-NUKE VERIFICATION (listDocuments)...\n');
  const verifyRefs = await db.collection('organizations').listDocuments();

  console.log(`Remaining references: ${verifyRefs.length}\n`);

  let ghostsRemain = 0;
  for (const ref of verifyRefs) {
    const isGolden = GOLDEN.has(ref.id);
    console.log(`${isGolden ? '✅' : '💀'} ${ref.id}`);
    if (!isGolden) ghostsRemain++;
  }

  if (ghostsRemain > 0) {
    console.log(`\n❌ ${ghostsRemain} GHOST(S) STILL REMAIN!\n`);
  } else {
    console.log(`\n✅ ALL PHANTOMS DESTROYED - ONLY GOLDEN 6 REMAIN\n`);
  }
}

nukePhantoms().catch(console.error);
