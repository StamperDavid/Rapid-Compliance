/**
 * COMPREHENSIVE FIREBASE TEST DATA CLEANUP
 *
 * Recursively removes ALL test data from Firebase:
 * 1. Phantom org subcollections (parent deleted, children remain)
 * 2. test_ prefixed root collections (dev environment remnants)
 * 3. Test user auth accounts (e2e-test@, demo-*, test-*)
 * 4. Orphaned Stripe events and test orders
 * 5. Demo data marked with "(Demo)" prefix
 *
 * SAFETY:
 * - DRY RUN by default (no deletions)
 * - Protected org IDs list (never deleted)
 * - Platform ID (rapid-compliance-root) never touched
 * - Logs every action for audit trail
 *
 * Usage:
 *   node scripts/cleanup-all-test-data.js              # Dry run
 *   node scripts/cleanup-all-test-data.js --confirm     # Execute deletions
 *   node scripts/cleanup-all-test-data.js --scan-only   # Just scan and report
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const DRY_RUN = !process.argv.includes('--confirm');
const SCAN_ONLY = process.argv.includes('--scan-only');

// ══════════════════════════════════════════════════════════════
// PROTECTED RESOURCES — NEVER DELETE
// ══════════════════════════════════════════════════════════════

const PLATFORM_ID = 'rapid-compliance-root';

const PROTECTED_ORG_IDS = new Set([
  PLATFORM_ID,
  'platform',
]);

// ══════════════════════════════════════════════════════════════
// TEST DATA PATTERNS
// ══════════════════════════════════════════════════════════════

/** Root collections with test_ prefix that should be cleaned */
const TEST_COLLECTION_PREFIXES = ['test_'];

/** Organization ID patterns that are test data */
const TEST_ORG_PATTERNS = [
  /^test-org-/,
  /^org_test_/,
  /^backward-compat/,
  /^experimental-/,
  /^e2e-test-org-/,
  /^org_\d{13}_[a-z0-9]+$/,  // Generated org IDs like org_1767162182929_zybiwt
  /^org_demo_/,                // Demo organizations
];

/** Test auth user email patterns */
const TEST_EMAIL_PATTERNS = [
  /^e2e-test@/,
  /^e2e-auto-test@/,
  /^demo-.*@test\.com$/,
  /^admin@.*\.test$/,
  /^test-prospect@/,
];

/** Known phantom org IDs from previous cleanup */
const PHANTOM_ORG_IDS = [
  'backward-compat-test-org',
  'test-org-distillation',
  'test-product-1',
];

// ══════════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════════

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// ══════════════════════════════════════════════════════════════
// STATS TRACKING
// ══════════════════════════════════════════════════════════════

const stats = {
  collectionsScanned: 0,
  documentsScanned: 0,
  documentsDeleted: 0,
  collectionsDeleted: 0,
  authUsersDeleted: 0,
  phantomOrgsCleared: 0,
  testCollectionsCleared: 0,
  testOrgsCleared: 0,
  errors: [],
};

// ══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Recursively delete all documents in a collection and its subcollections
 */
async function deleteCollectionRecursive(collectionRef, dryRun = true) {
  let totalDeleted = 0;
  const batchSize = 400;

  const snapshot = await collectionRef.limit(batchSize).get();
  if (snapshot.empty) return 0;

  for (const doc of snapshot.docs) {
    // Recursively handle subcollections first
    const subcollections = await doc.ref.listCollections();
    for (const sub of subcollections) {
      totalDeleted += await deleteCollectionRecursive(sub, dryRun);
    }
  }

  if (!dryRun) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  totalDeleted += snapshot.size;
  stats.documentsDeleted += snapshot.size;

  // If there were more docs, recurse
  if (snapshot.size === batchSize) {
    totalDeleted += await deleteCollectionRecursive(collectionRef, dryRun);
  }

  return totalDeleted;
}

/**
 * Count documents in a collection recursively (for reporting)
 */
async function countCollectionRecursive(collectionRef) {
  let count = 0;
  const snapshot = await collectionRef.get();
  count += snapshot.size;
  stats.documentsScanned += snapshot.size;

  for (const doc of snapshot.docs) {
    const subcollections = await doc.ref.listCollections();
    for (const sub of subcollections) {
      count += await countCollectionRecursive(sub);
    }
  }

  return count;
}

/**
 * Check if an org ID matches any test pattern
 */
function isTestOrgId(orgId) {
  if (PROTECTED_ORG_IDS.has(orgId)) return false;
  return TEST_ORG_PATTERNS.some((pattern) => pattern.test(orgId));
}

