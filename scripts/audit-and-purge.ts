/**
 * DIRECT FIRESTORE AUDIT & PURGE
 *
 * Lists every document, checks subcollections, identifies Golden 5,
 * and IMMEDIATELY deletes any test-org or org_176 zombies.
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

config();

// Golden 5 + Platform
const GOLDEN_IDS = new Set([
  'platform',
  'org_demo_retail',
  'org_demo_saas',
  'org_demo_healthcare',
  'org_demo_realestate',
  'org_demo_finance',
]);

// Zombie patterns - KILL ON SIGHT
const ZOMBIE_PATTERNS = [/^test-org/, /^org_176/];

function initFirebase(): Firestore {
  if (getApps().length > 0) return getFirestore();

  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
  } else {
    throw new Error('serviceAccountKey.json not found');
  }
  return getFirestore();
}

function isZombie(id: string): boolean {
  return ZOMBIE_PATTERNS.some(pattern => pattern.test(id));
}

async function audit() {
  const db = initFirebase();

  console.log('\n' + '═'.repeat(70));
  console.log('  DIRECT FIRESTORE AUDIT');
  console.log('═'.repeat(70) + '\n');

  // Get ALL documents
  const snapshot = await db.collection('organizations').get();
  console.log(`📂 Collection: organizations`);
  console.log(`   Documents found: ${snapshot.size}\n`);
  console.log('─'.repeat(70));

  const zombies: string[] = [];
  const valid: string[] = [];

  for (const doc of snapshot.docs) {
    const id = doc.id;
    const data = doc.data();
    const name = data.name || data.displayName || 'N/A';

    // Get subcollections
    const subcollections = await doc.ref.listCollections();
    const subcolNames = subcollections.map(c => c.id);

    // Classify
    const isGolden = GOLDEN_IDS.has(id);
    const isZombieDoc = isZombie(id);

    // Status icon
    let status = '✅';
    if (isZombieDoc) status = '💀 ZOMBIE';
    else if (!isGolden) status = '⚠️ UNKNOWN';

    console.log(`\n${status} ${id}`);
    console.log(`   Name: ${name}`);
    console.log(`   Golden 5: ${isGolden ? 'YES' : 'NO'}`);
    console.log(`   Subcollections: ${subcolNames.length > 0 ? subcolNames.join(', ') : 'none'}`);

    if (isZombieDoc) {
      zombies.push(id);
    } else {
      valid.push(id);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`\n📊 AUDIT SUMMARY:`);
  console.log(`   Valid: ${valid.length} (${valid.join(', ')})`);
  console.log(`   Zombies: ${zombies.length} (${zombies.join(', ') || 'none'})`);

  // PURGE ZOMBIES
  if (zombies.length > 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('  🔥 PURGING ZOMBIES');
    console.log('═'.repeat(70) + '\n');

    for (const zombieId of zombies) {
      console.log(`🔥 DELETING: ${zombieId}`);
      const docRef = db.collection('organizations').doc(zombieId);

      try {
        // Use recursiveDelete for complete removal
        await db.recursiveDelete(docRef);
        console.log(`   ✓ recursiveDelete() complete`);

        // VERIFY - attempt to read it back
        const verify = await docRef.get();
        if (verify.exists) {
          console.log(`   ❌ ZOMBIE PERSISTS! Retrying...`);
          await docRef.delete();
          const retry = await docRef.get();
          if (retry.exists) {
            console.log(`   ❌❌ FAILED TO DELETE - MANUAL INTERVENTION REQUIRED`);
          } else {
            console.log(`   ✓ Retry successful`);
          }
        } else {
          console.log(`   ✅ VERIFIED DELETED`);
        }

        // Check for orphaned subcollections
        const orphans = await docRef.listCollections();
        if (orphans.length > 0) {
          console.log(`   ⚠️ Orphaned subcollections: ${orphans.map(c => c.id).join(', ')}`);
          for (const orphan of orphans) {
            await db.recursiveDelete(orphan);
            console.log(`   ✓ Deleted orphan: ${orphan.id}`);
          }
        }

      } catch (err: any) {
        console.log(`   ❌ ERROR: ${err.message}`);
      }
    }
  }

  // FINAL VERIFICATION
  console.log('\n' + '═'.repeat(70));
  console.log('  FINAL LIVE CHECK');
  console.log('═'.repeat(70) + '\n');

  const finalSnap = await db.collection('organizations').get();
  console.log(`📂 organizations: ${finalSnap.size} documents\n`);

  let allGood = true;

  for (const doc of finalSnap.docs) {
    const id = doc.id;
    const name = doc.data().name || 'N/A';
    const subcols = await doc.ref.listCollections();

    if (isZombie(id)) {
      console.log(`❌ ZOMBIE STILL EXISTS: ${id}`);
      allGood = false;
    } else if (GOLDEN_IDS.has(id)) {
      console.log(`✅ ${id} → ${name} [${subcols.length} subcollections]`);
    } else {
      console.log(`⚠️ UNEXPECTED: ${id} → ${name}`);
      allGood = false;
    }
  }

  // Check if all Golden 5 exist
  console.log('\n📋 Golden 5 Check:');
  for (const goldenId of GOLDEN_IDS) {
    const exists = finalSnap.docs.some(d => d.id === goldenId);
    console.log(`   ${exists ? '✅' : '❌'} ${goldenId}`);
    if (!exists) allGood = false;
  }

  console.log('\n' + '═'.repeat(70));
  if (allGood) {
    console.log('  ✅ DATABASE IS CLEAN - ONLY GOLDEN 5 + PLATFORM EXIST');
  } else {
    console.log('  ❌ DATABASE HAS ISSUES - SEE ABOVE');
  }
  console.log('═'.repeat(70) + '\n');

  return allGood;
}

audit()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  });
