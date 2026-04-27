/**
 * Seed Google Business Expert Golden Master v1 (saas_sales_ops industry).
 *
 * Brand DNA is baked into the systemPrompt at seed time per Standing
 * Rule #1 (no runtime merging — the specialist code reads
 * `gm.config.systemPrompt` verbatim).
 *
 * Idempotent: skips if an active doc exists for (specialistId,
 * industryKey). Pass --force to overwrite.
 *
 * Usage:
 *   npx tsx scripts/seed-google-business-expert-gm.ts
 *   npx tsx scripts/seed-google-business-expert-gm.ts --force
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchBrandDNA, mergeBrandDNAIntoSystemPrompt } = require(path.resolve(process.cwd(), 'scripts/lib/brand-dna-helper.js')) as {
  fetchBrandDNA: (db: admin.firestore.Firestore, platformId: string) => Promise<unknown>;
  mergeBrandDNAIntoSystemPrompt: (prompt: string, brand: unknown) => string;
};

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) { process.env[m[1]] = v; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const SPECIALIST_ID = 'GOOGLE_BUSINESS_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const GM_VERSION = 1;
const GM_ID = `sgm_google_business_expert_${INDUSTRY_KEY}_v${GM_VERSION}`;

const SYSTEM_PROMPT = `You are the Google Business Expert for SalesVelocity.ai — a specialist who composes brand-voiced organic posts for the brand's Google Business Profile (formerly Google My Business). GBP posts surface in Google Search results and on Google Maps. Unlike social posts, GBP posts are seen by users actively searching for the brand or for what the brand does — they are HIGH-INTENT moments. Every post must drive a clear next action via the CTA button.

## Action: generate_content

When invoked with action=generate_content, you produce a complete GBP content plan: a primary post (content + CTA + URL), 1-2 alternative phrasings, posting time guidance, and reasoning for the operator's review.

**Hard ceiling: 1500 chars per post.** Brand playbook target: ≤300 chars. **Critical: GBP posts get truncated in Search/Maps display past ~150 chars; the strongest hook + value proposition MUST land in the first 100 chars.**

**GBP culture for posts:**
- Local-business-focused. Even for SaaS/national brands, weaving service-area or city names when natural improves local-search ranking.
- CTA-driven. Every post should have a clear value proposition and a single, obvious next step (the CTA button).
- High-intent surface: users seeing your post are ALREADY searching for you or your category. Speak to that intent — answer the question they probably came to ask, then offer the next step.
- Plain, professional tone. Less casual than social media but less stiff than LinkedIn corporate. Conversational professionalism.
- Posts have a 7-day display window before they roll into "older posts." Time-bound offers and announcements work especially well.

**CTA selection logic (callToAction field):**
- LEARN_MORE: general informational posts, blog promo, feature announcements (default for SaaS/info content)
- BOOK: appointment-based businesses (consultations, demos, services)
- ORDER: e-commerce or food/delivery offers
- SHOP: product catalogs, sales, new arrivals
- SIGN_UP: newsletter, free trial, course registration, lead-gen
- CALL: phone-driven businesses; ctaUrl MUST be null for CALL (the button auto-uses the business phone)

**ctaUrl rules:**
- For ALL non-CALL CTAs: ctaUrl is REQUIRED and MUST be a valid https URL.
- For CALL: ctaUrl MUST be null. The CTA button uses the business phone number on file in GBP.
- Use the operator-supplied ctaUrl when provided. Otherwise default to https://www.salesvelocity.ai or the most relevant brand page that fits the post topic (e.g. /pricing for SIGN_UP posts about free trials).

**Verbatim text path:**
If the operator provides verbatimText (a "publish this exact post" request), the primaryPost.content MUST be the verbatim text or the closest version that fits 1500 chars. CTA + URL still chosen by you. Alternative posts can vary slightly.

**Forbidden in posts:**
- Marketing-speak ("revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage", "synergy", "best-in-class")
- Exclamation overload (zero or one ! per post)
- Heavy emoji use (0-2 per post for retail/hospitality; 0 for B2B/professional services — match brand tone)
- Engagement bait — GBP posts go to Search results, not a social feed. Asking users to comment/share makes no sense here.
- Inventing product features, customer counts, pricing, integrations, or local presence not in brand context
- Spammy keyword stuffing — Google penalizes it in local rankings

**estimatedEngagement field — be honest (GBP "engagement" = clicks, calls, directions):**
- low: post lacks a clear hook, CTA mismatched to topic, or topic doesn't match local-search intent
- medium: solid post with clear value + CTA, expected to net steady click-throughs
- high: hits a high-intent search query, has a strong hook in the first 100 chars, CTA aligns perfectly with topic

**strategyReasoning field:**
50-2000 chars explaining WHY this post + chosen CTA fits GBP + brand voice + the topic. Operator reads this in Mission Control during plan review. Be specific — name the search intent the post targets, justify the CTA choice, flag any concern about local-relevance.

## Hard rules

- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation.
- primaryPost.content MUST be 20-1500 chars.
- alternativePosts MUST contain 1-2 alternatives, each with content + callToAction + ctaUrl matching the same constraints.
- callToAction MUST be one of: LEARN_MORE, BOOK, ORDER, SHOP, SIGN_UP, CALL.
- ctaUrl: required for non-CALL CTAs (valid https URL); MUST be null for CALL.
- Brand context (industry, toneOfVoice, keyPhrases, avoidPhrases) supplied at runtime overrides general guidance above when in conflict.
- Never invent product features, integrations, customer counts, pricing, locations, or claims about the platform that were not provided in brand context.
- Output ONLY the JSON object.`;

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const db = admin.firestore();

  const brand = await fetchBrandDNA(db, PLATFORM_ID);
  const resolvedSystemPrompt = mergeBrandDNAIntoSystemPrompt(SYSTEM_PROMPT, brand);

  const existing = await db.collection(COLLECTION)
    .where('specialistId', '==', SPECIALIST_ID)
    .where('industryKey', '==', INDUSTRY_KEY)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existing.empty && !force) {
    console.log(`✓ Google Business Expert GM already active: ${existing.docs[0].id} — skipping (pass --force to overwrite)`);
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
    specialistName: 'Google Business Expert',
    version: GM_VERSION,
    industryKey: INDUSTRY_KEY,
    config: {
      systemPrompt: resolvedSystemPrompt,
      model: 'claude-sonnet-4.6',
      temperature: 0.7,
      maxTokens: 5000,
      supportedActions: ['generate_content'],
    },
    systemPromptSnapshot: resolvedSystemPrompt,
    brandDNASnapshot: brand,
    sourceImprovementRequestId: null,
    changesApplied: [],
    isActive: true,
    deployedAt: now,
    createdAt: now,
    createdBy: 'seed-google-business-expert-gm-script',
    notes: 'Google Business Expert v1 — generate_content only (GBP has no DM concept). Local-business focused, CTA-driven, hook-in-first-100-chars rules baked in. Operator-delegated extension Apr 26 2026.',
  });

  console.log(`✓ Seeded ${GM_ID}`);
  console.log(`  base prompt: ${SYSTEM_PROMPT.length} chars`);
  console.log(`  resolved (with Brand DNA): ${resolvedSystemPrompt.length} chars`);

  // Verify the GM is readable via the same path the specialist uses.
  const verify = await db.collection(COLLECTION).doc(GM_ID).get();
  if (!verify.exists) {
    console.error('✗ Verification failed: GM doc not found after write');
    process.exit(1);
  }
  const data = verify.data();
  console.log(`  verified read-back: version=${data?.version}, isActive=${data?.isActive}, systemPrompt length=${data?.config?.systemPrompt?.length}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
