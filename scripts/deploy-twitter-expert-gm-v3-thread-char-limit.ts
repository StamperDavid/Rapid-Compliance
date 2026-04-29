/**
 * Deploy TWITTER_X_EXPERT GM v3 — strengthen the 280-char-per-tweet rule.
 *
 * Operator-delegated edit per `feedback_delegation_vs_self_training` memory.
 * Trigger: Apr 29 2026 multi-platform test halted because TWITTER_X_EXPERT
 * generated a thread where item #4 ran > 280 chars and the Zod schema
 * rejected it. Mission `mission_req_1777471695574_c9047m`.
 *
 * Root cause:
 *   v2's "## Hard rules" contains:
 *     `- EVERY tweet text field MUST be 280 characters or fewer. Count carefully. This is non-negotiable.`
 *   The rule is correct but too passive — LLMs are notoriously poor at
 *   character-counting, and "count carefully" gives no enforcement
 *   mechanism. Result: occasional over-280 items survive into output.
 *
 * Fix:
 *   Replace that single line with a stronger directive that:
 *     1. Sets the *target* at ≤ 270 chars to leave safety margin for
 *        emoji/multi-byte counting differences between LLM tokenizer
 *        and downstream Zod validator.
 *     2. Mandates an explicit pre-output audit step: "before producing the
 *        final JSON, count each thread item, rewrite any that exceed 270."
 *     3. Names the failure mode explicitly (schema rejection, lost round-trip)
 *        so the LLM understands the cost of over-length.
 *     4. Calls out two common traps observed in the halted mission output
 *        ("I just discovered..." openings; @-mention + link CTAs).
 *
 * Per Standing Rule #1, Brand DNA stays baked in — the surgical replace
 * does not touch the Brand DNA section.
 *
 * Per Standing Rule #2, this is operator-delegated — owner explicitly
 * directed the correction this turn after surfacing the schema error.
 *
 * Idempotent: refuses to apply if v3 already exists. Pass --force to recreate.
 *
 * Usage:
 *   npx tsx scripts/deploy-twitter-expert-gm-v3-thread-char-limit.ts
 *   npx tsx scripts/deploy-twitter-expert-gm-v3-thread-char-limit.ts --force
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  createIndustryGMVersionFromEdit,
  deployIndustryGMVersion,
  getActiveSpecialistGMByIndustry,
  invalidateIndustryGMCache,
  listIndustryGMVersions,
} from '@/lib/training/specialist-golden-master-service';

const SPECIALIST_ID = 'TWITTER_X_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const SOURCE_FEEDBACK_ID = `tfb_twitter_thread_char_limit_${Date.now()}`;
const CREATED_BY = 'operator-delegated:claude:apr-29-2026';

const CURRENT_TEXT = `- EVERY tweet text field MUST be 280 characters or fewer. Count carefully. This is non-negotiable.`;

const PROPOSED_TEXT = `- HARD CONSTRAINT — every tweet text field (thread items, standalone tweet, alternative hooks, all of them) MUST be ≤ 280 characters. Aim for ≤ 270 characters to leave safety margin: LLM tokenizers count characters differently than the downstream Zod validator (especially for emoji, smart quotes, and zero-width characters), so 278 in your head can be 282 at validation. Before producing the final JSON, AUDIT each text field one by one: count its characters, and if ANY field exceeds 270, REWRITE that field shorter before outputting. Do NOT submit and hope. Common over-length traps to watch for: "I just discovered..." or "Here's what nobody tells you about..." openings often balloon when a specific detail is appended; CTAs that combine an @-mention plus a URL plus a sentence eat the budget instantly; em-dashes count as 1 char but feel shorter; ellipses ("...") are 3 chars not 1. Schema validation downstream will REJECT the entire output if any item is > 280, halting the mission and wasting the LLM round-trip — this is non-negotiable.`;

const RATIONALE = 'v2 rule "Count carefully" was too passive. LLMs are unreliable character-counters; the rule needs (a) a target below the hard cap to leave safety margin, (b) an explicit pre-output audit step, (c) the cost of failure named, (d) common traps. Fixes the schema-rejection halt observed Apr 29 2026 in mission_req_1777471695574_c9047m.';

async function ensureFeedbackRecord(): Promise<void> {
  if (!adminDb) { throw new Error('adminDb not initialized'); }
  const collectionPath = getSubCollection('trainingFeedback');
  const ref = adminDb.collection(collectionPath).doc(SOURCE_FEEDBACK_ID);
  const now = new Date().toISOString();
  await ref.set({
    id: SOURCE_FEEDBACK_ID,
    targetSpecialistId: SPECIALIST_ID,
    targetSpecialistName: 'Twitter/X Expert',
    sourceReportTaskId: 'mission_req_1777471695574_c9047m',
    sourceReportExcerpt: 'TWITTER_X_EXPERT generate_content output: thread.4.text exceeded 280 chars; Zod schema rejected the output. Step 1 eventually recovered, but the wasted round-trip is symptomatic of v2\'s passive char-counting rule.',
    grade: 'request_revision',
    explanation: 'Strengthen the 280-char rule: aim for ≤270 (safety margin), require an explicit pre-output audit, name the cost of failure (schema rejection halts mission), and call out common over-length traps.',
    graderUserId: CREATED_BY,
    graderDisplayName: 'Operator (David) via Claude',
    status: 'applied',
    linkedImprovementRequestId: null,
    createdAt: now,
    updatedAt: now,
    appliedAt: now,
    notes: 'Operator-delegated direct GM edit per feedback_delegation_vs_self_training memory.',
  });
  console.log(`✓ TrainingFeedback record created: ${SOURCE_FEEDBACK_ID}`);
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  if (!adminDb) {
    console.error('adminDb not initialized — check FIREBASE_ADMIN_* env vars');
    process.exit(1);
  }

  const activeGM = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, INDUSTRY_KEY);
  if (!activeGM) {
    console.error(`No active GM for ${SPECIALIST_ID}:${INDUSTRY_KEY}.`);
    process.exit(1);
  }
  console.log(`Active GM: ${activeGM.id} (v${activeGM.version})`);
  console.log(`  systemPrompt length: ${activeGM.systemPromptSnapshot?.length ?? 0} chars`);

  if (activeGM.version >= 3 && !force) {
    console.log(`✓ Active GM is already v${activeGM.version} (>= v3). Skipping. Pass --force to recreate.`);
    process.exit(0);
  }

  const versions = await listIndustryGMVersions(SPECIALIST_ID, INDUSTRY_KEY);
  const existingV3 = versions.find((v) => v.version === 3);
  if (existingV3 && !force) {
    console.log(`v3 doc exists: ${existingV3.id} (active=${existingV3.isActive}). Deploying it directly.`);
    const deployResult = await deployIndustryGMVersion(SPECIALIST_ID, INDUSTRY_KEY, 3);
    if (!deployResult.success) {
      console.error(`Deploy failed: ${deployResult.error}`);
      process.exit(1);
    }
    invalidateIndustryGMCache(SPECIALIST_ID, INDUSTRY_KEY);
    console.log(`✓ v3 deployed.`);
    process.exit(0);
  }

  if (existingV3 && force) {
    console.log(`--force passed: deleting existing v3 doc ${existingV3.id}`);
    await adminDb
      .collection(`organizations/rapid-compliance-root/specialistGoldenMasters`)
      .doc(existingV3.id)
      .delete();
  }

  const currentPrompt = activeGM.systemPromptSnapshot ?? activeGM.config.systemPrompt;
  if (typeof currentPrompt !== 'string') {
    console.error('Active GM has no systemPromptSnapshot or config.systemPrompt. Cannot edit.');
    process.exit(1);
  }
  if (!currentPrompt.includes(CURRENT_TEXT)) {
    console.error('Anchor (currentText) not found verbatim in active prompt. Cannot apply surgical edit.');
    console.error(`  Looking for: ${CURRENT_TEXT.slice(0, 80)}...`);
    process.exit(1);
  }

  await ensureFeedbackRecord();

  console.log('\n[1/3] Creating TWITTER_X_EXPERT GM v3 from surgical edit...');
  const newGM = await createIndustryGMVersionFromEdit(
    SPECIALIST_ID,
    INDUSTRY_KEY,
    {
      currentText: CURRENT_TEXT,
      proposedText: PROPOSED_TEXT,
      rationale: RATIONALE,
      sourceTrainingFeedbackId: SOURCE_FEEDBACK_ID,
    },
    CREATED_BY,
  );
  if (!newGM) {
    console.error('createIndustryGMVersionFromEdit returned null');
    process.exit(1);
  }
  console.log(`  ✓ Created ${newGM.id} (v${newGM.version})`);

  console.log(`\n[2/3] Deploying ${newGM.id} (atomic switch v${activeGM.version} → v${newGM.version})...`);
  const deployResult = await deployIndustryGMVersion(SPECIALIST_ID, INDUSTRY_KEY, newGM.version);
  if (!deployResult.success) {
    console.error(`Deploy failed: ${deployResult.error}`);
    process.exit(1);
  }
  invalidateIndustryGMCache(SPECIALIST_ID, INDUSTRY_KEY);
  console.log(`  ✓ v${newGM.version} deployed`);

  console.log('\n[3/3] Verifying — re-loading active GM...');
  const after = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, INDUSTRY_KEY);
  if (!after || after.id !== newGM.id) {
    console.error(`✗ Active GM is ${after?.id ?? '?'} but expected ${newGM.id}`);
    process.exit(1);
  }
  if (!(after.systemPromptSnapshot ?? '').includes('HARD CONSTRAINT — every tweet text field')) {
    console.error('✗ Active GM does not contain the new rule text');
    process.exit(1);
  }
  console.log(`  ✓ Active GM is ${after.id} and contains the new rule`);
  console.log(`  Prompt length: ${activeGM.systemPromptSnapshot?.length ?? 0} → ${after.systemPromptSnapshot?.length ?? 0} chars`);

  console.log('\n=== ✓ TWITTER_X_EXPERT v3 deployed ===');
  console.log(`Rollback if needed: deployIndustryGMVersion('${SPECIALIST_ID}', '${INDUSTRY_KEY}', 2)`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
