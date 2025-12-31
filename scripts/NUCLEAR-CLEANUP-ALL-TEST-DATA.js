/**
 * NUCLEAR CLEANUP - Remove ALL test organizations and users
 * This will delete EVERYTHING except:
 * - dstamper@rapidcompliance.us
 * - The 5 approved demo accounts
 * - Platform organization
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// PROTECTED ACCOUNTS - DO NOT DELETE
const PROTECTED_EMAILS = [
  'dstamper@rapidcompliance.us',
  'demo-auraflow@test.com',
  'demo-greenthumb@test.com',
  'demo-adventuregear@test.com',
  'demo-summitwm@test.com',
  'demo-pixelperfect@test.com',
];

// PROTECTED ORGANIZATIONS - DO NOT DELETE
const PROTECTED_ORG_IDS = ['platform'];

async function nuclearCleanup() {
  console.log('\n💥 NUCLEAR CLEANUP - REMOVING ALL TEST DATA\n');
  console.log('='.repeat(80));
  console.log('Protected accounts:');
  PROTECTED_EMAILS.forEach(email => console.log(`   ✅ ${email}`));
  console.log('\nEverything else will be DELETED.\n');
  console.log('='.repeat(80));
  
  let deletedOrgs = 0;
  let deletedUsers = 0;
  
  // STEP 1: Delete ALL test organizations
  console.log('\n1️⃣ Deleting test organizations...\n');
  
  const orgsSnapshot = await db.collection('organizations').get();
  console.log(`Found ${orgsSnapshot.size} organizations total`);
  
  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id;
    const orgData = orgDoc.data();
    const orgName = orgData.name || orgId;
    
    // Skip protected orgs
    if (PROTECTED_ORG_IDS.includes(orgId)) {
      console.log(`   ✅ KEEPING: ${orgName} (${orgId})`);
      continue;
    }
    
    // Check if it's owned by protected user
    const isProtectedOrg = orgData.createdBy && await (async () => {
      try {
        const userDoc = await db.collection('users').doc(orgData.createdBy).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          return PROTECTED_EMAILS.includes(userData.email);
        }
      } catch (e) {
        return false;
      }
      return false;
    })();
    
    if (isProtectedOrg) {
      console.log(`   ✅ KEEPING: ${orgName} (${orgId}) - owned by protected user`);
      continue;
    }
    
    // DELETE IT
    console.log(`   🗑️ DELETING: ${orgName} (${orgId})`);
    await db.collection('organizations').doc(orgId).delete();
    deletedOrgs++;
  }
  
  // STEP 2: Delete ALL non-protected users
  console.log(`\n2️⃣ Deleting non-protected users...\n`);
  
  const usersSnapshot = await db.collection('users').get();
  console.log(`Found ${usersSnapshot.size} users total`);
  
  for (const userDoc of usersSnapshot.docs) {
    const uid = userDoc.id;
    const userData = userDoc.data();
    const email = userData.email;
    
    // Skip protected users
    if (PROTECTED_EMAILS.includes(email)) {
      console.log(`   ✅ KEEPING: ${email}`);
      continue;
    }
    
    // DELETE IT
    console.log(`   🗑️ DELETING: ${email} (${uid})`);
    
    // Delete from Firestore
    await db.collection('users').doc(uid).delete();
    
    // Delete from Firebase Auth
    try {
      await auth.deleteUser(uid);
    } catch (e) {
      // Might not exist in Auth, that's okay
    }
    
    deletedUsers++;
  }
  
  // STEP 3: Verify cleanup
  console.log('\n3️⃣ Verifying cleanup...\n');
  
  const finalOrgs = await db.collection('organizations').get();
  const finalUsers = await db.collection('users').get();
  
  console.log('\n' + '='.repeat(80));
  console.log('💥 NUCLEAR CLEANUP COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nDeleted ${deletedOrgs} organizations`);
  console.log(`Deleted ${deletedUsers} users`);
  console.log(`\nRemaining: ${finalUsers.size} users, ${finalOrgs.size} organizations\n`);
  
  console.log('Remaining users:');
  finalUsers.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${data.email} (${data.role})`);
  });
  
  console.log('\nRemaining organizations:');
  finalOrgs.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${data.name || doc.id}`);
  });
  
  console.log('\n' + '='.repeat(80));
}

nuclearCleanup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
