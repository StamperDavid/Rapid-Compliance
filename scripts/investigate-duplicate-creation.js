/**
 * Investigate Duplicate Creation and Test Data Pollution
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function investigateDuplicates() {
  try {
    console.log('\n🔍 INVESTIGATING DUPLICATE CREATION AND TEST DATA\n');
    console.log('='.repeat(80));
    
    // 1. Check all users with your email
    console.log('\n1️⃣ Checking user accounts with dstamper@rapidcompliance.us...\n');
    const usersSnapshot = await db.collection('users')
      .where('email', '==', 'dstamper@rapidcompliance.us')
      .get();
    
    console.log(`Found ${usersSnapshot.size} user document(s):\n`);
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate() || 'UNKNOWN';
      const updatedAt = data.updatedAt?.toDate() || 'UNKNOWN';
      console.log(`   UID: ${doc.id}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role}`);
      console.log(`   Created: ${createdAt}`);
      console.log(`   Updated: ${updatedAt}`);
      console.log(`   ---`);
    });
    
    // 2. Check for test organizations
    console.log('\n2️⃣ Checking for test/demo organizations...\n');
    const orgsSnapshot = await db.collection('organizations').get();
    
    const testOrgs = [];
    const prodOrgs = [];
    
    orgsSnapshot.forEach(doc => {
      const data = doc.data();
      const name = data.name || '';
      const email = data.contactEmail || '';
      const orgId = doc.id;
      
      // Check if it's test data
      const isTest = 
        name.toLowerCase().includes('test') ||
        name.toLowerCase().includes('demo') ||
        name.toLowerCase().includes('example') ||
        name.toLowerCase().includes('sample') ||
        email.includes('test') ||
        email.includes('demo') ||
        email.includes('example') ||
        orgId.includes('test') ||
        orgId.includes('demo');
      
      if (isTest) {
        testOrgs.push({
          id: doc.id,
          name: data.name,
          createdAt: data.createdAt?.toDate() || 'UNKNOWN',
          createdBy: data.createdBy
        });
      } else {
        prodOrgs.push({
          id: doc.id,
          name: data.name,
          createdAt: data.createdAt?.toDate() || 'UNKNOWN'
        });
      }
    });
    
    console.log(`Total organizations: ${orgsSnapshot.size}`);
    console.log(`Test/Demo organizations: ${testOrgs.length}`);
    console.log(`Production organizations: ${prodOrgs.length}\n`);
    
    if (testOrgs.length > 0) {
      console.log('⚠️ TEST ORGANIZATIONS FOUND:\n');
      testOrgs.forEach(org => {
        console.log(`   ${org.name} (${org.id})`);
        console.log(`   Created: ${org.createdAt}`);
        console.log(`   Created By: ${org.createdBy || 'UNKNOWN'}`);
        console.log(`   ---`);
      });
    }
    
    // 3. Check for test users
    console.log('\n3️⃣ Checking for test users...\n');
    const allUsersSnapshot = await db.collection('users').get();
    
    const testUsers = [];
    allUsersSnapshot.forEach(doc => {
      const data = doc.data();
      const email = data.email || '';
      const name = data.name || '';
      
      const isTest = 
        email.includes('test') ||
        email.includes('demo') ||
        email.includes('example') ||
        email.includes('admin@example.com') ||
        name.toLowerCase().includes('test') ||
        name.toLowerCase().includes('demo');
      
      if (isTest) {
        testUsers.push({
          uid: doc.id,
          email: data.email,
          name: data.name,
          createdAt: data.createdAt?.toDate() || 'UNKNOWN'
        });
      }
    });
    
    console.log(`Total users: ${allUsersSnapshot.size}`);
    console.log(`Test users: ${testUsers.length}\n`);
    
    if (testUsers.length > 0) {
      console.log('⚠️ TEST USERS FOUND:\n');
      testUsers.forEach(user => {
        console.log(`   ${user.email} (${user.name})`);
        console.log(`   UID: ${user.uid}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   ---`);
      });
    }
    
    // 4. Check recent user creation times to identify batch creation
    console.log('\n4️⃣ Analyzing user creation patterns...\n');
    
    const usersWithTimestamps = [];
    allUsersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt) {
        usersWithTimestamps.push({
          uid: doc.id,
          email: data.email,
          createdAt: data.createdAt.toDate(),
          timestamp: data.createdAt.toDate().getTime()
        });
      }
    });
    
    // Sort by creation time
    usersWithTimestamps.sort((a, b) => a.timestamp - b.timestamp);
    
    // Find clusters (users created within 1 minute of each other)
    const clusters = [];
    let currentCluster = [];
    
    for (let i = 0; i < usersWithTimestamps.length; i++) {
      if (currentCluster.length === 0) {
        currentCluster.push(usersWithTimestamps[i]);
      } else {
        const timeDiff = usersWithTimestamps[i].timestamp - currentCluster[0].timestamp;
        if (timeDiff < 60000) { // Within 1 minute
          currentCluster.push(usersWithTimestamps[i]);
        } else {
          if (currentCluster.length > 1) {
            clusters.push([...currentCluster]);
          }
          currentCluster = [usersWithTimestamps[i]];
        }
      }
    }
    
    if (currentCluster.length > 1) {
      clusters.push(currentCluster);
    }
    
    if (clusters.length > 0) {
      console.log(`Found ${clusters.length} cluster(s) of users created within 1 minute:\n`);
      clusters.forEach((cluster, idx) => {
        console.log(`   Cluster ${idx + 1}: ${cluster.length} users created around ${cluster[0].createdAt}`);
        cluster.forEach(user => {
          console.log(`      - ${user.email} (${user.uid})`);
        });
        console.log('');
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 SUMMARY:\n');
    console.log(`Total Organizations: ${orgsSnapshot.size}`);
    console.log(`Test Organizations: ${testOrgs.length}`);
    console.log(`Total Users: ${allUsersSnapshot.size}`);
    console.log(`Test Users: ${testUsers.length}`);
    console.log(`Duplicate User Accounts (your email): ${usersSnapshot.size}`);
    
    if (testOrgs.length > 0 || testUsers.length > 0) {
      console.log('\n⚠️ WARNING: Test data found in production database!');
      console.log('This should be cleaned up to avoid confusion and database bloat.');
    }
    
  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error);
  }
}

investigateDuplicates()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
