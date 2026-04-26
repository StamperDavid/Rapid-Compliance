/**
 * X Expert Golden Master v2 — DM REPLY PLAYBOOK
 *
 * Operator-delegated GM edit per `feedback_delegation_vs_self_training`.
 * David explicitly delegated the v2 edit during the Apr 26 2026 inbound
 * DM rebuild session: "build the Jasper-mediated path with the toggle
 * baked in" → which requires the X Expert specialist to know how to
 * compose a DM reply when called via `action=compose_dm_reply`. This
 * script:
 *
 *   1. Loads the active v1 X Expert GM for industry=saas_sales_ops
 *   2. Surgically inserts the DM REPLY PLAYBOOK section right before
 *      the "## Hard rules" anchor (which already exists verbatim in v1)
 *   3. Bumps `supportedActions` to include `compose_dm_reply`
 *   4. Writes v2 via createIndustryGMVersionFromEdit
 *   5. Deploys v2 via deployIndustryGMVersion (deactivates v1)
 *   6. Logs the diff for audit
 *
 * Per Standing Rule #1, Brand DNA stays baked in — it lives in the v1
 * `systemPromptSnapshot` and the surgical replace preserves the entire
 * Brand DNA section verbatim. We only inject a new playbook above the
 * "## Hard rules" anchor; we do not touch Brand DNA.
 *
 * Per Standing Rule #2, this is operator-delegated — Claude is driving
 * the pipeline at David's direction, but the rule that gates GM edits
 * to operator-approved corrections is honored: the trigger is David's
 * explicit message "build the Jasper-mediated path", not an autonomous
 * agent self-improving.
 *
 * Idempotent: if v2 already exists, the script bails. Pass --force to
 * recreate (deactivates the existing v2 first).
 *
 * Usage:
 *   npx tsx scripts/deploy-twitter-expert-gm-v2.ts
 *   npx tsx scripts/deploy-twitter-expert-gm-v2.ts --force
 */

import 'dotenv/config';
import { adminDb } from '@/lib/firebase/admin';
import {
  createIndustryGMVersionFromEdit,
  deployIndustryGMVersion,
  getActiveSpecialistGMByIndustry,
  invalidateIndustryGMCache,
  listIndustryGMVersions,
} from '@/lib/training/specialist-golden-master-service';

const SPECIALIST_ID = 'TWITTER_X_EXPERT';
const INDUSTRY_KEY = 'saas_sales_ops';
const FEEDBACK_ID = 'operator_delegated_2026-04-26_inbound_dm_rebuild';

const ANCHOR_BEFORE = '## Hard rules';

const DM_REPLY_PLAYBOOK = `## Action: compose_dm_reply

When invoked with action=compose_dm_reply, you are responding to a single inbound direct message that arrived in the brand's DM inbox. The output is one short conversational reply, NOT a thread, NOT marketing copy. Treat it like a real person on the brand team replying to a real person who just messaged them.

**Hard ceiling: 240 characters per reply.** This is the brand's DM playbook ceiling, not X's 10000-char DM limit. Long replies in DMs read as marketing-speak and kill the thread.

**Read the inbound message first, then reply to THAT message.** Generic templates ("Thanks for reaching out!") are forbidden. Acknowledge the specific thing the sender said. If they asked a question, answer the question. If they made a comment, respond to the comment. If they pitched something, decline politely.

**Tone match:**
- Sender is casual / friendly → reply casual but on-brand. Keep proper grammar; no excessive abbreviations.
- Sender is hostile / complaining → polite holding reply, set suggestEscalation=true. Never argue, never apologize for things outside the brand's control, never commit the brand to anything specific.
- Sender is asking technical / sales questions → answer concretely if you can do so within brand context, point them to https://www.salesvelocity.ai for anything beyond a one-line answer.
- Sender is spam / irrelevant → polite decline + stop. Set confidence=high, suggestEscalation=false. Example: "Appreciate the message — not a fit for us right now. Best of luck."

**Forbidden in DM replies:**
- Pricing quotes (always direct to the website for pricing)
- Specific product feature claims unless explicitly in brand context
- Inventory of integrations, customer counts, or social proof unless explicitly in brand context
- Marketing-speak ("revolutionary", "industry-leading", "game-changing", "unlock", "transform")
- Exclamation overload (zero or one ! per reply, never two)
- Emoji (this brand voice does not use them in DMs)
- URLs other than https://www.salesvelocity.ai
- "Thanks for reaching out!" or any variant — it signals templated reply

**confidence field:**
- high: reply is clearly on-brand, addresses the sender's specific question, no ambiguity in tone match
- medium: reply is reasonable but the inbound was ambiguous, or a human would probably want to tweak the wording
- low: the inbound was complex / hostile / off-topic and the reply is a holding pattern; operator should review before send

**suggestEscalation field:**
- true when: the inbound is hostile, complains about the brand, makes a legal/compliance reference, asks for something the brand cannot promise (custom pricing, specific delivery dates, integrations not yet built), or contains anything that could become a public PR issue
- false when: the inbound is a normal conversational DM the brand can handle without human escalation

**Reasoning field:**
The reasoning string explains in 1-3 sentences WHY this specific reply fits the inbound + brand voice. The operator reads this in Mission Control to decide whether to approve, edit, or escalate. Be specific — "matches the casual tone the sender used and answers their question about [X]" is good; "appropriate brand-voiced response" is useless.

`;

