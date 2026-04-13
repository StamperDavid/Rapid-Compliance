/**
 * Seed SMS Settings — single config document
 *
 * Usage: node scripts/seed-sms-settings.js [--force]
 *
 * Creates the initial SMS configuration document at
 * `organizations/{PLATFORM_ID}/settings/sms` with safe defaults:
 *   - maxCharCap: 480 (3 SMS segments — a safe middle ground)
 *   - complianceRegion: US
 *   - requireComplianceFooter: true
 *   - defaultSenderId: empty (UI must configure)
 *   - defaultShortenerDomain: empty (UI must configure)
 *
 * Running without --force leaves an existing doc untouched. With --force
 * the defaults are upserted (useful for test resets, never run in prod
 * without understanding which fields you are overwriting).
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/settings`;
const DOC_ID = 'sms';

const DEFAULT_DOC = {
  maxCharCap: 480,
  defaultSenderId: '',
  complianceRegion: 'US',
  requireComplianceFooter: true,
  defaultShortenerDomain: '',
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    console.error('Missing FIREBASE_ADMIN_* env vars. Check .env.local');
    process.exit(1);
  }
}

const db = admin.firestore();

async function main() {
  const force = process.argv.includes('--force');
  const ref = db.collection(COLLECTION).doc(DOC_ID);
  const existing = await ref.get();

  if (existing.exists && !force) {
    console.log(`✓ SMS settings already exist at ${COLLECTION}/${DOC_ID} — skipping (pass --force to overwrite)`);
    console.log(`  Current maxCharCap: ${existing.data()?.maxCharCap ?? '(unset)'}`);
    process.exit(0);
  }

  await ref.set(DEFAULT_DOC);
  console.log(`✓ Seeded SMS settings at ${COLLECTION}/${DOC_ID}`);
  console.log(`  maxCharCap: ${DEFAULT_DOC.maxCharCap}`);
  console.log(`  complianceRegion: ${DEFAULT_DOC.complianceRegion}`);
  console.log(`  requireComplianceFooter: ${DEFAULT_DOC.requireComplianceFooter}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
