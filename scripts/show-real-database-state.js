/**
 * SHOW REAL DATABASE STATE
 * This shows what's ACTUALLY in your database (not Firebase Console ghosts)
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

const db = admin.firestore();
const auth = admin.auth();

async function showRealState() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          REAL DATABASE STATE (NOT CONSOLE GHOSTS)         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log('Project: ' + process.env.FIREBASE_ADMIN_PROJECT_ID);
  console.log('');
  
  // Get ALL organizations that ACTUALLY exist
  const orgsSnapshot = await db.collection('organizations').get();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('ORGANIZATIONS (' + orgsSnapshot.size + ' total)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const realOrgs = [];
  const testOrgs = [];
  const demoOrgs = [];
  
  orgsSnapshot.forEach(doc => {
    const data = doc.data();
    const org = {
      id: doc.id,
      name: data.name || 'Unnamed',
      isDemoAccount: data.isDemoAccount,
      isAutomatedTest: data.isAutomatedTest
    };
    
    if (doc.id === 'platform') {
      realOrgs.push(org);
    } else if (data.isDemoAccount) {
      demoOrgs.push(org);
    } else if (data.isAutomatedTest || doc.id.startsWith('test-org-')) {
      testOrgs.push(org);
    } else {
      realOrgs.push(org);
    }
  });
  
  console.log('📊 PERMANENT DEMO ACCOUNTS (For manual testing):');
  if (demoOrgs.length === 0) {
    console.log('   ❌ NONE FOUND - Need to recreate!\n');
  } else {
    demoOrgs.forEach((org, i) => {
      console.log('   ' + (i + 1) + '. ' + org.name);
      console.log('      ID: ' + org.id);
      console.log('');
    });
  }
  
  console.log('🏢 OTHER ORGANIZATIONS:');
  if (realOrgs.length === 0) {
    console.log('   (none)\n');
  } else {
    realOrgs.forEach((org, i) => {
      console.log('   ' + (i + 1) + '. ' + org.name);
      console.log('      ID: ' + org.id);
      console.log('');
    });
  }
  
  console.log('🧪 AUTOMATED TEST DATA (Should be 0):');
  if (testOrgs.length === 0) {
    console.log('   ✅ CLEAN - No test data!\n');
  } else {
    console.log('   ❌ FOUND ' + testOrgs.length + ' TEST ORGS - Run cleanup!\n');
    testOrgs.forEach((org, i) => {
      if (i < 5) {
        console.log('   ' + (i + 1) + '. ' + org.id + ' (' + org.name + ')');
      }
    });
    if (testOrgs.length > 5) {
      console.log('   ... and ' + (testOrgs.length - 5) + ' more\n');
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('USERS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Get all Auth users
  let allAuthUsers = [];
  let nextPageToken;
  
  do {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);
    allAuthUsers = allAuthUsers.concat(listUsersResult.users);
    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);
  
  console.log('Total Auth Users: ' + allAuthUsers.length + '\n');
  
  allAuthUsers.forEach((user, i) => {
    console.log((i + 1) + '. ' + (user.email || 'NO EMAIL'));
    console.log('   UID: ' + user.uid);
    console.log('   Created: ' + user.metadata.creationTime);
    console.log('');
  });
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('✅ Total real organizations: ' + (realOrgs.length + demoOrgs.length));
  console.log('✅ Demo accounts: ' + demoOrgs.length + ' (should be 5)');
  console.log((testOrgs.length === 0 ? '✅' : '❌') + ' Test data: ' + testOrgs.length + ' (should be 0)');
  console.log('✅ Total users: ' + allAuthUsers.length);
  console.log('');
  
  if (testOrgs.length > 0) {
    console.log('⚠️  ACTION NEEDED: Run cleanup script');
    console.log('   node scripts/nuke-test-data.js\n');
  } else {
    console.log('🎉 DATABASE IS CLEAN!\n');
    console.log('Note: Firebase Console may show "ghost" entries for deleted documents.');
    console.log('This is a known UI bug. Click on any ghost entry and you\'ll see:');
    console.log('"This document does not exist"\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
}

showRealState()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
