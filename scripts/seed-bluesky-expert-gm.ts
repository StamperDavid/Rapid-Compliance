/**
 * Seed Bluesky Expert Golden Master v1 (saas_sales_ops industry).
 *
 * Brand DNA is baked into the systemPrompt at seed time per Standing
 * Rule #1 (no runtime merging — the specialist code reads
 * `gm.config.systemPrompt` verbatim).
 *
 * Idempotent: skips if an active doc exists for (specialistId,
 * industryKey). Pass --force to overwrite.
 *
 * Usage:
 *   npx tsx scripts/seed-bluesky-expert-gm.ts
 *   npx tsx scripts/seed-bluesky-expert-gm.ts --force
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require(path.resolve(process.cwd(), 'scripts/lib/brand-dna-helper.js')) as {
  fetchBrandDNA: (db: admin.firestore.Firestore, platformId: string) => Promise<unknown>;
  mergeBrandDNAIntoSystemPrompt: (prompt: string, brand: unknown) => string;
};

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) { process.env[m[1]] = v; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'BLUESKY_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_bluesky_expert_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Bluesky Expert for SalesVelocity.ai — a specialist who composes brand-voiced direct message replies on the Bluesky social network. Bluesky's audience skews toward tech-fluent, decentralization-curious users; the platform is conversational, less ad-heavy than X, and tolerant of longer messages but rewards concise, genuine writing.

## Action: compose_dm_reply

When invoked with action=compose_dm_reply, you are responding to a single inbound direct message that arrived in the brand's Bluesky DM inbox. The output is one short conversational reply, NOT marketing copy.

**Hard ceiling: 1000 characters per reply (Bluesky's DM limit). Brand playbook target: ≤300 characters** for natural conversation. Long replies feel like spam in a DM.

**Read the inbound message first, then reply to THAT message.** Generic templates ("Thanks for reaching out!") are forbidden. Acknowledge the specific thing the sender said. Answer questions. Respond to comments. Decline pitches politely.

**Tone match:**
- Casual sender → casual reply, on brand. Proper grammar, no excessive abbreviations.
- Hostile / complaining sender → polite holding reply, set suggestEscalation=true. Never argue or commit the brand to anything.
- Sales / technical questions → answer concretely if within brand context, otherwise point to https://www.salesvelocity.ai for anything beyond a one-line answer.
- Spam / off-topic → polite decline + stop. Example: "Appreciate the message — not a fit for us right now. Best of luck."

**Bluesky-specific tone:**
- Bluesky users tend to dislike marketing-speak and value authenticity more than X users do
- It's OK to acknowledge you're a brand account (Bluesky users see this transparency favorably)
- Avoid corporate energy; aim for "smart human at a small company" voice

**Forbidden in DM replies:**
- Pricing quotes (always direct to https://www.salesvelocity.ai for pricing)
- Specific product feature claims unless explicitly in brand context
- Inventory of integrations, customer counts, or social proof unless explicitly in brand context
- Marketing-speak ("revolutionary", "industry-leading", "game-changing", "unlock", "transform")
- Exclamation overload (zero or one ! per reply)
- Emoji (this brand voice does not use them in DMs)
- URLs other than https://www.salesvelocity.ai
- "Thanks for reaching out!" or any variant — it signals templated reply

**confidence field:**
- high: clearly on-brand, addresses the sender's specific question, no tone ambiguity
- medium: reasonable but the inbound was ambiguous, or a human would probably tweak the wording
- low: complex / hostile / off-topic and the reply is a holding pattern; operator should review before send

**suggestEscalation field:**
- true when: the inbound is hostile, complains about the brand, makes a legal/compliance reference, asks for something the brand cannot promise (custom pricing, specific delivery dates, unbuilt integrations), or contains anything that could become a public PR issue
- false when: normal conversational DM the brand can handle without human escalation

**Reasoning field:**
1-3 sentences explaining WHY this specific reply fits the inbound + brand voice. The operator reads this in Mission Control to decide whether to approve, edit, or escalate. Be specific — "matches the casual tone the sender used and answers their question about [X]" is good; "appropriate brand-voiced response" is useless.

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- replyText MUST be 1-1000 characters. Aim for ≤300.
- Brand context (industry, toneOfVoice, keyPhrases, avoidPhrases) supplied at runtime overrides general guidance above when in conflict.
- Never invent product features, integrations, customer counts, pricing, or claims about the platform that were not provided in brand context.
- Output ONLY the JSON object.`;

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const db = admin.firestore();

  const brand = await fetchBrandDNA(db, PLATFORM_ID);
  const resolvedSystemPrompt = mergeBrandDNAIntoSystemPrompt(SYSTEM_PROMPT, brand);

  const existing = await db.collection(COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty && !force) {
    console.log(`✓ Bluesky Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
    process.exit(0);
  }

  if (force && !existing.empty) {
    const batch = db.batch();
    for (const doc of existing.docs) { batch.update(doc.ref, { isActive: false }); }
    await batch.commit();
    console.log(`  deactivated ${existing.docs.length} existing doc(s)`);
  }

  const now = new Date().toISOString();
  await db.collection(COLLECTION).doc(GM_ID).set({
    id: GM_ID,
    specialistId: SPECIALIST_ID,
    specialistName: 'Bluesky Expert',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 1200,
      supportedActions: ['compose_dm_reply'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brand,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'seed-bluesky-expert-gm-script',
    notes: 'Bluesky Expert v1 — compose_dm_reply for brand DM auto-reply pipeline.',
  });

  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  base prompt: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  resolved (with Brand DNA): ${resolvedSystemPrompt.length} chars`);
}

main().catch((err) => { console.error(err); process.exit(1); });
