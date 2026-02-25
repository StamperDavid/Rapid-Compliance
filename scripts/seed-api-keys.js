/**
 * Bulk API Key Seeder
 * Saves API keys to Firestore via Firebase Admin SDK.
 *
 * Usage:
 *   1. Create scripts/api-keys.local.json with your keys (gitignored)
 *   2. Run: node scripts/seed-api-keys.js
 *
 * The JSON file should match the Firestore APIKeysConfig structure:
 * {
 *   "email": { "sendgrid": { "apiKey": "SG.xxx" } },
 *   "payments": { "stripe": { "publicKey": "pk_...", "secretKey": "sk_..." } },
 *   "voice": { "elevenlabs": { "apiKey": "..." } },
 *   ...
 * }
 *
 * Writes to: organizations/rapid-compliance-root/apiKeys/rapid-compliance-root
 * Uses { merge: true } so existing keys are preserved.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Load keys from local JSON file
const keysFilePath = path.resolve(__dirname, 'api-keys.local.json');
if (!fs.existsSync(keysFilePath)) {
  console.error(`\nMissing: ${keysFilePath}`);
  console.error('Create this file with your API keys in the Firestore config format.');
  console.error('See the comment at the top of this script for the expected structure.\n');
  process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = admin.firestore();
const PLATFORM_ID = 'rapid-compliance-root';
const DOC_PATH = `organizations/${PLATFORM_ID}/apiKeys/${PLATFORM_ID}`;

async function seedKeys() {
  console.log(`\nSeeding API keys to: ${DOC_PATH}\n`);

  const keysToSave = JSON.parse(fs.readFileSync(keysFilePath, 'utf8'));

  // Add metadata
  keysToSave.updatedAt = new Date().toISOString();
  keysToSave.updatedBy = 'seed-script';

  try {
    await db.doc(DOC_PATH).set(keysToSave, { merge: true });
    console.log('Keys saved successfully!\n');

    // Verify by reading back
    const doc = await db.doc(DOC_PATH).get();
    const data = doc.data();

    const checks = [
      ['OpenRouter', data?.ai?.openrouterApiKey],
      ['SendGrid', data?.email?.sendgrid?.apiKey],
      ['Stripe Publishable', data?.payments?.stripe?.publicKey],
      ['Stripe Secret', data?.payments?.stripe?.secretKey],
      ['ElevenLabs', data?.voice?.elevenlabs?.apiKey],
      ['Unreal Speech', data?.voice?.unrealSpeech?.apiKey],
      ['HeyGen', data?.video?.heygen?.apiKey],
      ['Runway', data?.video?.runway?.apiKey],
      ['PageSpeed', data?.seo?.pagespeedApiKey],
      ['DataForSEO Login', data?.seo?.dataforseoLogin],
      ['DataForSEO Password', data?.seo?.dataforseoPassword],
      ['Twitter Consumer Key', data?.social?.twitter?.clientId],
      ['Twitter Consumer Secret', data?.social?.twitter?.clientSecret],
      ['Twitter Access Token', data?.social?.twitter?.accessToken],
      ['Twitter Access Secret', data?.social?.twitter?.refreshToken],
    ];

    console.log('Verification:');
    for (const [name, value] of checks) {
      const preview = value ? `...${value.slice(-4)}` : '';
      console.log(`  ${value ? '[OK]' : '[!!]'} ${name}: ${value ? 'OK' : 'MISSING'} ${preview}`);
    }

    console.log('\nDone! Refresh /settings/api-keys to see the updated keys.');
  } catch (error) {
    console.error('Error seeding keys:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

seedKeys();
