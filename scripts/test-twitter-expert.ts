/**
 * Twitter/X Expert — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-twitter-expert.ts
 *   npx tsx scripts/test-twitter-expert.ts --case=saas_thread
 *   npx tsx scripts/test-twitter-expert.ts --case=realestate_hot_take
 *   npx tsx scripts/test-twitter-expert.ts --case=educational_ecommerce
 *
 * Exit codes:
 *   0 — specialist returned COMPLETED, Zod validation passed
 *   1 — any step failed
 */

import { getTwitterExpert, __internal } from '../src/lib/agents/marketing/twitter/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

type CaseName = 'saas_thread' | 'realestate_hot_take' | 'educational_ecommerce';

interface CliFlags {
  caseName: CaseName;
}

function parseFlags(): CliFlags {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_thread';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const value = arg.slice('--case='.length);
      if (value === 'saas_thread' || value === 'realestate_hot_take' || value === 'educational_ecommerce') {
        caseName = value;
      } else {
        console.error(`Unknown --case value: ${value}. Supported: saas_thread | realestate_hot_take | educational_ecommerce`);
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/test-twitter-expert.ts [--case=saas_thread|realestate_hot_take|educational_ecommerce]');
      process.exit(0);
    }
  }
  return { caseName };
}

const CANNED_INPUTS = {
  saas_thread: {
    action: 'generate_content' as const,
    topic: 'Why AI agent swarms will replace your entire SaaS tool stack by 2027',
    contentType: 'thread',
    targetAudience: 'B2B SaaS founders and CTOs',
    tone: 'sharp and opinionated',
  },
  realestate_hot_take: {
    action: 'generate_content' as const,
    topic: 'Open houses are dead — here is what smart agents do instead',
    contentType: 'hot_take',
    targetAudience: 'Real estate agents and brokers',
    tone: 'provocative',
  },
  educational_ecommerce: {
    action: 'generate_content' as const,
    topic: '7 checkout page tweaks that recovered $2M in abandoned carts',
    contentType: 'educational',
    targetAudience: 'Ecommerce founders and DTC brands',
    tone: 'data-driven and direct',
  },
} as const;

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
  process.exit(1);
}

async function main(): Promise<void> {
  const flags = parseFlags();
  const runStart = Date.now();
  const input = CANNED_INPUTS[flags.caseName];

  header(`TWITTER/X EXPERT PROOF OF LIFE — ${new Date().toISOString()}`);
  console.log(`Case:        ${flags.caseName}`);
  console.log(`Action:      ${input.action}`);
  console.log(`Industry:    ${__internal.DEFAULT_INDUSTRY_KEY}`);
  console.log(`Specialist:  ${__internal.SPECIALIST_ID}`);

  section('[1/7] LOADING GOLDEN MASTER FROM FIRESTORE');
  let gmRecord: Awaited<ReturnType<typeof getActiveSpecialistGMByIndustry>> = null;
  try {
    gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  } catch (err) {
    fail('Load GM', err);
  }
  if (!gmRecord) {
    fail('Load GM', new Error(`No active GM found. Run "node scripts/seed-twitter-expert-gm.js" first.`));
  }
  const gmConfig = gmRecord.config as Record<string, unknown>;
  const gmPrompt = typeof gmConfig.systemPrompt === 'string' ? gmConfig.systemPrompt : '';
  console.log(`  ✓ Doc ID: ${gmRecord.id}, v${gmRecord.version}, ${gmPrompt.length} prompt chars`);

  section('[2/7] LOADING BRAND DNA');
  const brandDNA = await getBrandDNA();
  if (!brandDNA) fail('Load Brand DNA', new Error('Brand DNA not configured.'));
  console.log(`  ✓ Company: ${brandDNA.companyDescription.slice(0, 60)}...`);
  console.log(`  ✓ Tone: ${brandDNA.toneOfVoice}, Industry: ${brandDNA.industry}`);

  section('[3/7] RESOLVED SYSTEM PROMPT');
  const resolvedPrompt = __internal.buildResolvedSystemPrompt(gmPrompt, brandDNA);
  console.log(`  Resolved prompt length: ${resolvedPrompt.length} chars`);

  section('[4/7] USER PROMPT');
  const parsedInput = __internal.GenerateContentRequestSchema.parse(input);
  const userPrompt = __internal.buildGenerateContentUserPrompt(parsedInput);
  console.log(indent(JSON.stringify(input, null, 2), 4));

  section('[5/7] CALLING TWITTER/X EXPERT (real OpenRouter invocation)');
  const specialist = getTwitterExpert();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${flags.caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'TWITTER_X_EXPERT',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: input,
    requiresResponse: true,
    traceId: `trace_harness_${Date.now()}`,
  };

  const llmStart = Date.now();
  const report = await specialist.execute(message);
  const llmDuration = Date.now() - llmStart;
  console.log(`  ✓ Returned in ${llmDuration} ms, status: ${report.status}`);

  if (report.status !== 'COMPLETED') {
    fail('Specialist execute', new Error(`status=${report.status}, errors=${JSON.stringify(report.errors ?? [])}`));
  }

  section('[6/7] ZOD SCHEMA VALIDATION');
  const validation = __internal.TwitterContentResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod validation', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }
  console.log('  ✓ Output matches TwitterContentResultSchema');
  console.log(`  ✓ thread length: ${validation.data.thread.length} tweets`);
  for (const tweet of validation.data.thread) {
    const charCount = tweet.text.length;
    const flag = charCount > 280 ? ' ✗ OVER LIMIT!' : '';
    console.log(`      [${tweet.position}] ${charCount} chars${flag}: "${tweet.text.slice(0, 60)}..."`);
  }
  console.log(`  ✓ standaloneTweet: "${validation.data.standaloneTweet.slice(0, 80)}..." (${validation.data.standaloneTweet.length} chars)`);
  console.log(`  ✓ hooks.primary: "${validation.data.hooks.primary.slice(0, 80)}"`);
  console.log(`  ✓ hooks.alternatives: ${validation.data.hooks.alternatives.length}`);
  console.log(`  ✓ hashtags: ${validation.data.hashtags.length > 0 ? validation.data.hashtags.join(', ') : '(none)'}`);
  console.log(`  ✓ estimatedEngagement: ${validation.data.estimatedEngagement}`);
  console.log(`  ✓ ratioRiskAssessment length: ${validation.data.ratioRiskAssessment.length} chars`);
  console.log(`  ✓ contentStrategy length: ${validation.data.contentStrategy.length} chars`);

  section('[7/7] PARSED AGENT REPORT DATA');
  console.log(indent(JSON.stringify(report.data, null, 2), 2));

  const totalMs = Date.now() - runStart;
  header('RESULT');
  console.log(`  Status:     COMPLETED`);
  console.log(`  Validation: PASS`);
  console.log(`  LLM call:   ${llmDuration} ms`);
  console.log(`  Total run:  ${totalMs} ms`);
  console.log(hr);
}

main().catch((err) => {
  console.error('\n✗ Harness crashed:', err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
