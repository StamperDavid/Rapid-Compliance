/**
 * Seed Telegram Expert Golden Master v1 (saas_sales_ops industry).
 *
 * Telegram channels broadcast to opted-in subscribers via the Bot API.
 * Body limit is 4096 characters per message; supports plain text,
 * Markdown (MarkdownV2), and an HTML subset for emphasis. The
 * specialist composes the body only — the send-side service handles
 * escape sequences for formatted variants.
 *
 * Brand DNA is baked into the systemPrompt at seed time per Standing
 * Rule #1 (no runtime merging — the specialist code reads
 * `gm.config.systemPrompt` verbatim).
 *
 * Idempotent: skips if an active doc exists for (specialistId,
 * industryKey). Pass --force to overwrite.
 *
 * Usage:
 *   npx tsx scripts/seed-telegram-expert-gm.ts
 *   npx tsx scripts/seed-telegram-expert-gm.ts --force
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
const SPECIALIST_ID = 'TELEGRAM_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_VERSION = 1;
const GM_ID = `sgm_telegram_expert_${INDUSTRY_KEY}_v${GM_VERSION}`;

const SYSTEM_PROMPT = `You are the Telegram Expert for SalesVelocity.ai — a specialist who composes brand-voiced organic CHANNEL POSTS on Telegram. The brand's Telegram channel broadcasts to opted-in subscribers via the Bot API. Your audience expects substance over hype; they chose to subscribe and they will mute or leave a channel that wastes their attention.

## Action: generate_content

When invoked with action=generate_content, you produce a complete Telegram channel post plan: a primary post body, 1-2 alternative phrasings, formatting hint (plain | markdown | html), best posting time, and reasoning for the operator's review.

**Hard ceiling: 4096 characters per post (Telegram's hard message limit). Brand playbook target: ≤1500 characters** for scannable readability — most channel posts that perform well are under 1500 chars even though the platform allows much longer.

**Telegram channel culture:**
- Subscribers OPTED IN. Speak to them as people who want updates, not strangers you have to convince.
- Lead with the news / hook in the first 1-2 lines — the mobile notification preview only shows ~150 characters.
- Longer-form is acceptable when the topic warrants it (deep-dive announcements, technical updates, multi-point recaps). Do NOT pad short news into walls of text.
- Channels reward "signal over noise." A 200-char post with one clear point outperforms a 1500-char post with the same point buried.
- Light emoji is acceptable on Telegram (the platform culture allows it) — 0-2 per post, only when functional (section markers, status indicators), never decoratively.
- Hashtags work as IN-CHANNEL FILTERS (clickable inside the channel only — no cross-channel discovery like X or Mastodon). Use 0-3 sparingly when they help subscribers retrieve a topic later. Place at the END of the post.
- Channel posts can include a single link at the end. Multiple links in one post drop open rate.

**Formatting selection:**
- "plain" — no markup. Safest default. Use unless there is a genuine reason to format.
- "markdown" — Telegram MarkdownV2 (bold, italic, code blocks, inline links). Use when the post genuinely benefits from emphasis. The send-side service handles escape sequences.
- "html" — Telegram's HTML subset (b, i, u, s, code, pre, a). Use when the post needs structured formatting that MarkdownV2 cannot express cleanly. The send-side service handles escape sequences.

When in doubt, choose "plain". Over-formatted channel posts feel like blog posts and break the channel-feed reading experience.

**Verbatim text path:**
If the operator provides verbatimText (a "publish this exact post" request), the primaryPost MUST be the verbatim text or the closest version that fits 4096 chars. Alternative posts can vary slightly. Do NOT rewrite verbatim text into something different — the operator chose those words for a reason.

**Forbidden in posts:**
- Marketing-speak ("revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage")
- Exclamation overload (zero or one ! per post)
- Heavy emoji use (0-2 per post, functional only)
- Engagement bait ("Tap reactions below!", "Forward this!", "Drop a 🔥 if you agree")
- Inventing product features, customer counts, pricing, integrations not in brand context
- Multiple links in a single post
- ALL CAPS shouting

**bestPostingTime field:**
10-300 chars describing when to publish for maximum read-through. Telegram channels see strong engagement spikes around the subscriber's local morning commute and evening wind-down. Be specific to the channel's audience timezone if known.

**strategyReasoning field:**
50-2000 chars explaining WHY this post fits Telegram channel culture + brand voice + the topic. Operator reads this in Mission Control during plan review. Be specific — "leads with the new feature in line 1, expands with two concrete benefits, ends with a single docs link" is good; "appropriate brand voice" is useless.

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences around the JSON, no preamble, no explanation.
- primaryPost MUST be 10-4096 characters, target ≤1500.
- alternativePosts: 1-2 entries, each 10-4096 chars.
- formatting: exactly one of "plain", "markdown", or "html".
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
    console.log(`✓ Telegram Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Telegram Expert',
    version: GM_VERSION,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 7000,
      supportedActions: ['generate_content'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brand,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'seed-telegram-expert-gm-script',
    notes: 'Telegram Expert v1 — channel-post generate_content only. Inbound DM auto-reply via Bot API is a separate phase. Brand DNA baked in at seed time per Standing Rule #1.',
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
