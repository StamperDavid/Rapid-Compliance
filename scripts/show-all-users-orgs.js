/**
 * Show ALL users and organizations in database
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function showAll() {
  console.log('\n📊 COMPLETE DATABASE INVENTORY\n');
  console.log('='.repeat(80));
  
  // Get ALL users
  const usersSnapshot = await db.collection('users').get();
  console.log(`\n👥 USERS (${usersSnapshot.size} total):\n`);
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`   ${data.email || 'NO EMAIL'}`);
    console.log(`      UID: ${doc.id}`);
    console.log(`      Name: ${data.name || 'NO NAME'}`);
    console.log(`      Role: ${data.role || 'NO ROLE'}`);
    console.log(`      Org ID: ${data.organizationId || 'NO ORG'}`);
    console.log(`      Created: ${data.createdAt?.toDate() || 'UNKNOWN'}`);
    console.log('');
  });
  
  // Get ALL organizations
  const orgsSnapshot = await db.collection('organizations').get();
  console.log(`\n🏢 ORGANIZATIONS (${orgsSnapshot.size} total):\n`);
  orgsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`   ${data.name || doc.id}`);
    console.log(`      ID: ${doc.id}`);
    console.log(`      Status: ${data.status || 'NO STATUS'}`);
    console.log(`      Plan: ${data.plan || 'NO PLAN'}`);
    console.log(`      Created: ${data.createdAt?.toDate() || 'UNKNOWN'}`);
    console.log(`      Created By: ${data.createdBy || 'UNKNOWN'}`);
    console.log('');
  });
  
  console.log('='.repeat(80));
}

showAll()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
