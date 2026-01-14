/**
 * Quick stats verification script
 * Checks what Jasper would see from both prefixed and unprefixed collections
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

config();

function initFirebase() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    throw new Error('No credentials found');
  }

  return getFirestore();
}

async function verify() {
  const db = initFirebase();

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  JASPER STATS VERIFICATION');
  console.log('════════════════════════════════════════════════════════════════\n');

  // Check unprefixed (production) collection
  const prodOrgs = await db.collection('organizations').get();
  console.log('📂 Production (organizations):');
  console.log(`   Count: ${prodOrgs.size}`);
  prodOrgs.forEach(doc => {
    console.log(`   • ${doc.id}: ${doc.data().name || 'N/A'}`);
  });

  // Check prefixed (dev/test) collection
  const testOrgs = await db.collection('test_organizations').get();
  console.log('\n📂 Dev/Test (test_organizations):');
  console.log(`   Count: ${testOrgs.size}`);
  testOrgs.forEach(doc => {
    console.log(`   • ${doc.id}: ${doc.data().name || 'N/A'}`);
  });

  // What Jasper would see (with fallback logic)
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  WHAT JASPER WILL SEE');
  console.log('════════════════════════════════════════════════════════════════');

  if (testOrgs.size > 0) {
    console.log(`\n   In DEV mode: ${testOrgs.size} organizations (from test_organizations)`);
  } else if (prodOrgs.size > 0) {
    console.log(`\n   In DEV mode: ${prodOrgs.size} organizations (fallback to organizations)`);
  } else {
    console.log('\n   In DEV mode: 0 organizations');
  }

  console.log(`   In PROD mode: ${prodOrgs.size} organizations (from organizations)`);

  console.log('\n✅ Verification complete\n');
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
