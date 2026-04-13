/**
 * Workflow Optimizer — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-workflow-optimizer.ts
 *   npx tsx scripts/test-workflow-optimizer.ts --case=saas_content_engine
 *   npx tsx scripts/test-workflow-optimizer.ts --case=realestate_lead_engine
 *   npx tsx scripts/test-workflow-optimizer.ts --case=ecommerce_product_launch
 */

import { getWorkflowOptimizer, __internal } from '../src/lib/agents/builder/workflow/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

type CaseName = 'saas_content_engine' | 'realestate_lead_engine' | 'ecommerce_product_launch';

function parseFlags(): { caseName: CaseName } {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_content_engine';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const v = arg.slice('--case='.length);
      if (v === 'saas_content_engine' || v === 'realestate_lead_engine' || v === 'ecommerce_product_launch') {
        caseName = v;
      } else {
        console.error(`Unknown case: ${v}`);
        process.exit(1);
      }
    }
  }
  return { caseName };
}

const CANNED_INPUTS = {
  saas_content_engine: {
    action: 'compose_workflow' as const,
    goal:
      'Produce one full weekly content package for a B2B SaaS sales velocity platform targeting founders and revenue operators: one SEO-optimized blog post, one LinkedIn thought-leadership post, one short-form TikTok video script, and three social image assets — all coordinated around a single weekly theme and ready for the calendar.',
    context: 'Weekly content cadence. Theme selection should lean on trending industry topics and existing brand DNA. All outputs must share a unified hook and call-to-action.',
    constraints: {
      maxDurationSeconds: 1800,
      priority: 'high' as const,
      maxParallelism: 4,
    },
  },
  realestate_lead_engine: {
    action: 'compose_workflow' as const,
    goal:
      'Build a weekly luxury real estate lead generation engine: research one neighborhood market trend, produce one editorial blog post, one LinkedIn post targeting wealth managers, two Instagram-ready property images, and a follow-up email nurture cadence for the leads captured.',
    context: 'Long sales cycle market. Editorial tone. Brand restraint is important — no loud or trendy visuals.',
    constraints: {
      maxDurationSeconds: 2400,
      priority: 'medium' as const,
    },
  },
  ecommerce_product_launch: {
    action: 'compose_workflow' as const,
    goal:
      'Launch a new DTC lifestyle product across all channels in one week: build the product landing page, compose Facebook ad creative (primary + 3 variants), produce one TikTok video script with hook variations, generate five product lifestyle images, schedule everything across the content calendar, and set up a welcome email sequence for first-time buyers.',
    context: 'Fast-velocity DTC brand. Mobile-first. Emphasis on repeat-purchase funnel setup, not one-time sales.',
    constraints: {
      maxDurationSeconds: 3600,
      priority: 'critical' as const,
      maxParallelism: 6,
    },
  },
} as const;

const hr = '═══════════════════════════════════════════════════════════════';

function fail(step: string, err: unknown): never {
  console.error(`\n✗ FAILED: ${step} — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { caseName } = parseFlags();
  const input = CANNED_INPUTS[caseName];
  const runStart = Date.now();

  console.log(`\n${hr}\nWORKFLOW OPTIMIZER PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) {fail('Load GM', new Error('No active GM. Run node scripts/seed-workflow-optimizer-gm.js'));}
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {fail('Brand DNA', new Error('Not configured'));}
  console.log(`  ✓ Brand DNA loaded (industry=${brandDNA.industry})`);

  const specialist = getWorkflowOptimizer();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'WORKFLOW_OPTIMIZER',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: input,
    requiresResponse: true,
    traceId: `trace_harness_${Date.now()}`,
  };

  const llmStart = Date.now();
  const report = await specialist.execute(message);
  const llmDuration = Date.now() - llmStart;
  console.log(`  ✓ Returned in ${llmDuration}ms, status: ${report.status}`);

  if (report.status !== 'COMPLETED') {
    fail('Execute', new Error(`status=${report.status}, errors=${JSON.stringify(report.errors ?? [])}`));
  }

  const validation = __internal.ComposeWorkflowResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ workflowSummary:`);
  console.log(`      name:             ${d.workflowSummary.name}`);
  console.log(`      goal:             ${d.workflowSummary.goal.slice(0, 120)}`);
  console.log(`      primaryObjective: ${d.workflowSummary.primaryObjective.slice(0, 200)}`);
  console.log(`  ✓ nodes: ${d.nodes.length}`);
  for (const n of d.nodes) {
    console.log(`      - [${n.id}] ${n.agentId}.${n.action} (${n.estimatedDurationSeconds}s, retry=${n.retryStrategy})`);
    console.log(`          purpose:  ${n.purpose.slice(0, 150)}`);
    console.log(`          inputs:   ${n.inputsDescription.slice(0, 150)}`);
    console.log(`          outputs:  ${n.outputsDescription.slice(0, 150)}`);
    console.log(`          depends:  ${n.dependsOnDescription.slice(0, 150)}`);
  }
  console.log(`  ✓ executionPattern: ${d.executionPattern}`);
  console.log(`  ✓ parallelizationNotes: ${d.parallelizationNotes.length} chars`);
  console.log(`      ${d.parallelizationNotes.slice(0, 200)}...`);
  console.log(`  ✓ criticalPathDescription: ${d.criticalPathDescription.length} chars`);
  console.log(`      ${d.criticalPathDescription.slice(0, 200)}...`);
  console.log(`  ✓ estimatedTotalDurationSeconds: ${d.estimatedTotalDurationSeconds}s`);
  console.log(`  ✓ riskMitigation: ${d.riskMitigation.length}`);
  for (const r of d.riskMitigation) {
    console.log(`      - ${r.slice(0, 180)}`);
  }
  console.log(`  ✓ successCriteria: ${d.successCriteria.length} chars`);
  console.log(`      ${d.successCriteria.slice(0, 200)}...`);
  console.log(`  ✓ rationale: ${d.rationale.length} chars`);
  console.log(`      ${d.rationale.slice(0, 300)}...`);

  const total = Date.now() - runStart;
  console.log(`\n${hr}\nRESULT: COMPLETED | Validation: PASS | LLM: ${llmDuration}ms | Total: ${total}ms\n${hr}`);
}

main().catch((err) => {
  console.error('Harness crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
