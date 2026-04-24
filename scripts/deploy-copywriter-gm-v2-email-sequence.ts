/**
 * Deploy Copywriter GM v2 — adds `generate_email_sequence` action documentation
 * to the system prompt. v1 is preserved as inactive for rollback.
 *
 * Context: the Content Manager hang on contentType="email_sequence" (see
 * memory/project_content_manager_email_sequence_hang.md) was fixed in code by
 * adding an EMAIL_SEQUENCE intent with a Copywriter-only path, plus extending
 * the Copywriter specialist with a `generate_email_sequence` action handler.
 * This script updates the Copywriter GM's system prompt so the LLM knows about
 * the new action and what the user message will contain.
 *
 * Uses createIndustryGMVersionFromEdit + deployIndustryGMVersion so v1 is
 * preserved (isActive=false) and rollback is a single call to
 * rollbackSpecialistGM('COPYWRITER', 'saas_sales_ops', 1).
 *
 * Standing Rule #1 respected: Brand DNA is already baked into v1's prompt at
 * seed time; createIndustryGMVersionFromEdit copies the config object forward
 * so Brand DNA rides along unchanged.
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

const CURRENT_SECTION = `## The Content Manager sends you one of two actions

**Action 1: generate_page_copy** — you receive a page definition (id, name, purpose, sections) plus SEO keywords and Brand DNA context. You produce full copy for that page: H1, H2s per section, body copy per section, primary CTA, metadata block.

**Action 2: generate_proposal** — you receive prospect context (company name, industry, pain points, contact name, techStack) plus Brand DNA. You produce a personalized proposal body: opening hook tied to their specific situation, 3-5 value sections mapped to their pain points, and a closing call to action with a concrete next step.

The exact JSON schema for each action is provided in the user message. Follow it precisely.`;

const PROPOSED_SECTION = `## The Content Manager sends you one of three actions

**Action 1: generate_page_copy** — you receive a page definition (id, name, purpose, sections) plus SEO keywords and Brand DNA context. You produce full copy for that page: H1, H2s per section, body copy per section, primary CTA, metadata block.

**Action 2: generate_proposal** — you receive prospect context (company name, industry, pain points, contact name, techStack) plus Brand DNA. You produce a personalized proposal body: opening hook tied to their specific situation, 3-5 value sections mapped to their pain points, and a closing call to action with a concrete next step.

**Action 3: generate_email_sequence** — you receive a topic, audience, email count (1-20), optional cadence description (e.g. "over 14 days", "day 1, 3, 7, 14"), and optional trigger event (e.g. "trial_signup", "abandoned_cart"). You produce exactly the requested number of emails, each with a subjectLine (under 80 chars), previewText (under 120 chars), body (100-200 words, plain text, 2-4 short paragraphs, second-person voice), cta (ONE concrete next action), and sendTimingHint (human-readable timing aligned with cadence).

For email sequences:
- Each email must have a distinct narrative purpose. Do not repeat the same angle across emails.
- The typical 5-email nurture arc is: (1) welcome + orient, (2) name the core problem, (3) show the solution with a proof point, (4) handle the most likely objection, (5) conversion push with urgency.
- When count differs from 5, adapt the arc — compress or expand, but never skip the welcome/orient and conversion push bookends when count is 2 or more.
- Every email has exactly one cta. Multiple CTAs dilute conversion.
- Plain-text body only, no HTML, no markdown headers. Paragraph breaks only.
- Subject lines must not fake a reply thread (no "RE:" or "FWD:" prefix) unless the sequence is explicitly a re-engagement flow.
- order field is a contiguous sequence: 1, 2, 3, ... through count, with no gaps or duplicates.

The exact JSON schema for each action is provided in the user message. Follow it precisely.`;

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

  if (!currentPrompt.includes(CURRENT_SECTION)) {
    console.error('');
    console.error('The CURRENT_SECTION text does not appear verbatim in the active GM prompt.');
    console.error('This can happen if the prompt has already been updated or if formatting drifted.');
    console.error('Refusing to write. Dump the active prompt with dump-copywriter-gm.ts and');
    console.error('reconcile the CURRENT_SECTION constant against the live text.');
    process.exit(1);
  }

  console.log('CURRENT_SECTION located in active prompt. Creating new version...');

  const newGM = await createIndustryGMVersionFromEdit(
    'COPYWRITER',
    'saas_sales_ops',
    {
      currentText: CURRENT_SECTION,
      proposedText: PROPOSED_SECTION,
      rationale:
        'Document the new generate_email_sequence action — Content Manager now routes email_sequence / nurture_sequence / drip_campaign contentType through a dedicated Copywriter-only path instead of FULL_PACKAGE. This unblocks workflow-001 / workflow-002 matrix prompts that were halting due to sequential video+blog+music+podcast calls timing out.',
      sourceTrainingFeedbackId: 'content-manager-hang-fix-option-b-email-sequence',
    },
    'claude-assistant-email-sequence-rebuild',
  );

  if (!newGM) {
    console.error('createIndustryGMVersionFromEdit returned null — see server logs');
    process.exit(1);
  }

  console.log(`Created Copywriter GM v${newGM.version} (${newGM.id})`);

  // Also update supportedActions in the new version's config since the Zod shape
  // added generate_email_sequence. The service copies `config` forward; we patch
  // the copied doc so the runtime check in specialist.ts passes.
  const db = admin.firestore();
  const PLATFORM_ID = 'rapid-compliance-root';
  const collectionPath = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
  const currentSupported = Array.isArray((newGM.config as Record<string, unknown>).supportedActions)
    ? ((newGM.config as Record<string, unknown>).supportedActions as string[])
    : ['generate_page_copy', 'generate_proposal'];
  const mergedSupported = Array.from(new Set([...currentSupported, 'generate_email_sequence']));
  await db.collection(collectionPath).doc(newGM.id).update({
    'config.supportedActions': mergedSupported,
  });
  console.log(`Patched supportedActions on v${newGM.version}: [${mergedSupported.join(', ')}]`);

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
  console.log('Rollback path: rollbackSpecialistGM("COPYWRITER", "saas_sales_ops", 1)');
  process.exit(0);
}

main().catch((err) => {
  console.error('deploy-copywriter-gm-v2-email-sequence failed:', err);
  process.exit(1);
});
