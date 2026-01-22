/**
 * Initialize Master Organization & Link Platform Admin User
 *
 * This script:
 * 1. Queries the users collection for role === 'platform_admin'
 * 2. Creates the platform-admin master organization
 * 3. Links the admin user to the organization via organizationId and tenantId
 *
 * Run with: npx ts-node --project tsconfig.scripts.json src/scripts/maintenance/init-master-org.ts
 */

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Firebase Admin Initialization (standalone - no Next.js dependencies)
// ============================================================================

function initializeFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('🔑 Using local serviceAccountKey.json');
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('🔑 Using FIREBASE_SERVICE_ACCOUNT_KEY env var');
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  throw new Error('❌ No Firebase credentials found. Please provide serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT_KEY env var.');
}

// ============================================================================
// Collection Names (environment-aware)
// ============================================================================

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development';
const IS_PRODUCTION = APP_ENV === 'production';
const PREFIX = IS_PRODUCTION ? '' : 'test_';

const COLLECTIONS = {
  ORGANIZATIONS: `${PREFIX}organizations`,
  USERS: `${PREFIX}users`,
} as const;

console.log(`📦 Environment: ${APP_ENV} | Collection prefix: "${PREFIX || '(none)'}"`);

// ============================================================================
// Types
// ============================================================================

