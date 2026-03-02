/**
 * SEO Launch Command — SalesVelocity.ai
 *
 * Flips crawlers and indexing ON. Run this when ready to go live.
 *
 * What it does:
 *   - robotsIndex → true
 *   - robotsFollow → true
 *   - All 9 AI bot access → true (GPTBot, Claude-Web, etc.)
 *   - robotsTxt → Allow: / with sitemap
 *   - status → "published"
 *
 * Firestore location: organizations/rapid-compliance-root/website/settings
 *
 * Usage: npx tsx scripts/seo-launch.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const DOMAIN = 'salesvelocity.ai';
const orgRoot = `organizations/${PLATFORM_ID}`;

// ============================================================================
// INITIALIZE FIREBASE ADMIN
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('  ✅ Using serviceAccountKey.json');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const parsed = raw.startsWith('{')
      ? JSON.parse(raw)
      : JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
    console.log('  ✅ Using FIREBASE_SERVICE_ACCOUNT_KEY env var');
  } else {
    throw new Error('No Firebase credentials found');
  }

  return admin.firestore();
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('🚀 SalesVelocity.ai SEO Launch');
  console.log('==============================');
  console.log('');

  const db = initFirebase();
  console.log('');

  const settingsRef = db.doc(`${orgRoot}/website/settings`);
  const doc = await settingsRef.get();

  if (!doc.exists) {
    console.error('❌ No website settings found. Run seed-seo-setup.ts first.');
    process.exit(1);
  }

  // Build the live robots.txt
  const robotsTxt = [
    '# SalesVelocity.ai — Live',
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /_next/',
    '',
    `Sitemap: https://${DOMAIN}/sitemap.xml`,
    '',
    '# AI model discovery',
    `# llms.txt: https://${DOMAIN}/llms.txt`,
  ].join('\n');

  // Flip everything ON
  await settingsRef.set(
    {
      seo: {
        robotsIndex: true,
        robotsFollow: true,
        aiBotAccess: {
          GPTBot: true,
          'ChatGPT-User': true,
          'Google-Extended': true,
          'Claude-Web': true,
          'anthropic-ai': true,
          CCBot: true,
          PerplexityBot: true,
          Bytespider: true,
          'cohere-ai': true,
        },
      },
      robotsTxt,
      status: 'published',
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log('✅ SEO Launch Complete');
  console.log('');
  console.log('  🟢 robotsIndex: true');
  console.log('  🟢 robotsFollow: true');
  console.log('  🟢 All 9 AI bots: allowed');
  console.log('  🟢 robotsTxt: Allow: / (with sitemap)');
  console.log('  🟢 status: published');
  console.log('');
  console.log(`  Your site is now discoverable at https://${DOMAIN}`);
  console.log('');
}

main().catch((error) => {
  console.error('❌ SEO launch failed:', error);
  process.exit(1);
});
