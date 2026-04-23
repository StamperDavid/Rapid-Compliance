/**
 * Verify Jasper plans multi-deliverable missions correctly — Stage A, Prompt 4.
 *
 * The request asks for a blog post AND 5 social posts. A correct plan must
 * include BOTH a blog-producing tool (save_blog_draft OR delegate_to_content)
 * AND a social-producing tool (delegate_to_marketing).
 *
 * Ideally the plan also includes delegate_to_intelligence (research) and
 * create_campaign (to group the deliverables) — these are reported but not
 * required for pass.
 *
 * Usage:
 *   npx tsx scripts/verify-multi-deliverable.ts                   — 3 iterations
 *   npx tsx scripts/verify-multi-deliverable.ts --iterations=5
 *   npx tsx scripts/verify-multi-deliverable.ts --prompt="..."
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

const BLOG_TOOLS = new Set(['save_blog_draft', 'delegate_to_content']);
const SOCIAL_TOOLS = new Set(['delegate_to_marketing', 'social_post']);
const RESEARCH_TOOLS = new Set(['delegate_to_intelligence', 'research_trending_topics']);
const CAMPAIGN_TOOLS = new Set(['create_campaign']);

interface PlanStep {
  order?: number;
  toolName: string;
  summary?: string;
}

interface IterationResult {
  iteration: number;
  durationMs: number;
  calledPlan: boolean;
  blogTools: string[];
  socialTools: string[];
  researchTools: string[];
  campaignTools: string[];
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
        iteration, durationMs: Date.now() - start, calledPlan: false,
        blogTools: [], socialTools: [], researchTools: [], campaignTools: [], steps: [],
        errorMessage: 'Model did not call propose_mission_plan',
      };
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(planCall.function.arguments);
    } catch (err) {
      return {
        iteration, durationMs: Date.now() - start, calledPlan: true,
        blogTools: [], socialTools: [], researchTools: [], campaignTools: [], steps: [],
        errorMessage: `Failed to parse plan args: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const steps = parsePlanFromToolCall(parsedArgs);
    const tools = steps.map((s) => s.toolName);

    return {
      iteration,
      durationMs: Date.now() - start,
      calledPlan: true,
      blogTools: tools.filter((t) => BLOG_TOOLS.has(t)),
      socialTools: tools.filter((t) => SOCIAL_TOOLS.has(t)),
      researchTools: tools.filter((t) => RESEARCH_TOOLS.has(t)),
      campaignTools: tools.filter((t) => CAMPAIGN_TOOLS.has(t)),
      steps,
    };
  } catch (err) {
    return {
      iteration, durationMs: Date.now() - start, calledPlan: false,
      blogTools: [], socialTools: [], researchTools: [], campaignTools: [], steps: [],
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
    : 'Create a blog post AND 5 social media posts about the benefits of AI-powered lead scoring for B2B sales teams.';

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Stage A / Prompt 4 — Multi-Deliverable Orchestration');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Prompt:     "${prompt}"`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Pass criterion: plan must include BOTH a blog tool AND a social tool`);
  console.log(`  Blog tools:   ${[...BLOG_TOOLS].join(', ')}`);
  console.log(`  Social tools: ${[...SOCIAL_TOOLS].join(', ')}`);
  console.log(`Nice-to-have (reported only):`);
  console.log(`  Research:     ${[...RESEARCH_TOOLS].join(', ')}`);
  console.log(`  Campaign:     ${[...CAMPAIGN_TOOLS].join(', ')}`);
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
    const hasBoth = r.blogTools.length > 0 && r.socialTools.length > 0;
    const allTools = r.steps.map((s) => s.toolName).join(' → ');
    if (hasBoth) {
      const extras = [
        r.researchTools.length > 0 ? `research=[${r.researchTools.join(',')}]` : '',
        r.campaignTools.length > 0 ? `campaign=[${r.campaignTools.join(',')}]` : '',
      ].filter(Boolean).join(' ');
      console.log(`\x1b[32m✓ PASS\x1b[0m (${r.durationMs}ms) blog=[${r.blogTools.join(',')}] social=[${r.socialTools.join(',')}] ${extras}`);
      console.log(`     plan: ${allTools}`);
    } else {
      const missing = [];
      if (r.blogTools.length === 0) { missing.push('blog tool'); }
      if (r.socialTools.length === 0) { missing.push('social tool'); }
      console.log(`\x1b[31m✗ FAIL\x1b[0m (${r.durationMs}ms) missing ${missing.join(' + ')}`);
      console.log(`     plan: ${allTools}`);
    }
  }

  const passCount = results.filter((r) => !r.errorMessage && r.blogTools.length > 0 && r.socialTools.length > 0).length;
  const passPct = Math.round((passCount / results.length) * 100);
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Result: ${passCount}/${results.length} plans hit both deliverables (${passPct}%)`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
