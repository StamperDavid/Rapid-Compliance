/**
 * Seed Jasper Orchestrator Golden Master (with Brand DNA baked in at seed time).
 *
 * Jasper is the user-facing chat orchestrator at /api/orchestrator/chat. Unlike
 * the 34 specialists, Jasper's GM lives in the Training Lab `goldenMasters`
 * collection under `agentType: 'orchestrator'` — NOT in
 * `specialistGoldenMasters`. This script creates or force-overwrites
 * `gm_orchestrator_v1` with:
 *   1. Layer 1: JASPER_THOUGHT_PARTNER_PROMPT  (from jasper-thought-partner.ts)
 *   2. Layer 2: ADMIN_ORCHESTRATOR_PROMPT       (from feature-manifest.ts)
 *   3. Layer 3: Brand DNA block (baked in per the standing rule)
 *
 * Runtime: the chat route (/api/orchestrator/chat) reads this GM via
 * getActiveJasperGoldenMaster(). Brand DNA is baked in here — no runtime merge.
 *
 * Usage: npx tsx scripts/seed-jasper-orchestrator-gm.ts [--force]
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { JASPER_THOUGHT_PARTNER_PROMPT } from '../src/lib/orchestrator/jasper-thought-partner';
import { ADMIN_ORCHESTRATOR_PROMPT } from '../src/lib/orchestrator/feature-manifest';

interface BrandDNA {
  companyDescription: string;
  uniqueValue?: string;
  targetAudience: string;
  toneOfVoice: string;
  communicationStyle?: string;
  industry: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
  competitors?: string[];
}

const PLATFORM_ID = 'rapid-compliance-root';
const GM_ID = 'gm_orchestrator_v1';
const COLLECTION = `organizations/${PLATFORM_ID}/goldenMasters`;

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) {
      const [, key, rawValue] = match;
      const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[key]) { process.env[key] = value; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(sakPath)) {
      const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      throw new Error('Missing FIREBASE_ADMIN_* env vars and no serviceAccountKey.json');
    }
  }
}

async function fetchBrandDNA(db: admin.firestore.Firestore): Promise<BrandDNA> {
  const orgDoc = await db.collection('organizations').doc(PLATFORM_ID).get();
  if (!orgDoc.exists) {
    throw new Error(`Org doc organizations/${PLATFORM_ID} not found`);
  }
  const data = orgDoc.data();
  if (!data?.brandDNA) {
    throw new Error('Brand DNA not configured — visit /settings/ai-agents/business-setup');
  }
  const brandDNA = data.brandDNA as BrandDNA;
  const missing: string[] = [];
  if (!brandDNA.companyDescription) { missing.push('companyDescription'); }
  if (!brandDNA.industry) { missing.push('industry'); }
  if (!brandDNA.toneOfVoice) { missing.push('toneOfVoice'); }
  if (!brandDNA.targetAudience) { missing.push('targetAudience'); }
  if (missing.length > 0) {
    throw new Error(`Brand DNA missing required fields: ${missing.join(', ')}`);
  }
  return brandDNA;
}

function buildBrandDNABlock(brandDNA: BrandDNA): string {
  const keyPhrases = brandDNA.keyPhrases && brandDNA.keyPhrases.length > 0
    ? brandDNA.keyPhrases.join(', ')
    : '(none configured)';
  const avoidPhrases = brandDNA.avoidPhrases && brandDNA.avoidPhrases.length > 0
    ? brandDNA.avoidPhrases.join(', ')
    : '(none configured)';
  const competitors = brandDNA.competitors && brandDNA.competitors.length > 0
    ? brandDNA.competitors.join(', ')
    : '(none configured)';

  return [
    '',
    '## Brand DNA (baked into the Golden Master at seed time — this is the tenant-specific identity that defines who you are and who you work for)',
    '',
    `Company: ${brandDNA.companyDescription}`,
    `Unique value: ${brandDNA.uniqueValue ?? '(not set)'}`,
    `Target audience: ${brandDNA.targetAudience}`,
    `Tone of voice: ${brandDNA.toneOfVoice}`,
    `Communication style: ${brandDNA.communicationStyle ?? '(not set)'}`,
    `Industry: ${brandDNA.industry}`,
    `Key phrases to weave in naturally when appropriate: ${keyPhrases}`,
    `Phrases you are forbidden from using: ${avoidPhrases}`,
    `Competitors (never name them unless specifically asked): ${competitors}`,
  ].join('\n');
}

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();
  const force = process.argv.includes('--force');

  // Check if a Jasper GM already exists
  const existing = await db
    .collection(COLLECTION)
    .where('agentType', '==', 'orchestrator')
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty && !force) {
    const doc = existing.docs[0];
    const data = doc.data();
    const promptLen = typeof data.systemPrompt === 'string' ? data.systemPrompt.length : 0;
    console.log(`Active Jasper GM exists: ${doc.id} (promptLen=${promptLen})`);
    if (promptLen === 0) {
      console.log('WARNING: existing GM has empty systemPrompt — you should probably run with --force to fix it.');
    }
    console.log('Skipping. Pass --force to overwrite.');
    process.exit(0);
  }

  // Deactivate existing GM(s) if force
  if (force && !existing.empty) {
    const batch = db.batch();
    const now = new Date().toISOString();
    for (const doc of existing.docs) {
      batch.update(doc.ref, {
        isActive: false,
        deactivatedAt: now,
        deactivatedReason: 'superseded by --force reseed with Brand DNA baked in',
      });
    }
    await batch.commit();
    console.log(`  deactivated ${existing.docs.length} existing Jasper GM doc(s)`);
  }

  // Fetch Brand DNA and build the unified prompt
  const brandDNA = await fetchBrandDNA(db);

  const industryPrompt = [
    '# Layer 1: Thought Partner Sovereignty',
    JASPER_THOUGHT_PARTNER_PROMPT,
    '',
    '# Layer 2: Admin Orchestrator Directive',
    ADMIN_ORCHESTRATOR_PROMPT,
  ].join('\n');

  const brandBlock = buildBrandDNABlock(brandDNA);
  const resolvedSystemPrompt = `${industryPrompt}\n${brandBlock}`;

  const now = new Date().toISOString();

  // Write the Jasper GM. Keep the Training Lab-style shape (agentPersona,
  // behaviorConfig, knowledgeBase) so the existing getActiveJasperGoldenMaster
  // loader and Training Lab UI keep working. Only systemPrompt changes.
  const doc = {
    id: GM_ID,
    version: 'v1',
    baseModelId: 'system_seed',
    agentType: 'orchestrator',
    agentPersona: {
      name: 'Jasper',
      tone: 'direct, strategic, and confident',
      greeting: 'Hey! What are we working on?',
      closingMessage: 'On it.',
      objectives: [
        'Delegate all work to agent teams immediately — never execute tasks directly',
        'Report tool results with clickable review links after every delegation',
        'Surface the highest-ROI action based on verified platform data',
        'Never hallucinate — call tools first, speak from results',
        'Guide the owner through the full platform as a trusted business partner',
      ],
      can_negotiate: false,
      escalationRules: [
        'Escalate to human when a tool returns a fatal error not actionable by the owner',
        'Never auto-retry a paid API call without user acknowledgment',
      ],
    },
    behaviorConfig: {
      closingAggressiveness: 0,
      questionFrequency: 2,
      responseLength: 'balanced',
      proactiveLevel: 9,
      idleTimeoutMinutes: 60,
    },
    knowledgeBase: {
      documents: [],
      urls: [],
      faqs: [],
    },
    systemPrompt: resolvedSystemPrompt,
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    trainedScenarios: [],
    trainingCompletedAt: now,
    trainingScore: 100,
    isActive: true,
    deployedAt: now,
    createdBy: 'seed-jasper-orchestrator-gm.ts (Brand DNA baked in)',
    createdAt: now,
    notes: 'Jasper orchestrator GM — Layer 1 (Thought Partner) + Layer 2 (Admin Orchestrator Directive) + Brand DNA baked in at seed time. Runtime chat route reads this GM via getActiveJasperGoldenMaster() and no longer merges Brand DNA at runtime.',
  };

  await db.collection(COLLECTION).doc(GM_ID).set(doc);

  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Layer 1 length: ${JASPER_THOUGHT_PARTNER_PROMPT.length} chars`);
  console.log(`  Layer 2 length: ${ADMIN_ORCHESTRATOR_PROMPT.length} chars`);
  console.log(`  Industry prompt (Layer 1+2) length: ${industryPrompt.length} chars`);
  console.log(`  Resolved prompt length: ${resolvedSystemPrompt.length} chars (industry + Brand DNA)`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
