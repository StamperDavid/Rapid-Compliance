/**
 * COMPREHENSIVE SCAN - Find EVERYTHING
 * 
 * This scans for:
 * - All actual organization documents
 * - All phantom paths (by attempting to access known problematic IDs)
 * - All collections that might contain org data
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function scanEverything() {
  console.log('\n🔍 COMPREHENSIVE DATABASE SCAN\n');
  console.log(`Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}\n`);
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
  
  // 1. Get all actual organization documents
  console.log('1️⃣  ACTUAL ORGANIZATION DOCUMENTS:\n');
  const orgsSnapshot = await db.collection('organizations').get();
  console.log(`Total: ${orgsSnapshot.size}\n`);
  
  const actualOrgs = [];
  orgsSnapshot.forEach(doc => {
    const data = doc.data();
    actualOrgs.push({
      id: doc.id,
      name: data.name || 'Unnamed',
      createdAt: data.createdAt || null
    });
    console.log(`   ✅ ${doc.id} - ${data.name || 'Unnamed'}`);
  });
  console.log('');
  
  // 2. Check if there are any OTHER collections that might have org data
  console.log('2️⃣  ALL TOP-LEVEL COLLECTIONS:\n');
  const allCollections = await db.listCollections();
  for (const coll of allCollections) {
    const snapshot = await coll.get();
    console.log(`   📁 ${coll.id}: ${snapshot.size} documents`);
    
    // If it looks like it might have test data, show first few
    if (coll.id.includes('test') || coll.id.includes('temp')) {
      snapshot.docs.slice(0, 3).forEach(doc => {
        console.log(`      - ${doc.id}`);
      });
      if (snapshot.size > 3) {
        console.log(`      ... and ${snapshot.size - 3} more`);
      }
    }
  }
  console.log('');
  
  // 3. Try to detect phantom paths by checking for subcollections on non-existent docs
  console.log('3️⃣  SCANNING FOR PHANTOM PATHS (this may take a moment)...\n');
  
  // We can't easily list all possible phantom IDs, but we can check if any
  // of the known patterns have subcollections
  const potentialPhantoms = [];
  
  // Try common test org patterns
  for (let i = 1767056931936; i <= 1767233549886; i += 1000) {
    const testId = `test-org-${i}`;
    try {
      const testRef = db.collection('organizations').doc(testId);
      const doc = await testRef.get();
      
      if (!doc.exists) {
        const subcollections = await testRef.listCollections();
        if (subcollections.length > 0) {
          potentialPhantoms.push({
            id: testId,
            subcollections: subcollections.map(s => s.id)
          });
        }
      }
    } catch (e) {
      // Skip errors
    }
  }
  
  if (potentialPhantoms.length > 0) {
    console.log(`   ⚠️  Found ${potentialPhantoms.length} phantom paths with subcollections`);
    potentialPhantoms.slice(0, 5).forEach(p => {
      console.log(`      - ${p.id}: ${p.subcollections.join(', ')}`);
    });
  } else {
    console.log('   ✅ No phantom paths detected in scan');
  }
  console.log('');
  
  // 4. Final summary
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
  console.log(`Actual organizations in database: ${actualOrgs.length}`);
  console.log(`Total collections: ${allCollections.length}`);
  console.log(`Phantom paths found in scan: ${potentialPhantoms.length}`);
  console.log('');
  
  console.log('💡 QUESTION FOR YOU:');
  console.log('   How many organizations do you see in Firebase Console?');
  console.log('   If it\'s more than ' + actualOrgs.length + ', please list their IDs so we can investigate.\n');
}

scanEverything()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
