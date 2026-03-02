/**
 * SEO System Setup — SalesVelocity.ai
 *
 * Populates 3 Firestore locations with real SalesVelocity.ai data:
 *   1. Brand DNA → organizations/rapid-compliance-root (brandDNA field)
 *   2. Website SEO → organizations/rapid-compliance-root/website/settings
 *   3. SEO Lab Training → organizations/rapid-compliance-root/toolTraining/seo
 *
 * Crawlers and indexing start OFF. Run `seo-launch.ts` to flip them on.
 *
 * Usage: npx tsx scripts/seed-seo-setup.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
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
// BRAND DNA DATA
// ============================================================================

const brandDNA = {
  companyDescription:
    'AI-powered sales automation platform with autonomous agents across chat, voice, email, social media, and SEO. SalesVelocity.ai deploys a full-stack AI sales workforce that handles outreach, qualification, follow-up, and closing — not just a chatbot, but an entire revenue team.',
  uniqueValue:
    'Full-stack AI sales workforce — autonomous agents across every channel (chat, voice, email, social, SEO) working together to close more deals. Not a single-trick tool, but a coordinated AI revenue team.',
  targetAudience:
    'Sales teams, B2B SaaS companies, digital agencies, growing businesses looking to scale revenue without scaling headcount.',
  toneOfVoice: 'Professional, confident, results-driven',
  communicationStyle:
    'Direct, data-backed, outcome-focused. Lead with results and ROI. Use concrete numbers over vague claims.',
  keyPhrases: [
    'AI sales workforce',
    'autonomous sales agents',
    'close more deals',
    'scale revenue',
    'AI-powered outreach',
    'revenue automation',
    'sales on autopilot',
    'full-stack AI sales',
  ],
  avoidPhrases: [
    'cheap',
    'basic',
    'simple chatbot',
    'just a CRM',
    'limited',
    'starter',
    'free forever',
  ],
  industry: 'SaaS / Sales Technology / AI Automation',
  competitors: [
    'GoHighLevel',
    'HubSpot',
    'Salesforce',
    'Close.com',
    'Apollo.io',
    'Outreach.io',
    'Salesloft',
    'Drift',
  ],
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedBy: 'system-seed',
};

// ============================================================================
// WEBSITE SEO DATA (robots OFF until launch)
// ============================================================================

const websiteSEO = {
  seo: {
    title: 'SalesVelocity.ai — AI Sales Workforce Platform',
    description:
      'Deploy autonomous AI agents across chat, voice, email, social & SEO to close more deals. The full-stack AI sales workforce for modern revenue teams.',
    keywords: [
      'AI sales platform',
      'autonomous sales agents',
      'AI sales workforce',
      'sales automation',
      'AI outreach',
      'revenue automation',
      'AI voice agent',
      'AI email agent',
      'AI social media',
      'AI SEO',
      'sales AI',
      'GoHighLevel alternative',
      'HubSpot AI alternative',
    ],
    robotsIndex: false,
    robotsFollow: false,
    aiBotAccess: {
      GPTBot: false,
      'ChatGPT-User': false,
      'Google-Extended': false,
      'Claude-Web': false,
      'anthropic-ai': false,
      CCBot: false,
      PerplexityBot: false,
      Bytespider: false,
      'cohere-ai': false,
    },
    twitterCard: 'summary_large_image' as const,
  },
  robotsTxt: [
    '# SalesVelocity.ai — Pre-launch (crawlers blocked)',
    'User-agent: *',
    'Disallow: /',
    '',
    '# AI bots blocked until launch',
    'User-agent: GPTBot',
    'Disallow: /',
    'User-agent: ChatGPT-User',
    'Disallow: /',
    'User-agent: Google-Extended',
    'Disallow: /',
    'User-agent: Claude-Web',
    'Disallow: /',
    'User-agent: anthropic-ai',
    'Disallow: /',
    'User-agent: CCBot',
    'Disallow: /',
    'User-agent: PerplexityBot',
    'Disallow: /',
    'User-agent: Bytespider',
    'Disallow: /',
    'User-agent: cohere-ai',
    'Disallow: /',
  ].join('\n'),
  status: 'draft' as const,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

// ============================================================================
// SEO LAB TRAINING DATA
// ============================================================================

const seoTraining = {
  toolType: 'seo',
  inheritFromBrandDNA: true,
  targetSearchIntent: 'commercial',
  writingStyle: 'conversational',
  contentLength: 'comprehensive',
  audienceExpertiseLevel: 'intermediate',
  structurePreferences: {
    useHeaders: true,
    useLists: true,
    useFAQ: true,
    useImages: true,
  },
  targetKeywords: [
    'AI sales platform',
    'autonomous sales agents',
    'AI sales workforce',
    'sales automation software',
    'AI outreach platform',
    'revenue automation',
    'AI voice agent for sales',
    'AI email outreach',
    'AI social media marketing',
    'AI SEO content',
    'GoHighLevel alternative',
    'HubSpot AI alternative',
    'best AI sales tools',
    'AI-powered CRM',
    'sales AI agents',
    'automated sales outreach',
    'AI lead generation',
    'close more deals with AI',
  ],
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedBy: 'system-seed',
};

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('🔧 SalesVelocity.ai SEO System Setup');
  console.log('=====================================');
  console.log('');

  const db = initFirebase();
  console.log('');

  // ── Write 1: Brand DNA ──────────────────────────────────────────────
  console.log('📝 [1/3] Writing Brand DNA...');
  const orgRef = db.doc(`${orgRoot}`);
  await orgRef.set({ brandDNA }, { merge: true });
  console.log('  ✅ Brand DNA → organizations/rapid-compliance-root');

  // Sync inherited Brand DNA to all 3 tool training docs
  const toolTypes = ['voice', 'social', 'seo'] as const;
  for (const toolType of toolTypes) {
    const toolRef = db.doc(`${orgRoot}/toolTraining/${toolType}`);
    const toolDoc = await toolRef.get();

    if (toolDoc.exists) {
      // Update existing doc — preserve tool-specific settings
      await toolRef.set(
        {
          inheritFromBrandDNA: true,
          inheritedBrandDNA: {
            ...brandDNA,
            // Replace FieldValue with plain timestamp for nested writes
            updatedAt: new Date().toISOString(),
          },
          lastSyncedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } else {
      // Create the doc with inherited brand DNA
      await toolRef.set({
        toolType,
        inheritFromBrandDNA: true,
        inheritedBrandDNA: {
          ...brandDNA,
          updatedAt: new Date().toISOString(),
        },
        lastSyncedAt: new Date().toISOString(),
      });
    }
    console.log(`  ✅ Brand DNA synced → toolTraining/${toolType}`);
  }

  // ── Write 2: Website SEO Settings ───────────────────────────────────
  console.log('');
  console.log('📝 [2/3] Writing Website SEO Settings (robots OFF)...');
  const settingsRef = db.doc(`${orgRoot}/website/settings`);
  await settingsRef.set(websiteSEO, { merge: true });
  console.log('  ✅ SEO settings → organizations/rapid-compliance-root/website/settings');
  console.log('  🚫 robotsIndex: false');
  console.log('  🚫 robotsFollow: false');
  console.log('  🚫 All 9 AI bots: blocked');
  console.log('  🚫 robotsTxt: Disallow: /');
  console.log('  📋 status: draft');

  // ── Write 3: SEO Lab Training Settings ──────────────────────────────
  console.log('');
  console.log('📝 [3/3] Writing SEO Lab Training Settings...');
  const seoRef = db.doc(`${orgRoot}/toolTraining/seo`);
  await seoRef.set(seoTraining, { merge: true });
  console.log('  ✅ SEO training → organizations/rapid-compliance-root/toolTraining/seo');
  console.log(`  🎯 Intent: ${seoTraining.targetSearchIntent}`);
  console.log(`  ✍️  Style: ${seoTraining.writingStyle}`);
  console.log(`  📏 Length: ${seoTraining.contentLength}`);
  console.log(`  👥 Audience: ${seoTraining.audienceExpertiseLevel}`);
  console.log(`  🔑 ${seoTraining.targetKeywords.length} target keywords`);

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('');
  console.log('=====================================');
  console.log('✅ SEO System Setup Complete');
  console.log('');
  console.log('What was written:');
  console.log('  1. Brand DNA (org doc + 3 tool training docs)');
  console.log('  2. Website SEO settings (robots OFF, AI bots blocked)');
  console.log('  3. SEO Lab training settings (18 keywords, commercial intent)');
  console.log('');
  console.log('⚠️  Crawlers are OFF. When ready to launch:');
  console.log('    npx tsx scripts/seo-launch.ts');
  console.log('');
}

main().catch((error) => {
  console.error('❌ SEO setup failed:', error);
  process.exit(1);
});
