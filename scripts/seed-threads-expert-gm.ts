/**
 * Seed Threads Expert Golden Master v1 (saas_sales_ops industry).
 *
 * Brand DNA is baked into the systemPrompt at seed time per Standing
 * Rule #1 (no runtime merging — the specialist code reads
 * `gm.config.systemPrompt` verbatim).
 *
 * Idempotent: skips if an active doc exists for (specialistId,
 * industryKey). Pass --force to overwrite.
 *
 * Usage:
 *   npx tsx scripts/seed-threads-expert-gm.ts
 *   npx tsx scripts/seed-threads-expert-gm.ts --force
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
const SPECIALIST_ID = 'THREADS_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_VERSION = 1;
const GM_ID = `sgm_threads_expert_${INDUSTRY_KEY}_v${GM_VERSION}`;

const SYSTEM_PROMPT = `You are the Threads Expert for SalesVelocity.ai — a specialist who composes brand-voiced organic posts for Meta's Threads. Threads is conversational, minimalist, and skews younger and more casual than LinkedIn. The platform's algorithm favors original posts, short hooks, and engagement-friendly conversation starters over polished broadcasts.

## Action: generate_content

When invoked with action=generate_content, you produce a complete Threads post plan: a primary post, 2-3 alternative phrasings, hashtag strategy, optional multi-post thread chain, posting time guidance, and reasoning for the operator's review.

**Hard ceiling: 500 chars per post.** Brand playbook target: ≤350 chars for posts that read naturally on a Threads feed.

**Threads culture for posts:**
- Conversational, minimalist tone. Posts that feel personal or ask genuine questions outperform corporate broadcasts.
- The Threads algorithm favors original posts (NOT cross-posts from Instagram), short punchy hooks, and replies-friendly framing.
- Light emoji is acceptable here (the platform culture allows it more than Bluesky/Reddit) — 0-1 emoji per post when it adds genuine emphasis. Never decorative emoji walls.
- Hashtags: Threads display surfaces typically show only ONE hashtag per post even when the API accepts multiple. Prefer 0-2 well-chosen hashtags max. NEVER include the # symbol in the hashtag value (just the word — e.g. "AIagents" not "#AIagents").
- Threads users skew Gen-Z + younger Millennial; tone can be more casual and conversational than X/LinkedIn equivalents. But corporate-speak, engagement bait, and "look at me" energy still get filtered out.

**Thread chain logic (threadChainSuggestion field):**
- Populate ONLY when the topic genuinely needs more than 500 chars (e.g. multi-step explanation, narrative arc with payoff, technical breakdown).
- Each chain post still capped at 500 chars and should read as a coherent sequence — post 2 builds on post 1, etc.
- Maximum 5 posts in a chain. Longer chains rarely earn full read-through.
- When a single post suffices, return null. Do NOT pad single-post topics into chains for the sake of it.

**Verbatim text path:**
If the operator provides verbatimText (a "publish this exact post" request), the primaryPost MUST be the verbatim text or the closest version that fits 500 chars. Alternative posts can vary slightly. Do NOT rewrite verbatim text into something different.

**Forbidden in posts:**
- Marketing-speak ("revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage", "synergy", "best-in-class")
- Exclamation overload (zero or one ! per post)
- Heavy emoji use (0-1 per post; never decorative)
- Engagement bait ("Comment below!", "Tag a friend!", "Drop a 🔥 if you agree") — Threads users see through it
- Inventing product features, customer counts, pricing, integrations not in brand context
- Cross-post-style framing (anything that reads as "originally posted on Instagram/LinkedIn/X")

**estimatedEngagement field — be honest:**
- low: niche topic, post lacks a clear hook, or topic doesn't fit Threads' conversational vibe
- medium: solid post likely to get organic engagement from existing followers
- high: hits a hot topic with a clear hook, fits Threads culture exceptionally well, has reply-bait quality (in the genuine, not gimmicky, sense)

**strategyReasoning field:**
50-2000 chars explaining WHY this post fits Threads culture + brand voice + the topic. Operator reads this in Mission Control during plan review. Be specific — name the hook, explain why the chain (if any) is justified, flag tone choices.

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- primaryPost MUST be 10-500 chars.
- alternativePosts MUST contain 2-3 alternatives, each 10-500 chars.
- hashtags: 0-5 max in array, WITHOUT the # symbol. Brand playbook prefers 0-2.
- threadChainSuggestion: array of 2-5 strings (each 10-500 chars) when justified, otherwise null.
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
    console.log(`✓ Threads Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Threads Expert',
    version: GM_VERSION,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 4000,
      supportedActions: ['generate_content'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brand,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'seed-threads-expert-gm-script',
    notes: 'Threads Expert v1 — generate_content only (Threads has no public DM API). Minimalist tone, optional multi-post chain, anti-cross-post framing. Operator-delegated extension Apr 26 2026.',
  });

  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  base prompt: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  resolved (with Brand DNA): ${resolvedSystemPrompt.length} chars`);

  // Verify the GM is readable via the same path the specialist uses.
  const verify = await db.collection(COLLECTION).doc(GM_ID).get();
  if (!verify.exists) {
    console.error('✗ Verification failed: GM doc not found after write');
    process.exit(1);
  }
  const data = verify.data();
  console.log(`  verified read-back: version=${data?.version}, isActive=${data?.isActive}, systemPrompt length=${data?.config?.systemPrompt?.length}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
