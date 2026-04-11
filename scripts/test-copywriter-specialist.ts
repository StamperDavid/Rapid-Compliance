/**
 * Copywriter Specialist — Proof of Life Harness
 *
 * Runs the rebuilt Copywriter end-to-end against live Firestore + live
 * OpenRouter and prints every layer so you can verify delegation is real.
 *
 * Usage:
 *   npx tsx scripts/test-copywriter-specialist.ts
 *   npx tsx scripts/test-copywriter-specialist.ts --action=generate_proposal
 *   npx tsx scripts/test-copywriter-specialist.ts --raw   # also dumps raw OpenRouter body
 *
 * Exit codes:
 *   0 — specialist returned COMPLETED, Zod validation passed
 *   1 — any step failed (GM missing, Brand DNA missing, LLM error, JSON/Zod failure)
 */

import { getCopywriter, __internal } from '../src/lib/agents/content/copywriter/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

// --------------------------------------------------------------------------
// Parse CLI flags
// --------------------------------------------------------------------------

interface CliFlags {
  action: 'generate_page_copy' | 'generate_proposal';
  showRaw: boolean;
}

function parseFlags(): CliFlags {
  const argv = process.argv.slice(2);
  let action: CliFlags['action'] = 'generate_page_copy';
  let showRaw = false;
  for (const arg of argv) {
    if (arg.startsWith('--action=')) {
      const value = arg.slice('--action='.length);
      if (value === 'generate_page_copy' || value === 'generate_proposal') {
        action = value;
      } else {
        console.error(`Unknown --action value: ${value}`);
        process.exit(1);
      }
    } else if (arg === '--raw') {
      showRaw = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/test-copywriter-specialist.ts [--action=generate_page_copy|generate_proposal] [--raw]');
      process.exit(0);
    }
  }
  return { action, showRaw };
}

// --------------------------------------------------------------------------
// Canned test inputs
// --------------------------------------------------------------------------

const CANNED_PAGE_COPY_INPUT = {
  action: 'generate_page_copy' as const,
  pageId: 'home',
  pageName: 'Home Page',
  pagePurpose: 'Convert B2B SaaS revenue leaders into 15-minute pipeline reviews',
  sections: [
    { id: 'hero', name: 'Hero', purpose: 'Headline + subheadline + primary CTA' },
    { id: 'how_it_works', name: 'How It Works', purpose: '3-step process showing the AI agent swarm in action' },
    { id: 'proof', name: 'Proof', purpose: 'Why this is different from GoHighLevel and Vendasta' },
    { id: 'cta', name: 'Final CTA', purpose: 'Book a pipeline review' },
  ],
  seoKeywords: ['AI sales agents', 'revenue automation', 'SaaS sales operations'],
  toneOfVoice: 'direct, confident, no fluff',
  keyPhrases: ['AI agent swarm', 'sales velocity', 'every department'],
  avoidPhrases: ['cutting-edge', 'best-in-class', 'game-changer', 'revolutionary', 'solution'],
};

const CANNED_PROPOSAL_INPUT = {
  action: 'generate_proposal' as const,
  leadId: 'test_lead_001',
  companyName: 'Acme Robotics',
  contactName: 'Dana Ruiz, VP of Revenue',
  industry: 'Industrial SaaS',
  painPoints: [
    'Outbound team of 4 SDRs hitting 32% of quota',
    'No content production — last blog post 7 months ago',
    'Pipeline reviews happening in spreadsheets',
  ],
  techStack: ['Salesforce', 'Outreach.io', 'Gong'],
  companySize: '180 employees',
  requestedInfo: ['pricing', 'implementation timeline', 'integration with Salesforce'],
};

// --------------------------------------------------------------------------
// Pretty-printing helpers
// --------------------------------------------------------------------------

const hr = '═══════════════════════════════════════════════════════════════';
const dash = '───────────────────────────────────────────────────────────────';

function header(title: string): void {
  console.log(`\n${hr}`);
  console.log(title);
  console.log(hr);
}

function section(step: string): void {
  console.log(`\n${dash}`);
  console.log(step);
  console.log(dash);
}

function indent(text: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((line) => `${pad}${line}`).join('\n');
}

