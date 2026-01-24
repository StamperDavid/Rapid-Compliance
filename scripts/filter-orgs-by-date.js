/**
 * FILTER ORGANIZATIONS BY DATE
 * 
 * Shows all organizations with their creation dates.
 * Can delete orgs created before a specific date.
 * 
 * Usage:
 *   node scripts/filter-orgs-by-date.js                    # List all with dates
 *   node scripts/filter-orgs-by-date.js --before 2024-12-30 # Show orgs before date
 *   node scripts/filter-orgs-by-date.js --before 2024-12-30 --confirm # DELETE orgs before date
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// PROTECTED ORGS - NEVER DELETE
const PROTECTED_ORG_IDS = [
  'platform',
  'org_demo_auraflow',
  'org_demo_greenthumb',
  'org_demo_adventuregear',
  'org_demo_summitwm',
  'org_demo_pixelperfect',
  'org_1767162182929_zybiwt',     // AuraFlow Analytics (TEST) - Dec 30, 2024
  'org_1767162183846_33y89i',     // GreenThumb Landscaping (TEST) - Dec 30, 2024
  'org_1767162184756_5xf9a9',     // The Adventure Gear Shop (TEST) - Dec 30, 2024
  'org_1767162185614_xo5ryr',     // Summit Wealth Management (TEST) - Dec 30, 2024
  'org_1767162186490_tptncm'      // PixelPerfect Design Co. (TEST) - Dec 30, 2024
];

const args = process.argv.slice(2);
const beforeDateStr = args.find(arg => !arg.startsWith('--')) || args[args.indexOf('--before') + 1];
const confirm = args.includes('--confirm');

console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║                                                                           ║');
console.log('║                    FILTER ORGANIZATIONS BY DATE                           ║');
console.log('║                                                                           ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
console.log(`Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
console.log('');

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

/**
 * Extract creation date from org ID or Firestore metadata
 */
function getOrgCreationDate(orgId, orgData) {
  // Method 1: Extract from org ID timestamp (org_TIMESTAMP_random)
  const timestampMatch = orgId.match(/^(?:org|test-org|test-product)[-_](\d{13})/);
  if (timestampMatch) {
    return new Date(parseInt(timestampMatch[1]));
  }
  
  // Method 2: Use Firestore createdAt field
  if (orgData && orgData.createdAt) {
    if (orgData.createdAt.toDate) {
      return orgData.createdAt.toDate();
    }
    if (orgData.createdAt instanceof Date) {
      return orgData.createdAt;
    }
  }
  
  // Method 3: Unknown - use epoch
  return new Date(0);
}

/**
 * Recursively delete subcollections
 */
async function deleteSubcollections(docRef) {
  const subcollections = await docRef.listCollections();
  
  for (const subcollection of subcollections) {
    const snapshot = await subcollection.get();
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      await deleteSubcollections(doc.ref);
      batch.delete(doc.ref);
      batchCount++;
      
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
  }
}

