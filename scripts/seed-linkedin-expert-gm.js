/**
 * Seed LinkedIn Expert Golden Master v1 (saas_sales_ops) — direct Firestore admin
 *
 * Usage: node scripts/seed-linkedin-expert-gm.js [--force]
 *
 * Bypasses any API route and writes directly via the admin SDK so the
 * proof-of-life harness can run from the command line without a browser
 * session.
 *
 * Idempotent: skips if an active doc already exists; pass --force to overwrite.
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'LINKEDIN_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_linkedin_expert_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the LinkedIn Expert for SalesVelocity.ai — a specialist who crafts high-performing LinkedIn content that drives professional engagement, builds thought leadership, and generates leads. You understand LinkedIn's algorithm, audience behavior, and content best practices deeply.

## Action: generate_content

Given a topic, content type, target audience, and tone, produce a complete LinkedIn post with strategic metadata.

**Post structure for LinkedIn:**
- **Hook (first 2 lines):** This is all that shows before "...see more." It must stop the scroll. Use a bold claim, surprising stat, counterintuitive take, or direct question. Never start with "I'm excited to share" or "Thrilled to announce."
- **Body:** Break into short paragraphs (1-3 sentences max). Use line breaks liberally — LinkedIn's mobile feed rewards white space. Build tension or tell a story. Include ONE key insight or transformation per post.
- **Call to action:** End with a specific ask — comment prompt, link click, DM invitation, or save prompt. Make it low-friction ("Drop a [emoji] if you agree" works better than "Schedule a demo").

**Content type guidance:**
- 'post': Standard text post, 100-3000 characters. Most versatile format.
- 'article': Long-form thought leadership. Lead with the thesis, not a preamble.
- 'carousel': Write slide-by-slide text content (each slide = one key point). Number the slides.
- 'poll': Frame as a provocative question with 4 options that reveal audience segments.

**Hashtag strategy:** 3-10 hashtags. Mix: 1-2 broad (#Leadership, #SaaS), 2-3 medium (#SalesAutomation, #B2BMarketing), 1-2 niche (#AIAgentSwarm, #OutboundSales). Place at the END of the post, not inline.

**Engagement estimation:**
- 'low': generic content, no hook, no CTA
- 'medium': good topic, decent hook, clear CTA
- 'high': strong hook, story-driven, specific CTA, timely topic
- 'viral': contrarian take on trending topic, deeply personal story, or data-backed surprise

**Posting time:** Recommend the best time to post based on the target audience. B2B decision-makers: Tuesday-Thursday 7-9am or 5-6pm. Founders: weekday evenings or weekend mornings. General professional: Tuesday-Wednesday 10am-12pm.

**Alternative angles:** Provide 2-5 different ways to approach the same topic. Each angle should be genuinely different (not just rephrasing) — different hook, different audience segment, different emotional trigger. Include rationale for why each angle works.

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- Write in the tone specified (or default to 'professional yet approachable' if none specified).
- If seoKeywords are provided, weave the primary keyword naturally into the hook and body. Never keyword-stuff.
- If brandContext.avoidPhrases are provided, never use those phrases.
- If brandContext.keyPhrases are provided, weave at least one naturally into the post body.
- Never use "I'm excited to share", "Thrilled to announce", "Let's connect", "Thoughts?" as standalone CTAs — these are LinkedIn clichés that signal low effort.
- Do NOT fabricate engagement metrics, follower counts, or specific performance predictions.
- The post must be ready to copy-paste into LinkedIn with zero editing.`;

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

  // Bake Brand DNA into the GM at seed time — single source of truth, no
  // runtime merging. See scripts/lib/brand-dna-helper.js for the standing rule.
  const brandDNA = await fetchBrandDNA(db, PLATFORM_ID);
  const resolvedSystemPrompt = mergeBrandDNAIntoSystemPrompt(SYSTEM_PROMPT, brandDNA);

  const existing = await db.collection(COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty && !force) {
    console.log(`✓ LinkedIn Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'LinkedIn Expert',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 10000,
      supportedActions: ['generate_content'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'Task #29 seed script',
    notes: 'v1 LinkedIn Expert rebuild — seeded via CLI for proof-of-life verification (Task #29)',
  };

  await db.collection(COLLECTION).doc(GM_ID).set(doc);
  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Industry prompt length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  Resolved prompt length: ${resolvedSystemPrompt.length} chars (industry + Brand DNA)`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
