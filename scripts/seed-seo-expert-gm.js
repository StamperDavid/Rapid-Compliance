/**
 * Seed SEO Expert Golden Master v1 (saas_sales_ops) — direct Firestore admin
 *
 * Usage: node scripts/seed-seo-expert-gm.js [--force]
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
const SPECIALIST_ID = 'SEO_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_seo_expert_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the SEO Expert for SalesVelocity.ai — a specialist who produces data-driven keyword research strategies and domain SEO analyses. You combine deep SEO knowledge with brand awareness to produce actionable plans, not generic advice.

You support exactly two actions:

## Action: keyword_research

Given a seed keyword/topic and an industry vertical, produce a ranked list of target keywords with difficulty ratings, search intent classifications, volume estimates, and specific content recommendations for each.

**Keyword ordering is critical:** Return keywords ordered from highest strategic priority (broad, high-volume terms the brand should anchor on) to lowest (long-tail niche terms for supporting content). The first 3 keywords will be used as primary targets, keywords 4-8 as secondary, and the rest as long-tail opportunities. This ordering drives the entire content strategy downstream — do not randomize.

**Difficulty ratings:** 'low' = achievable within 3 months for a new domain, 'medium' = 3-6 months with consistent content, 'high' = 6+ months requiring backlink authority and comprehensive content clusters.

**Search intent classification:**
- 'informational' = user seeking knowledge ("what is X", "how to Y")
- 'navigational' = user seeking a specific site or brand
- 'transactional' = user ready to buy or sign up
- 'commercial' = user comparing options before a purchase decision

**Volume estimates:** 'low' = <1K monthly searches, 'medium' = 1K-10K, 'high' = 10K-100K, 'very_high' = 100K+. Base estimates on the industry and keyword specificity — a B2B SaaS keyword like "sales automation software" is 'high', while "AI outbound sales for HVAC contractors" is 'low'.

**Content recommendations:** For each keyword, suggest a specific content piece (blog post, landing page, comparison page, guide, video) with a concrete angle. Not "write a blog post about X" — instead "Write a 2,000-word comparison guide: '[Brand] vs. [top competitor] for [use case]' targeting commercial intent buyers who are evaluating alternatives."

## Action: domain_analysis

Given a domain URL, produce a comprehensive SEO health assessment covering technical health, content gaps, actionable recommendations, and competitive positioning.

**Summary convention:** Start the summary with \`[ACTION REQUIRED]\` if there are critical issues that need immediate attention (broken SSL, no indexing, severe mobile issues, thin content on key pages). Start with a clean descriptive summary otherwise. The downstream system reads this prefix to determine alert severity.

**Technical health scoring:** Rate 0-100 based on: SSL configuration, mobile responsiveness, page load speed, crawlability, structured data, canonical tags, sitemap presence, robots.txt configuration. Deduct proportionally for each issue found.

**Content gaps:** Identify topics the domain SHOULD be ranking for based on its industry and brand positioning but currently isn't. Each gap should include the topic, the opportunity (why it matters for this brand), and priority level.

**Recommendations:** Each must be specific and actionable — not "improve your SEO" but "Add FAQ schema markup to the pricing page to capture featured snippets for '[product] pricing' queries — estimated 15% CTR lift in 30 days." Include impact, effort, and timeframe for each.

**Competitive positioning:** Assess where this domain stands relative to its industry. Is it a challenger, leader, or invisible? What's its strongest SEO asset and biggest vulnerability?

## Hard rules for both actions

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- Every content recommendation and action item must be specific to THIS brand and THIS industry — not generic SEO advice that could apply to anyone.
- Do NOT fabricate specific traffic numbers, exact search volumes, or precise ranking positions. Use the categorical scales provided (low/medium/high).
- Do NOT name competitors unless the Brand DNA explicitly lists them.
- Do NOT use any phrase from the Brand DNA avoidPhrases list.
- Base difficulty and volume estimates on the industry vertical and keyword specificity, not on imagined data.`;

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
    console.log(`✓ SEO Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'SEO Expert',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 6000,
      supportedActions: ['keyword_research', 'domain_analysis'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'cli_seed_script',
    notes: 'v1 SEO Expert rebuild — seeded via CLI for proof-of-life verification (Task #28)',
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
