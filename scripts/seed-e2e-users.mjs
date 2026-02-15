/**
 * Seed E2E Test Users
 *
 * Creates the test accounts required by the Playwright E2E tests:
 *   - e2e-member@salesvelocity.ai   (role: member)
 *   - e2e-admin@salesvelocity.ai    (role: admin)
 *   - e2e-manager@salesvelocity.ai  (role: manager)
 *
 * Uses Firebase Admin SDK with credentials from .env.local
 *
 * Usage:  node scripts/seed-e2e-users.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ------------------------------------------------------------------
// Firebase Admin init
// ------------------------------------------------------------------
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'rapid-compliance-65f87';
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!clientEmail || !privateKey) {
  console.error('Missing FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY in .env.local');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId,
});

const auth = getAuth(app);
const db = getFirestore(app);

// ------------------------------------------------------------------
// Platform constants (mirrors src/lib/constants/platform.ts)
// ------------------------------------------------------------------
const PLATFORM_ID = 'rapid-compliance-root';

// NEXT_PUBLIC_APP_ENV=production in .env.local → no prefix
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development';
const PREFIX = APP_ENV === 'production' ? '' : 'test_';

const USERS_COL = `${PREFIX}users`;
const ORGS_COL = `${PREFIX}organizations`;

// ------------------------------------------------------------------
// Test accounts (must match tests/e2e/fixtures/test-accounts.ts)
// ------------------------------------------------------------------
const ACCOUNTS = [
  {
    email: 'e2e-member@salesvelocity.ai',
    password: 'E2eTestPass!2026',
    displayName: 'E2E Test User',
    role: 'member',
  },
  {
    email: 'e2e-admin@salesvelocity.ai',
    password: 'E2eAdminPass!2026',
    displayName: 'E2E Admin User',
    role: 'admin',
  },
  {
    email: 'e2e-manager@salesvelocity.ai',
    password: 'E2eManagerPass!2026',
    displayName: 'E2E Manager User',
    role: 'manager',
  },
];

// ------------------------------------------------------------------
// Seed logic
// ------------------------------------------------------------------
async function upsertUser(account) {
  const { email, password, displayName, role } = account;
  let uid;

  // 1. Create or fetch Firebase Auth user
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`  Auth user exists: ${email} (${uid})`);

    // Make sure password is up-to-date
    await auth.updateUser(uid, { password, displayName });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const created = await auth.createUser({ email, password, displayName });
      uid = created.uid;
      console.log(`  Auth user CREATED: ${email} (${uid})`);
    } else {
      throw err;
    }
  }

  // 2. Upsert Firestore user profile
  const userRef = db.collection(USERS_COL).doc(uid);
  await userRef.set(
    {
      email,
      displayName,
      organizations: [PLATFORM_ID],
      defaultOrganization: PLATFORM_ID,
      companyName: 'SalesVelocity.ai',
      industry: 'saas',
      industryName: 'SaaS',
      role,
      status: 'active',
      emailVerified: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`  Firestore ${USERS_COL}/${uid} → role: ${role}`);

  // 3. Add UID to org members array (idempotent via arrayUnion)
  const orgRef = db.collection(ORGS_COL).doc(PLATFORM_ID);
  await orgRef.set(
    {
      members: FieldValue.arrayUnion(uid),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`  Added to ${ORGS_COL}/${PLATFORM_ID}.members`);

  return uid;
}

async function main() {
  console.log('=== Seeding E2E Test Users ===');
  console.log(`Project:     ${projectId}`);
  console.log(`Users col:   ${USERS_COL}`);
  console.log(`Orgs col:    ${ORGS_COL}`);
  console.log(`Platform ID: ${PLATFORM_ID}\n`);

  for (const account of ACCOUNTS) {
    console.log(`\n> ${account.email} (${account.role})`);
    await upsertUser(account);
  }

  console.log('\n=== Done! E2E test users are ready. ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
