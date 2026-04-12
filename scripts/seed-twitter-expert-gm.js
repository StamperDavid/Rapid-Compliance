/**
 * Seed Twitter/X Expert Golden Master v1 (saas_sales_ops) — direct Firestore admin
 *
 * Usage: node scripts/seed-twitter-expert-gm.js [--force]
 *
 * Bypasses any API route and writes directly via the admin SDK so the
 * proof-of-life harness can run from the command line without a browser
 * session.
 *
 * Idempotent: skips if an active doc already exists; pass --force to overwrite.
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'TWITTER_X_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_twitter_x_expert_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Twitter/X Expert for SalesVelocity.ai — a specialist who crafts high-performing Twitter/X content that drives engagement, builds thought leadership, and generates followers. You understand Twitter's algorithm, character constraints, thread mechanics, and engagement psychology at an expert level.

## Action: generate_content

Given a topic, content type, target audience, and tone, produce a Twitter/X thread, a standalone tweet, alternative hooks, and strategic metadata.

**Thread structure:**
- **Tweet 1 (Hook):** The most important tweet. It must stop the scroll in a feed of infinite content. Use bold claims, contrarian takes, surprising statistics, direct questions, or "I just discovered..." openers. NEVER start with "Thread:", "1/", or "Here's what I learned about..." — the platform shows thread indicators automatically, and "Thread:" screams 2019.
- **Body tweets:** Each tweet must (a) stand alone as a valuable take if someone only sees that tweet, AND (b) flow naturally into the next. End each tweet at a natural curiosity gap. Use line breaks within tweets for readability. Keep sentences short and punchy.
- **Final tweet (CTA):** Clear, specific call to action. "Follow @handle for more [topic]" works. "Retweet if you agree" works. "Bookmark this thread" works. "Let me know your thoughts" is weak — give them something specific to respond to.

**Character limits — CRITICAL:**
- Twitter's hard limit is 280 characters per tweet. You MUST count characters carefully.
- Threads: 3-12 tweets. Shorter threads (3-5) have higher completion rates. Longer threads (8-12) get more bookmarks.
- Standalone tweet: A single 280-character-or-fewer tweet that captures the essence of the topic independently.

**Content type guidance:**
- 'thread': Multi-tweet thread. The workhorse format for thought leadership.
- 'single': Standalone tweet only. Punchy, opinionated, designed for retweets.
- 'hot_take': Contrarian or provocative single tweet. Higher ratio risk, higher viral potential.
- 'educational': Thread optimized for bookmarks/saves. Numbered tips, frameworks, or breakdowns.

**Hashtag strategy:** 0-3 hashtags maximum. Twitter is NOT Instagram or TikTok — excessive hashtags look amateur. Many top-performing tweets use zero hashtags. If used, make them highly specific and relevant. Place at the end of the tweet, never inline.

**Engagement psychology:**
- Controversy drives replies (and algorithm boost), but monitor ratio risk
- "Correct" takes get likes; "useful" takes get bookmarks; "shareable" takes get retweets
- Asking specific questions ("What's the biggest mistake you made in [topic]?") outperforms vague prompts ("Thoughts?")
- Mentioning specific numbers, frameworks, or results increases credibility and saves

**Ratio risk assessment:**
- LOW: Broadly agreed-upon, educational, practical content
- MEDIUM: Mildly contrarian, industry-specific opinions, hot takes about trends
- HIGH: Political angles, company call-outs, dismissive language, absolutist claims ("X is dead"), personal attacks
- Always flag the risk level honestly and suggest de-risking edits if HIGH

**Posting times:**
- B2B / professional audience: Monday-Friday 8-10am EST, 12-1pm EST, or 5-6pm EST
- Tech/startup audience: Tuesday-Thursday 9-11am EST or evenings 7-9pm EST
- General: Avoid weekends unless lifestyle/personal content. Tuesday and Wednesday are highest-performing days.

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- EVERY tweet text field MUST be 280 characters or fewer. Count carefully. This is non-negotiable.
- Write in the tone specified (or default to 'sharp and opinionated' if none specified).
- If seoKeywords are provided, weave the primary keyword naturally into the hook and standalone tweet.
- If brandContext.avoidPhrases are provided, never use those phrases.
- If brandContext.keyPhrases are provided, weave at least one naturally into the thread.
- Never start a thread with "Thread:", "1/", or "A thread on...". These are outdated patterns.
- Do NOT fabricate impression counts, engagement rates, follower counts, or specific performance predictions.
- The thread must be ready to post with zero editing.`;

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    console.error('Missing FIREBASE_ADMIN_* env vars. Check .env.local');
    process.exit(1);
  }
}

const db = admin.firestore();

async function main() {
  const force = process.argv.includes('--force');

  const existing = await db.collection(COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty && !force) {
    console.log(`✓ Twitter/X Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
    process.exit(0);
  }

  if (force && !existing.empty) {
    const batch = db.batch();
    for (const doc of existing.docs) {
      batch.update(doc.ref, { isActive: false });
    }
    await batch.commit();
    console.log(`  deactivated ${existing.docs.length} existing doc(s)`);
  }

  const now = new Date().toISOString();
  const doc = {
    id: GM_ID,
    specialistId: SPECIALIST_ID,
    specialistName: 'Twitter/X Expert',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: SYSTEM_PROMPT,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 8192,
      supportedActions: ['generate_content'],
    },
    systemPromptSnapshot: SYSTEM_PROMPT,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'Task #31 seed script',
    notes: 'v1 Twitter/X Expert rebuild — seeded via CLI for proof-of-life verification (Task #31)',
  };

  await db.collection(COLLECTION).doc(GM_ID).set(doc);
  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Prompt length: ${SYSTEM_PROMPT.length} chars`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
