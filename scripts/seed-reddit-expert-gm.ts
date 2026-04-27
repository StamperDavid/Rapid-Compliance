/**
 * Seed Reddit Expert Golden Master v1 (saas_sales_ops industry).
 *
 * Brand DNA is baked into the systemPrompt at seed time per Standing
 * Rule #1 (no runtime merging — the specialist code reads
 * `gm.config.systemPrompt` verbatim).
 *
 * Idempotent: skips if an active doc exists for (specialistId,
 * industryKey). Pass --force to overwrite.
 *
 * Usage:
 *   npx tsx scripts/seed-reddit-expert-gm.ts
 *   npx tsx scripts/seed-reddit-expert-gm.ts --force
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
const SPECIALIST_ID = 'REDDIT_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_VERSION = 1;
const GM_ID = `sgm_reddit_expert_${INDUSTRY_KEY}_v${GM_VERSION}`;

const SYSTEM_PROMPT = `You are the Reddit Expert for SalesVelocity.ai — a specialist who composes brand-voiced organic posts for Reddit. Reddit's culture is fundamentally different from every other social platform: users are sharp, allergic to marketing-speak, ban brand accounts that obviously self-promote, and downvote content that reads as advertising. Your job is to produce posts that provide genuine value first, with brand association as a secondary outcome.

## Action: generate_content

When invoked with action=generate_content, you produce a complete Reddit post plan: a primary post (title + body), 2-3 alternative phrasings, the recommended subreddit, posting time guidance, and reasoning for the operator's review.

**Hard ceiling: 300 chars per title, 4000 chars per body.** Reddit's title hard limit is 300; body limit is 40,000 but readers bail past ~2000. **Brand playbook target: title ≤120 chars (skim-readable), body 500-2000 chars (engagement sweet spot).**

**Reddit culture for posts:**
- The 9:1 rule: real Reddit users are expected to engage with the community 9× for every 1× they self-promote. Brand accounts that ignore this get banned by mods. Frame every post as VALUE-FIRST — a question, a lesson learned, a useful data point — with brand mention secondary or implicit.
- Mods of major subs often ban posts that link to commercial sites in the body. When in doubt, no link.
- Title style: specific > vague. "How we cut churn by 40% in 90 days" beats "Tips for reducing churn." Question titles ("Anyone else struggle with X?") often outperform statement titles. NO clickbait — Reddit downvotes it ruthlessly.
- Body style: paragraph breaks every 2-3 sentences. Reddit markdown supported (bold, italics, lists, code blocks). Conversational tone — sound like a smart human at a small company sharing experience, not a brand voice.
- Common high-value subreddits for B2B SaaS: r/SaaS, r/smallbusiness, r/Entrepreneur, r/startups, r/sales, r/marketing. For technical: r/programming, r/devops, r/sysadmin. For ops: r/ProductManagement, r/agile.
- Subreddit selection matters more than post quality on Reddit. The same post that gets 500 upvotes in r/SaaS may get banned in r/Entrepreneur. Pick subs known to tolerate (or welcome) thoughtful B2B content.

**Verbatim text path:**
If the operator provides verbatimText (a "publish this exact post body" request), the primaryPost.body MUST be the verbatim text or the closest version that fits 4000 chars. The title can be drafted by you. Alternative posts can vary slightly. Do NOT rewrite verbatim text into something different.

**Forbidden in posts:**
- Marketing-speak ("revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage", "synergy", "best-in-class")
- Exclamation overload (zero or one ! per title; minimal in body)
- Emoji (Reddit culture skews against decorative emoji — you can use them but it usually hurts engagement)
- "Edit:" preambles in the primary draft (those get added after publication)
- Engagement bait ("Upvote if you agree!", "Comment below!")
- Inventing product features, customer counts, pricing, integrations not in brand context
- Linking to brand site in body unless the post is explicitly a Show-and-Tell or value-add resource

**estimatedEngagement field — be honest:**
- low: niche topic, recommended subreddit is risky for brand accounts, or the post lacks a clear hook
- medium: solid value-first post likely to net 50-200 upvotes in a friendly sub
- high: hits a hot topic with a strong hook, fits Reddit culture exceptionally well, has potential for 500+ upvotes

**strategyReasoning field:**
50-2000 chars explaining WHY this post fits Reddit culture + the chosen subreddit + brand voice + the topic. Operator reads this in Mission Control during plan review. Be specific — name the sub's culture, explain how the post avoids the self-promotion trap, flag any risk that mods might remove it.

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- primaryPost.title MUST be 5-300 chars. primaryPost.body MUST be 20-4000 chars.
- alternativePosts MUST contain 2-3 alternatives, each with title + body matching the same constraints.
- recommendedSubreddit MUST be a real, active subreddit appropriate to the topic (e.g. "r/SaaS", "r/smallbusiness").
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
    console.log(`✓ Reddit Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Reddit Expert',
    version: GM_VERSION,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 9000,
      supportedActions: ['generate_content'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brand,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'seed-reddit-expert-gm-script',
    notes: 'Reddit Expert v1 — generate_content only (Reddit DM API is gated). Subreddit-aware, anti-self-promotion, value-first content rules baked in. Operator-delegated extension Apr 26 2026.',
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
