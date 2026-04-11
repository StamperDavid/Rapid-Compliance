/**
 * Patch the Copywriter Golden Master's model field.
 *
 * Updates ONLY config.model on the existing sgm_copywriter_saas_sales_ops_v1
 * doc. Preserves systemPrompt, temperature, maxTokens, and every other field.
 * Idempotent — safe to run twice.
 *
 * Usage:  node scripts/_patch-copywriter-gm-model.js
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const GM_ID = 'sgm_copywriter_saas_sales_ops_v1';
const NEW_MODEL = 'claude-sonnet-4.6';

if (!admin.apps.length) {
  // Prefer the service account JSON if present (matches the other scripts),
  // fall back to individual env vars otherwise.
  const saPath = path.resolve(__dirname, '../serviceAccountKey.json');
  let initialized = false;
  try {
    const serviceAccount = require(saPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
  } catch (err) {
    // Fall through to env-var init
  }
  if (!initialized) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      console.error('Missing FIREBASE_ADMIN_* env vars and no serviceAccountKey.json found. Check .env.local or the project root.');
      process.exit(1);
    }
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
}

async function main() {
  const db = admin.firestore();
  const ref = db.collection(COLLECTION).doc(GM_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`GM doc ${GM_ID} not found at ${COLLECTION}. Run scripts/seed-copywriter-gm.js first.`);
    process.exit(1);
  }

  const data = snap.data();
  const currentModel = data?.config?.model;
  console.log(`Current model: ${currentModel ?? '(not set)'}`);
  console.log(`Target  model: ${NEW_MODEL}`);

  if (currentModel === NEW_MODEL) {
    console.log('Already on target model. No changes made.');
    process.exit(0);
  }

  const newConfig = { ...(data.config ?? {}), model: NEW_MODEL };
  await ref.update({
    config: newConfig,
    notes: `Model patched to ${NEW_MODEL} on ${new Date().toISOString()} (prior: ${currentModel ?? 'unset'}). Regression harness proved Sonnet 4 -> Sonnet 4.6 safe on April 11 2026.`,
  });

  console.log(`Patched config.model: ${currentModel} -> ${NEW_MODEL}`);
  console.log('All other GM fields preserved (systemPrompt, temperature, maxTokens, etc.).');
  process.exit(0);
}

main().catch((err) => {
  console.error('Patch failed:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