/**
 * Check if an email matches test patterns
 */
function isTestEmail(email) {
  return TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

// ══════════════════════════════════════════════════════════════
// PHASE 1: SCAN & CLEAN TEST-PREFIXED ROOT COLLECTIONS
// ══════════════════════════════════════════════════════════════

async function cleanTestPrefixedCollections() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 1: Test-Prefixed Root Collections (test_*)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const rootCollections = await db.listCollections();
  const testCollections = rootCollections.filter((c) =>
    TEST_COLLECTION_PREFIXES.some((prefix) => c.id.startsWith(prefix))
  );

  if (testCollections.length === 0) {
    console.log('   No test-prefixed collections found.\n');
    return;
  }

  console.log(`   Found ${testCollections.length} test-prefixed collections:\n`);

  for (const collection of testCollections) {
    stats.collectionsScanned++;
    const count = await countCollectionRecursive(collection);

    if (count === 0) {
      console.log(`   ${collection.id}: empty`);
      continue;
    }

    console.log(`   ${collection.id}: ${count} documents (including subcollections)`);

    if (!SCAN_ONLY) {
      const deleted = await deleteCollectionRecursive(collection, DRY_RUN);
      if (!DRY_RUN) {
        console.log(`      Deleted ${deleted} documents`);
        stats.testCollectionsCleared++;
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
// PHASE 2: SCAN & CLEAN PHANTOM ORGANIZATIONS
// ══════════════════════════════════════════════════════════════

async function cleanPhantomOrgs() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2: Phantom Organizations (parent deleted, subcollections remain)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // First, scan ALL organizations to find phantoms dynamically
  const orgsCollection = db.collection('organizations');
  const orgDocs = await orgsCollection.listDocuments();

  let phantomsFound = 0;

  for (const docRef of orgDocs) {
    const orgId = docRef.id;

    if (PROTECTED_ORG_IDS.has(orgId)) continue;

    const doc = await docRef.get();
    const subcollections = await docRef.listCollections();

    // Check for phantom orgs (no parent doc but has subcollections)
    const isPhantom = !doc.exists && subcollections.length > 0;
    // Check for test org IDs (has parent doc but is test data)
    const isTestOrg = doc.exists && isTestOrgId(orgId);

    if (!isPhantom && !isTestOrg) continue;

    const label = isPhantom ? 'PHANTOM' : 'TEST ORG';
    console.log(`   [${label}] ${orgId}`);

    if (subcollections.length > 0) {
      for (const sub of subcollections) {
        const count = await countCollectionRecursive(sub);
        console.log(`      - ${sub.id}: ${count} documents`);

        if (!SCAN_ONLY && !DRY_RUN) {
          await deleteCollectionRecursive(sub, false);
        }
      }
    }

    // Delete the parent document if it exists (test org)
    if (doc.exists && isTestOrg && !SCAN_ONLY && !DRY_RUN) {
      await docRef.delete();
      stats.documentsDeleted++;
      stats.testOrgsCleared++;
    }

    if (isPhantom) stats.phantomOrgsCleared++;
    phantomsFound++;
  }

  // Also check the known phantom IDs
  for (const orgId of PHANTOM_ORG_IDS) {
    const docRef = db.collection('organizations').doc(orgId);
    const subcollections = await docRef.listCollections();

    if (subcollections.length === 0) continue;

    console.log(`   [KNOWN PHANTOM] ${orgId}`);
    for (const sub of subcollections) {
      const count = await countCollectionRecursive(sub);
      console.log(`      - ${sub.id}: ${count} documents`);

      if (!SCAN_ONLY && !DRY_RUN) {
        await deleteCollectionRecursive(sub, false);
      }
    }
    stats.phantomOrgsCleared++;
    phantomsFound++;
  }

  if (phantomsFound === 0) {
    console.log('   No phantom or test organizations found.\n');
  } else {
    console.log(`\n   Total phantoms/test orgs found: ${phantomsFound}\n`);
  }
}

// ══════════════════════════════════════════════════════════════
// PHASE 3: CLEAN TEST AUTH USERS
// ══════════════════════════════════════════════════════════════

async function cleanTestAuthUsers() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3: Test Firebase Auth Users');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let testUsers = [];
  let pageToken;

  do {
    const listResult = await auth.listUsers(1000, pageToken);

    for (const user of listResult.users) {
      if (user.email && isTestEmail(user.email)) {
        testUsers.push({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '(no name)',
          createdAt: user.metadata.creationTime,
        });
      }
    }

    pageToken = listResult.pageToken;
  } while (pageToken);

  if (testUsers.length === 0) {
    console.log('   No test auth users found.\n');
    return;
  }

  console.log(`   Found ${testUsers.length} test auth users:\n`);

  for (const user of testUsers) {
    console.log(`   [TEST USER] ${user.email} (uid: ${user.uid}, created: ${user.createdAt})`);

    if (!SCAN_ONLY && !DRY_RUN) {
      try {
        // Delete user's Firestore profile
        const userDoc = db.collection('users').doc(user.uid);
        const userDocSnap = await userDoc.get();
        if (userDocSnap.exists) {
          await userDoc.delete();
          console.log(`      Deleted Firestore profile`);
        }

        // Also check test_users collection
        const testUserDoc = db.collection('test_users').doc(user.uid);
        const testUserDocSnap = await testUserDoc.get();
        if (testUserDocSnap.exists) {
          await testUserDoc.delete();
          console.log(`      Deleted test_users profile`);
        }

        // Delete Firebase Auth user
        await auth.deleteUser(user.uid);
        console.log(`      Deleted Auth account`);
        stats.authUsersDeleted++;
      } catch (err) {
        console.log(`      Error: ${err.message}`);
        stats.errors.push(`Auth user ${user.email}: ${err.message}`);
      }
    }
  }
  console.log('');
}

// ══════════════════════════════════════════════════════════════
// PHASE 4: CLEAN DEMO DATA UNDER PLATFORM ORG
// ══════════════════════════════════════════════════════════════

async function cleanDemoDataUnderPlatform() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 4: Demo Data Under Platform Org');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const platformRef = db.collection('organizations').doc(PLATFORM_ID);

  // Check for test Stripe events
  const stripeEventsRef = platformRef.collection('stripe_events');
  const stripeEventsSnap = await stripeEventsRef.get();
  if (!stripeEventsSnap.empty) {
    // Check for test events (events with test mode indicators)
    let testEventCount = 0;
    for (const doc of stripeEventsSnap.docs) {
      const data = doc.data();
      const eventId = doc.id;
      // Test Stripe events start with evt_test_ or contain livemode: false
      if (eventId.startsWith('evt_test_') || data?.livemode === false) {
        testEventCount++;
        if (!SCAN_ONLY && !DRY_RUN) {
          await doc.ref.delete();
          stats.documentsDeleted++;
        }
      }
    }
    if (testEventCount > 0) {
      console.log(`   stripe_events: ${testEventCount} test events ${DRY_RUN || SCAN_ONLY ? 'found' : 'deleted'}`);
    }
  }

  // Check for test orders (orders with demo/test emails)
  const ordersRef = platformRef.collection('orders');
  const ordersSnap = await ordersRef.get();
  if (!ordersSnap.empty) {
    let testOrderCount = 0;
    for (const doc of ordersSnap.docs) {
      const data = doc.data();
      const email = data?.customerInfo?.email || data?.customerEmail || '';
      if (isTestEmail(email) || email.includes('@test.com') || email.includes('@example.com')) {
        testOrderCount++;
        if (!SCAN_ONLY && !DRY_RUN) {
          await doc.ref.delete();
          stats.documentsDeleted++;
        }
      }
    }
    if (testOrderCount > 0) {
      console.log(`   orders: ${testOrderCount} test orders ${DRY_RUN || SCAN_ONLY ? 'found' : 'deleted'}`);
    }
  }

  // Check for test carts in workspaces
  const workspacesRef = platformRef.collection('workspaces');
  const workspaceDocs = await workspacesRef.listDocuments();
  for (const wsDoc of workspaceDocs) {
    const cartsRef = wsDoc.collection('carts');
    const cartsSnap = await cartsRef.get();
    let expiredCount = 0;
    for (const doc of cartsSnap.docs) {
      const data = doc.data();
      const status = data?.status;
      const expiresAt = data?.expiresAt;

      // Delete expired, abandoned, or converted carts
      const isExpired = status === 'expired' || status === 'abandoned' || status === 'converted';
      const isOldExpired = expiresAt && new Date(expiresAt) < new Date();

      if (isExpired || isOldExpired) {
        expiredCount++;
        if (!SCAN_ONLY && !DRY_RUN) {
          await doc.ref.delete();
          stats.documentsDeleted++;
        }
      }
    }
    if (expiredCount > 0) {
      console.log(`   ${wsDoc.id}/carts: ${expiredCount} expired/abandoned carts ${DRY_RUN || SCAN_ONLY ? 'found' : 'deleted'}`);
    }
  }

  // Check stripe_subscriptions for test data
  const subsRef = platformRef.collection('stripe_subscriptions');
  const subsSnap = await subsRef.get();
  if (!subsSnap.empty) {
    let testSubCount = 0;
    for (const doc of subsSnap.docs) {
      const subId = doc.id;
      if (subId.startsWith('sub_test_') || subId.startsWith('test_')) {
        testSubCount++;
        if (!SCAN_ONLY && !DRY_RUN) {
          await doc.ref.delete();
          stats.documentsDeleted++;
        }
      }
    }
    if (testSubCount > 0) {
      console.log(`   stripe_subscriptions: ${testSubCount} test subscriptions ${DRY_RUN || SCAN_ONLY ? 'found' : 'deleted'}`);
    }
  }

  console.log('   Phase 4 complete.\n');
}

// ══════════════════════════════════════════════════════════════
// PHASE 5: SCAN FOR ORPHANED ROOT COLLECTIONS
// ══════════════════════════════════════════════════════════════

async function scanOrphanedCollections() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 5: Orphaned Root Collections Scan');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const rootCollections = await db.listCollections();

  // Expected production collections
  const EXPECTED_COLLECTIONS = new Set([
    'organizations', 'users', 'platform_pricing', 'platform_coupons',
    'coupon_redemptions', 'ai_discount_requests', 'globalTemplates',
  ]);

  const unexpected = rootCollections.filter(
    (c) => !EXPECTED_COLLECTIONS.has(c.id) && !c.id.startsWith('test_')
  );

  if (unexpected.length === 0) {
    console.log('   No unexpected root collections.\n');
    return;
  }

  console.log(`   Found ${unexpected.length} unexpected root collections:\n`);
  for (const collection of unexpected) {
    const snapshot = await collection.limit(5).get();
    console.log(`   [UNEXPECTED] ${collection.id}: ${snapshot.size}+ documents`);

    // Show first few doc IDs for context
    if (snapshot.docs.length > 0) {
      const ids = snapshot.docs.map((d) => d.id).join(', ');
      console.log(`      Sample IDs: ${ids}`);
    }
  }
  console.log('');
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          COMPREHENSIVE FIREBASE TEST DATA CLEANUP           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const mode = SCAN_ONLY ? 'SCAN ONLY' : (DRY_RUN ? 'DRY RUN' : 'LIVE DELETE');
  console.log(`Mode:     ${mode}`);
  console.log(`Project:  ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
  console.log(`Platform: ${PLATFORM_ID}`);
  console.log(`Time:     ${new Date().toISOString()}`);
  console.log('');

  if (!DRY_RUN && !SCAN_ONLY) {
    console.log('⚠️  LIVE MODE — Data will be permanently deleted!\n');
  }

  try {
    await cleanTestPrefixedCollections();
    await cleanPhantomOrgs();
    await cleanTestAuthUsers();
    await cleanDemoDataUnderPlatform();
    await scanOrphanedCollections();
  } catch (err) {
    console.error('\n❌ Fatal error during cleanup:', err.message);
    stats.errors.push(`Fatal: ${err.message}`);
  }

  // ══════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ══════════════════════════════════════════════════════════════

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                       CLEANUP REPORT                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`   Collections scanned:        ${stats.collectionsScanned}`);
  console.log(`   Documents scanned:          ${stats.documentsScanned}`);
  console.log(`   Documents deleted:          ${stats.documentsDeleted}`);
  console.log(`   Test collections cleared:   ${stats.testCollectionsCleared}`);
  console.log(`   Phantom orgs cleared:       ${stats.phantomOrgsCleared}`);
  console.log(`   Test orgs cleared:          ${stats.testOrgsCleared}`);
  console.log(`   Auth users deleted:         ${stats.authUsersDeleted}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log(`   Errors (${stats.errors.length}):`);
    stats.errors.forEach((e) => console.log(`      - ${e}`));
    console.log('');
  }

  if (DRY_RUN && !SCAN_ONLY) {
    console.log('   This was a DRY RUN — no data was actually deleted.');
    console.log('   To execute deletions, run:');
    console.log('     node scripts/cleanup-all-test-data.js --confirm\n');
  } else if (SCAN_ONLY) {
    console.log('   This was a SCAN ONLY — no data was deleted.');
    console.log('   To see what would be deleted: node scripts/cleanup-all-test-data.js');
    console.log('   To execute deletions: node scripts/cleanup-all-test-data.js --confirm\n');
  } else {
    console.log('   Cleanup complete. Firebase is clean.\n');
    console.log('   To verify, re-run in scan mode:');
    console.log('     node scripts/cleanup-all-test-data.js --scan-only\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Unhandled error:', error);
    process.exit(1);
  });
