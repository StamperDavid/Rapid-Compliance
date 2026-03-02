/**
 * Migration Script: Agent Training Configs
 *
 * One-time migration to:
 * 1. Add agentType to existing Golden Masters (jasper-v1, sales-agent-v1)
 * 2. Create voice GM from toolTraining/voice
 * 3. Create SEO GM from toolTraining/seo
 * 4. Create email GM (blank template)
 * 5. Bridge existing GoldenPlaybook → social GM
 *
 * Usage: npx tsx scripts/migrate-agent-training-configs.ts
 */

import * as admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// FIREBASE INITIALIZATION (standalone script)
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  // Try to load service account from common locations
  const possiblePaths = [
    resolve(__dirname, '../firebase-service-account.json'),
    resolve(__dirname, '../service-account.json'),
    resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? ''),
  ];

  for (const p of possiblePaths) {
    if (p && existsSync(p)) {
      const serviceAccount = JSON.parse(readFileSync(p, 'utf8')) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      return admin.firestore();
    }
  }

  // Try default credentials (CI/Cloud environments)
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  return admin.firestore();
}

function getSubCollection(sub: string): string {
  return `organizations/${PLATFORM_ID}/${sub}`;
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function tagExistingGoldenMasters(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n--- Step 1: Tagging existing Golden Masters with agentType ---');

  const gmSnap = await db.collection(getSubCollection('goldenMasters')).get();

  if (gmSnap.empty) {
    console.log('No existing Golden Masters found.');
    return;
  }

  const batch = db.batch();
  let taggedCount = 0;

  for (const doc of gmSnap.docs) {
    const data = doc.data();

    // Skip if already tagged
    if (data.agentType) {
      console.log(`  [SKIP] ${doc.id} already has agentType: ${data.agentType}`);
      continue;
    }

    // Heuristic: identify agent type from ID or name
    const id = doc.id.toLowerCase();
    const name = ((data.agentPersona?.name as string) ?? '').toLowerCase();

    let agentType: string | undefined;

    if (id.includes('jasper') || name.includes('jasper') || name.includes('internal')) {
      // Jasper is the internal assistant — treat as chat for now
      agentType = 'chat';
      console.log(`  [TAG] ${doc.id} → chat (Jasper/internal assistant)`);
    } else if (id.includes('sales') || id.includes('alex') || name.includes('sales')) {
      agentType = 'chat';
      console.log(`  [TAG] ${doc.id} → chat (sales agent)`);
    } else {
      // Default to chat for unidentified GMs
      agentType = 'chat';
      console.log(`  [TAG] ${doc.id} → chat (default)`);
    }

    batch.update(doc.ref, { agentType });
    taggedCount++;
  }

  if (taggedCount > 0) {
    await batch.commit();
    console.log(`Tagged ${taggedCount} Golden Masters.`);
  } else {
    console.log('No Golden Masters needed tagging.');
  }
}

async function migrateVoiceConfig(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n--- Step 2: Migrating voice toolTraining → GM ---');

  // Check if voice GM already exists
  const existingSnap = await db
    .collection(getSubCollection('goldenMasters'))
    .where('agentType', '==', 'voice')
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    console.log('  [SKIP] Voice GM already exists:', existingSnap.docs[0].id);
    return;
  }

  const voiceDoc = await db.collection(getSubCollection('toolTraining')).doc('voice').get();

  const gmId = `gm_voice_${Date.now()}`;
  const gm: Record<string, unknown> = {
    id: gmId,
    version: 'v1',
    baseModelId: 'migrated_voice',
    agentType: 'voice',
    businessContext: {
      businessName: 'SalesVelocity.ai',
      industry: 'Technology',
      problemSolved: 'AI-powered sales acceleration',
      uniqueValue: 'Unified AI agent platform',
      targetCustomer: 'Sales teams',
      topProducts: 'AI Sales Platform',
    },
    agentPersona: {
      name: 'Voice Agent',
      tone: 'warm and confident',
      greeting: 'Hi there! Thanks for calling.',
      closingMessage: 'Thank you for your time!',
      objectives: ['Handle calls professionally', 'Qualify leads', 'Schedule appointments'],
      can_negotiate: false,
      escalationRules: ['Escalate when customer requests a human agent'],
    },
    behaviorConfig: {
      closingAggressiveness: 4,
      questionFrequency: 4,
      responseLength: 'concise',
      proactiveLevel: 5,
      idleTimeoutMinutes: 15,
    },
    knowledgeBase: { documents: [], urls: [], faqs: [] },
    systemPrompt: 'You are an AI voice agent for SalesVelocity.ai. Configure through the training lab.',
    trainedScenarios: [],
    trainingCompletedAt: new Date().toISOString(),
    trainingScore: 0,
    isActive: false,
    createdBy: 'migration-script',
    createdAt: new Date().toISOString(),
    notes: 'Migrated from toolTraining/voice',
  };

  if (voiceDoc.exists) {
    const voiceData = voiceDoc.data() as Record<string, unknown>;
    if (typeof voiceData.systemPrompt === 'string') {
      gm.systemPrompt = voiceData.systemPrompt;
    }
    console.log('  [MIGRATE] Incorporated existing voice toolTraining config');
  } else {
    console.log('  [CREATE] No voice toolTraining found, using defaults');
  }

  await db.collection(getSubCollection('goldenMasters')).doc(gmId).set(gm);
  console.log(`  [DONE] Created voice GM: ${gmId}`);
}

