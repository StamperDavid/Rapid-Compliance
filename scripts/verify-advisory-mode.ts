/**
 * Verify advisory-mode interpretation — Stage A, Prompt 5.
 *
 * Vague / advisory prompts like "Help me with marketing." MUST NOT trigger
 * plan drafting. The correct behavior is:
 *   1. Intent Expander classifies queryType === 'advisory'
 *   2. Jasper (with advisory guardrail appended) responds with TEXT —
 *      a clarifying question or strategic conversation — and does NOT call
 *      propose_mission_plan.
 *
 * This exercises both layers the way the chat route does (expander first,
 * then Jasper with toolChoice='auto' + advisory context appended).
 *
 * Usage:
 *   npx tsx scripts/verify-advisory-mode.ts                   — 3 iterations
 *   npx tsx scripts/verify-advisory-mode.ts --iterations=5
 *   npx tsx scripts/verify-advisory-mode.ts --prompt="..."
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

// Matches route.ts:627-637 verbatim so the harness exercises the same context
// Jasper sees in production when the expander classifies a prompt as advisory.
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

interface IterationResult {
  iteration: number;
  durationMs: number;
  queryType: string | null;
  expanderReasoning: string | null;
  calledPlan: boolean;
  calledWriteTool: string | null;
  textReplyLength: number;
  textReplyPreview: string;
  errorMessage?: string;
}

const WRITE_TOOLS = new Set([
  'propose_mission_plan',
  'save_blog_draft',
  'delegate_to_content',
  'delegate_to_marketing',
  'delegate_to_outreach',
  'produce_video',
  'create_video',
  'create_campaign',
  'scan_leads',
  'enrich_lead',
  'score_leads',
  'send_email',
  'voice_agent',
]);

async function runOneIteration(iteration: number, prompt: string, gmPrompt: string): Promise<IterationResult> {
  const start = Date.now();

  // Layer 1 — Intent Expander classification
  let queryType: string | null = null;
  let expanderReasoning: string | null = null;
  try {
    const expanded = await expandIntent(prompt);
    if (expanded) {
      queryType = expanded.queryType;
      expanderReasoning = expanded.reasoning;
    }
  } catch (err) {
    return {
      iteration, durationMs: Date.now() - start,
      queryType: null, expanderReasoning: null,
      calledPlan: false, calledWriteTool: null,
      textReplyLength: 0, textReplyPreview: '',
      errorMessage: `Intent expander failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Layer 2 — Jasper call with advisory guardrail appended if advisory
  const systemPrompt = queryType === 'advisory' ? gmPrompt + ADVISORY_GUARDRAIL : gmPrompt;
  const provider = new OpenRouterProvider(PLATFORM_ID);

  try {
    const response = await provider.chatWithTools({
      model: 'claude-sonnet-4' as Parameters<typeof provider.chatWithTools>[0]['model'],
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      tools: JASPER_TOOLS,
      // Critical: auto, not forced. This is how the chat route treats advisory
      // / conversational queries (see route.ts:822-823).
      toolChoice: 'auto',
      temperature: 0.7,
      maxTokens: 2000,
    });

    const toolCalls = response.toolCalls ?? [];
    const planCall = toolCalls.find((tc) => tc.function.name === 'propose_mission_plan');
    const writeCall = toolCalls.find((tc) => WRITE_TOOLS.has(tc.function.name));
    const text = response.content ?? '';

    return {
      iteration,
      durationMs: Date.now() - start,
      queryType,
      expanderReasoning,
      calledPlan: Boolean(planCall),
      calledWriteTool: writeCall ? writeCall.function.name : null,
      textReplyLength: text.length,
      textReplyPreview: text.slice(0, 200).replace(/\s+/g, ' ').trim(),
    };
  } catch (err) {
    return {
      iteration, durationMs: Date.now() - start,
      queryType, expanderReasoning,
      calledPlan: false, calledWriteTool: null,
      textReplyLength: 0, textReplyPreview: '',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

function iterationPassed(r: IterationResult): boolean {
  if (r.errorMessage) { return false; }
  // Pass criteria:
  //   1. Expander classified as advisory (or at worst conversational — NOT action/strategic)
  //   2. Jasper did not call propose_mission_plan
  //   3. Jasper did not call any write tool
  //   4. Jasper produced some text (a reply exists)
  const classifiedCorrectly = r.queryType === 'advisory' || r.queryType === 'conversational';
  return classifiedCorrectly && !r.calledPlan && r.calledWriteTool === null && r.textReplyLength > 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const iterArg = args.find((a) => a.startsWith('--iterations='));
  const promptArg = args.find((a) => a.startsWith('--prompt='));
  const iterations = iterArg ? Math.max(1, Math.min(10, parseInt(iterArg.split('=')[1], 10))) : 3;
  const prompt = promptArg
    ? promptArg.split('=').slice(1).join('=')
    : 'Help me with marketing.';

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Stage A / Prompt 5 — Advisory Mode');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Prompt:     "${prompt}"`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Pass criterion: advisory classification AND no plan/write tool AND non-empty text reply`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  invalidateJasperGMCache();
  const gm = await getActiveJasperGoldenMaster();
  if (!gm) {
    console.error('No active Jasper GM found — aborting');
    process.exit(1);
  }
  console.log(`Loaded GM: ${gm.id} (version ${gm.version}, ${gm.systemPrompt.length} chars)\n`);

  const results: IterationResult[] = [];
  for (let i = 1; i <= iterations; i++) {
    process.stdout.write(`Iteration ${i}/${iterations} ... `);
    const r = await runOneIteration(i, prompt, gm.systemPrompt);
    results.push(r);
    if (r.errorMessage) {
      console.log(`\x1b[31m✗ ERROR\x1b[0m (${r.durationMs}ms): ${r.errorMessage}`);
      continue;
    }
    const passed = iterationPassed(r);
    const tag = passed ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
    const planTag = r.calledPlan ? ' plan=YES' : '';
    const writeTag = r.calledWriteTool ? ` write=${r.calledWriteTool}` : '';
    console.log(`${tag} (${r.durationMs}ms) queryType=${r.queryType}${planTag}${writeTag} textLen=${r.textReplyLength}`);
    if (r.textReplyPreview) {
      console.log(`     reply: "${r.textReplyPreview}${r.textReplyLength > 200 ? '…' : ''}"`);
    }
    if (r.expanderReasoning) {
      console.log(`     expander: ${r.expanderReasoning.slice(0, 160)}`);
    }
  }

  const passCount = results.filter(iterationPassed).length;
  const passPct = Math.round((passCount / results.length) * 100);
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Result: ${passCount}/${results.length} stayed in advisory mode (${passPct}%)`);

  const classifications = new Map<string, number>();
  for (const r of results) {
    const k = r.queryType ?? 'null';
    classifications.set(k, (classifications.get(k) ?? 0) + 1);
  }
  console.log('\n  queryType distribution:');
  for (const [k, v] of classifications) {
    console.log(`    ${k.padEnd(16)} ${v}×`);
  }
  console.log('═══════════════════════════════════════════════════════════════════\n');

  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
