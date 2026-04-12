/**
 * TikTok Expert — Proof of Life Harness
 *
 * Runs the rebuilt TikTok Expert end-to-end against live Firestore +
 * live OpenRouter and prints every layer so you can verify delegation is real.
 *
 * Usage:
 *   npx tsx scripts/test-tiktok-expert.ts
 *   npx tsx scripts/test-tiktok-expert.ts --case=saas_viral_hook
 *   npx tsx scripts/test-tiktok-expert.ts --case=realestate_tutorial
 *   npx tsx scripts/test-tiktok-expert.ts --case=trend_ecommerce
 *   npx tsx scripts/test-tiktok-expert.ts --raw   # also dumps raw OpenRouter body
 *
 * Exit codes:
 *   0 — specialist returned COMPLETED, Zod validation passed
 *   1 — any step failed (GM missing, Brand DNA missing, LLM error, JSON/Zod failure)
 */

import { getTikTokExpert, __internal } from '../src/lib/agents/marketing/tiktok/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

// --------------------------------------------------------------------------
// Parse CLI flags
// --------------------------------------------------------------------------

type CaseName = 'saas_viral_hook' | 'realestate_tutorial' | 'trend_ecommerce';

interface CliFlags {
  caseName: CaseName;
  showRaw: boolean;
}

function parseFlags(): CliFlags {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_viral_hook';
  let showRaw = false;
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const value = arg.slice('--case='.length);
      if (value === 'saas_viral_hook' || value === 'realestate_tutorial' || value === 'trend_ecommerce') {
        caseName = value;
      } else {
        console.error(`Unknown --case value: ${value}. Supported: saas_viral_hook | realestate_tutorial | trend_ecommerce`);
        process.exit(1);
      }
    } else if (arg === '--raw') {
      showRaw = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/test-tiktok-expert.ts [--case=saas_viral_hook|realestate_tutorial|trend_ecommerce] [--raw]');
      process.exit(0);
    }
  }
  return { caseName, showRaw };
}

// --------------------------------------------------------------------------
// Canned test inputs
// --------------------------------------------------------------------------

const CANNED_INPUTS = {
  saas_viral_hook: {
    action: 'generate_content' as const,
    topic: 'Why AI sales automation agents will replace your entire SDR team by 2027',
    contentType: 'short_video',
    targetAudience: 'B2B SaaS founders and sales leaders',
    tone: 'bold and provocative',
  },
  realestate_tutorial: {
    action: 'generate_content' as const,
    topic: '5 open house staging tricks that sell luxury homes in 48 hours',
    contentType: 'tutorial',
    targetAudience: 'Real estate agents and luxury realtors',
    tone: 'authoritative and energetic',
  },
  trend_ecommerce: {
    action: 'generate_content' as const,
    topic: 'The product research method that found me 3 winning dropshipping products this week',
    contentType: 'trend',
    targetAudience: 'Ecommerce entrepreneurs and dropshippers',
    tone: 'conversational and hype',
  },
} as const;

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
  const input = CANNED_INPUTS[flags.caseName];

  header(`TIKTOK EXPERT PROOF OF LIFE — ${new Date().toISOString()}`);
  console.log(`Case:        ${flags.caseName}`);
  console.log(`Action:      ${input.action}`);
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
      'Run "node scripts/seed-tiktok-expert-gm.js" first.',
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
  const parsedInput = __internal.GenerateContentRequestSchema.parse(input);
  const userPrompt = __internal.buildGenerateContentUserPrompt(parsedInput);
  console.log('  Input payload:');
  console.log(indent(JSON.stringify(input, null, 2), 4));
  console.log('\n  User prompt sent to LLM:');
  console.log(indent(userPrompt, 4));

  // -- Steps 5 + 6: Call the specialist (real LLM invocation) --------------
  section('[5/7] CALLING TIKTOK EXPERT (real OpenRouter invocation)');
  const specialist = getTikTokExpert();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${flags.caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'TIKTOK_EXPERT',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: input,
    requiresResponse: true,
    traceId: `trace_harness_${Date.now()}`,
  };

  const llmStart = Date.now();
  const report = await specialist.execute(message);
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
  const validation = __internal.TikTokContentResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod validation', new Error(
      validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    ));
  }
  console.log('  ✓ Output matches TikTokContentResultSchema');
  console.log(`  ✓ videoScript.hook: "${validation.data.videoScript.hook.slice(0, 80)}..."`);
  console.log(`  ✓ videoScript.body length: ${validation.data.videoScript.body.length} chars`);
  console.log(`  ✓ videoScript.callToAction: "${validation.data.videoScript.callToAction.slice(0, 80)}"`);
  console.log(`  ✓ videoScript.duration: ${validation.data.videoScript.duration}`);
  console.log(`  ✓ videoScript.pacingNotes length: ${validation.data.videoScript.pacingNotes.length} chars`);
  console.log(`  ✓ caption length: ${validation.data.caption.length} chars`);
  console.log(`  ✓ hashtags: ${validation.data.hashtags.join(', ')}`);
  console.log(`  ✓ hooks.primary: "${validation.data.hooks.primary.slice(0, 80)}"`);
  console.log(`  ✓ hooks.alternatives count: ${validation.data.hooks.alternatives.length}`);
  for (const alt of validation.data.hooks.alternatives) {
    console.log(`      - "${alt.slice(0, 80)}..."`);
  }
  console.log(`  ✓ soundRecommendation: "${validation.data.soundRecommendation.slice(0, 80)}"`);
  console.log(`  ✓ estimatedEngagement: ${validation.data.estimatedEngagement}`);
  console.log(`  ✓ bestPostingTime: ${validation.data.bestPostingTime}`);
  console.log(`  ✓ contentStrategy length: ${validation.data.contentStrategy.length} chars`);

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
  if (flags.showRaw) {
    console.log('\n  (--raw flag set — raw OpenRouter body is available in the server logs if logger debug is enabled)');
  }
  console.log(hr);
}

main().catch((err) => {
  console.error('\n✗ Harness crashed:');
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
