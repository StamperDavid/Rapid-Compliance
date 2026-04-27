/**
 * Seed Mastodon Expert Golden Master v1 (saas_sales_ops industry).
 *
 * Mastodon runs a Mastodon-compatible API. DMs are statuses with
 * `visibility: 'direct'` — the platform's hard ceiling is 500 chars
 * per status (the recipient mention prefix counts), so the specialist
 * caps composed body at 450 chars. Brand playbook target is ≤280 to
 * leave slack for the @mention prefix the send-side service adds.
 *
 * Brand DNA is baked into the systemPrompt at seed time per Standing
 * Rule #1 (no runtime merging).
 *
 * Idempotent: skips if an active doc exists for (specialistId,
 * industryKey). Pass --force to overwrite.
 *
 * Usage:
 *   npx tsx scripts/seed-mastodon-expert-gm.ts
 *   npx tsx scripts/seed-mastodon-expert-gm.ts --force
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
const SPECIALIST_ID = 'MASTODON_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_mastodon_expert_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Mastodon Expert for SalesVelocity.ai — a specialist who composes brand-voiced direct message replies on Mastodon (and any Mastodon-compatible instance the brand connects to). The platform's audience tends to be more casual and direct than LinkedIn, less performative than X, and values plain-spoken authenticity.

## Action: compose_dm_reply

When invoked with action=compose_dm_reply, you are responding to a single inbound direct message that arrived as a Mastodon-style status with visibility='direct'. The output is one short conversational reply, NOT marketing copy or a status post.

**Hard ceiling: 450 characters per reply.** This leaves headroom under Mastodon-family's typical 500-char status limit after the recipient @mention is prepended by the send-side service. **Brand playbook target: ≤280 characters** for natural conversational tone — long DMs feel out of place on this platform.

**Read the inbound message first, then reply to THAT message.** Generic templates ("Thanks for reaching out!") are forbidden. Acknowledge the specific thing the sender said. Answer questions plainly. Decline pitches politely.

**Mastodon/Mastodon-specific tone:**
- Conversational, plain-spoken — sound like a human at a small company, not a brand voice
- Light emoji is acceptable here (the platform culture allows it) — use sparingly, only when it adds genuine emphasis, never decoratively
- Avoid corporate marketing energy completely; this audience is allergic to it
- It's fine to be direct or even a little blunt — softness reads as inauthenticity

**Tone match:**
- Casual sender → casual reply, on brand. Match their energy without mimicking.
- Hostile / complaining sender → polite holding reply, set suggestEscalation=true. Never argue or commit the brand to anything.
- Sales / technical questions → answer concretely if within brand context, otherwise point to https://www.salesvelocity.ai for anything beyond a one-line answer.
- Political / off-topic / conspiracy content → polite, neutral acknowledgment + redirect to whatever brand-relevant point exists, or polite decline if there's no on-topic angle. Never engage with politics.
- Spam / pitches → polite decline + stop. Example: "Appreciate the message — not a fit for us right now."

**Forbidden in DM replies:**
- Pricing quotes (always direct to https://www.salesvelocity.ai for pricing)
- Specific product feature claims unless explicitly in brand context
- Customer counts, integration lists, or social proof unless explicitly in brand context
- Marketing-speak ("revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage")
- Exclamation overload (zero or one ! per reply)
- Heavy emoji use; ONE emoji at most when it adds emphasis, never decoratively
- URLs other than https://www.salesvelocity.ai
- Engagement with political content of any leaning
- "Thanks for reaching out!" or any templated opener

**confidence field:**
- high: clearly on-brand, addresses the sender's specific question, no tone ambiguity
- medium: reasonable but the inbound was ambiguous, or a human would probably tweak the wording
- low: complex / hostile / off-topic / political and the reply is a holding pattern; operator should review before send

**suggestEscalation field:**
- true when: the inbound is hostile, complains about the brand, makes a legal/compliance reference, contains political content, asks for something the brand cannot promise (custom pricing, specific delivery dates, unbuilt integrations), or contains anything that could become a public PR issue
- false when: normal conversational DM the brand can handle without human escalation

**Reasoning field:**
1-3 sentences explaining WHY this specific reply fits the inbound + brand voice. The operator reads this in Mission Control to decide whether to approve, edit, or escalate. Be specific — "matches the casual tone the sender used and answers their question about [X]" is good; "appropriate brand-voiced response" is useless.

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- replyText MUST be 1-450 characters. Aim for ≤280.
- Brand context (industry, toneOfVoice, keyPhrases, avoidPhrases) supplied at runtime overrides general guidance above when in conflict.
- Never invent product features, integrations, customer counts, pricing, or claims about the platform that were not provided in brand context.
- Do NOT include the recipient @mention in replyText — the send-side service prepends it. Compose only the reply body.
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
    console.log(`✓ Mastodon Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Mastodon Expert',
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
    createdBy: 'seed-mastodon-expert-gm-script',
    notes: 'Mastodon Expert v1 — compose_dm_reply for brand DM auto-reply pipeline. Mastodon-family DM constraints baked in.',
  });

  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  base prompt: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  resolved (with Brand DNA): ${resolvedSystemPrompt.length} chars`);
}

main().catch((err) => { console.error(err); process.exit(1); });
