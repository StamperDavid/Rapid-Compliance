/**
 * Fix SalesVelocity.ai Platform Setup
 *
 * Fills all gaps that cause Jasper to report "setup not complete":
 * 1. Copies base model to org subcollection (health service can't find top-level)
 * 2. Creates business_profile in settings
 * 3. Sets featureVisibility to hide disabled features from health score
 * 4. Ensures org doc has industry fields
 * 5. Populates knowledge base with real documents
 *
 * Usage: npx tsx scripts/fix-platform-setup.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const PLATFORM_ID = 'rapid-compliance-root';
const SEED_USER_ID = 'system-seed';
const now = new Date().toISOString();

// Paths
const orgDoc = `organizations/${PLATFORM_ID}`;
const settingsCol = `${orgDoc}/settings`;
const subCol = (name: string) => `${orgDoc}/${name}`;

// ============================================================================
// FIREBASE INIT
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) { return admin.firestore(); }

  let serviceAccount: admin.ServiceAccount | undefined;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    serviceAccount = JSON.parse(
      raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8')
    ) as admin.ServiceAccount;
  }

  if (!serviceAccount && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'rapid-compliance-65f87',
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    } as admin.ServiceAccount;
  }

  if (!serviceAccount) {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;
      console.log('  Using serviceAccountKey.json');
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'rapid-compliance-65f87';
  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId });
  } else {
    admin.initializeApp({ projectId });
  }

  return admin.firestore();
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n  Fixing SalesVelocity.ai Platform Setup\n');

  const db = initFirebase();

  // ── 1. Ensure org doc has industry fields ────────────────────────────
  console.log('  [1/6] Setting industry fields on org document...');
  await db.doc(orgDoc).set({
    industry: 'saas_technology',
    industryName: 'Technology & SaaS',
    industryCategory: 'technology_saas',
    industryCategoryName: 'Technology & SaaS',
    onboardingComplete: true,
    setupComplete: true,
    brandDNA: {
      companyDescription: 'SalesVelocity.ai is an all-in-one AI-powered business operations platform featuring a coordinated AI agent swarm that handles marketing, sales, content, commerce, reputation management, website building, and competitive intelligence.',
      uniqueValue: 'The only platform with a coordinated AI agent swarm that replaces your entire marketing/sales/ops tool stack.',
      targetAudience: 'Small to mid-size business owners, solopreneurs, and marketing agencies.',
      toneOfVoice: 'professional yet approachable',
      communicationStyle: 'Consultative and results-focused',
      industry: 'SaaS & Technology',
      keyPhrases: [
        'AI-powered business operations',
        'AI agent swarm',
        'all-in-one platform',
        'works 24/7',
        'replace your entire stack',
      ],
      avoidPhrases: ['guaranteed results', 'get rich quick', 'crush the competition'],
      competitors: ['GoHighLevel', 'HubSpot', 'Salesforce'],
      updatedAt: now,
      updatedBy: SEED_USER_ID,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('        Done');

  // ── 2. Write business_profile to settings ────────────────────────────
  console.log('  [2/6] Writing business_profile...');
  await db.doc(`${settingsCol}/business_profile`).set({
    businessModel: 'saas_subscription',
    teamSize: '1-10',
    primaryGoal: 'all_in_one',
    sellsOnline: false,
    usesEmail: true,
    usesSocialMedia: true,
    usesVideo: true,
    needsForms: true,
    completedAt: now,
  });
  console.log('        Done');

  // ── 3. Copy base model to org subcollection ──────────────────────────
  console.log('  [3/6] Ensuring base model exists in org subcollection...');

  // Check if one already exists in the subcollection
  const existingModels = await db.collection(subCol('baseModels')).limit(1).get();
  if (existingModels.empty) {
    // Try to copy from top-level
    const topLevelModel = await db.doc('baseModels/base-model-seed-001').get();
    if (topLevelModel.exists) {
      const modelData = topLevelModel.data();
      await db.doc(`${subCol('baseModels')}/base-model-seed-001`).set({
        ...modelData,
        updatedAt: now,
      });
      console.log('        Copied from top-level baseModels');
    } else {
      // Create a fresh base model
      await db.doc(`${subCol('baseModels')}/base-model-seed-001`).set({
        id: 'base-model-seed-001',
        status: 'draft',
        businessContext: {
          businessName: 'SalesVelocity.ai',
          industry: 'saas_technology',
          targetCustomer: 'Small to mid-size business owners, solopreneurs, and marketing agencies.',
          uniqueValue: 'One platform replaces your entire marketing/sales/ops stack with a coordinated AI swarm.',
        },
        agentPersona: {
          name: 'Jasper',
          tone: 'consultative',
          greeting: "Hey! I'm Jasper, your AI business operations assistant. What can I help you with today?",
          personality: ['knowledgeable', 'proactive', 'enthusiastic', 'results-oriented', 'approachable'],
        },
        behaviorConfig: {
          closingAggressiveness: 6,
          questionFrequency: 4,
          responseLength: 'balanced',
          proactiveLevel: 7,
          idleTimeoutMinutes: 30,
        },
        knowledgeBase: {
          documents: [
            {
              id: 'doc-platform-overview',
              title: 'SalesVelocity.ai Platform Overview',
              content: 'SalesVelocity.ai is an all-in-one AI-powered business operations platform featuring a coordinated AI agent swarm that handles marketing, sales, content, commerce, reputation management, website building, and competitive intelligence.',
              type: 'text',
              addedAt: now,
            },
            {
              id: 'doc-pricing',
              title: 'Pricing Information',
              content: 'SalesVelocity.ai pricing ranges from $97/month to $497/month. All features are included in every plan — tiers are based on usage limits. Annual billing saves 2 months. Free trial available with full access, no credit card required.',
              type: 'text',
              addedAt: now,
            },
          ],
          urls: ['https://salesvelocity.ai'],
          faqs: [
            {
              question: 'What makes SalesVelocity.ai different from GoHighLevel or HubSpot?',
              answer: 'Unlike point solutions, SalesVelocity.ai is a unified AI swarm — not just one tool but dozens of coordinated agents that share intelligence. GoHighLevel requires manual setup for each function; we automate it. HubSpot charges per seat and per feature tier; we include everything.',
            },
          ],
          brandVoice: {
            tone: 'professional yet approachable',
            keyMessages: [
              'AI-powered business operations',
              'All-in-one platform',
              'Works 24/7',
              'Replace your entire stack',
            ],
          },
        },
        systemPrompt: 'You are Jasper, the AI business operations assistant for SalesVelocity.ai.',
        trainingScenarios: [],
        trainingScore: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: SEED_USER_ID,
      });
      console.log('        Created fresh base model in subcollection');
    }
  } else {
    console.log('        Base model already exists in subcollection');
  }

  // ── 4. Update knowledge base with documents ──────────────────────────
  console.log('  [4/6] Updating knowledge base...');
  await db.doc(`${subCol('knowledgeBase')}/current`).set({
    documents: [
      {
        id: 'doc-platform-overview',
        title: 'SalesVelocity.ai Platform Overview',
        content: 'SalesVelocity.ai is an all-in-one AI-powered business operations platform featuring a coordinated AI agent swarm that handles marketing, sales, content, commerce, reputation management, website building, and competitive intelligence. It replaces the entire marketing/sales/ops tool stack.',
        type: 'text',
        addedAt: now,
      },
      {
        id: 'doc-pricing',
        title: 'Pricing & Plans',
        content: 'SalesVelocity.ai pricing: $97/month - $497/month. All features included in every plan. Annual billing saves 2 months free. Free trial with full access, no credit card required.',
        type: 'text',
        addedAt: now,
      },
      {
        id: 'doc-competitors',
        title: 'Competitive Positioning',
        content: 'Key competitors: GoHighLevel (manual setup, less AI), HubSpot (per-seat pricing, feature-gated), Salesforce (enterprise complexity/cost). Our advantage: unified AI swarm that coordinates across all business functions in one platform.',
        type: 'text',
        addedAt: now,
      },
    ],
    urls: ['https://salesvelocity.ai'],
    faqs: [
      {
        question: 'What is SalesVelocity.ai?',
        answer: 'An all-in-one AI-powered platform that replaces your entire marketing, sales, and operations tool stack with a coordinated AI agent swarm.',
      },
      {
        question: 'How much does it cost?',
        answer: '$97-$497/month with all features included. Free trial available.',
      },
    ],
    brandVoice: {
      tone: 'professional yet approachable',
      keyMessages: ['AI-powered business operations', 'All-in-one platform', 'Replace your entire stack'],
      commonPhrases: ['AI agent swarm', 'works 24/7', 'all features included'],
    },
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  console.log('        Done');

  // ── 5. Set featureVisibility for disabled features ───────────────────
  console.log('  [5/6] Setting featureVisibility (hiding disabled features from health score)...');
  await db.doc(`${settingsCol}/featureVisibility`).set({
    visibility: {
      // Hide features we've disabled so they don't count against readiness
      ecommerce: 'hidden',
      product_catalog: 'hidden',
      payments: 'hidden',
    },
    updatedAt: now,
    updatedBy: SEED_USER_ID,
  });
  console.log('        Done (ecommerce, product_catalog, payments hidden)');

  // ── 6. Verify everything ─────────────────────────────────────────────
  console.log('  [6/6] Verifying...');

  const [orgSnap, bpSnap, bmSnap, kbSnap, fvSnap] = await Promise.all([
    db.doc(orgDoc).get(),
    db.doc(`${settingsCol}/business_profile`).get(),
    db.collection(subCol('baseModels')).limit(1).get(),
    db.doc(`${subCol('knowledgeBase')}/current`).get(),
    db.doc(`${settingsCol}/featureVisibility`).get(),
  ]);

  const orgData = orgSnap.data();
  const kbData = kbSnap.data();
  const docsCount = (kbData?.documents as unknown[])?.length ?? 0;

  console.log(`        Org industry:         ${orgData?.industry ?? 'MISSING'}`);
  console.log(`        Org onboardingComplete: ${orgData?.onboardingComplete ?? 'MISSING'}`);
  console.log(`        Org setupComplete:    ${orgData?.setupComplete ?? 'MISSING'}`);
  console.log(`        Org brandDNA:         ${orgData?.brandDNA ? 'Present' : 'MISSING'}`);
  console.log(`        business_profile:     ${bpSnap.exists ? 'OK' : 'MISSING'}`);
  console.log(`        baseModels (subcol):  ${bmSnap.empty ? 'MISSING' : 'OK'}`);
  console.log(`        knowledgeBase docs:   ${docsCount}`);
  console.log(`        featureVisibility:    ${fvSnap.exists ? 'OK' : 'MISSING'}`);

  console.log('\n  Platform setup fixed!\n');
  console.log('  Jasper should now recognize the platform as configured.');
  console.log('  Remaining items that are legitimately not set up:');
  console.log('  - Email/SMTP integration (connect via /settings/integrations)');
  console.log('  - Social media accounts (connect via /settings/integrations)');
  console.log('  - Golden Master deployment (train and deploy via AI Training)\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
