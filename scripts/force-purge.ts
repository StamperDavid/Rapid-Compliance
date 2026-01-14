/**
 * FORCE PURGE SCRIPT - NO MERCY MODE
 *
 * Uses admin.firestore().recursiveDelete() to NUKE documents and ALL subcollections.
 * Includes post-deletion verification - if the doc still exists, we FAIL LOUD.
 *
 * Usage: npx ts-node scripts/force-purge.ts
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

config();

// ============================================================================
// CONFIGURATION - WHAT TO KILL
// ============================================================================

// IDs to KEEP (exact match)
const KEEP_IDS = new Set([
  'platform',           // Platform Admin
  'org_demo_retail',    // Demo: Retail
  'org_demo_saas',      // Demo: SaaS
  'org_demo_healthcare',// Demo: Healthcare
  'org_demo_realestate',// Demo: Real Estate
  'org_demo_finance',   // Demo: Finance
]);

// Collection to purge
const COLLECTION = 'organizations';

// ============================================================================
// FIREBASE INIT
// ============================================================================

let db: Firestore;

function initFirebase(): Firestore {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
    console.log('✅ Firebase initialized');
  } else {
    throw new Error('serviceAccountKey.json not found');
  }

  return getFirestore();
}

// ============================================================================
// RECURSIVE DELETE WITH VERIFICATION
// ============================================================================

async function forceDelete(db: Firestore, docId: string): Promise<boolean> {
  const docRef = db.collection(COLLECTION).doc(docId);

  console.log(`\n🔥 PURGING: ${docId}`);

  try {
    // NUCLEAR OPTION: recursiveDelete
    await db.recursiveDelete(docRef);
    console.log(`   ✓ recursiveDelete() completed`);

    // VERIFICATION: Try to read it back
    const verifySnap = await docRef.get();

    if (verifySnap.exists) {
      console.log(`   ❌ ZOMBIE DETECTED! Document still exists after deletion!`);
      console.log(`   📋 Data: ${JSON.stringify(verifySnap.data())}`);

      // RETRY: Direct delete
      console.log(`   🔄 Retrying with direct delete...`);
      await docRef.delete();

      // VERIFY AGAIN
      const retrySnap = await docRef.get();
      if (retrySnap.exists) {
        console.log(`   ❌❌ STILL EXISTS! Manual intervention required.`);
        return false;
      }
    }

    // Check for orphaned subcollections
    const subcollections = await docRef.listCollections();
    if (subcollections.length > 0) {
      console.log(`   ⚠️ Orphaned subcollections found: ${subcollections.map(c => c.id).join(', ')}`);
      console.log(`   🔄 Force deleting subcollections...`);

      for (const subcol of subcollections) {
        await db.recursiveDelete(subcol);
        console.log(`      ✓ Deleted subcollection: ${subcol.id}`);
      }
    }

    console.log(`   ✅ VERIFIED DELETED: ${docId}`);
    return true;

  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return false;
  }
}

// ============================================================================
// GOLDEN SEED - CREATE DEMO ACCOUNTS
// ============================================================================

interface DemoOrg {
  id: string;
  name: string;
  industry: string;
  plan: string;
}

const DEMO_ORGS: DemoOrg[] = [
  { id: 'org_demo_retail', name: 'Demo: Retail Store', industry: 'retail', plan: 'demo' },
  { id: 'org_demo_saas', name: 'Demo: SaaS Company', industry: 'saas', plan: 'demo' },
  { id: 'org_demo_healthcare', name: 'Demo: Healthcare Provider', industry: 'healthcare', plan: 'demo' },
  { id: 'org_demo_realestate', name: 'Demo: Real Estate Agency', industry: 'real_estate', plan: 'demo' },
  { id: 'org_demo_finance', name: 'Demo: Financial Services', industry: 'finance', plan: 'demo' },
];

async function seedDemoAccounts(db: Firestore): Promise<void> {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  GOLDEN SEED - Creating Demo Accounts');
  console.log('════════════════════════════════════════════════════════════════\n');

  for (const demo of DEMO_ORGS) {
    const docRef = db.collection(COLLECTION).doc(demo.id);
    const existing = await docRef.get();

    if (existing.exists) {
      console.log(`  ⏭️ SKIP: ${demo.id} already exists`);
      continue;
    }

    await docRef.set({
      name: demo.name,
      industry: demo.industry,
      plan: demo.plan,
      createdAt: new Date(),
      isDemo: true,
      settings: {
        aiEnabled: true,
        maxAgents: 5,
      },
    });

    console.log(`  ✅ CREATED: ${demo.id} (${demo.name})`);
  }
}

// ============================================================================
// MAIN PURGE FUNCTION
// ============================================================================

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  FORCE PURGE - NO MERCY MODE');
  console.log('════════════════════════════════════════════════════════════════\n');

  db = initFirebase();

  // STEP 1: Get all documents
  console.log(`📂 Scanning collection: ${COLLECTION}`);
  const snapshot = await db.collection(COLLECTION).get();
  console.log(`   Found ${snapshot.size} documents\n`);

  // Classify
  const toKeep: string[] = [];
  const toDelete: string[] = [];

  snapshot.forEach(doc => {
    if (KEEP_IDS.has(doc.id) || doc.id.startsWith('org_demo_')) {
      toKeep.push(doc.id);
    } else {
      toDelete.push(doc.id);
    }
  });

  console.log('════════════════════════════════════════════════════════════════');
  console.log(`  KEEP (${toKeep.length}): ${toKeep.join(', ') || 'none'}`);
  console.log(`  DELETE (${toDelete.length}): ${toDelete.join(', ') || 'none'}`);
  console.log('════════════════════════════════════════════════════════════════');

  // STEP 2: PURGE
  if (toDelete.length === 0) {
    console.log('\n✅ Nothing to delete!');
  } else {
    console.log('\n🔥 INITIATING PURGE...');

    let successCount = 0;
    let failCount = 0;

    for (const docId of toDelete) {
      const success = await forceDelete(db, docId);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log(`  PURGE RESULTS: ${successCount} deleted, ${failCount} failed`);
    console.log('════════════════════════════════════════════════════════════════');

    if (failCount > 0) {
      console.log('\n❌ SOME DELETIONS FAILED! Check Firebase Console manually.');
    }
  }

  // STEP 3: SEED DEMO ACCOUNTS
  await seedDemoAccounts(db);

  // STEP 4: FINAL VERIFICATION
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  FINAL LIVE CHECK');
  console.log('════════════════════════════════════════════════════════════════\n');

  const finalSnapshot = await db.collection(COLLECTION).get();
  console.log(`📂 Collection: ${COLLECTION}`);
  console.log(`   Total documents: ${finalSnapshot.size}\n`);

  finalSnapshot.forEach(doc => {
    const data = doc.data();
    const status = KEEP_IDS.has(doc.id) || doc.id.startsWith('org_demo_') ? '✅' : '❌ ZOMBIE';
    console.log(`   ${status} ${doc.id}: ${data.name || 'N/A'}`);
  });

  // Check for any unexpected documents
  const unexpectedDocs = finalSnapshot.docs.filter(
    doc => !KEEP_IDS.has(doc.id) && !doc.id.startsWith('org_demo_')
  );

  if (unexpectedDocs.length > 0) {
    console.log('\n❌❌❌ ZOMBIE DATA DETECTED! These IDs should not exist:');
    unexpectedDocs.forEach(doc => console.log(`   - ${doc.id}`));
    process.exit(1);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  ✅ PURGE COMPLETE - DATABASE IS CLEAN');
  console.log('════════════════════════════════════════════════════════════════\n');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
