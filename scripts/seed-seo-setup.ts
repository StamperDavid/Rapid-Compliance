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
    'AI-powered business growth platform with 54 autonomous agents spanning sales, marketing, content creation, social media management, e-commerce, website building, voice AI, email campaigns, and SEO. SalesVelocity.ai deploys a coordinated AI workforce that handles the entire revenue lifecycle — from lead generation and content marketing to closing deals and post-sale engagement.',
  uniqueValue:
    'Full-stack AI business workforce — 54 autonomous agents coordinated across sales, marketing, content, social, e-commerce, voice, email, and SEO. Not a single-channel tool, but an entire AI-powered revenue and marketing team working together.',
  targetAudience:
    'B2B SaaS companies, digital agencies, e-commerce businesses, and growing companies looking to scale revenue and marketing without scaling headcount.',
  toneOfVoice: 'Professional, confident, results-driven',
  communicationStyle:
    'Direct, data-backed, outcome-focused. Lead with results and ROI. Use concrete numbers over vague claims.',
  keyPhrases: [
    'AI business workforce',
    'autonomous AI agents',
    'AI sales automation',
    'AI marketing platform',
    'AI content generation',
    'AI social media management',
    'AI e-commerce',
    'AI website builder',
    'AI voice agent',
    'scale revenue',
    'AI-powered outreach',
    'revenue automation',
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
  industry: 'SaaS / AI Automation / Sales & Marketing Technology',
  competitors: [
    'GoHighLevel',
    'HubSpot',
    'Salesforce',
    'Close.com',
    'Apollo.io',
    'Outreach.io',
    'Salesloft',
    'Drift',
    'Jasper AI',
    'Shopify',
  ],
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedBy: 'system-seed',
};

// ============================================================================
// WEBSITE SEO DATA (robots OFF until launch)
// ============================================================================

