/**
 * Jasper Prompt Matrix — planning-layer coverage for every feature area.
 *
 * For each prompt in scripts/fixtures/prompt-matrix.json:
 *  1. Run the Intent Expander to classify queryType.
 *  2. Based on queryType, call Jasper with the appropriate toolChoice
 *     (force propose_mission_plan for action/strategic, auto for advisory/
 *     conversational/factual — same logic as the real chat route at
 *     src/app/api/orchestrator/chat/route.ts:822-852).
 *  3. Evaluate each expectation in the fixture and report pass/fail.
 *
 * Usage:
 *   npx tsx scripts/verify-prompt-matrix.ts                       — all prompts
 *   npx tsx scripts/verify-prompt-matrix.ts --category=video      — one category
 *   npx tsx scripts/verify-prompt-matrix.ts --id=video-001        — one prompt
 *   npx tsx scripts/verify-prompt-matrix.ts --iterations=3        — override iteration count
 *
 * Exit code: 0 if every iteration of every prompt passes its expectations.
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
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

import { OpenRouterProvider } from '../src/lib/ai/openrouter-provider';
import { getActiveJasperGoldenMaster, invalidateJasperGMCache } from '../src/lib/orchestrator/jasper-golden-master';
import { JASPER_TOOLS } from '../src/lib/orchestrator/jasper-tools';
import { PLATFORM_ID } from '../src/lib/constants/platform';
import { expandIntent } from '../src/lib/orchestrator/intent-expander';

const ADVISORY_GUARDRAIL = `

IMPORTANT — ADVISORY MODE:
The user is asking for your advice, recommendations, or opinion. They are NOT asking you to execute anything.
DO NOT call any tools that create data (scan_leads, delegate_to_outreach, delegate_to_marketing, delegate_to_content, etc.).
Instead, have a strategic conversation:
1. Explain your recommended approach and WHY it makes sense for their situation
2. Outline the specific steps you WOULD take if they approve
3. Ask if they want you to proceed with execution
Only execute tools if the user explicitly says to go ahead (e.g., "yes do it", "go ahead", "let's do that", "execute that plan").
You MAY call read-only tools like get_system_state, query_docs, or list_crm_leads to inform your recommendation.`;

type QueryType = 'factual' | 'advisory' | 'action' | 'strategic' | 'conversational';

interface Expect {
  queryTypeOneOf?: QueryType[];
  planCalled?: boolean;
  replyExpected?: boolean;
  /** At least one of these tools must appear in the plan/tool calls. */
  toolsAnyOf?: string[];
  /** AND — another group where at least one must appear. */
  toolsAlsoAnyOf?: string[];
  toolsThirdAnyOf?: string[];
  toolsFourthAnyOf?: string[];
  /** Every one of these must appear. */
  toolsAllOf?: string[];
  /** Allowlist — if set, only these tools may be called (for read-class queries). */
  toolsAllowed?: string[];
  /** Blocklist — none of these may be called. */
  toolsForbidden?: string[];
}

interface PromptFixture {
  id: string;
  category: string;
  prompt: string;
  expect: Expect;
  iterations?: number;
}

interface FixtureFile {
  defaultIterations: number;
  prompts: PromptFixture[];
}

interface RunResult {
  fixture: PromptFixture;
  iteration: number;
  durationMs: number;
  queryType: string | null;
  planCalled: boolean;
  toolsCalled: string[];
  textReplyLength: number;
  failures: string[];
  errorMessage?: string;
}

function isReadClass(qt: string | null): boolean {
  return qt === 'advisory' || qt === 'conversational' || qt === 'factual';
}

