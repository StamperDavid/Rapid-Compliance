/**
 * Fix the reputation-001 regression: Jasper wraps propose_mission_plan in a
 * stringified JSON envelope when review text is present in the prompt, and
 * emits steps as a malformed JSON string with a trailing `]`.
 *
 * Root cause (observed in scripts/diagnose-jasper-planning.ts output):
 *   - `steps` comes through as a JSON-STRING, not a native array
 *   - nested `toolArgs.reviewData` comes through as a JSON-STRING, not an object
 *   - the outer stringification adds a spurious trailing `]`
 * Every other matrix prompt passes. This is specific to inputs that contain
 * structured data (review text) the model feels pressure to "preserve".
 *
 * Fix: add an explicit call-shape rule to Jasper's GM — `steps` and
 * `toolArgs.*` values are NEVER JSON strings, always native arrays / objects.
 * Includes a reputation example that shows the correct nested-object shape.
 *
 * Standing Rule #2: owner explicitly delegated this correction end-to-end
 * ("go" — see feedback_delegation_vs_self_training.md). The proposal is
 * still dumped to disk and the before/after is printed for audit.
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
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

initAdmin();

import { proposePromptRevision } from '../src/lib/training/prompt-engineer-agent';
import {
  getActiveJasperGoldenMaster,
  invalidateJasperGMCache,
} from '../src/lib/orchestrator/jasper-golden-master';
import {
  createJasperGMVersionFromEdit,
  deployJasperGMVersion,
} from '../src/lib/training/jasper-golden-master-service';

const CORRECTION_INSTRUCTION = `When calling propose_mission_plan, the arguments you pass MUST use native JSON types — never JSON strings.

Specifically:
  - "steps" is a native JSON ARRAY of step objects. It is NEVER a string. Do not wrap the array in quotes. Do not JSON.stringify it.
  - Each step's "toolArgs" is a native JSON OBJECT. Its fields (including nested data like reviewData, formFields, campaignSpec, researchType, audience, content, etc.) are native values — strings, numbers, booleans, objects, arrays. Never stringify an object field.
  - If a field's value IS itself structured data (e.g. a review object with rating + content + platform), pass it as a nested object, not as an escaped JSON string.

CORRECT — native array, nested objects:
  propose_mission_plan({
    title: "Respond to 1-star Google review",
    steps: [
      {
        order: 1,
        toolName: "delegate_to_trust",
        toolArgs: {
          action: "respond_to_review",
          platform: "google",
          reviewData: { rating: 1, content: "Terrible onboarding, nothing worked.", platform: "google" }
        },
        summary: "Draft an empathetic professional response to the 1-star review",
        specialistsExpected: ["REVIEW_SPECIALIST"]
      }
    ]
  })

WRONG — steps stringified, reviewData stringified:
  propose_mission_plan({
    title: "...",
    steps: "[{\\"order\\":1,\\"toolName\\":\\"delegate_to_trust\\",\\"toolArgs\\":{\\"reviewData\\":\\"{\\\\\\"rating\\\\\\":1,...}\\"}}]"
  })
The wrong shape fails JSON parsing and the plan is rejected.

This rule applies to EVERY propose_mission_plan call, not just reputation prompts. The only reason the matrix exposed it on reputation is that quoted review text inside the user prompt puts extra quoting pressure on the model. Hold the line — propose_mission_plan's arguments are always native JSON.`;

const CONTEXT = `Matrix diagnostic on reputation-001 ("Draft a response to this 1-star Google review: 'Terrible onboarding, nothing worked.'") shows 17 of 20 iterations failing because Jasper wraps the steps array as a JSON string with a trailing "]". The nested reviewData inside toolArgs is also double-stringified. Every other prompt in the 49-prompt matrix passes at 98%+. This correction teaches the correct call shape at the prompt level so the model stops defensively stringifying when structured data appears in the user message.`;

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  reputation-001 / call-shape correction for Jasper');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  invalidateJasperGMCache();
  const gm = await getActiveJasperGoldenMaster();
  if (!gm) { throw new Error('No active Jasper GM'); }
  console.log(`Current Jasper GM: ${gm.id} v${gm.version} (len=${gm.systemPrompt.length})\n`);

  console.log('Drafting correction with Prompt Engineer…');
  const response = await proposePromptRevision({
    agentType: 'orchestrator',
    currentSystemPrompt: gm.systemPrompt,
    correction: CORRECTION_INSTRUCTION,
    context: CONTEXT,
  });

  console.log('\n── CHANGE SUMMARY ──────────────────────────────────────────────');
  console.log(response.changeDescription || '(no summary)');
  if (response.clarifyingQuestion) {
    console.log('\nPE CLARIFYING QUESTION:');
    console.log(`  ${response.clarifyingQuestion}`);
  }
  console.log('\n── BEFORE (section to be replaced, first 600 chars) ───────────');
  console.log(response.beforeSection.slice(0, 600) + (response.beforeSection.length > 600 ? ' …' : ''));
  console.log('\n── AFTER (proposed replacement, first 600 chars) ──────────────');
  console.log(response.afterSection.slice(0, 600) + (response.afterSection.length > 600 ? ' …' : ''));
  console.log('');

  const proposal = {
    id: 'jasper-propose-mission-plan-call-shape',
    generatedAt: new Date().toISOString(),
    targetAgent: 'Jasper (Orchestrator)',
    targetGMId: gm.id,
    targetGMVersion: gm.version,
    targetGMCollection: 'goldenMasters' as const,
    failingPrompts: [
      'Draft a response to this 1-star Google review: \'Terrible onboarding, nothing worked.\'',
    ],
    observedBehavior: '17/20 iterations: steps emitted as JSON-stringified array with spurious trailing "]", reviewData double-stringified — fails JSON.parse in production and harness.',
    correctionInstruction: CORRECTION_INSTRUCTION,
    context: CONTEXT,
    changeDescription: response.changeDescription,
    clarifyingQuestion: response.clarifyingQuestion ?? null,
    beforeSection: response.beforeSection,
    afterSection: response.afterSection,
    fullRevisedPromptLength: response.fullRevisedPrompt.length,
  };

  const outDir = 'D:/rapid-dev';
  if (!fs.existsSync(outDir)) { fs.mkdirSync(outDir, { recursive: true }); }
  const outPath = path.join(outDir, 'correction-proposal-reputation-call-shape.json');
  fs.writeFileSync(outPath, JSON.stringify(proposal, null, 2));
  console.log(`Proposal written to ${outPath}\n`);

  if (!response.beforeSection || !response.afterSection) {
    console.error('PE returned empty before/after — refusing to apply. Check the clarifying question above.');
    process.exit(1);
  }
  if (response.beforeSection === response.afterSection) {
    console.error('PE returned identical before/after — no change would be applied. Aborting.');
    process.exit(1);
  }

  console.log('Applying to Jasper GM via createJasperGMVersionFromEdit…');
  const newVersion = await createJasperGMVersionFromEdit(
    {
      currentText: response.beforeSection,
      proposedText: response.afterSection,
      rationale: `Matrix training target — ${response.changeDescription}`,
      sourceFeedbackId: 'matrix-correction-reputation-call-shape',
    },
    'claude-assistant-matrix-corrections',
  );
  if (!newVersion) { throw new Error('createJasperGMVersionFromEdit returned null'); }
  console.log(`  new version created: v${newVersion.versionNumber} (${newVersion.id})`);

  const deployResult = await deployJasperGMVersion(newVersion.versionNumber);
  if (!deployResult.success) { throw new Error(`Deploy failed: ${deployResult.error}`); }
  console.log(`  ✓ deployed v${newVersion.version}`);
  invalidateJasperGMCache();
  console.log(`  ✓ Jasper GM cache invalidated`);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Done. Re-run verify-prompt-matrix.ts --id=reputation-001 to confirm.');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('apply-reputation-call-shape-fix failed:', err);
  process.exit(1);
});