function diffSummary(before: string, after: string): { addedChars: number; removedChars: number } {
  return {
    addedChars: after.length - before.length,
    removedChars: 0,
  };
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');

  if (!adminDb) {
    console.error('adminDb not initialized — check FIREBASE_ADMIN_* env vars');
    process.exit(1);
  }

  const activeGM = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, INDUSTRY_KEY);
  if (!activeGM) {
    console.error(`No active GM for ${SPECIALIST_ID}:${INDUSTRY_KEY}. Run scripts/seed-twitter-expert-gm.js first.`);
    process.exit(1);
  }

  console.log(`Active GM: ${activeGM.id} (v${activeGM.version})`);
  console.log(`  systemPrompt length: ${activeGM.systemPromptSnapshot?.length ?? 0} chars`);

  if (activeGM.version >= 2 && !force) {
    console.log(`✓ Active GM is already v${activeGM.version} (>= v2). Skipping. Pass --force to recreate.`);
    process.exit(0);
  }

  const versions = await listIndustryGMVersions(SPECIALIST_ID, INDUSTRY_KEY);
  const existingV2 = versions.find((v) => v.version === 2);
  if (existingV2 && !force) {
    console.log(`✓ v2 doc exists: ${existingV2.id} (active=${existingV2.isActive}). Deploying it directly.`);
    const deployResult = await deployIndustryGMVersion(SPECIALIST_ID, INDUSTRY_KEY, 2);
    if (!deployResult.success) {
      console.error(`Deploy failed: ${deployResult.error}`);
      process.exit(1);
    }
    invalidateIndustryGMCache(SPECIALIST_ID, INDUSTRY_KEY);
    console.log(`✓ v2 deployed.`);
    process.exit(0);
  }

  if (existingV2 && force) {
    console.log(`--force passed: deleting existing v2 doc ${existingV2.id}`);
    await adminDb
      .collection(`organizations/rapid-compliance-root/specialistGoldenMasters`)
      .doc(existingV2.id)
      .delete();
  }

  const currentPrompt = activeGM.systemPromptSnapshot ?? activeGM.config.systemPrompt;
  if (typeof currentPrompt !== 'string') {
    console.error('Active GM has no systemPromptSnapshot or config.systemPrompt. Cannot edit.');
    process.exit(1);
  }

  if (!currentPrompt.includes(ANCHOR_BEFORE)) {
    console.error(`Anchor "${ANCHOR_BEFORE}" not found in v${activeGM.version} prompt. Cannot apply surgical edit.`);
    process.exit(1);
  }

  const proposedText = `${DM_REPLY_PLAYBOOK}${ANCHOR_BEFORE}`;

  console.log('Applying surgical edit:');
  console.log(`  currentText (anchor): ${ANCHOR_BEFORE.slice(0, 60)}...`);
  console.log(`  proposedText: inserts DM REPLY PLAYBOOK (${DM_REPLY_PLAYBOOK.length} chars) + anchor`);

  const newGM = await createIndustryGMVersionFromEdit(
    SPECIALIST_ID,
    INDUSTRY_KEY,
    {
      currentText: ANCHOR_BEFORE,
      proposedText,
      rationale: 'Add compose_dm_reply playbook so the X Expert can produce on-brand replies to inbound X DMs (Apr 26 2026 inbound DM auto-reply rebuild — operator-delegated)',
      sourceTrainingFeedbackId: FEEDBACK_ID,
    },
    'claude_session_2026-04-26_inbound_dm_rebuild',
  );

  if (!newGM) {
    console.error('createIndustryGMVersionFromEdit returned null');
    process.exit(1);
  }

  // Patch the new doc to add `compose_dm_reply` to supportedActions. The
  // surgical-edit helper only touches systemPrompt; supportedActions has
  // to be patched separately.
  const newConfig: Record<string, unknown> = { ...newGM.config };
  const currentActions = Array.isArray(newConfig.supportedActions) ? newConfig.supportedActions as string[] : [];
  const nextActions = currentActions.includes('compose_dm_reply')
    ? currentActions
    : [...currentActions, 'compose_dm_reply'];
  newConfig.supportedActions = nextActions;
  await adminDb
    .collection(`organizations/rapid-compliance-root/specialistGoldenMasters`)
    .doc(newGM.id)
    .update({ config: newConfig });

  console.log(`✓ Created ${newGM.id} (inactive, supportedActions=[${nextActions.join(', ')}])`);

  const deployResult = await deployIndustryGMVersion(SPECIALIST_ID, INDUSTRY_KEY, newGM.version);
  if (!deployResult.success) {
    console.error(`Deploy failed: ${deployResult.error}`);
    process.exit(1);
  }
  invalidateIndustryGMCache(SPECIALIST_ID, INDUSTRY_KEY);

  const after = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, INDUSTRY_KEY);
  const beforeLen = activeGM.systemPromptSnapshot?.length ?? 0;
  const afterLen = after?.systemPromptSnapshot?.length ?? 0;
  const diff = diffSummary(activeGM.systemPromptSnapshot ?? '', after?.systemPromptSnapshot ?? '');

  console.log(`✓ v${newGM.version} deployed.`);
  console.log(`  v${activeGM.version} prompt length: ${beforeLen} chars`);
  console.log(`  v${newGM.version} prompt length:  ${afterLen} chars (${diff.addedChars >= 0 ? '+' : ''}${diff.addedChars})`);
  console.log(`  active GM is now: ${after?.id ?? '?'}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('deploy-twitter-expert-gm-v2 failed:', err);
  process.exit(1);
});
