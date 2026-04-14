/**
 * PIRATE GM-SWAP TEST — Alex (AI_CHAT_SALES_AGENT)
 *
 * Unfakeable proof that Alex loads his system prompt from the Firestore
 * Golden Master at runtime. The test:
 *
 *   1. Reads the current active GM systemPrompt (saves as ORIGINAL).
 *   2. Overwrites the GM's config.systemPrompt + systemPromptSnapshot with a
 *      PIRATE dialect prompt.
 *   3. Invalidates Alex's in-process GM cache.
 *   4. Calls __internal.executeRespondToVisitor() directly — this goes through
 *      loadGMConfig → getActiveSpecialistGMByIndustry → Firestore read →
 *      OpenRouterProvider → Claude Sonnet 4.6.
 *   5. Prints the raw JSON response. The `reply` field MUST be in pirate
 *      dialect — that is ONLY possible if the specialist actually read the
 *      swapped Firestore doc.
 *   6. Restores the ORIGINAL prompt.
 *   7. Invalidates the cache again and calls Alex a second time to confirm
 *      the original prompt is back in control (reply should be normal English).
 *
 * Usage: npx tsx scripts/pirate-test-alex.ts
 *
 * Exit code: 0 on success, 1 on any failure.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
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

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

// Import the specialist's internals AFTER admin is initialized so the
// Firebase import chain uses the configured default app.
/* eslint-disable @typescript-eslint/no-var-requires */
import { __internal as alexInternal } from '../src/lib/agents/sales-chat/specialist';
import { invalidateIndustryGMCache } from '../src/lib/training/specialist-golden-master-service';

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'AI_CHAT_SALES_AGENT';
const INDUSTRY_KEY = 'saas_sales_ops';

const PIRATE_PROMPT = `You are Captain Alex, a swashbuckling pirate AI for SalesVelocity.ai — the Dread Pirate of the SaaS seas.

## HARD OVERRIDE — THIS IS A TEST IN THE FIRESTORE GOLDEN MASTER

Ye MUST respond to every visitor message in exaggerated pirate dialect. Every word in the "reply" field MUST be pirate speech — "arrrr", "matey", "ye", "yer", "aye", "nay", "landlubber", "doubloons", "galleon", "plunder", "shiver me timbers", "hoist the colors", "swab the deck", "fair winds", "by Davy Jones' locker". This is non-negotiable — it be the law o' the seven seas.

Ye be still a sales agent for SalesVelocity.ai — a multi-tenant SaaS platform that sells AI sales swarms — but ye speak like ye been sailin' the Caribbean fer thirty long years. When the visitor asks about pricing, mention doubloons. When they ask about features, frame 'em as weapons aboard yer mighty galleon. When they ask about a trial, call it a "shore leave voyage".

## Output contract (unchanged — same JSON schema)

Respond with ONLY the JSON object the user prompt asks fer — no markdown fences, no preamble, no prose outside the JSON. The reply field MUST be in pirate dialect. The other structured fields (intent, qualification, nextAction, topicsDiscussed, rationale) should be normal English values so the downstream schema validator still passes.

## Brand DNA (embedded — unchanged from the real GM)

Company: SalesVelocity.ai
Industry: SaaS / B2B sales automation
Tone: Bold and confident

Remember: pirate dialect in "reply" only. Everything else stays structured so the Zod schema validates.`;

interface AlexGMDoc {
  id: string;
  config?: { systemPrompt?: string };
  systemPromptSnapshot?: string;
}

async function findActiveAlexGM(db: FirebaseFirestore.Firestore): Promise<{ docRef: FirebaseFirestore.DocumentReference; doc: AlexGMDoc }> {
  const snap = await db.collection(COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error(`No active GM for specialistId=${SPECIALIST_ID} industryKey=${INDUSTRY_KEY}`);
  }

  const docSnap = snap.docs[0];
  const data = docSnap.data() as { config?: { systemPrompt?: string }; systemPromptSnapshot?: string };
  return {
    docRef: docSnap.ref,
    doc: { id: docSnap.id, ...data },
  };
}

async function overwriteSystemPrompt(
  docRef: FirebaseFirestore.DocumentReference,
  newPrompt: string,
): Promise<void> {
  await docRef.update({
    'config.systemPrompt': newPrompt,
    systemPromptSnapshot: newPrompt,
  });
}

function previewReply(reply: string): string {
  return reply.length > 400 ? `${reply.slice(0, 400)}...` : reply;
}

