/**
 * NUKE GHOSTS - Simple recursive delete for ALL non-Golden documents
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

config();

// THE GOLDEN 5 + PLATFORM - DO NOT DELETE
const GOLDEN = new Set([
  'platform',
  'org_demo_retail',
  'org_demo_saas',
  'org_demo_healthcare',
  'org_demo_realestate',
  'org_demo_finance',
]);

async function nuke() {
  // Init Firebase
  if (getApps().length === 0) {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    initializeApp({ credential: cert(sa) });
    console.log(`\n🔥 Firebase initialized: ${sa.project_id}\n`);
  }

  const db = getFirestore();

  // Get ALL documents
  console.log('📂 Fetching ALL documents from organizations...\n');
  const snapshot = await db.collection('organizations').get();
  console.log(`Found ${snapshot.size} documents\n`);

  // Find targets (anything NOT in Golden list)
  const targets: string[] = [];

  for (const doc of snapshot.docs) {
    if (!GOLDEN.has(doc.id)) {
      targets.push(doc.id);
      console.log(`💀 TARGET: ${doc.id}`);
    } else {
      console.log(`✅ KEEP: ${doc.id}`);
    }
  }

  if (targets.length === 0) {
    console.log('\n✅ No ghost documents found. Database is clean.\n');
    return;
  }

  // NUKE each target with recursiveDelete
  console.log(`\n🔥 NUKING ${targets.length} ghost document(s)...\n`);

  for (const targetId of targets) {
    const docRef = db.collection('organizations').doc(targetId);

    console.log(`─── ${targetId} ───`);

    try {
      // List subcollections first (for logging)
      const subcols = await docRef.listCollections();
      if (subcols.length > 0) {
        console.log(`   Subcollections: ${subcols.map(c => c.id).join(', ')}`);
      }

      // RECURSIVE DELETE - nukes doc + all subcollections
      await db.recursiveDelete(docRef);
      console.log(`   ✅ DELETED (doc + ${subcols.length} subcollections)\n`);

    } catch (err: any) {
      console.log(`   ❌ ERROR: ${err.message}\n`);
    }
  }

  // Verify
  console.log('─'.repeat(50));
  console.log('\n📋 POST-DELETE VERIFICATION:\n');

  const verify = await db.collection('organizations').get();
  console.log(`Documents remaining: ${verify.size}\n`);

  for (const doc of verify.docs) {
    const status = GOLDEN.has(doc.id) ? '✅' : '💀 GHOST';
    console.log(`   ${status} ${doc.id}`);
  }

  const ghosts = verify.docs.filter(d => !GOLDEN.has(d.id));
  if (ghosts.length > 0) {
    console.log(`\n❌ ${ghosts.length} GHOST(S) STILL EXIST!\n`);
  } else {
    console.log('\n✅ DATABASE IS CLEAN\n');
  }
}

nuke().catch(console.error);