async function migrateSeoConfig(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n--- Step 3: Migrating SEO toolTraining → GM ---');

  const existingSnap = await db
    .collection(getSubCollection('goldenMasters'))
    .where('agentType', '==', 'seo')
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    console.log('  [SKIP] SEO GM already exists:', existingSnap.docs[0].id);
    return;
  }

  const seoDoc = await db.collection(getSubCollection('toolTraining')).doc('seo').get();

  const gmId = `gm_seo_${Date.now()}`;
  const gm: Record<string, unknown> = {
    id: gmId,
    version: 'v1',
    baseModelId: 'migrated_seo',
    agentType: 'seo',
    businessContext: {
      businessName: 'SalesVelocity.ai',
      industry: 'Technology',
      problemSolved: 'AI-powered sales acceleration',
      uniqueValue: 'Unified AI agent platform',
      targetCustomer: 'Sales teams',
      topProducts: 'AI Sales Platform',
    },
    agentPersona: {
      name: 'SEO Content Agent',
      tone: 'authoritative and reader-friendly',
      greeting: '',
      closingMessage: '',
      objectives: ['Create SEO-optimized content', 'Match search intent', 'Comprehensive coverage'],
      can_negotiate: false,
      escalationRules: [],
    },
    behaviorConfig: {
      closingAggressiveness: 1,
      questionFrequency: 0,
      responseLength: 'detailed',
      proactiveLevel: 3,
      idleTimeoutMinutes: 120,
    },
    knowledgeBase: { documents: [], urls: [], faqs: [] },
    systemPrompt: 'You are an AI SEO content agent for SalesVelocity.ai. Configure through the training lab.',
    trainedScenarios: [],
    trainingCompletedAt: new Date().toISOString(),
    trainingScore: 0,
    isActive: false,
    createdBy: 'migration-script',
    createdAt: new Date().toISOString(),
    notes: 'Migrated from toolTraining/seo',
  };

  if (seoDoc.exists) {
    const seoData = seoDoc.data() as Record<string, unknown>;
    if (typeof seoData.systemPrompt === 'string') {
      gm.systemPrompt = seoData.systemPrompt;
    }
    console.log('  [MIGRATE] Incorporated existing SEO toolTraining config');
  } else {
    console.log('  [CREATE] No SEO toolTraining found, using defaults');
  }

  await db.collection(getSubCollection('goldenMasters')).doc(gmId).set(gm);
  console.log(`  [DONE] Created SEO GM: ${gmId}`);
}

async function createEmailGM(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n--- Step 4: Creating email GM ---');

  const existingSnap = await db
    .collection(getSubCollection('goldenMasters'))
    .where('agentType', '==', 'email')
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    console.log('  [SKIP] Email GM already exists:', existingSnap.docs[0].id);
    return;
  }

  const gmId = `gm_email_${Date.now()}`;
  const gm: Record<string, unknown> = {
    id: gmId,
    version: 'v1',
    baseModelId: 'initial_email',
    agentType: 'email',
    businessContext: {
      businessName: 'SalesVelocity.ai',
      industry: 'Technology',
      problemSolved: 'AI-powered sales acceleration',
      uniqueValue: 'Unified AI agent platform',
      targetCustomer: 'Sales teams',
      topProducts: 'AI Sales Platform',
    },
    agentPersona: {
      name: 'Email Agent',
      tone: 'professional and personalized',
      greeting: 'Hello',
      closingMessage: 'Best regards',
      objectives: ['Compose personalized outreach emails', 'Follow up appropriately', 'Craft compelling CTAs'],
      can_negotiate: false,
      escalationRules: [],
    },
    behaviorConfig: {
      closingAggressiveness: 3,
      questionFrequency: 2,
      responseLength: 'detailed',
      proactiveLevel: 7,
      idleTimeoutMinutes: 60,
    },
    knowledgeBase: { documents: [], urls: [], faqs: [] },
    systemPrompt: 'You are an AI email agent for SalesVelocity.ai. Configure through the training lab.',
    trainedScenarios: [],
    trainingCompletedAt: new Date().toISOString(),
    trainingScore: 0,
    isActive: false,
    createdBy: 'migration-script',
    createdAt: new Date().toISOString(),
    notes: 'Initial email Golden Master — blank template',
  };

  await db.collection(getSubCollection('goldenMasters')).doc(gmId).set(gm);
  console.log(`  [DONE] Created email GM: ${gmId}`);
}

