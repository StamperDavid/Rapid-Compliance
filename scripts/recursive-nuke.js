#!/usr/bin/env node

/**
 * RECURSIVE DEEP CLEAN - Ghost Data Purge
 * 
 * Deletes all test organizations from ai-sales-platform-dev
 * while preserving the 5 demo organizations.
 * 
 * PROTECTED ORGS:
 * - org_1767162182929_zybiwt (AuraFlow)
 * - org_1767162183846_33y89i (GreenThumb)
 * - org_1767162184756_5xf9a9 (Adventure Gear)
 * - org_1767162185614_xo5ryr (Summit)
 * - org_1767162186490_tptncm (PixelPerfect)
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'ai-sales-platform-dev',
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@ai-sales-platform-dev.iam.gserviceaccount.com',
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.projectId,
});

const db = admin.firestore();

// PROTECTED organization IDs (DO NOT DELETE)
const PROTECTED_ORGS = new Set([
  'org_1767162182929_zybiwt',  // AuraFlow
  'org_1767162183846_33y89i',  // GreenThumb
  'org_1767162184756_5xf9a9',  // Adventure Gear
  'org_1767162185614_xo5ryr',  // Summit
  'org_1767162186490_tptncm',  // PixelPerfect
]);

// PROTECTED user email (DO NOT DELETE)
const PROTECTED_EMAIL = 'dstamper@rapidcompliance.us';

async function recursiveDeleteOrg(orgId) {
  console.log(`🗑️  Recursively deleting organization: ${orgId}`);
  
  try {
    const orgRef = db.collection('organizations').doc(orgId);
    
    // Use Firebase's recursive delete (requires firestore@9.9.0+)
    await db.recursiveDelete(orgRef);
    
    console.log(`✅ Successfully deleted: ${orgId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting ${orgId}:`, error.message);
    return false;
  }
}

async function cleanupGhostData() {
  console.log('\n🚀 RECURSIVE DEEP CLEAN - Ghost Data Purge');
  console.log('================================================\n');
  console.log(`📋 Project: ${serviceAccount.projectId}`);
  console.log(`🛡️  Protected Organizations: ${PROTECTED_ORGS.size}`);
  console.log(`🛡️  Protected User: ${PROTECTED_EMAIL}\n`);

  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Total organizations found: ${orgsSnapshot.size}\n`);

    let deletedCount = 0;
    let protectedCount = 0;
    let failedCount = 0;

    for (const doc of orgsSnapshot.docs) {
      const orgId = doc.id;
      const orgData = doc.data();

      // Check if this org should be protected
      if (PROTECTED_ORGS.has(orgId)) {
        console.log(`🛡️  PROTECTED (keeping): ${orgId} - ${orgData.name || 'Unknown'}`);
        protectedCount++;
        continue;
      }

      // Delete all other organizations (especially test-org-* ones)
      console.log(`🎯 TARGET: ${orgId} - ${orgData.name || 'Unknown'}`);
      const success = await recursiveDeleteOrg(orgId);
      
      if (success) {
        deletedCount++;
      } else {
        failedCount++;
      }
    }

    console.log('\n================================================');
    console.log('📊 CLEANUP SUMMARY:');
    console.log('================================================');
    console.log(`✅ Deleted: ${deletedCount} organizations`);
    console.log(`🛡️  Protected: ${protectedCount} organizations`);
    console.log(`❌ Failed: ${failedCount} organizations`);
    console.log('\n🎉 Ghost data purge complete!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupGhostData();
