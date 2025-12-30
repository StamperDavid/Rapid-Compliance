/**
 * Analyze suspicious test organizations
 * Shows details to verify they're duplicates before deletion
 */

const admin = require('firebase-admin');
const path = require('path');

let adminDb;

async function initializeFirebase() {
  if (admin.apps.length) {
    adminDb = admin.firestore();
    return true;
  }

  const possiblePaths = [
    path.join(__dirname, '../serviceAccountKey.json'),
    path.join(__dirname, '../service-account-key.json'),
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  ].filter(Boolean);

  for (const keyPath of possiblePaths) {
    try {
      const serviceAccount = require(keyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      adminDb = admin.firestore();
      console.log('✅ Firebase Admin initialized');
      return true;
    } catch (e) {
      // Try next path
    }
  }

  console.error('❌ Cannot initialize Firebase Admin');
  return false;
}

async function analyzeOrganizations() {
  console.log('\n📊 ANALYZING TEST ORGANIZATIONS\n');
  
  if (!await initializeFirebase()) {
    console.error('Failed to initialize Firebase. Cannot proceed.');
    process.exit(1);
  }

  try {
    const orgsSnapshot = await adminDb.collection('organizations').get();
    console.log(`Total organizations: ${orgsSnapshot.size}\n`);
    
    // Categorize organizations
    const categories = {
      'Test Organization': [],
      'Unconfigured Org': [],
      'Legitimate': []
    };
    
    orgsSnapshot.forEach(doc => {
      const data = doc.data();
      const name = data.name || 'Unnamed';
      
      if (name === 'Test Organization') {
        categories['Test Organization'].push({
          id: doc.id,
          name,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || 'Unknown',
          plan: data.plan || 'none',
          status: data.status || 'none',
          billingEmail: data.billingEmail || 'none',
          isTest: data.isTest || false
        });
      } else if (name === 'Unconfigured Org') {
        categories['Unconfigured Org'].push({
          id: doc.id,
          name,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || 'Unknown',
          plan: data.plan || 'none',
          status: data.status || 'none',
          billingEmail: data.billingEmail || 'none',
          isTest: data.isTest || false
        });
      } else {
        categories['Legitimate'].push({
          id: doc.id,
          name,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || 'Unknown',
          plan: data.plan || 'none',
          status: data.status || 'none'
        });
      }
    });
    
    // Analyze "Test Organization" entries
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 "Test Organization" entries: ${categories['Test Organization'].length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (categories['Test Organization'].length > 0) {
      // Show sample
      console.log('Sample of first 10:');
      categories['Test Organization'].slice(0, 10).forEach((org, i) => {
        console.log(`\n${i + 1}. ID: ${org.id}`);
        console.log(`   Created: ${org.createdAt}`);
        console.log(`   Plan: ${org.plan}`);
        console.log(`   Status: ${org.status}`);
        console.log(`   Email: ${org.billingEmail}`);
        console.log(`   isTest flag: ${org.isTest}`);
      });
      
      // Check if they're identical
      const firstOrg = categories['Test Organization'][0];
      const allIdentical = categories['Test Organization'].every(org => 
        org.plan === firstOrg.plan &&
        org.status === firstOrg.status &&
        org.billingEmail === firstOrg.billingEmail &&
        org.isTest === firstOrg.isTest
      );
      
      console.log(`\n✅ Are they identical? ${allIdentical ? 'YES - All have same plan/status/email' : 'NO - They vary'}`);
      console.log(`   Common pattern: Plan=${firstOrg.plan}, Status=${firstOrg.status}, Email=${firstOrg.billingEmail}`);
    }
    
    // Analyze "Unconfigured Org" entries
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log(`📋 "Unconfigured Org" entries: ${categories['Unconfigured Org'].length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (categories['Unconfigured Org'].length > 0) {
      // Show sample
      console.log('Sample of first 10:');
      categories['Unconfigured Org'].slice(0, 10).forEach((org, i) => {
        console.log(`\n${i + 1}. ID: ${org.id}`);
        console.log(`   Created: ${org.createdAt}`);
        console.log(`   Plan: ${org.plan}`);
        console.log(`   Status: ${org.status}`);
        console.log(`   Email: ${org.billingEmail}`);
        console.log(`   isTest flag: ${org.isTest}`);
      });
      
      // Check if they're identical
      const firstOrg = categories['Unconfigured Org'][0];
      const allIdentical = categories['Unconfigured Org'].every(org => 
        org.plan === firstOrg.plan &&
        org.status === firstOrg.status &&
        org.billingEmail === firstOrg.billingEmail &&
        org.isTest === firstOrg.isTest
      );
      
      console.log(`\n✅ Are they identical? ${allIdentical ? 'YES - All have same plan/status/email' : 'NO - They vary'}`);
      console.log(`   Common pattern: Plan=${firstOrg.plan}, Status=${firstOrg.status}, Email=${firstOrg.billingEmail}`);
    }
    
    // Show legitimate organizations
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log(`📋 Legitimate organizations: ${categories['Legitimate'].length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Your real organizations (sample):');
    categories['Legitimate'].slice(0, 20).forEach((org, i) => {
      console.log(`   ${i + 1}. ${org.name} (${org.plan})`);
    });
    
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total organizations: ${orgsSnapshot.size}`);
    console.log(`  - "Test Organization" duplicates: ${categories['Test Organization'].length}`);
    console.log(`  - "Unconfigured Org" duplicates: ${categories['Unconfigured Org'].length}`);
    console.log(`  - Legitimate organizations: ${categories['Legitimate'].length}`);
    console.log(`\n🗑️  Potential to delete: ${categories['Test Organization'].length + categories['Unconfigured Org'].length} organizations`);
    console.log(`✅ Will keep: ${categories['Legitimate'].length} organizations\n`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

analyzeOrganizations();
