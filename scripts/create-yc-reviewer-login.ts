/**
 * Create YC Reviewer Login
 *
 * Creates a Firebase Auth user `yc-review@salesvelocity.ai` with full owner-role
 * access to the rapid-compliance-root organization so YC staff can log in and
 * review the platform.
 *
 * Run: npx tsx scripts/create-yc-reviewer-login.ts
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const REVIEWER_EMAIL = 'yc-review@salesvelocity.ai';
const REVIEWER_DISPLAY_NAME = 'YC Reviewer';
const PLATFORM_ID = 'rapid-compliance-root';

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  let serviceAccount: admin.ServiceAccount | undefined;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    if (raw.startsWith('{')) {
      serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    } else {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded) as admin.ServiceAccount;
    }
  }

  if (!serviceAccount && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID
        ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        ?? 'rapid-compliance-65f87',
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    } as admin.ServiceAccount;
  }

  if (!serviceAccount) {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ?? process.env.FIREBASE_PROJECT_ID
    ?? 'rapid-compliance-65f87';

  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId });
  } else {
    console.warn('No Firebase credentials found, using project ID only');
    admin.initializeApp({ projectId });
  }

  return admin.firestore();
}

function generateStrongPassword(): string {
  // 20 chars, mix of upper/lower/digits/symbols, easy to read (no I/l/O/0)
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*?';
  const all = upper + lower + digits + symbols;

  // Guarantee at least one of each class
  const chars = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  while (chars.length < 20) {
    chars.push(all[crypto.randomInt(all.length)]);
  }

  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  const db = initFirebase();
  const auth = admin.auth();
  const password = generateStrongPassword();

  console.log('Creating YC reviewer login...\n');

  let uid: string;
  let created = false;

  try {
    const existing = await auth.getUserByEmail(REVIEWER_EMAIL);
    uid = existing.uid;
    await auth.updateUser(uid, {
      password,
      emailVerified: true,
      displayName: REVIEWER_DISPLAY_NAME,
    });
    console.log(`✓ Updated existing user (uid: ${uid})`);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== 'auth/user-not-found') {
      throw err;
    }
    const user = await auth.createUser({
      email: REVIEWER_EMAIL,
      password,
      emailVerified: true,
      displayName: REVIEWER_DISPLAY_NAME,
      disabled: false,
    });
    uid = user.uid;
    created = true;
    console.log(`✓ Created new Firebase Auth user (uid: ${uid})`);
  }

  // Set admin role via custom claims (one rung below owner — full access minus
  // delete-org and impersonation)
  await auth.setCustomUserClaims(uid, { role: 'admin' });
  console.log('✓ Set custom claim role=admin');

  // Mirror to Firestore users doc
  await db.collection('users').doc(uid).set({
    email: REVIEWER_EMAIL,
    role: 'admin',
    displayName: REVIEWER_DISPLAY_NAME,
    name: REVIEWER_DISPLAY_NAME,
    organizationId: PLATFORM_ID,
    currentOrganizationId: PLATFORM_ID,
    status: 'active',
    notes: 'YC submission reviewer login. Created May 1, 2026. Delete after review window closes.',
    createdAt: created
      ? admin.firestore.FieldValue.serverTimestamp()
      : admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('✓ Wrote users/{uid} doc with role=admin');

  // Mirror to organizations/{orgId}/members so member-aware code paths see them
  await db
    .collection('organizations')
    .doc(PLATFORM_ID)
    .collection('members')
    .doc(uid)
    .set({
      userId: uid,
      email: REVIEWER_EMAIL,
      name: REVIEWER_DISPLAY_NAME,
      role: 'admin',
      status: 'active',
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  console.log('✓ Wrote organizations/' + PLATFORM_ID + '/members/{uid} doc');

  console.log('\n=========================================================');
  console.log('YC REVIEWER LOGIN — paste this into your YC application:');
  console.log('=========================================================');
  console.log(`  Login URL:  https://www.salesvelocity.ai/login`);
  console.log(`  Email:      ${REVIEWER_EMAIL}`);
  console.log(`  Password:   ${password}`);
  console.log('=========================================================');
  console.log('Role: admin (one rung below owner — full access minus delete-org + impersonation)');
  console.log('UID:  ' + uid);
  console.log('To revoke after review: delete the auth user + Firestore docs.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
