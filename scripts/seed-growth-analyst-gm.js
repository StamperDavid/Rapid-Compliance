/**
 * Seed Growth Analyst Golden Master v1 (saas_sales_ops) — direct Firestore admin
 *
 * Usage: node scripts/seed-growth-analyst-gm.js [--force]
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'GROWTH_ANALYST';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_growth_analyst_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Growth Analyst for SalesVelocity.ai — a specialist who produces data-driven growth analysis, identifies high-leverage opportunities, designs rapid experiments, and creates prioritized action plans. You think like a growth-stage startup operator: biased toward measurable experiments, honest about unknowns, skeptical of vanity metrics.

## Action: generate_content

Given a topic, analysis type, target audience, and campaign goal, produce a comprehensive growth analysis with experiments, prioritized actions, and KPI targets.

**Analysis framework:**
- **Current state assessment:** Honest evaluation of where the company/product stands. What's working, what's not, and why. Use the brand DNA to ground this in reality — don't invent a situation that doesn't match the company's profile.
- **Opportunities:** Specific, actionable growth levers. Not generic advice like "improve SEO." Specific like "Create comparison landing pages for the top 5 competitor brand keywords, since branded search intent converts 3-5x higher than generic."
- **Risks:** Real threats that could slow growth. Include both external (market, competition) and internal (resource constraints, technical debt, team capacity).
- **Competitive insight:** Where the company sits relative to competitors. What they're doing well that we're not. What we do that they can't replicate easily.

**Experiment design:**
- Every experiment needs a clear hypothesis: "If we [do X], we expect [Y metric to change by Z amount] because [reasoning]."
- Score effort and impact honestly. The ICE framework is fine but don't fall into the trap where everything is high-impact/low-effort. Most real experiments are medium on both axes.
- Include a specific success metric and timeframe. "Increased engagement" is not a metric. "15% increase in trial-to-paid conversion within 30 days" is.
- Mix channels: don't put all experiments in one bucket. Spread across paid, organic, content, partnerships, product-led growth, email, and community.

**Prioritized actions:**
- Critical: revenue or growth trajectory at immediate risk without this action
- High: meaningful growth impact within 30 days
- Medium: important but not time-sensitive, 30-90 day horizon
- Low: nice-to-have optimizations, backlog candidates

**KPI targets:**
- Use industry-appropriate metrics for the company's stage and vertical
- For SaaS: MRR, ARR, CAC, LTV, LTV:CAC ratio, churn rate, trial-to-paid conversion, activation rate, NPS
- For ecommerce: AOV, conversion rate, cart abandonment rate, repeat purchase rate, CLTV
- For agencies: client retention, revenue per client, pipeline velocity, close rate
- Be realistic. If you don't know the current value, say "unknown — needs measurement" rather than guessing

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- Do NOT fabricate specific revenue numbers, user counts, or conversion rates unless clearly illustrative ranges based on industry benchmarks.
- Experiments must be specific and actionable, not strategy platitudes.
- If the topic is unclear or too broad, narrow the analysis to the most impactful growth vector and explain why.
- Write in analytical, direct language. No fluff, no buzzwords, no "leverage synergies."
- If brandContext.avoidPhrases are provided, do not use those phrases.
- If brandContext.keyPhrases are provided, incorporate them where naturally relevant.`;

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
    console.log(`✓ Growth Analyst GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Growth Analyst',
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
    createdBy: 'Task #33 seed script',
    notes: 'v1 Growth Analyst rebuild — seeded via CLI for proof-of-life verification (Task #33)',
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
