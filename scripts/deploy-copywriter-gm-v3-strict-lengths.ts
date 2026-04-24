/**
 * Deploy Copywriter GM v3 — tighten previewText + subjectLine length
 * constraints so the Zod schema stops rejecting 5-email nurture runs.
 *
 * Symptom: approximately 1 in 3 generate_email_sequence runs at count>=4
 * produced a previewText over 120 chars on the 4th or 5th email, causing
 * the specialist to throw "emails.N.previewText: String must contain at
 * most 120 character(s)" and the entire sequence to fail. The current v2
 * prompt describes the cap as "under 120 chars" — descriptive, not
 * prescriptive — and the LLM occasionally drifts past it.
 *
 * Surgical edit: exactly the Action 3 paragraph. No other section
 * touched. Brand DNA, action 1/2 descriptions, sequence arc guidance,
 * and supportedActions all ride forward unchanged because
 * createIndustryGMVersionFromEdit copies the config forward and only
 * substitutes the matched text.
 *
 * Standing Rules:
 *   #1 (Brand DNA baked into GM) — preserved, copied forward by the
 *      versioning service.
 *   #2 (no grades = no GM edits) — operator explicitly delegated this
 *      edit end-to-end on 2026-04-24 per the
 *      feedback_delegation_vs_self_training rule. Feedback ID below
 *      captures that authorization.
 *
 * Rollback: `rollbackSpecialistGM("COPYWRITER", "saas_sales_ops", 2)`
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) {
        const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[m[1]]) { process.env[m[1]] = v; }
      }
    }
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    } as admin.ServiceAccount),
  });
}

initAdmin();

import {
  createIndustryGMVersionFromEdit,
  deployIndustryGMVersion,
  getActiveSpecialistGMByIndustry,
} from '../src/lib/training/specialist-golden-master-service';

const CURRENT_TEXT =
  '**Action 3: generate_email_sequence** — you receive a topic, audience, email count (1-20), optional cadence description (e.g. "over 14 days", "day 1, 3, 7, 14"), and optional trigger event (e.g. "trial_signup", "abandoned_cart"). You produce exactly the requested number of emails, each with a subjectLine (under 80 chars), previewText (under 120 chars), body (100-200 words, plain text, 2-4 short paragraphs, second-person voice), cta (ONE concrete next action), and sendTimingHint (human-readable timing aligned with cadence).';

const PROPOSED_TEXT =
  '**Action 3: generate_email_sequence** — you receive a topic, audience, email count (1-20), optional cadence description (e.g. "over 14 days", "day 1, 3, 7, 14"), and optional trigger event (e.g. "trial_signup", "abandoned_cart"). You produce exactly the requested number of emails, each with a subjectLine (STRICT maximum 80 characters including spaces — aim for 40-60 chars), previewText (STRICT maximum 120 characters including spaces — aim for 80-100 chars, a single 10-18 word sentence, never two sentences), body (100-200 words, plain text, 2-4 short paragraphs, second-person voice), cta (ONE concrete next action), and sendTimingHint (human-readable timing aligned with cadence). Count characters before emitting every subjectLine and previewText — the Zod validator rejects the entire sequence on any single overshoot, so it is safer to write short and leave 20 chars of headroom than to pack in the full limit.';

async function main(): Promise<void> {
  const activeGM = await getActiveSpecialistGMByIndustry('COPYWRITER', 'saas_sales_ops');
  if (!activeGM) {
    console.error('No active Copywriter GM found');
    process.exit(1);
  }

  const currentPrompt = typeof activeGM.config.systemPrompt === 'string'
    ? activeGM.config.systemPrompt
    : activeGM.systemPromptSnapshot ?? '';

  console.log(`Active Copywriter GM: ${activeGM.id} v${activeGM.version} (${currentPrompt.length} chars)`);

  if (!currentPrompt.includes(CURRENT_TEXT)) {
    console.error('');
    console.error('The CURRENT_TEXT does not appear verbatim in the active GM prompt.');
    console.error('This usually means v3 (or similar) was already deployed, or the prompt has drifted.');
    console.error('Dump the active prompt with `npx tsx scripts/dump-copywriter-gm.ts` and reconcile.');
    process.exit(1);
  }

  console.log('CURRENT_TEXT located — creating new version with surgical edit');

  const newGM = await createIndustryGMVersionFromEdit(
    'COPYWRITER',
    'saas_sales_ops',
    {
      currentText: CURRENT_TEXT,
      proposedText: PROPOSED_TEXT,
      rationale:
        'Tighten subjectLine + previewText length constraints. The v2 wording ("under N chars") is descriptive and the LLM occasionally drifts past the Zod caps (80 chars subject, 120 chars preview). Restating both as "STRICT maximum including spaces" with suggested targets (40-60 subject, 80-100 preview) plus an explicit "count before emitting" reminder closes the flake. No other section touched — Brand DNA, action 1/2, sequence arc rules, and supportedActions ride forward unchanged.',
      sourceTrainingFeedbackId: 'operator-delegated-2026-04-24-preview-length-flake',
    },
    'claude-assistant-preview-length-fix',
  );

  if (!newGM) {
    console.error('createIndustryGMVersionFromEdit returned null — see server logs');
    process.exit(1);
  }

  console.log(`Created Copywriter GM v${newGM.version} (${newGM.id})`);

  const deployResult = await deployIndustryGMVersion(
    'COPYWRITER',
    'saas_sales_ops',
    newGM.version,
  );
  if (!deployResult.success) {
    console.error(`Deploy failed: ${deployResult.error}`);
    process.exit(1);
  }

  console.log(`Deployed Copywriter GM v${newGM.version} as active`);
  console.log('');
  console.log(`Rollback: rollbackSpecialistGM("COPYWRITER", "saas_sales_ops", ${activeGM.version})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('deploy-copywriter-gm-v3-strict-lengths failed:', err);
  process.exit(1);
});
