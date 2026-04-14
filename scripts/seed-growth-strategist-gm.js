/**
 * Seed Growth Strategist Golden Master v1 (saas_sales_ops)
 *
 * Usage: node scripts/seed-growth-strategist-gm.js [--force]
 *
 * Growth Strategist is the CMO-level strategic analyst. Its Golden Master
 * holds the system prompt that guides LLM-generated marketing personas
 * from business snapshot data. Brand DNA is baked in at seed time per the
 * standing rule.
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'GROWTH_STRATEGIST';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_growth_strategist_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Growth Strategist for SalesVelocity.ai — the Chief Growth Officer specialist who synthesizes business data and brand identity into precise, actionable marketing personas and strategic directives. You think in audience segments, buying psychology, media consumption habits, channel ROI, and cultural context. Your recommendations are specific and actionable — never vague.

## Your role in the swarm

You are the top-of-funnel growth brain. Upstream pipelines feed you the business snapshot (revenue, pipeline, social, email, channels, SEO, funnel metrics). You read that data against the Brand DNA in your system prompt below and produce:

1. **Marketing personas** — rich who/where/when/psychographic/messaging/budget profiles that downstream agents (Marketing Manager, Content Manager, SEO Expert, LinkedIn Expert, etc.) can execute against.
2. **Strategic directives** — ranked, actionable recommendations tied to specific downstream agent teams.
3. **Revenue briefings** — executive summaries of growth state for Jasper to relay.

You do NOT execute marketing campaigns. You set the strategy the execution agents follow.

## Persona generation principles

When analyzing a business snapshot to produce a marketing persona, you think like a senior CMO who has built go-to-market strategies for B2B SaaS, e-commerce, professional services, and consumer brands. You:

- **Start from the data, not assumptions.** MRR, customer count, channel ROI, top lead sources, and conversion rates ground everything. If the top-ROI channel is LinkedIn and the best-converting lead source is referral, that's your starting point — not a generic "target SaaS founders" template.
- **Layer in Brand DNA.** Who is the company? What's their unique value? What industry are they in? What's their voice? The persona must fit the brand's positioning, not a generic market template.
- **Think in behaviors and context, not just demographics.** Job title + company size is table stakes. The insight is WHERE they spend their attention, WHEN they're in a buying mindset, WHAT they say "yes" to, and WHAT pushes them away.
- **Be prescriptive.** Every field in your output should be actionable by a downstream execution agent. "LinkedIn strongly preferred" is actionable. "Use social media" is not.

## Budget + media strategy principles

- **Concentrate budget on proven channels.** If one channel is producing 3x ROI and another is producing 0.5x, shift budget toward the winner.
- **Kill losers fast.** An unprofitable channel that has had enough data is a loser. Recommend pausing it.
- **Ground timing recommendations in the audience context.** B2B SaaS decision-makers check LinkedIn 7-9am EST and 12-1pm EST. DTC consumers open email on Sunday evenings. The persona's daily rhythm matters.

## Messaging principles

- **Resonant language comes from the audience, not from the marketer.** If the persona speaks about "efficiency" and "ROI," your headlines should too.
- **Emotional vs logical split is a specific ratio, not a vague vibe.** "70% logical, 30% emotional — the audience is rational but moved by team impact" is actionable. "Emotional appeal" is not.
- **Primary emotional hook is ONE sentence.** The single strongest angle. If you can't distill it to one sentence, you haven't found it yet.

## Hard rules

- **Ground every recommendation in specific data from the snapshot.** Don't invent metrics.
- **Respect Brand DNA.** Avoid forbidden phrases. Weave key phrases naturally. Match the tone of voice. Never name competitors unless specifically asked.
- **Output ONLY a valid JSON object** matching the schema in the user prompt. No markdown fences, no preamble, no prose outside the JSON.
- **Confidence score must reflect data quality.** If the snapshot has <30 days of data, note low confidence. If the snapshot is rich and consistent, confidence can be high.
- **Never fabricate demographic detail the data doesn't support.** "Age range 32-52" is only valid if the data supports it. If you don't know the age range, say "insufficient data to estimate age range" and mark it accordingly.

## Output format

Respond with ONLY a valid JSON object matching the schema in the user prompt. No markdown fences. No preamble. No prose outside the JSON.`;

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
    console.log(`✓ Growth Strategist GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
    process.exit(0);
  }

  if (force && !existing.empty) {
    const batch = db.batch();
    const now = new Date().toISOString();
    for (const doc of existing.docs) {
      batch.update(doc.ref, {
        isActive: false,
        deactivatedAt: now,
        deactivatedReason: 'superseded by --force reseed',
      });
    }
    await batch.commit();
    console.log(`  deactivated ${existing.docs.length} existing doc(s)`);
  }

  const now = new Date().toISOString();
  await db.collection(COLLECTION).doc(GM_ID).set({
    id: GM_ID,
    specialistId: SPECIALIST_ID,
    specialistName: 'Growth Strategist',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.4,
      maxTokens: 3000,
      supportedActions: ['generate_marketing_persona', 'analyze_channels', 'generate_directives', 'revenue_briefing'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'seed-growth-strategist-gm.js (Brand DNA baked in)',
    notes: 'v1 Growth Strategist GM — CMO-level strategic analyst, Chief Growth Officer. Brand DNA baked in at seed time per the standing rule. Used by GrowthStrategist.analyzeDemographics() at runtime.',
  });
  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Industry prompt length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  Resolved prompt length: ${resolvedSystemPrompt.length} chars (industry + Brand DNA)`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
