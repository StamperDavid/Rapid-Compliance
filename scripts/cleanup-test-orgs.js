/**
 * Cleanup Script for Test Organizations
 * 
 * This script removes all test organizations created by automated tests.
 * It targets organizations with:
 * - Names: "Test Payment Org" or "Pagination Test Org"
 * - isTest flag set to true
 * - Names starting with "test-org-" or "[TEST]"
 * 
 * Usage: node scripts/cleanup-test-orgs.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  path.join(__dirname, '../service-account-key.json');

if (!admin.apps.length) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin. Make sure service-account-key.json exists.');
    console.error('   Or set GOOGLE_APPLICATION_CREDENTIALS environment variable.');
    process.exit(1);
  }
}

const db = admin.firestore();

// Test organization patterns to identify and delete
const TEST_PATTERNS = [
  'Test Payment Org',
  'Pagination Test Org',
  /^test-org-/i,
  /^\[TEST\]/i,
  /^TEMP_TEST/i,
];

/**
 * Check if an organization is a test org
 */
function isTestOrg(orgData) {
  const name = orgData.name || '';
  
  // Check if explicitly marked as test
  if (orgData.isTest === true) {
    return true;
  }
  
  // Check if name matches test patterns
  for (const pattern of TEST_PATTERNS) {
    if (typeof pattern === 'string') {
      if (name === pattern) return true;
    } else if (pattern instanceof RegExp) {
      if (pattern.test(name)) return true;
    }
  }
  
  // Check for Unix epoch date (12/31/1969 issue)
  if (orgData.createdAt) {
    const timestamp = orgData.createdAt.toDate ? orgData.createdAt.toDate() : new Date(orgData.createdAt);
    const year = timestamp.getFullYear();
    if (year < 2020) {
      console.log(`  ⚠️  Found org with suspicious date: ${name} (${timestamp.toISOString()})`);
      return true;
    }
  }
  
  return false;
}

/**
 * Delete all subcollections and documents in an organization
 */
async function deleteOrgAndSubcollections(orgId, orgName) {
  console.log(`  🗑️  Deleting organization: ${orgName} (${orgId})`);
  
  const batch = db.batch();
  let deleteCount = 0;
  
  // Delete the organization document itself
  const orgRef = db.collection('organizations').doc(orgId);
  batch.delete(orgRef);
  deleteCount++;
  
  // Note: We're not deleting subcollections (workspaces, entities, etc.) 
  // because Firestore batch has a 500 operation limit.
  // If you need to delete subcollections, you'll need to use a recursive delete
  // or the Firebase CLI: firebase firestore:delete organizations/{orgId} --recursive
  
  await batch.commit();
  console.log(`    ✅ Deleted ${deleteCount} document(s)`);
  
  return deleteCount;
}

/**
 * Main cleanup function
 */
async function cleanupTestOrganizations() {
  console.log('\n🧹 Starting Test Organization Cleanup...\n');
  
  try {
    // Fetch all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} total organization(s)\n`);
    
    const testOrgs = [];
    const realOrgs = [];
    
    // Identify test vs real organizations
    orgsSnapshot.forEach(doc => {
      const data = doc.data();
      if (isTestOrg(data)) {
        testOrgs.push({ id: doc.id, ...data });
      } else {
        realOrgs.push({ id: doc.id, name: data.name });
      }
    });
    
    console.log(`🔍 Analysis:`);
    console.log(`   - Test organizations: ${testOrgs.length}`);
    console.log(`   - Real organizations: ${realOrgs.length}\n`);
    
    if (testOrgs.length === 0) {
      console.log('✨ No test organizations found. Your database is clean!\n');
      return;
    }
    
    // Show what will be deleted
    console.log('📋 Test organizations to be deleted:\n');
    testOrgs.forEach((org, index) => {
      const createdAt = org.createdAt?.toDate?.() || new Date(org.createdAt || 0);
      console.log(`   ${index + 1}. ${org.name} (ID: ${org.id})`);
      console.log(`      Created: ${createdAt.toISOString()}`);
      console.log(`      Reason: ${org.isTest ? 'isTest flag' : 'Pattern match'}\n`);
    });
    
    // Confirmation (skipped in non-interactive mode)
    if (process.env.CI || process.env.AUTO_CONFIRM === 'true') {
      console.log('⚠️  Running in auto-confirm mode...\n');
    } else {
      console.log('⚠️  WARNING: This will permanently delete the above organizations!\n');
      console.log('   Press Ctrl+C to cancel, or set AUTO_CONFIRM=true to skip this prompt.\n');
      
      // Wait 5 seconds before proceeding
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Delete test organizations
    console.log('🗑️  Deleting test organizations...\n');
    let totalDeleted = 0;
    
    for (const org of testOrgs) {
      const deleted = await deleteOrgAndSubcollections(org.id, org.name);
      totalDeleted += deleted;
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   - Deleted ${totalDeleted} organization document(s)`);
    console.log(`   - Remaining organizations: ${realOrgs.length}\n`);
    
    if (realOrgs.length > 0) {
      console.log('📋 Remaining organizations:');
      realOrgs.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.name} (ID: ${org.id})`);
      });
      console.log();
    }
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run cleanup
cleanupTestOrganizations()
  .then(() => {
    console.log('🎉 Script completed successfully\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
