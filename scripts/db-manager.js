/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATABASE MANAGER - The ONLY Cleanup Script You'll Ever Need
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * SINGLE SOURCE OF TRUTH for all database cleanup operations.
 * 
 * Replaces 14+ conflicting cleanup/nuke/wipe/delete scripts with ONE
 * authoritative utility that:
 * 
 * ✅ Uses recursive deletion ONLY (no ghost documents)
 * ✅ Protects permanent demo accounts (centralized list)
 * ✅ Hybrid detection (flags + patterns + hardcoded IDs)
 * ✅ Environment safety (refuses to run on prod)
 * ✅ Dry-run mode by default (safe to test)
 * 
 * Usage:
 *   node scripts/db-manager.js              # Dry run (shows what would be deleted)
 *   node scripts/db-manager.js --nuke       # ACTUALLY DELETE (live mode)
 *   node scripts/db-manager.js --list       # Just list all orgs
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - SINGLE SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PROTECTED ORGANIZATIONS - NEVER DELETE THESE
 * These are permanent demo accounts for manual testing
 */
const PROTECTED_ORG_IDS = [
  'platform',
  'org_demo_auraflow',
  'org_demo_greenthumb',
  'org_demo_adventuregear',
  'org_demo_summitwm',
  'org_demo_pixelperfect',
  // Legacy demo org IDs (also protected)
  'org_1767162182929_zybiwt',
  'org_1767162183846_33y89i',
  'org_1767162184756_5xf9a9',
  'org_1767162185614_xo5ryr',
  'org_1767162186490_tptncm'
];

/**
 * KNOWN GHOST ORG IDs - These show in console but don't exist
 * Include them so we can report them separately
 */
const KNOWN_GHOST_IDS = [
  'test-org-1767056931936', 'test-org-1767056932040', 'test-org-1767056932041',
  'test-org-1767056932042', 'test-org-1767056932170', 'test-org-1767056932222',
  'test-org-1767056935162', 'test-org-1767056936016', 'test-org-1767058285576',
  'test-org-1767058285702', 'test-org-1767058285710', 'test-org-1767058285711',
  'test-org-1767058285712', 'test-org-1767058285723', 'test-org-1767058288609',
  'test-org-1767058290585', 'test-org-1767060767624', 'test-org-1767060767625',
  'test-org-1767060767627', 'test-org-1767060767645', 'test-org-1767060767646',
  'test-org-1767060767647', 'test-org-1767060770438', 'test-org-1767060770815',
  'test-org-1767062333333', 'test-org-1767062333405', 'test-org-1767062333504',
  'test-org-1767062333537', 'test-org-1767062333545', 'test-org-1767062333547',
  'test-org-1767062336537', 'test-org-1767062337447', 'test-org-1767064007314',
  'test-org-1767064007460', 'test-org-1767064007461', 'test-org-1767064007532',
  'test-org-1767064007570', 'test-org-1767064010510', 'test-org-1767064011300',
  'test-org-1767069659450', 'test-org-1767069659524', 'test-org-1767069659550',
  'test-org-1767069659575', 'test-org-1767069659576', 'test-org-1767069659577',
  'test-org-1767069662894', 'test-org-1767069663466', 'test-org-1767079894958',
  'test-org-1767079894982', 'test-org-1767079894983', 'test-org-1767079894993',
  'test-org-1767079895009', 'test-org-1767079897794', 'test-org-1767079900081',
  'test-org-1767079922841', 'test-org-1767079922905', 'test-org-1767079922920',
  'test-org-1767079922921', 'test-org-1767079922934', 'test-org-1767079925752',
  'test-org-1767079927852', 'test-org-1767211084795', 'test-org-1767211084797',
  'test-org-1767211084826', 'test-org-1767211084827', 'test-org-1767211087954',
  'test-org-1767211089271', 'test-org-1767221709226', 'test-org-1767221709229',
  'test-org-1767221709238', 'test-org-1767221709239', 'test-org-1767221709418',
  'test-org-1767221712850', 'test-org-1767221713127', 'test-org-1767232644435',
  'test-org-1767232644440', 'test-org-1767232644513', 'test-org-1767232644577',
  'test-org-1767232644578', 'test-org-1767232644579', 'test-org-1767232648790',
  'test-org-1767232648879', 'test-org-1767232899586', 'test-org-1767232899838',
  'test-org-1767232899839', 'test-org-1767232899855', 'test-org-1767232899856',
  'test-org-1767232903727', 'test-org-1767232904102', 'test-org-1767233128627',
  'test-org-1767233128704', 'test-org-1767233128705', 'test-org-1767233128903',
  'test-org-1767233128980', 'test-org-1767233131826', 'test-org-1767233132004',
  'test-org-1767233545632', 'test-org-1767233545633', 'test-org-1767233545634',
  'test-org-1767233545762', 'test-org-1767233545768', 'test-org-1767233545816',
  'test-org-1767233548953', 'test-org-1767233549886', 'test-org-distillation',
  'test-product-1'
];

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;