function fail(step: string, err: unknown): never {
  console.error(`\n✗ FAILED at step: ${step}`);
  console.error(`  Reason: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    console.error(indent(err.stack, 2));
  }
  process.exit(1);
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags();
  const runStart = Date.now();

  header(`COPYWRITER SPECIALIST PROOF OF LIFE — ${new Date().toISOString()}`);
  console.log(`Action:      ${flags.action}`);
  console.log(`Industry:    ${__internal.DEFAULT_INDUSTRY_KEY}`);
  console.log(`Specialist:  ${__internal.SPECIALIST_ID}`);

  // -- Step 1: Load GM from Firestore --------------------------------------
  section('[1/7] LOADING GOLDEN MASTER FROM FIRESTORE');
  let gmRecord: Awaited<ReturnType<typeof getActiveSpecialistGMByIndustry>> = null;
  try {
    gmRecord = await getActiveSpecialistGMByIndustry(
      __internal.SPECIALIST_ID,
      __internal.DEFAULT_INDUSTRY_KEY,
    );
  } catch (err) {
    fail('Load GM', err);
  }
  if (!gmRecord) {
    fail('Load GM', new Error(
      `No active GM found for specialistId=${__internal.SPECIALIST_ID} industryKey=${__internal.DEFAULT_INDUSTRY_KEY}. ` +
      'Run POST /api/training/seed-copywriter-gm first.',
    ));
  }
  console.log(`  ✓ Doc ID:       ${gmRecord.id}`);
  console.log(`  ✓ Version:      v${gmRecord.version}`);
  console.log(`  ✓ Deployed at:  ${gmRecord.deployedAt ?? '(not deployed)'}`);
  console.log(`  ✓ Created by:   ${gmRecord.createdBy}`);
  console.log(`  ✓ Created at:   ${gmRecord.createdAt}`);
  const gmConfig = gmRecord.config as Record<string, unknown>;
  const gmPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  console.log(`  ✓ Model:        ${String(gmConfig.model ?? '(not set)')}`);
  console.log(`  ✓ Temperature:  ${String(gmConfig.temperature ?? '(not set)')}`);
  console.log(`  ✓ Max tokens:   ${String(gmConfig.maxTokens ?? '(not set)')}`);
  console.log(`  ✓ Prompt chars: ${gmPrompt.length}`);
  console.log(`  ✓ Notes:        ${gmRecord.notes ?? '(none)'}`);

  // -- Step 2: Load Brand DNA ----------------------------------------------
  section('[2/7] LOADING BRAND DNA');
  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    fail('Load Brand DNA', new Error(
      'Brand DNA not configured. Visit /settings/ai-agents/business-setup.',
    ));
  }
  console.log(`  ✓ Company:       ${brandDNA.companyDescription}`);
  console.log(`  ✓ Unique value:  ${brandDNA.uniqueValue}`);
  console.log(`  ✓ Tone:          ${brandDNA.toneOfVoice}`);
  console.log(`  ✓ Industry:      ${brandDNA.industry}`);
  console.log(`  ✓ Key phrases:   ${brandDNA.keyPhrases?.join(', ') || '(none)'}`);
  console.log(`  ✓ Avoid phrases: ${brandDNA.avoidPhrases?.join(', ') || '(none)'}`);
  console.log(`  ✓ Competitors:   ${brandDNA.competitors?.join(', ') || '(none)'}`);

  // -- Step 3: Build resolved system prompt --------------------------------
  section('[3/7] RESOLVED SYSTEM PROMPT (base GM + Brand DNA injection)');
  const resolvedPrompt = __internal.buildResolvedSystemPrompt(gmPrompt, brandDNA);
  console.log(indent(resolvedPrompt, 2));
  console.log(`\n  Resolved prompt length: ${resolvedPrompt.length} chars`);

  // -- Step 4: Build user prompt -------------------------------------------
  section('[4/7] USER PROMPT BUILT FROM INPUT');
  const input = flags.action === 'generate_page_copy'
    ? CANNED_PAGE_COPY_INPUT
    : CANNED_PROPOSAL_INPUT;
  const userPrompt = flags.action === 'generate_page_copy'
    ? __internal.buildPageCopyUserPrompt(CANNED_PAGE_COPY_INPUT)
    : __internal.buildProposalUserPrompt(CANNED_PROPOSAL_INPUT);
  console.log('  Input payload:');
  console.log(indent(JSON.stringify(input, null, 2), 4));
  console.log('\n  User prompt sent to LLM:');
  console.log(indent(userPrompt, 4));

  // -- Steps 5 + 6: Call the specialist (real LLM invocation) --------------
  section('[5/7] CALLING COPYWRITER SPECIALIST (real OpenRouter invocation)');
  const copywriter = getCopywriter();
  await copywriter.initialize();

  const message: AgentMessage = {
    id: `harness_${flags.action}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'COPYWRITER',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: input,
    requiresResponse: true,
    traceId: `trace_harness_${Date.now()}`,
  };

  const llmStart = Date.now();
  const report = await copywriter.execute(message);
  const llmDuration = Date.now() - llmStart;
  console.log(`  ✓ Specialist returned in ${llmDuration} ms`);
  console.log(`  ✓ AgentReport.status: ${report.status}`);
  console.log(`  ✓ AgentReport.agentId: ${report.agentId}`);
  console.log(`  ✓ AgentReport.taskId: ${report.taskId}`);

  if (report.status !== 'COMPLETED') {
    fail('Specialist execute', new Error(
      `Report status=${report.status}, errors=${JSON.stringify(report.errors ?? [])}`,
    ));
  }

  // -- Step 6: Zod validation -----------------------------------------------
  section('[6/7] ZOD SCHEMA VALIDATION');
  const schema = flags.action === 'generate_page_copy'
    ? __internal.PageCopyResultSchema
    : __internal.ProposalResultSchema;
  const validation = schema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod validation', new Error(
      validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    ));
  }
  console.log('  ✓ Output matches expected schema');

  // -- Step 7: Dump parsed data --------------------------------------------
  section('[7/7] PARSED AGENT REPORT DATA');
  console.log(indent(JSON.stringify(report.data, null, 2), 2));

  // -- Summary --------------------------------------------------------------
  const totalMs = Date.now() - runStart;
  header('RESULT');
  console.log(`  Status:     COMPLETED`);
  console.log(`  Validation: PASS`);
  console.log(`  LLM call:   ${llmDuration} ms`);
  console.log(`  Total run:  ${totalMs} ms`);
  console.log(hr);
}

main().catch((err) => {
  console.error('\n✗ Harness crashed:');
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