async function runOne(fixture: PromptFixture, iteration: number, gmPrompt: string): Promise<RunResult> {
  const start = Date.now();

  let queryType: string | null = null;
  try {
    const expanded = await expandIntent(fixture.prompt);
    if (expanded) { queryType = expanded.queryType; }
  } catch (err) {
    return {
      fixture, iteration, durationMs: Date.now() - start,
      queryType: null, planCalled: false, toolsCalled: [],
      textReplyLength: 0, failures: [],
      errorMessage: `Intent expander failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Decide tool-choice strategy — mirror route.ts behavior.
  const forcePlan = queryType === 'action' || queryType === 'strategic';
  const systemPrompt = queryType === 'advisory' ? gmPrompt + ADVISORY_GUARDRAIL : gmPrompt;

  const provider = new OpenRouterProvider(PLATFORM_ID);

  let toolsCalled: string[] = [];
  let planCalled = false;
  let textReplyLength = 0;

  try {
    const response = await provider.chatWithTools({
      model: 'claude-sonnet-4' as Parameters<typeof provider.chatWithTools>[0]['model'],
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fixture.prompt },
      ],
      tools: JASPER_TOOLS,
      toolChoice: forcePlan
        ? { type: 'function' as const, function: { name: 'propose_mission_plan' } }
        : 'auto',
      temperature: 0.7,
      maxTokens: 4000,
    });

    textReplyLength = (response.content ?? '').length;

    // Harvest tools from both direct tool calls and any propose_mission_plan steps array.
    for (const tc of response.toolCalls ?? []) {
      if (tc.function.name === 'propose_mission_plan') {
        planCalled = true;
        try {
          const parsed = JSON.parse(tc.function.arguments) as { steps?: Array<{ toolName?: string }> };
          for (const step of parsed.steps ?? []) {
            if (typeof step.toolName === 'string') { toolsCalled.push(step.toolName); }
          }
        } catch {
          // If the plan args won't parse, leave steps empty and the expectation check will flag it.
        }
      } else {
        toolsCalled.push(tc.function.name);
      }
    }
  } catch (err) {
    return {
      fixture, iteration, durationMs: Date.now() - start,
      queryType, planCalled, toolsCalled, textReplyLength,
      failures: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  // Evaluate expectations.
  const failures: string[] = [];
  const ex = fixture.expect;

  if (ex.queryTypeOneOf && queryType && !ex.queryTypeOneOf.includes(queryType as QueryType)) {
    failures.push(`queryType=${queryType}, expected one of [${ex.queryTypeOneOf.join(',')}]`);
  }

  if (ex.planCalled === true && !planCalled) {
    failures.push('plan was expected but propose_mission_plan was not called');
  }
  if (ex.planCalled === false && planCalled) {
    failures.push('plan was NOT expected but propose_mission_plan was called');
  }

  // replyExpected means "Jasper produced SOME response" — either text OR a tool
  // call counts. On read-class queries (factual/advisory) Jasper correctly
  // calls a read-only tool on turn 1 and waits for the tool result before
  // writing the user-facing text; in this harness we never run turn 2, so a
  // tool-call-only response is valid.
  if (ex.replyExpected === true && textReplyLength === 0 && toolsCalled.length === 0) {
    failures.push('reply was expected but response had no text AND no tool calls');
  }

  const toolSet = new Set(toolsCalled);

  const checkAnyOf = (group: string[] | undefined, label: string): void => {
    if (!group || group.length === 0) { return; }
    if (!group.some((t) => toolSet.has(t))) {
      failures.push(`${label} not satisfied — need one of [${group.join(',')}], got [${toolsCalled.join(',') || 'none'}]`);
    }
  };
  checkAnyOf(ex.toolsAnyOf, 'toolsAnyOf');
  checkAnyOf(ex.toolsAlsoAnyOf, 'toolsAlsoAnyOf');
  checkAnyOf(ex.toolsThirdAnyOf, 'toolsThirdAnyOf');
  checkAnyOf(ex.toolsFourthAnyOf, 'toolsFourthAnyOf');

  if (ex.toolsAllOf) {
    const missing = ex.toolsAllOf.filter((t) => !toolSet.has(t));
    if (missing.length > 0) {
      failures.push(`toolsAllOf missing: [${missing.join(',')}]`);
    }
  }

  if (ex.toolsForbidden) {
    const present = ex.toolsForbidden.filter((t) => toolSet.has(t));
    if (present.length > 0) {
      failures.push(`toolsForbidden present: [${present.join(',')}]`);
    }
  }

  if (ex.toolsAllowed) {
    const allowed = new Set(ex.toolsAllowed);
    const stray = toolsCalled.filter((t) => !allowed.has(t));
    if (stray.length > 0) {
      failures.push(`toolsAllowed violated — unexpected tools [${stray.join(',')}] (allowed: [${ex.toolsAllowed.join(',')}])`);
    }
  }

  return {
    fixture, iteration, durationMs: Date.now() - start,
    queryType, planCalled, toolsCalled, textReplyLength,
    failures,
  };
}

function loadFixture(): FixtureFile {
  const fixturePath = path.resolve(process.cwd(), 'scripts/fixtures/prompt-matrix.json');
  const raw = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(raw) as FixtureFile;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const categoryArg = args.find((a) => a.startsWith('--category='));
  const idArg = args.find((a) => a.startsWith('--id='));
  const iterArg = args.find((a) => a.startsWith('--iterations='));

  const fixture = loadFixture();
  let prompts = fixture.prompts;
  if (categoryArg) {
    const target = categoryArg.split('=')[1];
    prompts = prompts.filter((p) => p.category === target);
  }
  if (idArg) {
    const target = idArg.split('=')[1];
    prompts = prompts.filter((p) => p.id === target);
  }
  const iterationsOverride = iterArg ? parseInt(iterArg.split('=')[1], 10) : null;

  if (prompts.length === 0) {
    console.error('No prompts match filter');
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Jasper Prompt Matrix — planning coverage');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Fixture:  scripts/fixtures/prompt-matrix.json`);
  console.log(`Prompts:  ${prompts.length}`);
  console.log(`Filter:   category=${categoryArg ? categoryArg.split('=')[1] : '*'} id=${idArg ? idArg.split('=')[1] : '*'}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  invalidateJasperGMCache();
  const gm = await getActiveJasperGoldenMaster();
  if (!gm) { console.error('No active Jasper GM'); process.exit(1); }
  console.log(`GM: ${gm.id} v${gm.version} (${gm.systemPrompt.length} chars)\n`);

  const allResults: RunResult[] = [];

  for (const p of prompts) {
    const iters = iterationsOverride ?? p.iterations ?? fixture.defaultIterations;
    const iterResults: RunResult[] = [];
    for (let i = 1; i <= iters; i++) {
      const r = await runOne(p, i, gm.systemPrompt);
      iterResults.push(r);
      allResults.push(r);
    }
    // Collapse per-prompt to a single status line.
    const passCount = iterResults.filter((r) => !r.errorMessage && r.failures.length === 0).length;
    const errored = iterResults.filter((r) => r.errorMessage).length;
    const status = passCount === iters ? '\x1b[32m✓ PASS\x1b[0m'
      : errored === iters ? '\x1b[33m⚠ ERROR\x1b[0m'
        : passCount === 0 ? '\x1b[31m✗ FAIL\x1b[0m'
          : '\x1b[33m~ FLAKY\x1b[0m';
    const avgMs = Math.round(iterResults.reduce((a, r) => a + r.durationMs, 0) / iters);
    const first = iterResults[0];
    const qt = first.queryType ?? '(null)';
    const planTag = first.planCalled ? ' plan' : '';
    const toolsStr = first.toolsCalled.length > 0
      ? first.toolsCalled.slice(0, 6).join(',') + (first.toolsCalled.length > 6 ? `+${first.toolsCalled.length - 6}` : '')
      : 'none';
    console.log(`${status} ${p.id.padEnd(22)} ${p.category.padEnd(22)} ${passCount}/${iters} ${avgMs}ms qt=${qt}${planTag} tools=[${toolsStr}]`);
    for (const r of iterResults) {
      if (r.errorMessage) {
        console.log(`   iter ${r.iteration} ERROR: ${r.errorMessage}`);
      } else if (r.failures.length > 0) {
        for (const f of r.failures) {
          console.log(`   iter ${r.iteration} FAIL: ${f}`);
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  const totalIterations = allResults.length;
  const totalPass = allResults.filter((r) => !r.errorMessage && r.failures.length === 0).length;
  const totalErr = allResults.filter((r) => r.errorMessage).length;
  const totalFail = totalIterations - totalPass - totalErr;
  const passPct = Math.round((totalPass / totalIterations) * 100);
  console.log(`  Overall: ${totalPass}/${totalIterations} iterations passed (${passPct}%) · ${totalFail} failed · ${totalErr} errored`);

  // Per-category aggregate
  const byCategory = new Map<string, { pass: number; total: number }>();
  for (const r of allResults) {
    const bucket = byCategory.get(r.fixture.category) ?? { pass: 0, total: 0 };
    bucket.total += 1;
    if (!r.errorMessage && r.failures.length === 0) { bucket.pass += 1; }
    byCategory.set(r.fixture.category, bucket);
  }
  console.log('\n  Per-category:');
  const categories = Array.from(byCategory.keys()).sort();
  for (const cat of categories) {
    const b = byCategory.get(cat);
    if (!b) { continue; }
    const pct = Math.round((b.pass / b.total) * 100);
    const tag = b.pass === b.total ? '\x1b[32m✓\x1b[0m'
      : b.pass === 0 ? '\x1b[31m✗\x1b[0m'
        : '\x1b[33m~\x1b[0m';
    console.log(`    ${tag} ${cat.padEnd(24)} ${b.pass}/${b.total} (${pct}%)`);
  }
  console.log('═══════════════════════════════════════════════════════════════════\n');

  process.exit(totalPass === totalIterations ? 0 : 1);
}

main().catch((err) => {
  console.error('Matrix run failed:', err);
  process.exit(1);
});