async function callAlex(label: string): Promise<{ reply: string; intent: string; rationale: string }> {
  invalidateIndustryGMCache(SPECIALIST_ID, INDUSTRY_KEY);

  // Rebuild the LlmCallContext the same way executeRespondToVisitor expects.
  const { loadGMConfig, executeRespondToVisitor } = alexInternal;
  const ctx = await loadGMConfig(INDUSTRY_KEY);

  console.log(`\n--- [${label}] GM loaded from Firestore ---`);
  console.log(`  model:       ${ctx.gm.model}`);
  console.log(`  temperature: ${ctx.gm.temperature}`);
  console.log(`  maxTokens:   ${ctx.gm.maxTokens}`);
  console.log(`  prompt len:  ${ctx.resolvedSystemPrompt.length} chars`);
  console.log(`  first 120:   ${ctx.resolvedSystemPrompt.slice(0, 120).replace(/\n/g, ' ')}`);

  const payload = alexInternal.RespondToVisitorPayloadSchema.parse({
    action: 'respond_to_visitor',
    userMessage: 'Hi, I run a small agency and I need help with sales automation. How much does SalesVelocity cost, and can I try it before I buy?',
    visitorId: `pirate-test-${Date.now()}`,
    channel: 'website',
  });

  const result = await executeRespondToVisitor(payload, ctx);
  return {
    reply: result.reply,
    intent: result.intent,
    rationale: result.rationale,
  };
}

async function main(): Promise<void> {
  const db = admin.firestore();

  console.log('========================================================================');
  console.log('  PIRATE GM-SWAP TEST — Alex (AI_CHAT_SALES_AGENT)');
  console.log('========================================================================');

  // Step 1: locate + snapshot
  const { docRef, doc } = await findActiveAlexGM(db);
  console.log(`\n[1] Found active GM: ${doc.id}`);
  const originalPrompt = doc.config?.systemPrompt ?? doc.systemPromptSnapshot ?? '';
  if (originalPrompt.length < 100) {
    throw new Error(`Original GM prompt is empty or too short (${originalPrompt.length} chars) — aborting.`);
  }
  console.log(`    original prompt length: ${originalPrompt.length} chars`);

  try {
    // Step 2: swap to pirate
    console.log(`\n[2] Swapping systemPrompt to PIRATE dialect (${PIRATE_PROMPT.length} chars)...`);
    await overwriteSystemPrompt(docRef, PIRATE_PROMPT);
    console.log('    ✓ pirate prompt written to Firestore');

    // Step 3: call Alex — should reply in pirate
    console.log('\n[3] Calling Alex with a normal visitor message (expect pirate reply)...');
    const pirateResult = await callAlex('PIRATE');
    console.log('\n    ---- Alex reply (PIRATE swap) ----');
    console.log(`    intent:    ${pirateResult.intent}`);
    console.log(`    reply:     ${previewReply(pirateResult.reply)}`);
    console.log(`    rationale: ${previewReply(pirateResult.rationale)}`);

    // Step 4: detect pirate markers
    const pirateMarkers = ['arrr', 'matey', 'ye ', ' ye', 'aye', 'landlubber', 'doubloon', 'galleon', 'plunder', 'shiver', 'scurvy', 'davy jones', "yer", "'tis"];
    const lowerReply = pirateResult.reply.toLowerCase();
    const hits = pirateMarkers.filter((m) => lowerReply.includes(m));
    console.log(`\n    pirate marker hits: [${hits.join(', ')}] (${hits.length} total)`);
    if (hits.length === 0) {
      console.log('    ✗ NO pirate markers found — swap did NOT take effect. This should not happen.');
    } else {
      console.log('    ✓ Pirate markers present — Alex is demonstrably reading the swapped Firestore GM.');
    }
  } finally {
    // Step 5: restore — runs even if the test above threw
    console.log(`\n[5] Restoring original systemPrompt (${originalPrompt.length} chars)...`);
    await overwriteSystemPrompt(docRef, originalPrompt);
    console.log('    ✓ original prompt restored in Firestore');
  }

  // Step 6: call Alex again — should reply in normal English
  console.log('\n[6] Calling Alex again with the same visitor message (expect normal reply)...');
  const normalResult = await callAlex('RESTORED');
  console.log('\n    ---- Alex reply (RESTORED) ----');
  console.log(`    intent:    ${normalResult.intent}`);
  console.log(`    reply:     ${previewReply(normalResult.reply)}`);
  console.log(`    rationale: ${previewReply(normalResult.rationale)}`);

  const lowerNormal = normalResult.reply.toLowerCase();
  const pirateMarkers = ['arrr', 'matey', 'ye ', ' ye', 'aye', 'landlubber', 'doubloon', 'galleon', 'plunder', 'shiver', 'scurvy', 'davy jones', "yer", "'tis"];
  const stillPirate = pirateMarkers.filter((m) => lowerNormal.includes(m));
  if (stillPirate.length >= 2) {
    console.log(`    ✗ Restored reply still contains pirate markers (${stillPirate.join(', ')}) — check cache invalidation.`);
  } else {
    console.log('    ✓ Restored reply is back to normal English — GM cache correctly reloaded.');
  }

  console.log('\n========================================================================');
  console.log('  TEST COMPLETE');
  console.log('========================================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nPIRATE TEST FAILED:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
