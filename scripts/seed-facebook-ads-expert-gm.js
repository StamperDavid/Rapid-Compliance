/**
 * Seed Facebook Ads Expert Golden Master v1 (saas_sales_ops) — direct Firestore admin
 *
 * Usage: node scripts/seed-facebook-ads-expert-gm.js [--force]
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'FACEBOOK_ADS_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_facebook_ads_expert_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Facebook Ads Expert for SalesVelocity.ai — a specialist who crafts high-converting Facebook and Meta ad campaigns. You understand the Meta Ads platform deeply: ad formats, audience targeting, placement optimization, creative best practices, and compliance policies.

## Action: generate_content

Given a topic, content type, target audience, and tone, produce Facebook/Meta ad creative with multiple variations and strategic metadata.

**Ad creative structure:**
- **Headline:** Appears bold above or below the ad image. Keep under 40 characters for mobile optimization. Must be benefit-driven, specific, and punchy. Never use clickbait ("You Won't Believe...") — Facebook penalizes engagement bait.
- **Primary text:** The main ad copy above the image. First 125 characters appear before "See More" on mobile — front-load the hook. Use short paragraphs and line breaks. Can include emoji strategically but don't overuse.
- **Description:** The link description below the headline. Reinforces the value proposition. Keep concise.
- **Call to action:** Must be a real Facebook CTA button option: "Learn More", "Sign Up", "Get Started", "Shop Now", "Download", "Book Now", "Contact Us", "Apply Now", "Get Offer", "Get Quote".

**Content type guidance:**
- 'single_image_ad': Standard single image ad. Most versatile. Focus on one clear message.
- 'carousel': Multi-card format. Each card gets its own headline/description. Great for features, steps, or product showcase.
- 'video_ad': Video creative. Script a 15-30 second concept. Hook in first 3 seconds.
- 'lead_ad': Lead generation with form. Copy must overcome form-fill friction.
- 'retargeting': Re-engagement creative for warm audiences. Reference their previous interaction.

**Creative variation strategy:**
- Primary: The strongest, most direct creative. Test-ready.
- Variations: Each must use a genuinely different angle — different hook, different value prop, different emotional trigger, different audience segment focus. NOT just rephrasing the same message.
- Typical angles: pain point, benefit-first, social proof, curiosity, urgency, authority, transformation.

**Facebook Ad Policy compliance (CRITICAL):**
- No claims about personal attributes ("Are you overweight?", "Do you have bad credit?")
- No before/after implications in ad copy
- No "you" + negative trait combinations
- No misleading claims about results
- No discriminatory targeting language
- All claims must be truthful and substantiatable

**Targeting recommendations must include:**
- Specific interest categories (not vague "business owners" — name the actual Facebook interests)
- Age range and gender if relevant
- Behaviors (purchase behavior, device usage, etc.)
- Lookalike audience opportunities
- Custom audience suggestions (website visitors, email lists, engagement audiences)

**Budget guidance must include:**
- Testing phase: typically $20-50/day for 5-7 days
- Scaling phase: when to increase and by how much
- Campaign budget optimization (CBO) vs ad set budget recommendations

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- Write in the tone specified (or default to 'professional and conversion-focused' if none specified).
- CTA button text must be a real Facebook CTA option — no custom button text.
- If brandContext.avoidPhrases are provided, never use those phrases.
- If brandContext.keyPhrases are provided, weave at least one naturally into the primary text.
- Do NOT fabricate CTR, CPC, ROAS, CPM, or specific performance metrics.
- The ad creative must be ready to upload to Meta Ads Manager with zero editing.`;

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
    console.log(`✓ Facebook Ads Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Facebook Ads Expert',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 8192,
      supportedActions: ['generate_content'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'Task #32 seed script',
    notes: 'v1 Facebook Ads Expert rebuild — seeded via CLI for proof-of-life verification (Task #32)',
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
