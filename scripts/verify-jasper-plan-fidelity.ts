/**
 * Verify Jasper plan fidelity — does he reliably follow plan-step rules?
 *
 * Loads Jasper's active GM, calls OpenRouter directly with the same model +
 * tool catalog the chat route uses, forces toolChoice=propose_mission_plan,
 * and inspects the steps array for forbidden tools.
 *
 * Runs N iterations to detect non-deterministic compliance: if the rule
 * sticks 5/5 times, training is solid. If it sticks 3/5 times, the model is
 * inconsistent and the rule is structurally weak.
 *
 * Usage:
 *   npx tsx scripts/verify-jasper-plan-fidelity.ts                   — 5 iterations of the default prompt
 *   npx tsx scripts/verify-jasper-plan-fidelity.ts --iterations=10   — N iterations
 *   npx tsx scripts/verify-jasper-plan-fidelity.ts --prompt="custom prompt here"
 *
 * Exit code: 0 if all iterations clean, 1 if any iteration includes forbidden tools.
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

// The forbidden tools we trained Jasper to NOT include as plan steps.
// If any of these appear in a propose_mission_plan steps array, the rule
// has been violated.
const FORBIDDEN_PLAN_STEP_TOOLS = new Set([
  'get_system_state',
  'get_platform_stats',
  'query_docs',
  'get_seo_config',
  'inspect_agent_logs',
  'list_avatars',
]);

interface PlanStep {
  order?: number;
  toolName: string;
  summary?: string;
}

interface IterationResult {
  iteration: number;
  durationMs: number;
  success: boolean;
  steps: PlanStep[];
  forbiddenStepsFound: string[];
  errorMessage?: string;
}

function parsePlanFromToolCall(args: unknown): PlanStep[] {
  if (typeof args !== 'object' || args === null) { return []; }
  const obj = args as Record<string, unknown>;
  const steps = obj.steps;
  if (!Array.isArray(steps)) { return []; }
  return steps
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s) => ({
      order: typeof s.order === 'number' ? s.order : undefined,
      toolName: typeof s.toolName === 'string' ? s.toolName : '(unknown)',
      summary: typeof s.summary === 'string' ? s.summary : undefined,
    }));
}

async function runOneIteration(iteration: number, prompt: string, gmPrompt: string): Promise<IterationResult> {
  const start = Date.now();
  const provider = new OpenRouterProvider(PLATFORM_ID);

  try {
    const response = await provider.chatWithTools({
      model: 'claude-sonnet-4' as Parameters<typeof provider.chatWithTools>[0]['model'],
      messages: [
        { role: 'system', content: gmPrompt },
        { role: 'user', content: prompt },
      ],
      tools: JASPER_TOOLS,
      toolChoice: { type: 'function' as const, function: { name: 'propose_mission_plan' } },
      temperature: 0.7,
      maxTokens: 4000,
    });

    const planCall = response.toolCalls?.find((tc) => tc.function.name === 'propose_mission_plan');
    if (!planCall) {
      return {
        iteration,
        durationMs: Date.now() - start,
        success: false,
        steps: [],
        forbiddenStepsFound: [],
        errorMessage: 'Model did not call propose_mission_plan despite forced toolChoice',
      };
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(planCall.function.arguments);
    } catch (err) {
      return {
        iteration,
        durationMs: Date.now() - start,
        success: false,
        steps: [],
        forbiddenStepsFound: [],
        errorMessage: `Failed to parse plan args: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const steps = parsePlanFromToolCall(parsedArgs);
    const forbidden = steps
      .map((s) => s.toolName)
      .filter((t) => FORBIDDEN_PLAN_STEP_TOOLS.has(t));

    return {
      iteration,
      durationMs: Date.now() - start,
      success: forbidden.length === 0,
      steps,
      forbiddenStepsFound: forbidden,
    };
  } catch (err) {
    return {
      iteration,
      durationMs: Date.now() - start,
      success: false,
      steps: [],
      forbiddenStepsFound: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const iterArg = args.find((a) => a.startsWith('--iterations='));
  const promptArg = args.find((a) => a.startsWith('--prompt='));
  const iterations = iterArg ? Math.max(1, Math.min(20, parseInt(iterArg.split('=')[1], 10))) : 5;
  const prompt = promptArg
    ? promptArg.split('=').slice(1).join('=')
    : 'Write me a blog post about how our AI agent swarm handles customer onboarding, based on what\'s already in our product.';

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Jasper Plan Fidelity Check');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Prompt:     "${prompt}"`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Forbidden:  ${[...FORBIDDEN_PLAN_STEP_TOOLS].join(', ')}`);
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
    if (r.success) {
      console.log(`\x1b[32m✓ PASS\x1b[0m (${r.durationMs}ms, ${r.steps.length} steps: ${r.steps.map((s) => s.toolName).join(', ')})`);
    } else if (r.errorMessage) {
      console.log(`\x1b[31m✗ ERROR\x1b[0m (${r.durationMs}ms): ${r.errorMessage}`);
    } else {
      console.log(`\x1b[31m✗ FAIL\x1b[0m (${r.durationMs}ms, forbidden tools in plan: ${r.forbiddenStepsFound.join(', ')})`);
      console.log(`     Plan was: ${r.steps.map((s) => s.toolName).join(' → ')}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  const passCount = results.filter((r) => r.success).length;
  const failCount = results.length - passCount;
  const passPct = Math.round((passCount / results.length) * 100);
  console.log(`  Result: ${passCount}/${results.length} passed (${passPct}%)`);

  if (failCount > 0) {
    console.log('\n  Forbidden tools that appeared in failing plans:');
    const counts = new Map<string, number>();
    for (const r of results) {
      for (const t of r.forbiddenStepsFound) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    for (const [tool, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    - ${tool}: ${count}/${iterations} runs`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (passCount === results.length) {
    console.log('All iterations clean — rule is sticking reliably.');
    process.exit(0);
  } else if (passCount > 0) {
    console.log(`PARTIAL compliance — rule sticks ${passPct}% of the time. Model is non-deterministic; cleanup may be needed.`);
    process.exit(1);
  } else {
    console.log('Rule is NOT sticking — every iteration violated the forbidden-tools rule. Cleanup required.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