// ENVIRONMENT SAFETY CHECK
if (!projectId) {
  console.error('\n❌ ERROR: FIREBASE_ADMIN_PROJECT_ID not set in .env.local\n');
  process.exit(1);
}

if (projectId.toLowerCase().includes('prod')) {
  console.error('\n');
  console.error('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.error('║                                                                           ║');
  console.error('║   ⚠️  ⚠️  ⚠️  PRODUCTION ENVIRONMENT DETECTED  ⚠️  ⚠️  ⚠️                   ║');
  console.error('║                                                                           ║');
  console.error('║   This script is designed for DEV environments ONLY.                     ║');
  console.error('║   Your FIREBASE_ADMIN_PROJECT_ID contains "prod".                        ║');
  console.error('║                                                                           ║');
  console.error(`║   Project ID: ${projectId.padEnd(58)}║`);
  console.error('║                                                                           ║');
  console.error('║   REFUSING TO RUN. Change your .env.local to point to DEV.               ║');
  console.error('║                                                                           ║');
  console.error('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.error('\n');
  process.exit(1);
}

// Initialize Firebase Admin
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

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION LOGIC - HYBRID APPROACH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determines if an organization is test data that should be deleted
 * 
 * HYBRID DETECTION - Returns true if ANY of these conditions match:
 * 1. Document has isAutomatedTest: true flag
 * 2. Document ID starts with test-org-, test-product-, e2e-test-, or backward-compat-test-
 * 3. Document ID is in the KNOWN_GHOST_IDS list
 * 
 * @param {string} orgId - Organization document ID
 * @param {object} orgData - Organization document data
 * @returns {object} { isTest: boolean, reason: string }
 */
function isTestOrganization(orgId, orgData) {
  // NEVER delete protected orgs
  if (PROTECTED_ORG_IDS.includes(orgId)) {
    return { isTest: false, reason: 'PROTECTED' };
  }

  // Method 1: Flag-based detection (PREFERRED)
  if (orgData && orgData.isAutomatedTest === true) {
    return { isTest: true, reason: 'Has isAutomatedTest flag' };
  }

  // Method 2: Pattern-based detection (LEGACY SUPPORT)
  if (orgId.startsWith('test-org-')) {
    return { isTest: true, reason: 'Starts with test-org-' };
  }
  if (orgId.startsWith('test-product-')) {
    return { isTest: true, reason: 'Starts with test-product-' };
  }
  if (orgId.startsWith('e2e-test-')) {
    return { isTest: true, reason: 'Starts with e2e-test-' };
  }
  if (orgId.startsWith('backward-compat-test-')) {
    return { isTest: true, reason: 'Starts with backward-compat-test-' };
  }

  // Method 3: Known ghost ID list (HARDCODED)
  if (KNOWN_GHOST_IDS.includes(orgId)) {
    return { isTest: true, reason: 'In known ghost ID list' };
  }

  return { isTest: false, reason: 'Does not match test criteria' };
}

// ═══════════════════════════════════════════════════════════════════════════
// RECURSIVE DELETION - NO GHOST DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Recursively delete all subcollections under a document
 * This prevents "ghost" documents from appearing in Firebase Console
 * 
 * @param {DocumentReference} docRef - Document reference to delete subcollections from
 */
async function deleteSubcollectionsRecursive(docRef) {
  const subcollections = await docRef.listCollections();
  
  for (const subcollection of subcollections) {
    const snapshot = await subcollection.get();
    
    // Batch delete documents in subcollection
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      // Recursively delete nested subcollections first
      await deleteSubcollectionsRecursive(doc.ref);
      
      batch.delete(doc.ref);
      batchCount++;
      
      // Firestore batch limit is 500, commit early at 400 to be safe
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    // Commit remaining deletes
    if (batchCount > 0) {
      await batch.commit();
    }
  }
}

/**
 * Delete an organization and ALL its data recursively
 * 
 * @param {string} orgId - Organization ID to delete
 * @param {boolean} dryRun - If true, only log what would be deleted
 * @returns {object} { success: boolean, subcollectionsDeleted: number }
 */
async function deleteOrganizationRecursive(orgId, dryRun = true) {
  const orgRef = db.collection('organizations').doc(orgId);
  
  try {
    // Check if document exists
    const orgDoc = await orgRef.get();
    
    if (!orgDoc.exists) {
      return { success: false, reason: 'Document does not exist (ghost)', subcollectionsDeleted: 0 };
    }
    
    if (dryRun) {
      // In dry run, just count subcollections
      const subcollections = await orgRef.listCollections();
      return { success: true, reason: 'Would delete (dry run)', subcollectionsDeleted: subcollections.length };
    }
    
    // LIVE MODE: Actually delete
    // Step 1: Delete all subcollections recursively
    await deleteSubcollectionsRecursive(orgRef);
    
    // Step 2: Delete the organization document itself
    await orgRef.delete();
    
    return { success: true, reason: 'Deleted successfully', subcollectionsDeleted: 0 };
    
  } catch (error) {
    return { success: false, reason: error.message, subcollectionsDeleted: 0 };
  }
}

/**
 * Delete a user from both Firestore and Firebase Auth
 * 
 * @param {string} userId - User ID to delete
 * @param {boolean} dryRun - If true, only log what would be deleted
 */
async function deleteUser(userId, dryRun = true) {
  if (dryRun) {
    return { success: true, reason: 'Would delete (dry run)' };
  }
  
  try {
    // Delete from Firestore
    await db.collection('users').doc(userId).delete();
    
    // Delete from Auth (might not exist)
    try {
      await auth.deleteUser(userId);
    } catch (e) {
      // User might not exist in Auth, that's ok
    }
    
    return { success: true, reason: 'Deleted successfully' };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List all organizations and categorize them
 */
async function listOrganizations() {
  console.log('\n📋 SCANNING DATABASE...\n');
  
  const orgsSnapshot = await db.collection('organizations').get();
  
  const protected = [];
  const testOrgs = [];
  const realOrgs = [];
  
  for (const doc of orgsSnapshot.docs) {
    const orgId = doc.id;
    const orgData = doc.data();
    const orgName = orgData.name || orgId;
    
    if (PROTECTED_ORG_IDS.includes(orgId)) {
      protected.push({ id: orgId, name: orgName });
    } else {
      const { isTest, reason } = isTestOrganization(orgId, orgData);
      if (isTest) {
        testOrgs.push({ id: orgId, name: orgName, reason });
      } else {
        realOrgs.push({ id: orgId, name: orgName });
      }
    }
  }
  
  console.log(`Total organizations in database: ${orgsSnapshot.size}\n`);
  
  console.log('🛡️  PROTECTED ORGANIZATIONS (Will NEVER be deleted):');
  console.log(`   Count: ${protected.length}`);
  protected.forEach(org => {
    console.log(`   ✅ ${org.id} - ${org.name}`);
  });
  console.log('');
  
  console.log('🗑️  TEST ORGANIZATIONS (Will be deleted):');
  console.log(`   Count: ${testOrgs.length}`);
  testOrgs.slice(0, 20).forEach(org => {
    console.log(`   ❌ ${org.id} - ${org.name}`);
    console.log(`      Reason: ${org.reason}`);
  });
  if (testOrgs.length > 20) {
    console.log(`   ... and ${testOrgs.length - 20} more`);
  }
  console.log('');
  
  console.log('📦 REAL ORGANIZATIONS (Will be kept):');
  console.log(`   Count: ${realOrgs.length}`);
  realOrgs.forEach(org => {
    console.log(`   ✅ ${org.id} - ${org.name}`);
  });
  console.log('');
  
  return { protected, testOrgs, realOrgs };
}

/**
 * Clean up all test data from the database
 */
async function cleanupTestData(dryRun = true) {
  const mode = dryRun ? '🔍 DRY RUN MODE' : '⚠️  LIVE MODE';
  
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                           ║');
  console.log('║                     DATABASE CLEANUP OPERATION                            ║');
  console.log('║                                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
  console.log(`Mode: ${mode}`);
  console.log(`Project: ${projectId}`);
  console.log(`Protected Organizations: ${PROTECTED_ORG_IDS.length}`);
  console.log('');
  
  // Step 1: Scan database
  const { protected, testOrgs, realOrgs } = await listOrganizations();
  
  if (testOrgs.length === 0) {
    console.log('✅ No test organizations found. Database is clean!\n');
    return;
  }
  
  if (dryRun) {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 DRY RUN - No changes will be made');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    console.log(`Would delete ${testOrgs.length} test organizations.`);
    console.log('\nTo actually delete, run:');
    console.log('   node scripts/db-manager.js --nuke\n');
    return;
  }
  
  // Step 2: Confirm deletion
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('⚠️  WARNING: ABOUT TO DELETE TEST DATA');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
  console.log(`Test organizations to delete: ${testOrgs.length}`);
  console.log('\n⏳ Starting deletion in 3 seconds... (Press Ctrl+C to cancel)\n');
  
  await new Promise(resolve => { setTimeout(resolve, 3000); });
  
  // Step 3: Delete test organizations
  console.log('🗑️  DELETING TEST ORGANIZATIONS...\n');
  
  let deletedOrgs = 0;
  let deletedUsers = 0;
  let ghostsFound = 0;
  let errors = 0;
  
  for (const org of testOrgs) {
    try {
      console.log(`   Processing: ${org.id}`);
      
      // Delete users belonging to this org first
      const usersSnapshot = await db.collection('users')
        .where('organizationId', '==', org.id)
        .get();
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const result = await deleteUser(userDoc.id, false);
        if (result.success) {
          console.log(`      ✅ Deleted user: ${userData.email}`);
          deletedUsers++;
        }
      }
      
      // Delete organization recursively
      const result = await deleteOrganizationRecursive(org.id, false);
      
      if (result.success) {
        if (result.reason === 'Document does not exist (ghost)') {
          console.log(`      👻 Ghost document (already deleted, subcollections may remain)`);
          ghostsFound++;
        } else {
          console.log(`      ✅ Deleted organization and all subcollections`);
          deletedOrgs++;
        }
      } else {
        console.log(`      ❌ Error: ${result.reason}`);
        errors++;
      }
      
    } catch (error) {
      console.log(`      ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  // Step 4: Clean up orphaned users
  console.log('\n🧹 CLEANING UP ORPHANED USERS...\n');
  
  const allUsers = await db.collection('users').get();
  const protectedOrgSet = new Set([...PROTECTED_ORG_IDS, ...realOrgs.map(o => o.id)]);
  
  for (const userDoc of allUsers.docs) {
    const userData = userDoc.data();
    const orgId = userData.organizationId;
    
    if (orgId && !protectedOrgSet.has(orgId)) {
      // Check if organization still exists
      const orgExists = await db.collection('organizations').doc(orgId).get();
      
      if (!orgExists.exists) {
        const result = await deleteUser(userDoc.id, false);
        if (result.success) {
          console.log(`   ✅ Deleted orphaned user: ${userData.email} (org: ${orgId})`);
          deletedUsers++;
        }
      }
    }
  }
  
  // Step 5: Summary
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                           ║');
  console.log('║                          CLEANUP COMPLETE                                 ║');
  console.log('║                                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Organizations deleted: ${deletedOrgs}`);
  console.log(`✅ Users deleted: ${deletedUsers}`);
  console.log(`👻 Ghost documents found: ${ghostsFound}`);
  if (errors > 0) {
    console.log(`❌ Errors: ${errors}`);
  }
  console.log('');
  
  // Step 6: Show final state
  const finalOrgs = await db.collection('organizations').get();
  const finalUsers = await db.collection('users').get();
  
  console.log('📊 FINAL DATABASE STATE:');
  console.log(`   Organizations: ${finalOrgs.size}`);
  console.log(`   Users: ${finalUsers.size}`);
  console.log('');
  
  if (ghostsFound > 0) {
    console.log('ℹ️  NOTE: Ghost documents are parent paths that show in Firebase Console');
    console.log('   because subcollections still exist. To fully remove them:');
    console.log('   1. Close all Firebase Console tabs');
    console.log('   2. Clear browser cache (Ctrl+Shift+Delete)');
    console.log('   3. Reopen in incognito mode');
    console.log('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTED FUNCTIONS (for use in test teardown)
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  PROTECTED_ORG_IDS,
  isTestOrganization,
  deleteOrganizationRecursive,
  deleteUser,
  cleanupTestData,
  listOrganizations,
  // Re-export for test suite
  db,
  auth
};

// ═══════════════════════════════════════════════════════════════════════════
// CLI ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                         DATABASE MANAGER                                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
    console.log('Usage:');
    console.log('  node scripts/db-manager.js              # Dry run (shows what would be deleted)');
    console.log('  node scripts/db-manager.js --nuke       # ACTUALLY DELETE (live mode)');
    console.log('  node scripts/db-manager.js --list       # Just list all organizations');
    console.log('  node scripts/db-manager.js --help       # Show this help');
    console.log('');
    console.log('Environment:');
    console.log(`  Project: ${projectId}`);
    console.log(`  Protected Orgs: ${PROTECTED_ORG_IDS.length}`);
    console.log('');
    process.exit(0);
  }
  
  if (args.includes('--list')) {
    listOrganizations()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
  } else if (args.includes('--nuke')) {
    cleanupTestData(false)
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
  } else {
    // Default: dry run
    cleanupTestData(true)
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
  }
}
