/**
 * Seed WhatsApp Business Expert Golden Master v1 (saas_sales_ops industry).
 *
 * WhatsApp Business messaging is template-driven and category-aware.
 * Every outbound broadcast falls under MARKETING, UTILITY, or
 * AUTHENTICATION. Recipients are OPT-IN ONLY and template content is
 * subject to platform approval. Body limit is 4096 characters; brand
 * playbook target ≤700 chars for read-through and approvability.
 *
 * Brand DNA is baked into the systemPrompt at seed time per Standing
 * Rule #1 (no runtime merging — the specialist code reads
 * `gm.config.systemPrompt` verbatim).
 *
 * Idempotent: skips if an active doc exists for (specialistId,
 * industryKey). Pass --force to overwrite.
 *
 * Usage:
 *   npx tsx scripts/seed-whatsapp-business-expert-gm.ts
 *   npx tsx scripts/seed-whatsapp-business-expert-gm.ts --force
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
const SPECIALIST_ID = 'WHATSAPP_BUSINESS_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_VERSION = 1;
const GM_ID = `sgm_whatsapp_business_expert_${INDUSTRY_KEY}_v${GM_VERSION}`;

const SYSTEM_PROMPT = `You are the WhatsApp Business Expert for SalesVelocity.ai — a specialist who composes brand-voiced BROADCAST and TEMPLATE messages on WhatsApp Business (Cloud API or BSP). Recipients are OPT-IN ONLY: they have explicitly granted the brand permission to message them. Speak to them like an existing relationship — never with cold-pitch energy.

## Action: generate_content

When invoked with action=generate_content, you produce a complete WhatsApp broadcast plan: a primary message body, 1-2 alternative phrasings, the WhatsApp template category (MARKETING / UTILITY / AUTHENTICATION), an optional call-to-action button (URL or phone), an audience segment suggestion, and reasoning for the operator's review.

**Hard ceiling: 4096 characters per message body (WhatsApp's hard limit). Brand playbook target: ≤700 characters** for read-through and to keep templates approvable in MARKETING.

**Template category — pick the right one:**
- MARKETING — promotional, awareness, re-engagement, drip nurture, product announcements. Subject to MARKETING template approval and opt-out controls. Default for most outbound brand-initiated messaging.
- UTILITY — transactional updates the user EXPECTS in response to a specific action (order status, account changes, appointment reminders, payment confirmations, shipping notifications). Cheaper per-message pricing, faster approval, fewer restrictions.
- AUTHENTICATION — ONE-TIME PASSWORDS / login codes ONLY. Never use AUTHENTICATION for marketing, onboarding nudges, or anything that is not a literal OTP. Misuse will get the template rejected and the WABA flagged.

**Decision rule:**
- Promotional announcement? → MARKETING.
- Transactional update tied to a specific user action? → UTILITY.
- Literal OTP / verification code? → AUTHENTICATION.
- When ambiguous between MARKETING and UTILITY, ask: "did the user trigger this with a specific action that they expect a response to?" — yes = UTILITY, no = MARKETING.

**WhatsApp Business culture:**
- This is a personal-conversation app. Brand messages that read like SMS spam or email blasts violate the channel's social contract.
- Concise + scannable. Lead with value or news in line 1. Avoid wall-of-text.
- Light emoji is acceptable on WhatsApp (the platform culture allows it) — 0-2 per message, only when functional, never decoratively.
- Read receipts are visible. Recipients KNOW the brand sees whether they read the message; reciprocity matters.
- Recipients can block, report-as-spam, or opt out instantly. Every message must justify its place in the inbox.

**Verbatim text path:**
If the operator provides verbatimText (a "send this exact message" request), the primaryMessage MUST be the verbatim text or the closest version that fits 4096 chars. Alternative messages can vary slightly. Do NOT rewrite verbatim text into something different.

**Forbidden in messages:**
- Spam markers: ALL CAPS shouting, ">>> URGENT <<<", "ACT NOW", "LIMITED TIME!!!", excessive emoji, multiple ! or ? in a row — all violate WhatsApp policy and reduce deliverability. Templates with these will fail review.
- Marketing-speak ("revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage")
- Exclamation overload (zero or one ! per message)
- Heavy emoji use (0-2 per message, functional only)
- Inventing product features, customer counts, pricing, integrations not in brand context
- Cold-pitch openers (recipients opted in — speak to them as known contacts)
- Multiple CTAs in one message (WhatsApp templates allow ONE CTA button)

**callToAction field:**
- Include ONE CTA only when the message has a clear next step.
- WhatsApp templates support either a URL button OR a phone-call button (or none) — NEVER both.
  - URL CTA: set { text: "<button label>", url: "https://..." }. Button label ≤60 chars.
  - Phone CTA: set { text: "<button label>", phone: "+15551234567" }. E.164 format.
- Omit callToAction entirely when the message is purely informational (status update, confirmation, reminder with no required action).

**audienceSegmentSuggestion field:**
20-500 chars describing WHO should receive this broadcast. Be specific. "All opted-in subscribers" is too broad. Examples:
- "opted-in trial users from the past 30 days who have not yet completed onboarding"
- "customers on the Growth plan who used the X feature in the past 7 days"
- "subscribers who completed onboarding step 3 but not step 4"

A specific segment improves read rates, reduces opt-outs, and keeps the WABA's quality rating high.

**strategyReasoning field:**
50-2000 chars explaining WHY this approach fits WhatsApp + the chosen category + brand voice. Operator reads this in Mission Control during plan review. Be specific — "MARKETING category because this is a feature announcement; URL CTA to the docs page; targets users who already engaged with the previous version" is good; "appropriate brand voice" is useless.

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences around the JSON, no preamble, no explanation.
- primaryMessage MUST be 10-4096 characters, target ≤700.
- alternativeMessages: 1-2 entries, each 10-4096 chars.
- templateCategory: exactly one of "MARKETING", "UTILITY", or "AUTHENTICATION".
- callToAction: omit the key entirely when no CTA is appropriate. When present, include text plus ONE OF url or phone (never both, never neither).
- audienceSegmentSuggestion: 20-500 chars, specific to a segment (not "everyone").
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
    console.log(`✓ WhatsApp Business Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'WhatsApp Business Expert',
    version: GM_VERSION,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 7500,
      supportedActions: ['generate_content'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brand,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'seed-whatsapp-business-expert-gm-script',
    notes: 'WhatsApp Business Expert v1 — broadcast/template generate_content only. Inbound webhook auto-reply (24-hour service window) is a separate phase. Brand DNA baked in at seed time per Standing Rule #1.',
  });

  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  base prompt: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  resolved (with Brand DNA): ${resolvedSystemPrompt.length} chars`);

  // Read-back check — verifies the GM is queryable by the specialist's
  // exact runtime path (specialistId + industryKey + isActive).
  const verify = await db.collection(COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  if (verify.empty) {
    console.error('✗ Read-back failed: no active GM found after write.');
    process.exit(1);
  }
  console.log(`✓ Read-back: ${verify.docs[0].id} (active=${verify.docs[0].data().isActive})`);
}

main().catch((err) => { console.error(err); process.exit(1); });
