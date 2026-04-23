/**
 * Verify Jasper plans the video pipeline correctly — Stage A, Prompt 3.
 *
 * Does not fire Hedra. Only exercises the PLAN layer: Jasper receives the
 * video-creation request, must call propose_mission_plan, and the plan must
 * include at least one real video-pipeline tool (produce_video or
 * batch_produce_videos). Tools that merely edit or inspect the library
 * (edit_video, manage_media_library) do NOT count — those don't produce
 * a new video.
 *
 * Usage:
 *   npx tsx scripts/verify-video-orchestration.ts                   — 3 iterations
 *   npx tsx scripts/verify-video-orchestration.ts --iterations=5
 *   npx tsx scripts/verify-video-orchestration.ts --prompt="..."
 *
 * Exit code: 0 if every iteration includes a video-producing tool, 1 otherwise.
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

// Tools that represent REAL video production (generate a new artifact).
const VIDEO_PRODUCING_TOOLS = new Set([
  'produce_video',
  'batch_produce_videos',
  'create_video',
  'script_to_storyboard',
  'delegate_to_video',
]);

// Tools that touch video but do NOT produce a new render.
const VIDEO_ADJACENT_TOOLS = new Set([
  'edit_video',
  'assemble_video',
  'manage_media_library',
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
  calledPlan: boolean;
  producingToolsFound: string[];
  adjacentToolsFound: string[];
  steps: PlanStep[];
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
        calledPlan: false,
        producingToolsFound: [],
        adjacentToolsFound: [],
        steps: [],
        errorMessage: 'Model did not call propose_mission_plan',
      };
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(planCall.function.arguments);
    } catch (err) {
      return {
        iteration,
        durationMs: Date.now() - start,
        calledPlan: true,
        producingToolsFound: [],
        adjacentToolsFound: [],
        steps: [],
        errorMessage: `Failed to parse plan args: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const steps = parsePlanFromToolCall(parsedArgs);
    const tools = steps.map((s) => s.toolName);
    const producing = tools.filter((t) => VIDEO_PRODUCING_TOOLS.has(t));
    const adjacent = tools.filter((t) => VIDEO_ADJACENT_TOOLS.has(t));

    return {
      iteration,
      durationMs: Date.now() - start,
      calledPlan: true,
      producingToolsFound: producing,
      adjacentToolsFound: adjacent,
      steps,
    };
  } catch (err) {
    return {
      iteration,
      durationMs: Date.now() - start,
      calledPlan: false,
      producingToolsFound: [],
      adjacentToolsFound: [],
      steps: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const iterArg = args.find((a) => a.startsWith('--iterations='));
  const promptArg = args.find((a) => a.startsWith('--prompt='));
  const iterations = iterArg ? Math.max(1, Math.min(10, parseInt(iterArg.split('=')[1], 10))) : 3;
  const prompt = promptArg
    ? promptArg.split('=').slice(1).join('=')
    : 'Create a 60-second video explaining how SalesVelocity.ai helps small businesses automate their sales outreach.';

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Stage A / Prompt 3 — Video Orchestration');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Prompt:     "${prompt}"`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Producing tools (pass criterion): ${[...VIDEO_PRODUCING_TOOLS].join(', ')}`);
  console.log(`Adjacent tools (won't count):     ${[...VIDEO_ADJACENT_TOOLS].join(', ')}`);
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
    const ok = r.producingToolsFound.length > 0;
    const allTools = r.steps.map((s) => s.toolName).join(' → ');
    if (ok) {
      console.log(`\x1b[32m✓ PASS\x1b[0m (${r.durationMs}ms) producing=[${r.producingToolsFound.join(',')}] plan=${allTools}`);
    } else {
      console.log(`\x1b[31m✗ FAIL\x1b[0m (${r.durationMs}ms) no video-producing tool in plan=${allTools}`);
    }
  }

  const passCount = results.filter((r) => !r.errorMessage && r.producingToolsFound.length > 0).length;
  const passPct = Math.round((passCount / results.length) * 100);
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Result: ${passCount}/${results.length} plans include a video-producing tool (${passPct}%)`);

  const aggPlan = new Map<string, number>();
  for (const r of results) {
    for (const s of r.steps) {
      aggPlan.set(s.toolName, (aggPlan.get(s.toolName) ?? 0) + 1);
    }
  }
  if (aggPlan.size > 0) {
    console.log('\n  Tool frequency across all plans:');
    for (const [tool, count] of [...aggPlan.entries()].sort((a, b) => b[1] - a[1])) {
      const tag = VIDEO_PRODUCING_TOOLS.has(tool) ? ' ← producing'
        : VIDEO_ADJACENT_TOOLS.has(tool) ? ' ← adjacent'
          : '';
      console.log(`    ${tool.padEnd(36)} ${count}×${tag}`);
    }
  }
  console.log('═══════════════════════════════════════════════════════════════════\n');

  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