async function bridgeSocialPlaybook(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n--- Step 5: Bridging GoldenPlaybook → social GM ---');

  const existingSnap = await db
    .collection(getSubCollection('goldenMasters'))
    .where('agentType', '==', 'social')
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    console.log('  [SKIP] Social GM already exists:', existingSnap.docs[0].id);
    return;
  }

  // Look for an existing GoldenPlaybook
  const playbookSnap = await db
    .collection(getSubCollection('goldenPlaybooks'))
    .where('agentType', '==', 'social')
    .limit(1)
    .get();

  const gmId = `gm_social_${Date.now()}`;
  const gm: Record<string, unknown> = {
    id: gmId,
    version: 'v1',
    baseModelId: 'initial_social',
    agentType: 'social',
    businessContext: {
      businessName: 'SalesVelocity.ai',
      industry: 'Technology',
      problemSolved: 'AI-powered sales acceleration',
      uniqueValue: 'Unified AI agent platform',
      targetCustomer: 'Sales teams',
      topProducts: 'AI Sales Platform',
    },
    agentPersona: {
      name: 'Social Media Agent',
      tone: 'engaging and on-brand',
      greeting: '',
      closingMessage: '',
      objectives: ['Create engaging social content', 'Maintain brand voice', 'Drive engagement'],
      can_negotiate: false,
      escalationRules: [],
    },
    behaviorConfig: {
      closingAggressiveness: 2,
      questionFrequency: 1,
      responseLength: 'concise',
      proactiveLevel: 8,
      idleTimeoutMinutes: 60,
    },
    knowledgeBase: { documents: [], urls: [], faqs: [] },
    systemPrompt: 'You are an AI social media agent for SalesVelocity.ai. Configure through the training lab.',
    trainedScenarios: [],
    trainingCompletedAt: new Date().toISOString(),
    trainingScore: 0,
    isActive: false,
    createdBy: 'migration-script',
    createdAt: new Date().toISOString(),
    notes: 'Initial social Golden Master',
  };

  if (!playbookSnap.empty) {
    const playbook = playbookSnap.docs[0].data();
    console.log('  [BRIDGE] Found GoldenPlaybook, incorporating data');

    // Merge brand voice DNA
    if (playbook.brandVoiceDNA) {
      const voice = playbook.brandVoiceDNA as Record<string, unknown>;
      (gm.agentPersona as Record<string, unknown>).tone = voice.tone ?? 'engaging and on-brand';
      gm.knowledgeBase = {
        documents: [],
        urls: [],
        faqs: [],
        brandVoice: {
          tone: voice.tone ?? 'engaging',
          keyMessages: voice.keyMessages ?? [],
          commonPhrases: voice.commonPhrases ?? [],
        },
      };
    }

    // Merge compiled prompt
    if (typeof playbook.compiledPrompt === 'string') {
      gm.systemPrompt = playbook.compiledPrompt;
    }

    // Merge training data
    gm.trainingScore = playbook.trainingScore ?? 0;
    gm.trainedScenarios = playbook.trainedScenarios ?? [];
    gm.notes = `Bridged from GoldenPlaybook ${playbookSnap.docs[0].id}`;
  } else {
    console.log('  [CREATE] No GoldenPlaybook found, using defaults');
  }

  await db.collection(getSubCollection('goldenMasters')).doc(gmId).set(gm);
  console.log(`  [DONE] Created social GM: ${gmId}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('=== Agent Training Config Migration ===');
  console.log(`Platform: ${PLATFORM_ID}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const db = initFirebase();

  await tagExistingGoldenMasters(db);
  await migrateVoiceConfig(db);
  await migrateSeoConfig(db);
  await createEmailGM(db);
  await bridgeSocialPlaybook(db);

  console.log('\n=== Migration Complete ===');
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
