/**
 * Quick database inspection script
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
const auth = admin.auth();

async function inspectDatabase() {
  console.log('\n🔍 FULL DATABASE INSPECTION\n');
  console.log(`Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}\n`);
  
  // Check organizations
  const orgsSnapshot = await db.collection('organizations').get();
  console.log('📦 ORGANIZATIONS:');
  console.log(`   Total: ${orgsSnapshot.size}`);
  orgsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: ${data.name || 'unnamed'}`);
  });
  console.log('');
  
  // Check users in Firestore
  const usersSnapshot = await db.collection('users').get();
  console.log('👥 USERS (Firestore):');
  console.log(`   Total: ${usersSnapshot.size}`);
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${data.email || 'no email'} → org: ${data.organizationId || 'none'}`);
  });
  console.log('');
  
  // Check users in Auth
  console.log('🔐 USERS (Firebase Auth):');
  const authUsers = await auth.listUsers(1000);
  console.log(`   Total: ${authUsers.users.length}`);
  authUsers.users.forEach(user => {
    console.log(`   - ${user.email || 'no email'} (uid: ${user.uid})`);
  });
  console.log('');
  
  // List all collections
  console.log('📚 ALL COLLECTIONS:');
  const collections = await db.listCollections();
  for (const collection of collections) {
    const snapshot = await collection.get();
    console.log(`   - ${collection.id}: ${snapshot.size} documents`);
  }
  console.log('');
  
  // Check for orphaned users
  console.log('🔍 ORPHANED USER CHECK:');
  const orgIds = new Set();
  orgsSnapshot.forEach(doc => orgIds.add(doc.id));
  
  let orphanedCount = 0;
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.organizationId && !orgIds.has(data.organizationId)) {
      console.log(`   ⚠️  ${data.email} → orphaned org: ${data.organizationId}`);
      orphanedCount++;
    }
  });
  if (orphanedCount === 0) {
    console.log('   ✅ No orphaned users found');
  }
  console.log('');
}

inspectDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
