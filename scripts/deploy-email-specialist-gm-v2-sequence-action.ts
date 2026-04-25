/**
 * Deploy Email Specialist GM v2 — adds documentation for the new
 * `compose_outreach_sequence` action.
 *
 * Why: the Email Specialist code now supports two actions
 * (compose_email + compose_outreach_sequence) but the v1 GM prompt only
 * describes compose_email. Without a v2 GM, when the Outreach Manager
 * dispatches `action: 'compose_outreach_sequence'`, the LLM doesn't
 * know what shape to output.
 *
 * Surgical edit: insert a new "Action: compose_outreach_sequence"
 * section between the existing compose_email section and the Email
 * Purpose Taxonomy block. Nothing else is touched — Brand DNA, subject
 * craft, body craft, PS craft, hard rules all ride forward.
 *
 * Standing Rules:
 *   #1 (Brand DNA baked in): preserved by createIndustryGMVersionFromEdit's
 *      forward-copy of config.
 *   #2 (no grades = no GM changes): operator delegated this end-to-end on
 *      2026-04-25 per feedback_delegation_vs_self_training. The new
 *      sourceTrainingFeedbackId captures that authorization.
 *
 * Rollback: rollbackSpecialistGM('EMAIL_SPECIALIST', 'saas_sales_ops', 1).
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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
  } else {
    throw new Error('No serviceAccountKey.json');
  }
}

initAdmin();

import {
  createIndustryGMVersionFromEdit,
  deployIndustryGMVersion,
  getActiveSpecialistGMByIndustry,
} from '../src/lib/training/specialist-golden-master-service';

const CURRENT_TEXT = `- rationale prose

## The Email Purpose Taxonomy (runtime injection)`;

const PROPOSED_TEXT = `- rationale prose

## Action: compose_outreach_sequence

Given a campaign name, target audience (a SINGLE prospect — name, role, company, vertical, recent triggers), goal, sequenceLength (2-10), optional cadence hint, optional suggestedPurposeSlug, and a brief from the Outreach Manager, produce a coherent N-email cold outreach sequence personalized for that ONE prospect, with a deliberate narrative arc across the emails.

The output is a JSON object containing:

- campaignName, sequenceLength, narrativeArcSummary (80-2000 chars — name the arc explicitly: how each email builds on the prior toward the goal)
- emails (array of exactly sequenceLength elements, stepIndex 1..N in order, totalSteps=N on every element)
  - per-email: stepIndex, totalSteps, stepPurposeSlug (one slug per step from the active taxonomy), narrativeRole (this email's job in the arc), subjectLine, previewText, bodyPlainText, ctaLine, psLine, personalizationNotes, sendTimingHint
- toneAndAngleReasoning, followupSuggestion, spamRiskNotes (sequence-level — cumulative spam risk across N emails matters), rationale

Rules that are stricter for sequences than for single emails:

- Step 1 opens with prospect-specific context (pain, trigger, role, vertical) in the first 2 sentences. Step 2+ opens with continuity from prior steps ("Following up on the {{vertical}} note", "Saw you didn't bite on the demo") — NEVER a generic greeting on a follow-up.
- Each step has exactly ONE call-to-action. Across the sequence, asks should escalate (curiosity → specific question → meeting request → final).
- sendTimingHint on each step aligns with the cadence hint. If the caller passes "day 1, day 4, day 8" and sequenceLength is 3, then step hints are "day 1", "day 4", "day 8" in order. If no cadence given, infer reasonable spacing (rule of thumb: 3-5 days between cold-outreach touches).
- Brand DNA governs voice across ALL steps. avoidPhrases must not appear in any prose field across the whole sequence. keyPhrases, if present, weave into bodies or PS lines naturally.
- spamRiskNotes is sequence-level and accounts for burnout: receiving N pitches from a stranger in 1-2 weeks has cumulative inbox cost. Be honest.
- The narrativeArcSummary and each step's narrativeRole MUST make the inter-email connections explicit. Generic descriptions ("step 2 follows up") are a failure.
- The emails array length MUST equal the requested sequenceLength. If you cannot produce N coherent emails for this brief, return fewer is NOT acceptable — fail the call and explain why so the operator can supply a fuller brief.

The schema is the same shape as compose_email's per-email fields (subjectLine, previewText, bodyPlainText, ctaLine, psLine, personalizationNotes) plus the sequence-level fields (narrativeArcSummary, sequenceLength, totalSteps on each step).

## The Email Purpose Taxonomy (runtime injection)`;

async function main(): Promise<void> {
  const activeGM = await getActiveSpecialistGMByIndustry('EMAIL_SPECIALIST', 'saas_sales_ops');
  if (!activeGM) {
    console.error('No active Email Specialist GM');
    process.exit(1);
  }

  const config = activeGM.config as { systemPrompt?: string };
  const currentPrompt = config.systemPrompt ?? activeGM.systemPromptSnapshot ?? '';
  console.log(`Active Email Specialist GM: ${activeGM.id} v${activeGM.version} (${currentPrompt.length} chars)`);

  if (!currentPrompt.includes(CURRENT_TEXT)) {
    console.error('');
    console.error('CURRENT_TEXT not found verbatim in active GM. v2 may already be deployed or prompt drifted.');
    console.error('Dump prompt with `npx tsx scripts/dump-email-specialist-gm.ts` and reconcile.');
    process.exit(2);
  }

  console.log('CURRENT_TEXT located — creating new version with new action documentation');

  const newGM = await createIndustryGMVersionFromEdit(
    'EMAIL_SPECIALIST',
    'saas_sales_ops',
    {
      currentText: CURRENT_TEXT,
      proposedText: PROPOSED_TEXT,
      rationale:
        'Document the new compose_outreach_sequence action — produces a coherent N-email cold outreach sequence personalized for a single prospect, with narrative arc across the emails. Closes the architecture gap where Copywriter handles broadcast nurture sequences and compose_email handles single outreach, but nothing handled multi-email cold outreach drips. Inserted between compose_email and the Email Purpose Taxonomy header so all other sections (subject craft, body craft, PS craft, etc.) ride forward unchanged.',
      sourceTrainingFeedbackId: 'operator-delegated-2026-04-25-outreach-sequence-action',
    },
    'claude-assistant-outreach-sequence-action',
  );

  if (!newGM) {
    console.error('createIndustryGMVersionFromEdit returned null');
    process.exit(3);
  }

  console.log(`Created Email Specialist GM v${newGM.version} (${newGM.id})`);

  // Patch supportedActions to include compose_outreach_sequence so the
  // runtime check in specialist.ts sees the new action.
  const db = admin.firestore();
  const PLATFORM_ID = 'rapid-compliance-root';
  const collectionPath = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
  const newConfig = newGM.config as Record<string, unknown>;
  const currentSupported = Array.isArray(newConfig.supportedActions)
    ? (newConfig.supportedActions as string[])
    : ['compose_email'];
  const mergedSupported = Array.from(new Set([...currentSupported, 'compose_outreach_sequence']));
  await db.collection(collectionPath).doc(newGM.id).update({
    'config.supportedActions': mergedSupported,
  });
  console.log(`Patched supportedActions on v${newGM.version}: [${mergedSupported.join(', ')}]`);

  const deployResult = await deployIndustryGMVersion('EMAIL_SPECIALIST', 'saas_sales_ops', newGM.version);
  if (!deployResult.success) {
    console.error(`Deploy failed: ${deployResult.error}`);
    process.exit(4);
  }
  console.log(`Deployed Email Specialist GM v${newGM.version} as active`);
  console.log('');
  console.log(`Rollback: rollbackSpecialistGM("EMAIL_SPECIALIST", "saas_sales_ops", ${activeGM.version})`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('deploy-email-specialist-gm-v2 failed:', err);
  process.exit(1);
});
