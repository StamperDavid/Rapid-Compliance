/**
 * Video Specialist — Proof of Life Harness
 *
 * Runs the rebuilt Video Specialist end-to-end against live Firestore + live
 * OpenRouter and prints every layer so you can verify delegation is real.
 *
 * Usage:
 *   npx tsx scripts/test-video-specialist.ts
 *   npx tsx scripts/test-video-specialist.ts --case=personalized
 *   npx tsx scripts/test-video-specialist.ts --raw   # also dumps raw OpenRouter body
 *
 * Exit codes:
 *   0 — specialist returned COMPLETED, Zod validation passed
 *   1 — any step failed (GM missing, Brand DNA missing, LLM error, JSON/Zod failure)
 */

import { getVideoSpecialist, __internal } from '../src/lib/agents/content/video/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

// --------------------------------------------------------------------------
// Parse CLI flags
// --------------------------------------------------------------------------

type CaseName = 'youtube_documentary' | 'tiktok_energetic' | 'personalized';

interface CliFlags {
  caseName: CaseName;
  showRaw: boolean;
}

function parseFlags(): CliFlags {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'youtube_documentary';
  let showRaw = false;
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const value = arg.slice('--case='.length);
      if (value === 'youtube_documentary' || value === 'tiktok_energetic' || value === 'personalized') {
        caseName = value;
      } else {
        console.error(`Unknown --case value: ${value}. Supported: youtube_documentary | tiktok_energetic | personalized`);
        process.exit(1);
      }
    } else if (arg === '--raw') {
      showRaw = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/test-video-specialist.ts [--case=youtube_documentary|tiktok_energetic|personalized] [--raw]');
      process.exit(0);
    }
  }
  return { caseName, showRaw };
}

// --------------------------------------------------------------------------
// Canned test inputs
// --------------------------------------------------------------------------

const CANNED_INPUTS = {
  youtube_documentary: {
    action: 'script_to_storyboard' as const,
    script: 'Introducing SalesVelocity.ai — an AI agent swarm that runs your revenue engine end-to-end. Every department, always on, coordinated through one brain. Replace the patchwork stack your team built over the last decade.',
    brief: 'Cold-introduction explainer for B2B SaaS founders and revenue leaders',
    platform: 'youtube' as const,
    style: 'documentary' as const,
    targetDuration: 75,
    targetAudience: 'B2B SaaS founders and revenue operations leaders',
    callToAction: 'Book a 15-minute pipeline review',
  },
  tiktok_energetic: {
    action: 'script_to_storyboard' as const,
    script: '',
    brief: 'Short vertical hook video explaining in 30 seconds why your revenue stack is actually slowing you down and what replacing it with an AI agent swarm looks like',
    platform: 'tiktok' as const,
    style: 'energetic' as const,
    targetDuration: 30,
    targetAudience: 'Early-stage founders scrolling TikTok',
    callToAction: 'Comment "swarm" to see the demo',
  },
  personalized: {
    action: 'script_to_storyboard' as const,
    script: 'Hi Dana, I saw Acme Robotics is running Salesforce plus Outreach.io plus Gong and your SDR team is hitting 32% of quota. That stack is the problem — not the quota. Here is what changes when you replace it with a coordinated agent swarm.',
    brief: 'Personalized 1:1 outbound video for Dana Ruiz, VP of Revenue at Acme Robotics. Reference the company name, the contact name, their tech stack, and the SDR quota miss in the opening scene.',
    platform: 'linkedin' as const,
    style: 'talking_head' as const,
    targetDuration: 60,
    targetAudience: 'Dana Ruiz, VP of Revenue at Acme Robotics (industrial SaaS, 180 employees)',
    callToAction: 'Book a 20-minute deep-dive on Acme\'s Salesforce → agent-swarm migration path',
    tone: 'confident, direct, executive peer-to-peer',
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

  header(`VIDEO SPECIALIST PROOF OF LIFE — ${new Date().toISOString()}`);
  console.log(`Case:        ${flags.caseName}`);
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
      'Run "node scripts/seed-video-specialist-gm.js" first.',
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
  const input = CANNED_INPUTS[flags.caseName];
  const userPrompt = __internal.buildScriptToStoryboardUserPrompt(input);
  console.log('  Input payload:');
  console.log(indent(JSON.stringify(input, null, 2), 4));
  console.log('\n  User prompt sent to LLM:');
  console.log(indent(userPrompt, 4));

  // -- Steps 5 + 6: Call the specialist (real LLM invocation) --------------
  section('[5/7] CALLING VIDEO SPECIALIST (real OpenRouter invocation)');
  const specialist = getVideoSpecialist();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${flags.caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'VIDEO_SPECIALIST',
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
  const validation = __internal.StoryboardResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod validation', new Error(
      validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    ));
  }
  console.log('  ✓ Output matches StoryboardResultSchema');
  console.log(`  ✓ scenes.length=${validation.data.scenes.length}, sceneCount=${validation.data.sceneCount}`);
  console.log(`  ✓ totalDurationSec=${validation.data.totalDurationSec}, sum of durations=${validation.data.scenes.reduce((a, s) => a + s.duration, 0)}`);
  console.log(`  ✓ productionNotes.length=${validation.data.productionNotes.length}`);

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
