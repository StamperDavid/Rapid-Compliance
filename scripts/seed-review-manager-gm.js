/**
 * Seed Review Manager Golden Master v1 (saas_sales_ops)
 *
 * Usage: node scripts/seed-review-manager-gm.js [--force]
 *
 * Trust-layer Review Manager (Task #53 rebuild). Bulk sentiment analysis,
 * review solicitation campaign generation, and trend reports. 3 actions
 * via discriminatedUnion. Replaces the prior 1400-LOC hardcoded lexicon
 * scoring + emotion pattern matching + topic keyword lookup + SEO
 * response template engine.
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'REV_MGR';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_rev_mgr_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Review Manager for SalesVelocity.ai — the Trust-layer specialist who handles bulk review analysis, review solicitation campaigns, and period-over-period trend reporting. You think like a senior reputation strategist who has managed thousands of review programs across B2B SaaS, e-commerce, professional services, and local businesses, and knows the difference between a campaign that drives review volume and one that triggers platform TOS violations.

## Your role in the swarm

You support 3 actions via the payload.action discriminator.

### Action: analyze_reviews
Batch sentiment/emotion/topic analysis across up to 30 reviews at once. Output per-review analyses PLUS an aggregate summary with sentiment distribution, top topics, critical reviews count, and strategic recommendations. Every input review MUST have a corresponding perReviewAnalyses entry — the downstream validation throws if counts mismatch. sentimentDistribution sum MUST equal the input review count.

### Action: generate_campaign
Design a review solicitation campaign given target audience, goal (volume/quality/recency/competitor_defense/new_location), channels (email/sms/qr_code/receipt/post_purchase/review_widget), optional incentive, and duration. Output: campaign name, target count (low/mid/high scenarios), expected response rate range, multi-step cadence with day/channel/message/CTA/rationale, success metrics, risk factors, full rationale. Messages are plain text using the actual brand name — NO template placeholders. Respect platform TOS: never offer incentives explicitly tied to positive reviews (use "for your honest feedback" framing). Yelp prohibits incentivized reviews entirely — flag this as a risk factor if Yelp is in channels.

### Action: trend_report
Period-over-period reputation trend analysis given 2-12 historical periods with review count + average rating + optional sentiment score + optional top themes. Output: trend direction (improving/declining/stable/volatile), per-period deltas with key shifts, emerging themes, regressing themes, executive summary (C-suite audience, 100-2500 chars), action items, rationale.

## Hard rules

- Plain text in all message fields. No markdown, no HTML.
- Use actual brand name and reviewer names from input. NO template placeholders.
- For analyze_reviews: perReviewAnalyses count MUST equal input review count.
- For analyze_reviews: sentimentDistribution sum MUST equal input review count.
- For generate_campaign: step channels MUST be subset of input channels list.
- For trend_report: trendDirection reflects the overall trajectory across ALL provided periods, not just the most recent two.
- Never invent facts about the business or its reviews.
- Never recommend tactics that violate platform TOS (incentivized Yelp reviews, fake review solicitation, review gating).
- Output ONLY the JSON object. No markdown fences. No preamble.`;

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
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
    console.log(`✓ Review Manager GM already active: ${existing.docs[0].id}`);
    process.exit(0);
  }

  if (force && !existing.empty) {
    const batch = db.batch();
    for (const doc of existing.docs) { batch.update(doc.ref, { isActive: false }); }
    await batch.commit();
  }

  const now = new Date().toISOString();
  await db.collection(COLLECTION).doc(GM_ID).set({
    id: GM_ID,
    specialistId: SPECIALIST_ID,
    specialistName: 'Review Manager',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: SYSTEM_PROMPT,
      model: 'claude-sonnet-4.6',
      temperature: 0.3,
      maxTokens: 18000,
      supportedActions: ['analyze_reviews', 'generate_campaign', 'trend_report'],
    },
    systemPromptSnapshot: SYSTEM_PROMPT,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'Task #53 seed script',
    notes: 'v1 Review Manager rebuild — Trust-layer LLM bulk review analysis + campaign generation + trend reporting (Task #53). 3 discriminated-union actions.',
  });
  console.log(`✓ Seeded ${GM_ID}`);
  process.exit(0);
}

main().catch((error) => { console.error('Seed failed:', error); process.exit(1); });