const websiteSEO = {
  seo: {
    title: 'SalesVelocity.ai — AI-Powered Sales, Marketing & Growth Platform',
    description:
      'Deploy 54 autonomous AI agents across sales, marketing, content creation, social media, e-commerce, voice, email & SEO. The full-stack AI workforce that grows your business on every channel.',
    keywords: [
      // Sales
      'AI sales platform',
      'autonomous sales agents',
      'AI sales workforce',
      'sales automation software',
      'AI outreach platform',
      // Marketing & Content
      'AI marketing platform',
      'AI content generation',
      'AI content marketing',
      'AI copywriting',
      'AI blog writer',
      // Social Media
      'AI social media management',
      'AI social media posting',
      'automated social media',
      // E-commerce
      'AI e-commerce platform',
      'AI product descriptions',
      // Voice & Email
      'AI voice agent',
      'AI email campaigns',
      'AI email marketing',
      // SEO & Website
      'AI SEO tools',
      'AI website builder',
      'AI landing pages',
      // General
      'revenue automation',
      'GoHighLevel alternative',
      'HubSpot AI alternative',
      'all-in-one AI business platform',
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
  llmsTxt: [
    '# SalesVelocity.ai',
    '',
    '> SalesVelocity.ai is an AI-powered business growth platform that deploys 54 autonomous agents',
    '> across sales, marketing, content creation, social media, e-commerce, website building, voice AI,',
    '> email campaigns, and SEO. It provides businesses with a coordinated AI workforce that manages',
    '> the entire revenue and marketing lifecycle.',
    '',
    '## What SalesVelocity.ai Does',
    '',
    'SalesVelocity.ai replaces the need for multiple point solutions by providing a single platform',
    'with AI agents that work together across every business growth channel:',
    '',
    '### AI Sales Agents',
    '- Autonomous lead qualification and scoring',
    '- AI-powered outreach across email, chat, and voice',
    '- Deal pipeline management and follow-up automation',
    '- Sales coaching and performance optimization',
    '',
    '### AI Marketing & Content',
    '- Blog post and article generation with SEO optimization',
    '- Marketing copy and campaign content creation',
    '- Brand voice consistency across all channels',
    '- Content calendar planning and execution',
    '',
    '### AI Social Media Management',
    '- Multi-platform posting (Twitter/X, LinkedIn, Facebook, Instagram)',
    '- Content scheduling and automated publishing',
    '- Engagement monitoring and response',
    '- Social media strategy and analytics',
    '',
    '### AI Voice Agents',
    '- Inbound and outbound AI phone calls',
    '- Lead qualification via voice',
    '- Appointment scheduling',
    '- Natural conversation with custom personas',
    '',
    '### AI Email Campaigns',
    '- Drip campaign creation and management',
    '- Personalized email sequences',
    '- A/B testing and optimization',
    '- Deliverability monitoring',
    '',
    '### AI SEO',
    '- Keyword research and tracking',
    '- Content optimization for search engines',
    '- Technical SEO auditing',
    '- Competitor analysis',
    '',
    '### AI Website Builder',
    '- Drag-and-drop page builder with AI assistance',
    '- Landing page generation',
    '- Custom domain support',
    '- Mobile-responsive templates',
    '',
    '### E-Commerce',
    '- Product catalog management',
    '- AI-generated product descriptions',
    '- Checkout and payment processing via Stripe',
    '- Order management',
    '',
    '## Platform Architecture',
    '',
    '- 54 autonomous AI agents organized in a hierarchical swarm',
    '- 5 manager agents coordinate specialist teams',
    '- Real-time performance tracking and self-improvement',
    '- Built on Next.js 15, Firebase, and Vercel',
    '',
    '## Key Differentiators',
    '',
    '- **All-in-one**: Replaces GoHighLevel, HubSpot, Salesforce, and multiple point tools',
    '- **Autonomous**: Agents work independently, not just as chatbots',
    '- **Coordinated**: Agents share context and work together across channels',
    '- **Full lifecycle**: From lead generation through closing and post-sale engagement',
    '',
    '## Discovery',
    '',
    '- Sitemap: https://salesvelocity.ai/sitemap.xml',
    '- Robots: https://salesvelocity.ai/robots.txt',
    '',
    '## Contact',
    '',
    'Website: https://salesvelocity.ai',
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
    // Sales
    'AI sales platform',
    'autonomous sales agents',
    'AI sales workforce',
    'sales automation software',
    'AI-powered CRM',
    'AI lead generation',
    'close more deals with AI',
    // Marketing & Content
    'AI marketing platform',
    'AI content generation tool',
    'AI content marketing software',
    'AI copywriting platform',
    'AI blog content writer',
    // Social Media
    'AI social media management tool',
    'AI social media marketing',
    'automated social media posting',
    // E-commerce
    'AI e-commerce platform',
    'AI product description generator',
    // Voice & Email
    'AI voice agent for sales',
    'AI email marketing automation',
    'AI email outreach',
    // SEO & Website
    'AI SEO content generator',
    'AI website builder for business',
    'AI landing page builder',
    // Competitors & General
    'GoHighLevel alternative',
    'HubSpot AI alternative',
    'best all-in-one AI business platform',
    'revenue automation software',
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
  console.log(`  🔑 ${seoTraining.targetKeywords.length} target keywords (sales + marketing + social + e-commerce + voice + SEO)`);

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('');
  console.log('=====================================');
  console.log('✅ SEO System Setup Complete');
  console.log('');
  console.log('What was written:');
  console.log('  1. Brand DNA (org doc + 3 tool training docs)');
  console.log('  2. Website SEO settings (robots OFF, AI bots blocked, llms.txt populated)');
  console.log(`  3. SEO Lab training settings (${seoTraining.targetKeywords.length} keywords, commercial intent)`);
  console.log('');
  console.log('⚠️  Crawlers are OFF. When ready to launch:');
  console.log('    npx tsx scripts/seo-launch.ts');
  console.log('');
}

main().catch((error) => {
  console.error('❌ SEO setup failed:', error);
  process.exit(1);
});