async function filterByDate() {
  console.log('📋 Scanning all organizations...\n');
  
  const orgsSnapshot = await db.collection('organizations').get();
  const orgs = [];
  
  // Collect all orgs with their dates
  for (const doc of orgsSnapshot.docs) {
    const orgId = doc.id;
    const orgData = doc.data();
    const createdAt = getOrgCreationDate(orgId, orgData);
    const isProtected = PROTECTED_ORG_IDS.includes(orgId);
    
    orgs.push({
      id: orgId,
      name: orgData.name || 'Unnamed',
      createdAt,
      isProtected,
      data: orgData
    });
  }
  
  // Sort by date (oldest first)
  orgs.sort((a, b) => a.createdAt - b.createdAt);
  
  // Show all orgs with dates
  console.log('📅 ALL ORGANIZATIONS (sorted by creation date):\n');
  console.log('Created Date       | Organization ID                    | Name                              | Status');
  console.log('─'.repeat(115));
  
  orgs.forEach(org => {
    const dateStr = org.createdAt.toISOString().split('T')[0];
    const timeStr = org.createdAt.toTimeString().split(' ')[0];
    const status = org.isProtected ? '🛡️  PROTECTED' : '  ';
    const idPadded = org.id.padEnd(35);
    const namePadded = org.name.substring(0, 30).padEnd(30);
    console.log(`${dateStr} ${timeStr} | ${idPadded} | ${namePadded} | ${status}`);
  });
  
  console.log('');
  
  // If filtering by date
  if (beforeDateStr) {
    const beforeDate = new Date(beforeDateStr);
    console.log(`\n🔍 FILTERING: Organizations created BEFORE ${beforeDate.toISOString().split('T')[0]}\n`);
    
    const orgsToDelete = orgs.filter(org => 
      !org.isProtected && org.createdAt < beforeDate
    );
    
    const protectedBeforeDate = orgs.filter(org =>
      org.isProtected && org.createdAt < beforeDate
    );
    
    if (protectedBeforeDate.length > 0) {
      console.log('🛡️  PROTECTED orgs before this date (will NOT delete):');
      protectedBeforeDate.forEach(org => {
        console.log(`   ✅ ${org.id} - ${org.name} (${org.createdAt.toISOString().split('T')[0]})`);
      });
      console.log('');
    }
    
    if (orgsToDelete.length === 0) {
      console.log('✅ No unprotected organizations found before this date!\n');
      return;
    }
    
    console.log(`⚠️  Found ${orgsToDelete.length} organizations to delete:\n`);
    orgsToDelete.forEach(org => {
      console.log(`   ❌ ${org.id} - ${org.name} (${org.createdAt.toISOString().split('T')[0]})`);
    });
    console.log('');
    
    if (!confirm) {
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('🔍 DRY RUN - No changes made');
      console.log('═══════════════════════════════════════════════════════════════════════════\n');
      console.log('To actually delete these organizations, run:');
      console.log(`   node scripts/filter-orgs-by-date.js --before ${beforeDateStr} --confirm\n`);
      return;
    }
    
    // LIVE MODE - Actually delete
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('⚠️  DELETING ORGANIZATIONS...');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    console.log('⏳ Starting in 3 seconds... (Press Ctrl+C to cancel)\n');
    
    await new Promise(resolve => { setTimeout(resolve, 3000); });
    
    let deletedOrgs = 0;
    let deletedUsers = 0;
    
    for (const org of orgsToDelete) {
      try {
        console.log(`\n🗑️  Deleting: ${org.id} - ${org.name}`);
        
        // Delete users
        const usersSnapshot = await db.collection('users')
          .where('organizationId', '==', org.id)
          .get();
        
        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data();
          await db.collection('users').doc(userDoc.id).delete();
          try {
            await auth.deleteUser(userDoc.id);
          } catch (e) {}
          console.log(`   - Deleted user: ${userData.email}`);
          deletedUsers++;
        }
        
        // Delete org with subcollections
        const orgRef = db.collection('organizations').doc(org.id);
        await deleteSubcollections(orgRef);
        await orgRef.delete();
        
        console.log(`   ✅ Deleted organization and all data`);
        deletedOrgs++;
        
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log('✅ CLEANUP COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    console.log(`Organizations deleted: ${deletedOrgs}`);
    console.log(`Users deleted: ${deletedUsers}`);
    console.log('');
    
  } else {
    console.log('💡 To filter by date, run:');
    console.log('   node scripts/filter-orgs-by-date.js --before YYYY-MM-DD');
    console.log('');
    console.log('Examples:');
    console.log('   node scripts/filter-orgs-by-date.js --before 2024-12-30  # Show orgs before Dec 30');
    console.log('   node scripts/filter-orgs-by-date.js --before 2025-01-01 --confirm  # DELETE orgs before Jan 1');
    console.log('');
  }
}

filterByDate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
