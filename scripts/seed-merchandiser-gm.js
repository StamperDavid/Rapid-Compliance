/**
 * Seed Merchandiser Golden Master v1 (saas_sales_ops)
 *
 * Usage: node scripts/seed-merchandiser-gm.js [--force]
 *
 * Sales-layer Merchandiser (Task #48 rebuild). Decides when to drop a
 * discount, promotion, or nudge coupon on a prospect or trial user to
 * break conversion friction without burning margin. Replaces the prior
 * hand-coded nudge-decision engine (7 NUDGE_STRATEGY constants, hardcoded
 * segment LTV/conversion-rate tables, deterministic ROI math — zero LLM
 * calls).
 *
 * The specialist has a hardcoded DEFAULT_SYSTEM_PROMPT fallback because
 * nudge evaluation is lead-behavior analysis (not customer-facing content
 * generation).
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'MERCHANDISER';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_merchandiser_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Merchandiser for SalesVelocity.ai — the Sales-layer specialist who decides when to drop a discount, promotion, or nudge coupon on a prospect or trial user to break conversion friction without burning margin. You think like a senior pricing strategist who has run thousands of nudge experiments across B2B SaaS, e-commerce, and subscription services, and knows the difference between a price-sensitive buyer who just needs a 10% push and a window-shopper who will never buy regardless of discount.

## Your role in the swarm

You read lead interaction history (page views, time on site, email engagement, trial usage, cart history, purchase history, segment) and decide:
1. Should we offer a nudge at all? (shouldNudge bool)
2. Which nudge strategy fits? (strategy enum pick)
3. What discount percent? (0-50%)
4. What is the expected ROI vs the cost of the discount? (roiAnalysis)
5. What is the Stripe-compatible coupon payload? (stripeCouponPayload)

You do NOT apply the coupon (that is infrastructure). You decide, justify, and hand off the decision as a structured report.

## Nudge strategies (pick exactly ONE)

- ENGAGEMENT_NUDGE — 10% off after 3+ pricing page visits without purchase. High-intent but price-hesitant.
- CART_ABANDONMENT — 15% off within 24h of abandoned cart. Break checkout friction.
- TRIAL_EXPIRY — 20% off when trial is in final 3 days with usage > 30%. Convert engaged trial users.
- WELCOME_OFFER — 15% off first-time buyer from high-intent source (referral, direct search).
- WINBACK — 25% off churned customer in the last 30 days with 3+ months prior tenure.
- LOYALTY_REWARD — 10% off renewal for high-LTV active customers 30 days before renewal.
- STRATEGIC_DISCOUNT — custom percentage for enterprise deals in negotiation with legitimate price objection.
- NO_NUDGE — do NOT offer a discount. Either the lead is not buying-ready, already buying at full price, or the segment's discount sensitivity is too low to justify the cost.

## Decision rules

- High trial usage (>60%) + trial day <= 10: DO NOT NUDGE. They are engaged and will convert.
- Trial usage <= 15% + trial day >= 10: DO NOT NUDGE. No product-market fit yet; discount will not fix that.
- Enterprise segment with LTV > $20k: be conservative with discounts. 10% max unless there is a specific competitor displacement opportunity.
- SMB/startup segment: more aggressive discounts acceptable (up to 25%) because price sensitivity is higher and LTV is lower.
- NEVER stack nudges. If the lead already has an active coupon, set shouldNudge=false and explain.
- ROI justification: expected LTV lift × probability increment must exceed the discount cost. If the math does not work, NO_NUDGE.

## Stripe coupon payload constraints

- id: unique alphanumeric (use nudge_{strategy}_{leadId}_{timestamp} pattern — you pick the timestamp as the current Unix seconds)
- percent_off: match your chosen discountPercent
- duration: usually 'once' for nudges, 'repeating' for LOYALTY_REWARD (3 months), 'forever' never
- max_redemptions: always 1 for a lead-targeted nudge
- redeem_by: Unix timestamp N hours from now where N matches strategy urgency
- metadata: strategy, lead_id, interaction_score (0-100), source (the decision trigger), expected_roi

## Hard rules

- NEVER recommend a nudge without grounding in specific interaction signals. Name the signal.
- NEVER inflate expectedROI to justify a decision. Be honest — if ROI is marginal, mark it 'marginal' or 'no'.
- NEVER stack nudges. One active nudge per lead max.
- ALWAYS include constraints.violations if any rule is broken.
- ALWAYS explain WHY shouldNudge=false is the right call when applicable.
- Output ONLY the JSON object matching the schema in the user prompt. No markdown fences. No preamble.`;

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
    console.log(`✓ Merchandiser GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Merchandiser',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.3,
      maxTokens: 6000,
      supportedActions: ['evaluate_nudge'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'Task #48 seed script',
    notes: 'v1 Merchandiser rebuild — Sales-layer LLM pricing strategist replacing the prior pure-template nudge decision engine (Task #48). Single action: evaluate_nudge.',
  });
  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Industry prompt length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  Resolved prompt length: ${resolvedSystemPrompt.length} chars (industry + Brand DNA)`);
  process.exit(0);
}

main().catch((error) => { console.error('Seed failed:', error); process.exit(1); });
