/**
 * Detailed Account Inspector
 * Shows EVERYTHING in Firebase Auth and Firestore
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function inspectEverything() {
  console.log('🔍 DETAILED FIREBASE INSPECTION\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 1. Check ALL Auth users
  console.log('📋 FIREBASE AUTHENTICATION USERS:\n');
  
  try {
    let allAuthUsers = [];
    let nextPageToken;
    
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      allAuthUsers = allAuthUsers.concat(listUsersResult.users);
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    console.log(`Total Auth Users: ${allAuthUsers.length}\n`);
    
    allAuthUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email || 'NO EMAIL'}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Display Name: ${user.displayName || 'None'}`);
      console.log(`   Created: ${user.metadata.creationTime}`);
      console.log(`   Last Sign In: ${user.metadata.lastSignInTime || 'Never'}`);
      console.log(`   Email Verified: ${user.emailVerified}`);
      console.log(`   Disabled: ${user.disabled || false}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error reading Auth:', error.message);
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 2. Check Firestore 'users' collection
  console.log('📂 FIRESTORE "users" COLLECTION:\n');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`Total Documents: ${usersSnapshot.size}\n`);
    
    usersSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${data.email || 'NO EMAIL'}`);
      console.log(`   Doc ID: ${doc.id}`);
      console.log(`   Display Name: ${data.displayName || data.name || 'None'}`);
      console.log(`   Role: ${data.role || 'None'}`);
      console.log(`   Organization ID: ${data.organizationId || 'None'}`);
      console.log(`   Created At: ${data.createdAt?.toDate?.() || 'Unknown'}`);
      console.log(`   All Fields: ${Object.keys(data).join(', ')}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error reading users collection:', error.message);
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 3. Check for test_users collection
  console.log('📂 FIRESTORE "test_users" COLLECTION:\n');
  
  try {
    const testUsersSnapshot = await db.collection('test_users').get();
    
    if (testUsersSnapshot.empty) {
      console.log('✅ No test_users collection (good!)\n');
    } else {
      console.log(`Total Documents: ${testUsersSnapshot.size}\n`);
      
      testUsersSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ${data.email || 'NO EMAIL'}`);
        console.log(`   Doc ID: ${doc.id}`);
        console.log(`   Role: ${data.role || 'None'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.log('✅ test_users collection does not exist\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 4. Check organizations
  console.log('📂 FIRESTORE "organizations" COLLECTION:\n');
  
  try {
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`Total Documents: ${orgsSnapshot.size}\n`);
    
    orgsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${data.name || 'NO NAME'}`);
      console.log(`   Doc ID: ${doc.id}`);
      console.log(`   Created At: ${data.createdAt?.toDate?.() || 'Unknown'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error reading organizations:', error.message);
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 5. Check for test organizations
  console.log('📂 FIRESTORE "test_organizations" COLLECTION:\n');
  
  try {
    const testOrgsSnapshot = await db.collection('test_organizations').get();
    
    if (testOrgsSnapshot.empty) {
      console.log('✅ No test_organizations collection\n');
    } else {
      console.log(`Total Documents: ${testOrgsSnapshot.size}\n`);
      
      testOrgsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ${data.name || 'NO NAME'}`);
        console.log(`   Doc ID: ${doc.id}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.log('✅ test_organizations collection does not exist\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 6. Find duplicates
  console.log('🔍 DUPLICATE ANALYSIS:\n');
  
  try {
    let allAuthUsers = [];
    let nextPageToken;
    
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      allAuthUsers = allAuthUsers.concat(listUsersResult.users);
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    const emailCounts = new Map();
    allAuthUsers.forEach(user => {
      if (user.email) {
        const email = user.email.toLowerCase();
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
    });
    
    const duplicates = Array.from(emailCounts.entries()).filter(([email, count]) => count > 1);
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate emails in Auth:\n`);
      duplicates.forEach(([email, count]) => {
        console.log(`   ${email}: ${count} accounts`);
      });
    } else {
      console.log('✅ No duplicate emails in Firebase Auth\n');
    }
    
    // Check Firestore duplicates
    const usersSnapshot = await db.collection('users').get();
    const firestoreEmailCounts = new Map();
    
    usersSnapshot.forEach(doc => {
      const email = doc.data().email?.toLowerCase();
      if (email) {
        firestoreEmailCounts.set(email, (firestoreEmailCounts.get(email) || 0) + 1);
      }
    });
    
    const firestoreDuplicates = Array.from(firestoreEmailCounts.entries()).filter(([email, count]) => count > 1);
    
    if (firestoreDuplicates.length > 0) {
      console.log(`⚠️  Found ${firestoreDuplicates.length} duplicate emails in Firestore:\n`);
      firestoreDuplicates.forEach(([email, count]) => {
        console.log(`   ${email}: ${count} documents`);
      });
    } else {
      console.log('✅ No duplicate emails in Firestore users collection\n');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing duplicates:', error.message);
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 7. Check admin account specifically
  console.log('👤 YOUR ADMIN ACCOUNT (dstamper@rapidcompliance.us):\n');
  
  try {
    // Check in Auth
    const adminEmail = 'dstamper@rapidcompliance.us';
    
    try {
      const authUser = await auth.getUserByEmail(adminEmail);
      console.log('✅ Found in Firebase Auth:');
      console.log(`   UID: ${authUser.uid}`);
      console.log(`   Email Verified: ${authUser.emailVerified}`);
      console.log(`   Disabled: ${authUser.disabled || false}`);
      console.log(`   Created: ${authUser.metadata.creationTime}`);
      console.log('');
    } catch (e) {
      console.log('❌ NOT found in Firebase Auth\n');
    }
    
    // Check in Firestore
    const userQuery = await db.collection('users').where('email', '==', adminEmail).get();
    
    if (userQuery.empty) {
      console.log('❌ NOT found in Firestore users collection\n');
    } else {
      console.log(`✅ Found ${userQuery.size} document(s) in Firestore:`);
      userQuery.forEach(doc => {
        const data = doc.data();
        console.log(`   Doc ID: ${doc.id}`);
        console.log(`   Role: ${data.role}`);
        console.log(`   Org ID: ${data.organizationId || 'None'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking admin account:', error.message);
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('✨ Inspection complete!\n');
}

inspectEverything().then(() => process.exit(0)).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
