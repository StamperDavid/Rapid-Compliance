/**
 * Seed SalesVelocity.ai Onboarding Data
 *
 * One-time script to populate the platform's own onboarding data so Jasper
 * and the AI training pipeline have real business context to work with.
 *
 * Usage: npx tsx scripts/seed-onboarding.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const SEED_USER_ID = 'system-seed';

// Environment-aware prefix (dev = test_, production = no prefix)
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development';
const IS_PRODUCTION = APP_ENV === 'production';
const PREFIX = IS_PRODUCTION ? '' : 'test_';

// Path builders
const orgDoc = `${PREFIX}organizations/${PLATFORM_ID}`;
const subCol = (name: string) => `${orgDoc}/${PREFIX}${name}`;

// ============================================================================
// INITIALIZE FIREBASE ADMIN
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  let serviceAccount: admin.ServiceAccount | undefined;

  // Strategy 1: FIREBASE_SERVICE_ACCOUNT_KEY env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    if (raw.startsWith('{')) {
      serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    } else {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded) as admin.ServiceAccount;
    }
  }

  // Strategy 2: Individual env vars
  if (!serviceAccount && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID
        ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        ?? 'rapid-compliance-65f87',
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    } as admin.ServiceAccount;
  }

  // Strategy 3: serviceAccountKey.json
  if (!serviceAccount) {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;
      console.log('  Using serviceAccountKey.json');
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ?? process.env.FIREBASE_PROJECT_ID
    ?? 'rapid-compliance-65f87';

  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId });
  } else {
    console.warn('  No Firebase credentials found, using project ID only');
    admin.initializeApp({ projectId });
  }

  return admin.firestore();
}

// ============================================================================
// ONBOARDING DATA
// ============================================================================

const onboardingData = {
  // Business Basics
  businessName: 'SalesVelocity.ai',
  industry: 'saas_technology',
  website: 'https://salesvelocity.ai',

  // Value Proposition
  problemSolved:
    'Small and mid-size businesses waste time and money juggling 10+ disconnected tools for marketing, sales, CRM, content, reputation, and website management. They lack the AI expertise and budget to compete with enterprises that have dedicated teams for each function.',
  uniqueValue:
    'One platform replaces your entire marketing/sales/ops stack with a 52-agent AI swarm that works 24/7 — marketing, sales, content, commerce, reputation, website building, and competitive intelligence, all coordinated by a single AI orchestrator (Jasper).',
  targetCustomer:
    'Small to mid-size business owners, solopreneurs, and marketing agencies who want enterprise-level AI-powered business operations without enterprise-level complexity or cost.',

  // Products & Services
  topProducts:
    'Full AI business operations platform including: AI Agent Swarm (52 agents), CRM & Sales Pipeline, Marketing Automation (social media, SEO, email, SMS), E-Commerce (Stripe payments, catalog, pricing), AI Website Builder, Reputation Management (reviews, GMB), Content Production (copy, video, blog), Competitive Intelligence (scraping, research, trends), Voice AI, and Mission Control dashboard.',

  // Pricing
  priceRange: '$97/month - $497/month',
  discountPolicy: 'Annual billing discount (2 months free). Launch pricing for early adopters.',

  // Sales Process
  typicalSalesFlow:
    'Free trial signup → onboarding wizard → AI agent training → guided tour of capabilities → conversion to paid plan. Self-serve with optional demo calls for enterprise.',

  // Discovery
  discoveryQuestions:
    'What tools are you currently using for marketing and sales? How many hours per week do you spend on social media, email campaigns, and content creation? What\'s your biggest bottleneck in converting leads to customers? Have you tried AI tools before — what worked and what didn\'t?',

  // Objections
  commonObjections:
    '"It seems too good to be true — one platform can\'t replace all my tools." "I\'m not technical enough to set up AI agents." "How is this different from HubSpot/GoHighLevel?" "What happens to my data if I cancel?"',
  priceObjections:
    'The platform replaces $500-2000/month in separate tool subscriptions. ROI is typically positive within the first month through time savings alone.',

  // Competitors
  competitors: ['GoHighLevel', 'HubSpot', 'Salesforce', 'Jasper AI', 'Copy.ai', 'Hootsuite', 'Mailchimp'],
  competitiveAdvantages:
    'Unlike point solutions, SalesVelocity.ai is a unified AI swarm — not just one tool but 52 coordinated agents that share intelligence. GoHighLevel requires manual setup for each function; we automate it. HubSpot charges per seat and per feature tier; we include everything. No other platform combines CRM + AI content + social + voice + website builder + reputation + commerce in a single coordinated system.',

  // Agent Identity
  agentName: 'Jasper',
  communicationStyle: 'consultative',
  greetingMessage:
    "Hey! I'm Jasper, your AI business operations assistant. I coordinate a team of 52 specialized AI agents to handle your marketing, sales, content, and more. What can I help you with today?",
  closingMessage:
    "Great talking with you! Remember, I'm here 24/7 whenever you need help with marketing, sales, content, or anything else. Just ping me anytime.",
  personalityTraits: ['knowledgeable', 'proactive', 'enthusiastic', 'results-oriented', 'approachable'],

  // Behavior
  closingStyle: 6,
  discoveryDepth: 4,
  responseLength: 'balanced' as const,
  proactivityLevel: 7,

  // Escalation
  escalationRules: [
    'Customer requests human support',
    'Billing dispute over $500',
    'Legal or compliance questions',
    'Customer expresses strong dissatisfaction after 2+ attempts to resolve',
    'Technical issue requiring backend access',
  ],

  // Agent Rules
  agentRules: {
    prohibitedBehaviors: [
      'Never disparage competitors by name — focus on our strengths',
      'Never make guarantees about specific revenue outcomes',
      'Never share internal pricing logic or cost structure',
    ],
    mustAlwaysMention: [
      'Free trial available',
      'All features included in every plan',
      '24/7 AI support',
    ],
    neverMention: [
      'Internal development status',
      'Unreleased features',
      'Specific customer data from other accounts',
    ],
  },

  // Metadata
  completedAt: new Date().toISOString(),
  completedBy: SEED_USER_ID,
  version: '1.0',
};

// ============================================================================
// BRAND DNA
// ============================================================================

const brandDNA = {
  companyDescription:
    'SalesVelocity.ai is an all-in-one AI-powered business operations platform featuring a 52-agent AI swarm that handles marketing, sales, content, commerce, reputation management, website building, and competitive intelligence.',
  uniqueValue:
    'The only platform with a coordinated 52-agent AI swarm that replaces your entire marketing/sales/ops tool stack.',
  targetAudience: 'Small to mid-size business owners, solopreneurs, and marketing agencies.',
  toneOfVoice: 'professional yet approachable',
  communicationStyle: 'Consultative and results-focused',
  industry: 'SaaS & Technology',
  keyPhrases: [
    'AI-powered business operations',
    '52-agent AI swarm',
    'all-in-one platform',
    'works 24/7',
    'replace your entire stack',
  ],
  avoidPhrases: ['guaranteed results', 'get rich quick', 'crush the competition'],
  competitors: ['GoHighLevel', 'HubSpot', 'Salesforce'],
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedBy: SEED_USER_ID,
};

// ============================================================================
// BUSINESS SETUP PAGE DATA (onboardingData field on org doc)
// ============================================================================

const businessSetupData = {
  businessBasics: {
    businessName: 'SalesVelocity.ai',
    industry: 'saas_technology',
    website: 'https://salesvelocity.ai',
    companySize: '1-10',
  },
  businessUnderstanding: {
    problemSolved: onboardingData.problemSolved,
    uniqueValue: onboardingData.uniqueValue,
    whyBuy:
      'Businesses buy SalesVelocity.ai to consolidate their entire marketing, sales, and operations stack into one AI-powered platform — saving $500-2000/month in separate tools and dozens of hours per week.',
    whyNotBuy:
      'Some prospects hesitate because it sounds too comprehensive to be real, they worry about the learning curve, or they\'re locked into long-term contracts with existing tools.',
  },
  productsServices: {
    primaryOffering: 'AI-powered all-in-one business operations platform',
    priceRange: '$97/month - $497/month',
    targetCustomer: onboardingData.targetCustomer,
    customerDemographics: 'SMB owners (25-55), marketing agencies, solopreneurs, tech-savvy professionals',
  },
  productDetails: {
    topProducts: onboardingData.topProducts,
  },
  pricingSales: {
    pricingStrategy: 'Tiered SaaS subscription — all features included in every plan, tiers based on usage limits.',
    discountPolicy: onboardingData.discountPolicy,
    firstTimeBuyerIncentive: 'Free trial with full access to all features. No credit card required to start.',
  },
  agentGoals: {
    primaryObjective: 'Convert free trial users to paid subscribers by demonstrating clear ROI within the trial period.',
    successMetrics: 'Trial-to-paid conversion rate, time-to-value, customer satisfaction score, monthly recurring revenue.',
    escalationRules: onboardingData.escalationRules,
  },
  agentPersonality: {
    tone: 'Professional yet approachable',
    formalityLevel: 4,
    useOfHumor: 'Subtle — friendly and warm, but not jokey',
    empathyLevel: 7,
  },
};

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n🚀 Seeding SalesVelocity.ai Onboarding Data\n');
  console.log(`  Environment: ${APP_ENV}`);
  console.log(`  Prefix: "${PREFIX}"`);
  console.log(`  Org doc: ${orgDoc}\n`);

  const db = initFirebase();

  // 1. Write onboarding data to onboarding/current subcollection
  console.log('  [1/4] Writing onboarding data to onboarding/current...');
  await db.doc(`${subCol('onboarding')}/current`).set(onboardingData);
  console.log('        ✅ Done');

  // 2. Write business setup data + brand DNA to org document
  console.log('  [2/4] Writing business setup data + brand DNA to org document...');
  await db.doc(orgDoc).set(
    {
      onboardingData: businessSetupData,
      brandDNA,
      onboardingComplete: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('        ✅ Done');

  // 3. Run the onboarding processor to build persona, knowledge base, and base model
  console.log('  [3/4] Running onboarding processor (persona → knowledge → base model)...');
  try {
    // We need to set up the environment for the Next.js imports to work
    // Since we're running outside Next.js, we call Admin SDK directly instead
    // of importing processOnboarding which depends on Next.js module resolution.

    const { buildPersonaFromOnboarding } = await import('../src/lib/agent/persona-builder');

    const persona = buildPersonaFromOnboarding(onboardingData);

    // Save persona
    await db.doc(`${subCol('agentPersona')}/current`).set({
      ...persona,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log('        ✅ Persona saved');

    // Save knowledge base (empty but structured — will be populated via URL scraping later)
    const knowledgeBase = {
      documents: [],
      urls: [],
      faqs: [],
      brandVoice: {
        tone: 'professional yet approachable',
        keyMessages: brandDNA.keyPhrases,
        commonPhrases: [
          'AI-powered business operations',
          '52-agent AI swarm',
          'replace your entire stack',
        ],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.doc(`${subCol('knowledgeBase')}/current`).set(knowledgeBase);
    console.log('        ✅ Knowledge base saved');

    // Save base model
    const now = new Date().toISOString();
    const baseModel = {
      id: 'base-model-seed-001',
      status: 'draft',
      businessContext: onboardingData,
      agentPersona: persona,
      behaviorConfig: {
        closingAggressiveness: onboardingData.closingStyle,
        questionFrequency: onboardingData.discoveryDepth,
        responseLength: onboardingData.responseLength,
        proactiveLevel: onboardingData.proactivityLevel,
        idleTimeoutMinutes: 30,
      },
      knowledgeBase,
      systemPrompt: buildSystemPrompt(persona),
      trainingScenarios: [],
      trainingScore: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: SEED_USER_ID,
      notes: 'Auto-generated from seed-onboarding.ts',
    };
    await db.doc(`${subCol('baseModels')}/base-model-seed-001`).set(baseModel);
    console.log('        ✅ Base model saved');
  } catch (error) {
    console.error('        ❌ Processor error (non-fatal):', error);
    console.log('        Onboarding data is still written — processor can be re-run from the UI.');
  }

  // 4. Verify
  console.log('  [4/4] Verifying...');
  const orgSnap = await db.doc(orgDoc).get();
  const orgData = orgSnap.data();
  const hasOnboarding = !!orgData?.onboardingData;
  const hasBrandDNA = !!orgData?.brandDNA;
  const personaSnap = await db.doc(`${subCol('agentPersona')}/current`).get();
  const kbSnap = await db.doc(`${subCol('knowledgeBase')}/current`).get();

  console.log(`        onboardingData on org doc: ${hasOnboarding ? '✅' : '❌'}`);
  console.log(`        brandDNA on org doc: ${hasBrandDNA ? '✅' : '❌'}`);
  console.log(`        agentPersona/current: ${personaSnap.exists ? '✅' : '❌'}`);
  console.log(`        knowledgeBase/current: ${kbSnap.exists ? '✅' : '❌'}`);

  console.log('\n✅ Onboarding seed complete!\n');
  console.log('  Next steps:');
  console.log('  1. Visit /settings/ai-agents/business-setup — all 6 sections should be populated');
  console.log('  2. Visit /settings/brand-dna — Brand DNA fields should be filled');
  console.log('  3. Jasper now has business context for AI conversations\n');

  process.exit(0);
}

// ============================================================================
// HELPERS
// ============================================================================

function buildSystemPrompt(persona: Record<string, unknown>): string {
  const name = (persona.name as string) || 'Jasper';
  const tone = (persona.tone as string) || 'consultative';
  const greeting = (persona.greeting as string) || '';

  return `You are ${name}, the AI business operations assistant for SalesVelocity.ai.

## ROLE
You coordinate a team of 52 specialized AI agents to handle marketing, sales, content, commerce, reputation management, website building, and competitive intelligence.

## TONE
${tone} — professional yet approachable, results-focused, and proactive.

## GREETING
${greeting}

## BUSINESS CONTEXT
SalesVelocity.ai is an all-in-one AI-powered business operations platform. We replace the entire marketing/sales/ops tool stack with a coordinated AI swarm.

Target customers: Small to mid-size business owners, solopreneurs, and marketing agencies.
Pricing: $97/month - $497/month (all features included in every plan).

## RULES
- Always mention: Free trial available, all features included, 24/7 AI support
- Never mention: Internal development status, unreleased features, other customers' data
- Never disparage competitors by name — focus on our strengths
- Never guarantee specific revenue outcomes
`;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
