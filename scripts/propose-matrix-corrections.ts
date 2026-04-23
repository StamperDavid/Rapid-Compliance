/**
 * Draft corrections for the 3 training targets surfaced by the matrix:
 *
 *   1. Intent Expander mislabels action imperatives as advisory/factual
 *   2. Jasper confuses delegate_to_architect (strategy) with delegate_to_builder
 *      (execution) on page-build prompts
 *   3. Jasper misses create_workflow for nurture sequences
 *
 * For each correction this script:
 *   - Loads the target agent's ACTIVE Golden Master
 *   - Writes a grade / revision request describing the correction
 *   - Calls the Prompt Engineer to produce a surgical before→after edit
 *   - Captures the proposal
 *
 * Nothing is applied. Proposals are written to
 * `D:/rapid-dev/correction-proposals.json` for the operator to review before
 * approval triggers the apply step.
 *
 * Respects Standing Rule #2 — the human approval gate is preserved. This
 * script only PROPOSES; the follow-up apply step is separate.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) { process.env[key] = value; }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

import { proposePromptRevision } from '../src/lib/training/prompt-engineer-agent';
import { getActiveJasperGoldenMaster } from '../src/lib/orchestrator/jasper-golden-master';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';

interface Proposal {
  id: 'intent-expander-imperatives' | 'jasper-architect-vs-builder' | 'jasper-workflow-nurture';
  targetAgent: string;
  targetGMId: string;
  targetGMVersion: string | number;
  targetGMCollection: 'specialistGoldenMasters' | 'goldenMasters';
  failingPrompts: string[];
  observedBehavior: string;
  correctionInstruction: string;
  beforeSection: string;
  afterSection: string;
  changeDescription: string;
  clarifyingQuestion?: string;
  /** The assembled full prompt to write on apply. */
  fullRevisedPrompt: string;
}

async function proposeJasperCorrection(
  id: Proposal['id'],
  failingPrompts: string[],
  observedBehavior: string,
  correctionInstruction: string,
  context: string,
): Promise<Proposal> {
  const gm = await getActiveJasperGoldenMaster();
  if (!gm) { throw new Error('No active Jasper GM'); }

  const response = await proposePromptRevision({
    agentType: 'orchestrator',
    currentSystemPrompt: gm.systemPrompt,
    correction: correctionInstruction,
    context,
  });

  return {
    id,
    targetAgent: 'Jasper (Orchestrator)',
    targetGMId: gm.id,
    targetGMVersion: gm.version,
    targetGMCollection: 'goldenMasters',
    failingPrompts,
    observedBehavior,
    correctionInstruction,
    beforeSection: response.beforeSection,
    afterSection: response.afterSection,
    changeDescription: response.changeDescription,
    clarifyingQuestion: response.clarifyingQuestion,
    fullRevisedPrompt: response.fullRevisedPrompt,
  };
}

