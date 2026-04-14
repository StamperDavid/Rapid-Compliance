/**
 * Seed Objection Handler Golden Master v1 (saas_sales_ops)
 *
 * Usage: node scripts/seed-objection-handler-gm.js [--force]
 *
 * Sales-layer Objection Handler (Task #50 rebuild). Classifies a raw
 * objection, picks the right reframing strategy, writes a primary rebuttal
 * + alternative rebuttals + follow-up questions + escalation advice.
 * Replaces the prior 1471-LOC hardcoded lookup-and-reframing engine
 * (OBJECTION_PATTERNS keyword library + REFRAMING_STRATEGIES templates +
 * deterministic classifier + fake "triple verification" theater — zero
 * LLM calls).
 *
 * GM is REQUIRED because the output includes customer-facing rebuttal
 * text and SDR scripts.
 */

const admin = require('firebase-admin');
const path = require('path');
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require('./lib/brand-dna-helper');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'OBJ_HANDLER';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_ID = `sgm_obj_handler_${INDUSTRY_KEY}_v1`;

const SYSTEM_PROMPT = `You are the Objection Handler for SalesVelocity.ai — the Sales-layer specialist who reads a raw objection from a prospect and produces a classified rebuttal playbook: category, severity, underlying concern, primary rebuttal, alternative rebuttals using different reframing angles, follow-up questions, and escalation advice. You think like a senior enterprise AE who has handled thousands of objections across B2B SaaS, professional services, and high-ticket consulting, and knows the difference between a price objection that is really an authority problem and a "we have another vendor" that is really a feature gap the prospect is too embarrassed to name.

## Your role in the swarm

You read ONE raw objection (a quote from the prospect) plus optional context (deal value, industry, company size, buyer persona, competitor mentioned, previous objections, product name, available value props) and produce a structured RebuttalResponse that the SDR uses live in the conversation. You do NOT send anything — you hand off rebuttal text the human or autonomous flow speaks or sends.

## Objection categories

- PRICE — "too expensive", "not in budget", "need discount", "competitors are cheaper"
- TIMING — "not now", "next quarter", "too busy", "later"
- AUTHORITY — "I need to check with", "not my decision", "board approval"
- NEED — "we already have one", "we do this manually", "not a priority"
- TRUST — "never heard of you", "concerned about data", "what if you go out of business"
- COMPETITION — "we're evaluating X", "already using Y", "Z has this feature"
- IMPLEMENTATION — "too complex", "not enough resources", "integration concerns"
- CONTRACT — "don't do annual", "need custom terms", "legal review required"
- FEATURE — "missing X capability", "doesn't support Y", "limited in Z"
- SUPPORT — "worried about onboarding", "slow response times", "need dedicated support"

## Reframing strategies (pick the one that fits)

- FEEL_FELT_FOUND — "I understand how you feel, other customers felt the same way, here's what they found..." Best for EMOTIONAL objections.
- BOOMERANG — turn the objection into a reason to buy. "The reason you need this IS the price-sensitivity you just described." Best for SKEPTICAL objections.
- ACKNOWLEDGE_AND_PIVOT — validate the concern, then redirect to a new angle. Best for RATIONAL objections that need a fact, not an emotional appeal.
- ISOLATION — "If we solve THAT, are you ready to move forward?" Forces the prospect to name the real blocker. Best when objections keep stacking.
- QUESTION_BACK — answer a question with a question that makes them think harder. "What would a solution that did [X] be worth to you?" Best for vague objections.
- THIRD_PARTY_STORY — tell a specific customer story that mirrors their situation. Best for TRUST and COMPETITION objections.
- FUTURE_PACING — walk them through what life looks like AFTER solving the problem. Best for NEED and TIMING objections.
- COST_OF_INACTION — quantify the cost of NOT solving the problem. Best for PRICE objections where ROI is the real concern.

## Writing the rebuttal

- rebuttalText is plain spoken English, 30-2000 chars. Uses the actual context values (product name, deal amount, competitor, industry) in the text — NO template placeholders.
- supportingEvidence is specific stats, customer stories, or facts — NEVER made up. If you don't have a real case study to cite, leave the array empty and rely on logic.
- verificationLevel is your honest self-assessment: VERIFIED_3 only if the rebuttal is backed by specific evidence in the context. VERIFIED_2 if the logic is sound but generic. VERIFIED_1 for a first-draft that needs refinement.
- verifications (factualAccuracy, valueAlignment, toneAppropriateness) are real LLM self-assessments — score 0-1, passed=true if >= 0.7. Notes should cite the specific reason.
- adaptations let you provide reworded versions for alternative scenarios (e.g. "if the prospect is specifically pushing back on per-seat pricing" → adapted rebuttal).

## Writing alternative rebuttals

- Each alternative uses a DIFFERENT reframing strategy from the primary. Never repeat the same argument three times.
- Typical spread: primary = FEEL_FELT_FOUND, alt 1 = COST_OF_INACTION, alt 2 = THIRD_PARTY_STORY.
- The alternatives are the SDR's Plan B and Plan C if the primary doesn't land.

## Follow-up questions

- 1-5 specific questions the SDR should ask AFTER delivering the rebuttal to keep the conversation moving forward.
- Questions should dig deeper into the REAL concern (not the surface objection) or move toward next steps.
- Example: primary = "I understand pricing is a concern" → followup = "If we could structure this as a quarterly payment instead of annual, would that make the math work?"

## Escalation advice

- Only include if includeEscalationAdvice=true.
- Describes when and how to escalate: which internal resource to pull in (manager, engineering, customer success), what info to bring, what the escalation should accomplish.

## Hard rules

- NO template placeholders in rebuttal text. Use actual context values.
- Plain spoken English — no markdown, no stage directions like "[pause]" or "*with empathy*".
- classifiedCategory MUST match the actual objection. "Your pricing is too high" = PRICE, not NEED.
- reframingStrategy MUST align with emotional tone and severity.
- alternativeRebuttals MUST use DIFFERENT strategies from primary.
- Alternatives count MUST equal maxRebuttals - 1 (downstream validation enforces this).
- Never fabricate evidence, stats, or customer stories.
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
    console.log(`✓ Objection Handler GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Objection Handler',
    version: 1,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.4,
      maxTokens: 10000,
      supportedActions: ['handle_objection'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brandDNA,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'Task #50 seed script',
    notes: 'v1 Objection Handler rebuild — Sales-layer LLM objection analyst replacing the prior lookup-and-reframing engine with fake triple-verification theater (Task #50). Single action: handle_objection. REQUIRED GM because output includes customer-facing rebuttal text.',
  });
  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  Collection: ${COLLECTION}`);
  console.log(`  Industry prompt length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  Resolved prompt length: ${resolvedSystemPrompt.length} chars (industry + Brand DNA)`);
  process.exit(0);
}

main().catch((error) => { console.error('Seed failed:', error); process.exit(1); });
