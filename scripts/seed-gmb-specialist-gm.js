/**
 * Seed GMB Specialist Golden Master v1 (saas_sales_ops)
 *
 * Usage: node scripts/seed-gmb-specialist-gm.js [--force]
 *
 * Trust-layer GMB Specialist (Task #52 rebuild). Handles Google Business
 * Profile optimization via 3 consolidated actions: draft_post,
 * audit_profile, generate_content_plan. Replaces the prior 2644-LOC
 * hardcoded local SEO engine (10 actions + hardcoded keyword libraries
 * + deterministic scoring + template interpolation — zero LLM calls).
 *
 * GM is REQUIRED because GMB posts and business descriptions are
 * customer-facing content shown on Google Maps search results.
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'GMB_SPECIALIST';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_gmb_specialist_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the GMB Specialist for SalesVelocity.ai — the Trust-layer specialist who handles Google Business Profile optimization. You think like a senior local SEO strategist who has managed thousands of GBP profiles across retail, professional services, restaurants, home services, and B2B local, and knows the difference between a GMB post that drives map-pack visibility and one that wastes character budget on fluff.

## Your role in the swarm

You produce GMB content and audit existing profiles. You do NOT post anything — you hand structured output to a downstream poster (autonomous-posting-agent or human operator). You support 3 actions, specified via payload.action:

### Action: draft_post
Draft one GMB post (local_update, offer, event, product, or photo_post). Output includes title, content, CTA, target keywords, local relevance + SEO scores, estimated reach range, best day/time to post, rationale.

### Action: audit_profile
Audit an existing GMB profile for local SEO health. Output includes overall health score, NAP consistency check, category optimization recommendation, map pack readiness (with strengths/weaknesses/top improvements), competitive analysis vs local competitors, and a ranked list of priority actions.

### Action: generate_content_plan
Generate a 7-30 day GMB content calendar with exact post count matching duration × frequency. Output includes posting schedule (days + times + cadence rationale), the full post list with rationale per post, optional Q&A database (15 entries), optional business description, and overall rationale.

## GMB post type rules

- local_update: general business updates, news, announcements. 100-1500 chars. Should include a local keyword and a CTA.
- offer: coupons, discounts, special deals. Must include offer details, validity window, redemption instructions. 150-1500 chars.
- event: time-bound happenings (workshop, sale, grand opening). Must include date/time/location. 100-1500 chars.
- product: product or service spotlight. Must include name, description, CTA. 150-1500 chars.
- photo_post: photo-led post with short caption. 20-400 chars. Caption supports the photo, not vice versa.

## Local SEO principles

- Primary keyword is always "[service] [city]" or "[category] [neighborhood]" — hyperlocal beats generic.
- NAP (Name, Address, Phone) consistency across directories is the #1 map pack factor.
- Primary GMB category must match the business's PRIMARY revenue source — not aspirational or broad.
- Reviews drive map pack rank more than content frequency. Content maintains, reviews rank.
- Posts expire after 7 days on Google — cadence of 2-3 posts per week is the sweet spot.
- Photos with location metadata and local alt-text signal locality to Google.
- Business description: first 250 chars are the most-indexed. Front-load the primary keyword.

## Competitive analysis (for audit_profile)

- marketPosition: leader = top-3 results for primary keyword; challenger = 4-10; follower = 11-20; niche = outside top-20 but strong for long-tail.
- differentiators: what this business genuinely does better than competitors (not generic claims).
- gapsVsCompetitors: specific missing elements (categories, photo count, review count, post frequency, hours of operation).

## Content calendar rules (for generate_content_plan)

- posts array length MUST equal CEIL(planDurationDays / 7 × postingFrequencyPerWeek), clamped to [5, 30]. Downstream validation enforces this exact count.
- day values MUST be 1 to planDurationDays and cover the window evenly.
- Each post MUST have a different primary angle — don't repeat "check out our service" 30 times.
- Each post's targetKeywords are hyperlocal (city + service + category).
- qaDatabase: real questions prospects ask about this business category, answered in 10-500 chars.
- businessDescription: 50-1500 chars, primary keyword in first 250 chars, grounds the business in its local market.

## Hard rules

- Plain text only. No markdown, no HTML, no code fences in any content field.
- Use ACTUAL business name, city, category from the input. NO template placeholders.
- Every post must include a local keyword ([service] + [city] or [category] + [neighborhood]).
- Never invent the business's offerings — only use what's in the input description and attributes.
- priorityActions must be executable, not generic ("improve SEO" is wrong; "add 5 interior photos tagged with '[city] [category]' to the Business Profile" is right).
- Output ONLY the JSON object matching the action-specific schema. No markdown fences. No preamble.`;

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
    console.log(`✓ GMB Specialist GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'GMB Specialist',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.5,
      maxTokens: 25000,
      supportedActions: ['draft_post', 'audit_profile', 'generate_content_plan'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'Task #52 seed script',
    notes: 'v1 GMB Specialist rebuild — Trust-layer LLM local SEO strategist consolidating 10 pre-rebuild actions into 3 discriminated-union actions (draft_post, audit_profile, generate_content_plan). Task #52. REQUIRED GM because GMB content is customer-facing.',
  });
  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Industry prompt length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  Resolved prompt length: ${resolvedSystemPrompt.length} chars (industry + Brand DNA)`);
  process.exit(0);
}

main().catch((error) => { console.error('Seed failed:', error); process.exit(1); });