async function proposeIntentExpanderCorrection(
  failingPrompts: string[],
  observedBehavior: string,
  correctionInstruction: string,
  context: string,
): Promise<Proposal> {
  // The Intent Expander is a specialist (INTENT_EXPANDER) in the specialist
  // GM collection. It has no dedicated AgentDomain so we load it manually and
  // use the generic proposePromptRevision pattern, then write the proposal
  // under the same shape the orchestrator case uses. The specialist GM is
  // seeded with the industry key 'saas_sales_ops' per the service default.
  const INDUSTRY_KEY = 'saas_sales_ops';
  const activeGM = await getActiveSpecialistGMByIndustry('INTENT_EXPANDER', INDUSTRY_KEY);
  if (!activeGM) {
    throw new Error(`No active Intent Expander GM for industry ${INDUSTRY_KEY}`);
  }

  // Intent Expander doesn't match AgentDomain enum. The PE can still operate
  // on its prompt — we reuse the 'chat' agentType channel because the PE only
  // uses agentType for logging + labelling, not routing logic. See
  // prompt-engineer-agent.ts:70-120.
  const response = await proposePromptRevision({
    agentType: 'chat',
    currentSystemPrompt: activeGM.config.systemPrompt,
    correction: correctionInstruction,
    context,
  });

  return {
    id: 'intent-expander-imperatives',
    targetAgent: 'Intent Expander (specialist)',
    targetGMId: activeGM.id,
    targetGMVersion: activeGM.version,
    targetGMCollection: 'specialistGoldenMasters',
    failingPrompts,
    observedBehavior,
    correctionInstruction,
    beforeSection: response.beforeSection,
    afterSection: response.afterSection,
    changeDescription: response.changeDescription,
    clarifyingQuestion: response.clarifyingQuestion,
    fullRevisedPrompt: response.fullRevisedPrompt,
  };
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Drafting 3 correction proposals for matrix training targets');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const proposals: Proposal[] = [];

  // Correction 1 — Intent Expander ----------------------------------------
  console.log('1/3  Intent Expander — action imperatives misclassified as advisory/factual');
  const c1 = await proposeIntentExpanderCorrection(
    [
      'Call this lead at +15551234567 and qualify them.',
      'Set Jasper up in prospector mode to handle inbound calls about our starter plan.',
      'Migrate our website to match the competitor at example.com.',
      'Check our ratings across all review platforms.',
      'Respond to every unread review from the last 30 days.',
    ],
    'Classified as "advisory" (for the voice + migrate + reputation-respond prompts) or "factual" (for the ratings-check prompt). Every iteration of these 5 prompts produces the same wrong classification, 5 times in a row. The user\'s message is a direct imperative with a specific target and verb — not a question or opinion request.',
    `Direct imperative commands must be classified as "action" (or "strategic" for multi-step strategic work), never "advisory" or "factual".

Specifically, classify as "action" any message that contains ALL THREE:
  1. An imperative verb — call, text, email, post, send, write, create, build, dial, schedule, respond to, reply to, migrate, move, convert, set up, configure.
  2. A concrete target or entity — a phone number, a URL, a review, a lead, a named product tier, a page name, an email address, a specific platform.
  3. A clear expected effect on the outside world — a call placed, a message sent, a page built, a review responded to.

Examples that MUST be "action":
  - "Call this lead at +15551234567 and qualify them."                    → action (verb=call, target=phone number)
  - "Set Jasper up in prospector mode to handle inbound calls about X."  → action (verb=set up/configure, target=voice agent, effect=inbound handling)
  - "Migrate our website to match example.com."                          → action (verb=migrate, target=example.com, effect=site changes)
  - "Respond to every unread review from the last 30 days."              → action (verb=respond, target=reviews, effect=responses sent)
  - "Check our ratings across all review platforms." (with intent to act) → action (verb=check+respond implied, target=platforms)

"Advisory" is reserved for opinion/recommendation requests ("Should I...?", "What would you focus on?", "Help me with marketing" with no specific target). "Factual" is reserved for READ-ONLY information queries ("How many leads do we have?", "What's our current SEO config?"). If the user is directing action on a specific target, it is never advisory or factual.`,
    'Matrix at 5 iterations: 5 prompts × 5 iters = 25 deterministic misclassifications. These action-imperative prompts were classified as advisory/factual in every iteration.',
  );
  proposals.push(c1);
  console.log('   ✓ proposal received');
  console.log(`   change: ${c1.changeDescription}\n`);

  // Correction 2 — Jasper Architect vs Builder -----------------------------
  console.log('2/3  Jasper — Architect-vs-Builder routing on page-build prompts');
  const c2 = await proposeJasperCorrection(
    'jasper-architect-vs-builder',
    [
      'Build me a landing page for the Black Friday sale.',
      'Create a new pricing page that lists our three tiers and a comparison table.',
    ],
    'Routed "build me a page" / "create a page" requests to delegate_to_architect (strategy team) plus delegate_to_content and delegate_to_marketing. delegate_to_builder (the execution team that actually constructs pages) was never included. Over 5 iterations: builder-001 used delegate_to_builder in only 2/5 runs, builder-002 used it in 1/5 — and builder-001 includes architect+content+marketing on the failing iters, which is the strategy department, not the execution one.',
    `When a user asks to BUILD, CREATE, or MAKE a page (landing page, pricing page, homepage, about page, blog page, contact page — any specific web page), the plan MUST include delegate_to_builder. Builder is the execution department that constructs the page. delegate_to_architect is for STRATEGY work only (site structure planning, conversion audits, funnel pathology analysis, information architecture recommendations) — NOT for page construction.

Rule of thumb:
  - "Build me a [X] page" / "Create a [X] page" / "Make me a [X] page"           → delegate_to_builder (REQUIRED)
  - "Design our site structure" / "Plan the user journey" / "Audit our funnel"  → delegate_to_architect
  - Both may appear in the same plan only when the user asks for strategy before execution (e.g. "first plan our site then build the landing page"). In that case: architect → builder order.

This rule applies to pages AND to any site-level construction request (sections, footers, forms embedded in pages, navigation updates, domain migration). The architect team is for analysis; the builder team is the one that ships HTML and components.

delegate_to_content may accompany delegate_to_builder when copy is needed for the page. delegate_to_marketing is NOT a substitute for delegate_to_builder — marketing is for campaigns and channel promotion, not page construction.`,
    'Matrix at 5 iterations: builder-001 and builder-002 consistently miss delegate_to_builder (8 of 10 iterations), routing page construction to the strategy department instead. forms-001 and forms-002 correctly use delegate_to_builder — the confusion is specifically about the word "page".',
  );
  proposals.push(c2);
  console.log('   ✓ proposal received');
  console.log(`   change: ${c2.changeDescription}\n`);

  // Correction 3 — Jasper workflow miss on nurture sequences --------------
  console.log('3/3  Jasper — create_workflow missing on nurture/drip sequence prompts');
  const c3 = await proposeJasperCorrection(
    'jasper-workflow-nurture',
    [
      'Build me a nurture sequence for SaaS trial users — 5 emails over 14 days.',
    ],
    'Planned delegate_to_content only, in 4 of 5 iterations. Jasper is writing the email copy but never scheduling the sequence cadence. create_workflow was never included. Without it, the emails exist in Firestore but no cron/trigger fires them on the right day.',
    `For nurture sequences, drip campaigns, email sequences with timing, or any multi-step outreach flow that specifies a CADENCE (over X days, day 1 / day 3 / day 7, send then wait N days, every Tuesday, etc.), the plan MUST include BOTH:

  1. delegate_to_content — to write the email copy for each step
  2. create_workflow — to wire the cadence so the emails actually fire on schedule

Writing the copy without creating the workflow produces drafts that never send. Creating the workflow without the content produces a schedule of empty slots. Both are required.

Optional additional step: delegate_to_outreach — for the actual per-recipient sends after the workflow fires on schedule. create_workflow schedules the TIMING; delegate_to_outreach (or send_email) does the sending when the timing hits.

Trigger words that indicate a cadence-based sequence:
  - "nurture sequence", "drip campaign", "email sequence"
  - "over N days", "over N weeks"
  - "day 1", "day 3", "wait N days"
  - "every Tuesday", "weekly cadence"
  - "follow-up sequence", "welcome series"

On these prompts, omitting create_workflow is a plan-level bug that produces zero real user value (drafts without triggers).`,
    'Matrix at 5 iterations: workflow-002 ("nurture sequence — 5 emails over 14 days") produced delegate_to_content-only plans in 4 of 5 iterations, missing create_workflow every time. workflow-001 (which uses an explicit event trigger "when a new lead is created") correctly includes delegate_to_outreach, suggesting Jasper knows outreach exists — the miss is specifically about scheduled cadence.',
  );
  proposals.push(c3);
  console.log('   ✓ proposal received');
  console.log(`   change: ${c3.changeDescription}\n`);

  // Write proposals to disk -----------------------------------------------
  const outPath = 'D:/rapid-dev/correction-proposals.json';
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), proposals }, null, 2));
  console.log(`═══════════════════════════════════════════════════════════════════`);
  console.log(`  3 proposals written to ${outPath}`);
  console.log(`  Nothing has been applied yet. The active GMs are unchanged.`);
  console.log(`═══════════════════════════════════════════════════════════════════\n`);

  // Print a concise chat-friendly summary of each diff --------------------
  for (const p of proposals) {
    console.log(`──────────────────────────────────────────────────────────────────`);
    console.log(`PROPOSAL  ${p.id}`);
    console.log(`Agent     ${p.targetAgent}  (${p.targetGMId} v${p.targetGMVersion})`);
    console.log(`Fails on  ${p.failingPrompts.length} prompt${p.failingPrompts.length === 1 ? '' : 's'}`);
    console.log(``);
    console.log(`SUMMARY`);
    console.log(`  ${p.changeDescription}`);
    if (p.clarifyingQuestion) {
      console.log(``);
      console.log(`CLARIFYING QUESTION (PE is unsure):`);
      console.log(`  ${p.clarifyingQuestion}`);
    }
    console.log(``);
    console.log(`BEFORE (section to be replaced — first 500 chars):`);
    console.log(p.beforeSection.slice(0, 500) + (p.beforeSection.length > 500 ? ' …' : ''));
    console.log(``);
    console.log(`AFTER (proposed replacement — first 500 chars):`);
    console.log(p.afterSection.slice(0, 500) + (p.afterSection.length > 500 ? ' …' : ''));
    console.log(``);
  }
}

main().catch((err) => {
  console.error('Failed to draft proposals:', err);
  process.exit(1);
});