interface MasterOrgDocument {
  id: string;
  name: string;
  isPlatformOrg: boolean;
  status: 'active' | 'suspended' | 'trial';
  plan: 'free' | 'pro' | 'enterprise';
  flags: {
    isInternalAdmin: boolean;
    bypassQuotas: boolean;
  };
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

type UserUpdateData = {
  organizationId: string;
  tenantId: string;
  updatedAt: admin.firestore.FieldValue;
} & Record<string, string | admin.firestore.FieldValue>;

interface PlatformAdminUser {
  id: string;
  email: string;
  role: string;
  organizationId?: string;
  tenantId?: string;
}

// ============================================================================
// Main Script
// ============================================================================

async function initMasterOrg(): Promise<void> {
  console.log(`\n${  '='.repeat(60)}`);
  console.log('🚀 MASTER ORG INITIALIZATION & USER-TENANT MAPPING');
  console.log(`${'='.repeat(60)  }\n`);

  // Initialize Firebase Admin
  const app = initializeFirebaseAdmin();
  const db = admin.firestore(app);

  const MASTER_ORG_ID = 'platform-admin';

  // -------------------------------------------------------------------------
  // Step 1: Find Platform Admin User
  // -------------------------------------------------------------------------
  console.log('📍 Step 1: Locating platform_admin or super_admin user...');

  // Try prefixed collection first, then non-prefixed (for existing deployments)
  let usersSnapshot = await db
    .collection(COLLECTIONS.USERS)
    .where('role', 'in', ['platform_admin', 'super_admin'])
    .limit(10)
    .get();

  let usersCollectionUsed = COLLECTIONS.USERS;

  // Fallback to non-prefixed users collection if prefixed is empty
  if (usersSnapshot.empty && PREFIX) {
    console.log(`   No admins in ${COLLECTIONS.USERS}, checking non-prefixed users...`);
    usersSnapshot = await db
      .collection('users')
      .where('role', 'in', ['platform_admin', 'super_admin'])
      .limit(10)
      .get();
    usersCollectionUsed = 'users';
  }

  if (usersSnapshot.empty) {
    console.error('❌ No user found with role "platform_admin" or "super_admin"');
    console.log('   Hint: Run the create-super-admin script first.');
    process.exit(1);
  }

  const platformAdmins: PlatformAdminUser[] = [];
  usersSnapshot.forEach((doc) => {
    const data = doc.data();
    platformAdmins.push({
      id: doc.id,
      email: data.email as string,
      role: data.role as string,
      organizationId: data.organizationId as string | undefined,
      tenantId: data.tenantId as string | undefined,
    });
  });

  console.log(`✅ Found ${platformAdmins.length} platform_admin user(s):`);
  platformAdmins.forEach((user) => {
    console.log(`   - ${user.email} (UID: ${user.id})`);
    console.log(`     Current orgId: ${user.organizationId ?? '(none)'}`);
    console.log(`     Current tenantId: ${user.tenantId ?? '(none)'}`);
  });

  // -------------------------------------------------------------------------
  // Step 2: Create Master Organization
  // -------------------------------------------------------------------------
  console.log('\n📍 Step 2: Creating/updating Master Organization...');

  // Use same prefix logic as users - if we found users in non-prefixed, use non-prefixed orgs
  const orgsCollectionUsed = usersCollectionUsed === 'users' ? 'organizations' : COLLECTIONS.ORGANIZATIONS;
  console.log(`   Using organizations collection: ${orgsCollectionUsed}`);

  const masterOrgRef = db.collection(orgsCollectionUsed).doc(MASTER_ORG_ID);
  const existingOrg = await masterOrgRef.get();

  const masterOrgData: MasterOrgDocument = {
    id: MASTER_ORG_ID,
    name: 'SalesVelocity.ai Master Control',
    isPlatformOrg: true,
    status: 'active',
    plan: 'enterprise',
    flags: {
      isInternalAdmin: true,
      bypassQuotas: true,
    },
    createdAt: existingOrg.exists
      ? (existingOrg.data()?.createdAt ?? admin.firestore.FieldValue.serverTimestamp())
      : admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await masterOrgRef.set(masterOrgData, { merge: true });

  if (existingOrg.exists) {
    console.log(`✅ Master Organization updated: "${MASTER_ORG_ID}"`);
  } else {
    console.log(`✅ Master Organization created: "${MASTER_ORG_ID}"`);
  }
  console.log(`   Name: ${masterOrgData.name}`);
  console.log(`   Plan: ${masterOrgData.plan}`);
  console.log(`   Flags: isInternalAdmin=${masterOrgData.flags.isInternalAdmin}, bypassQuotas=${masterOrgData.flags.bypassQuotas}`);

  // -------------------------------------------------------------------------
  // Step 3: Link User(s) to Master Organization
  // -------------------------------------------------------------------------
  console.log('\n📍 Step 3: Linking platform_admin user(s) to Master Organization...');

  const batch = db.batch();

  for (const user of platformAdmins) {
    const userRef = db.collection(usersCollectionUsed).doc(user.id);
    const userUpdate: UserUpdateData = {
      organizationId: MASTER_ORG_ID,
      tenantId: MASTER_ORG_ID,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    batch.update(userRef, userUpdate);
    console.log(`   Updating user ${user.email} -> organizationId: "${MASTER_ORG_ID}", tenantId: "${MASTER_ORG_ID}"`);
  }

  await batch.commit();
  console.log(`✅ Successfully linked ${platformAdmins.length} user(s) to Master Organization`);

  // -------------------------------------------------------------------------
  // Verification
  // -------------------------------------------------------------------------
  console.log('\n📍 Verification: Reading back data...');

  const verifyOrg = await masterOrgRef.get();
  if (verifyOrg.exists) {
    const orgData = verifyOrg.data();
    console.log(`✅ Organization "${MASTER_ORG_ID}" verified:`);
    console.log(`   name: ${orgData?.name}`);
    console.log(`   isPlatformOrg: ${orgData?.isPlatformOrg}`);
    console.log(`   status: ${orgData?.status}`);
  }

  for (const user of platformAdmins) {
    const verifyUser = await db.collection(usersCollectionUsed).doc(user.id).get();
    if (verifyUser.exists) {
      const userData = verifyUser.data();
      console.log(`✅ User "${user.email}" verified:`);
      console.log(`   organizationId: ${userData?.organizationId}`);
      console.log(`   tenantId: ${userData?.tenantId}`);
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n${  '='.repeat(60)}`);
  console.log('🎉 MASTER ORG INITIALIZATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nOrganization ID: ${MASTER_ORG_ID}`);
  console.log(`Organization Name: ${masterOrgData.name}`);
  console.log(`Users Linked: ${platformAdmins.length}`);
  console.log('\n✅ The Identity Bridge is now operational.');
  console.log('   Platform Admin can access Workspace routes via useAuth hook.\n');
}

// ============================================================================
// Execute
// ============================================================================

initMasterOrg()
  .then(() => {
    console.log('Script completed successfully.');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('❌ Script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
