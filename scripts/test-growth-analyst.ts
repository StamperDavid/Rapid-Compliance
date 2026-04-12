/**
 * Growth Analyst — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-growth-analyst.ts
 *   npx tsx scripts/test-growth-analyst.ts --case=saas_acquisition
 *   npx tsx scripts/test-growth-analyst.ts --case=realestate_leads
 *   npx tsx scripts/test-growth-analyst.ts --case=ecommerce_retention
 */

import { getGrowthAnalyst, __internal } from '../src/lib/agents/marketing/growth-analyst/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

type CaseName = 'saas_acquisition' | 'realestate_leads' | 'ecommerce_retention';

function parseFlags(): { caseName: CaseName } {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_acquisition';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const v = arg.slice('--case='.length);
      if (v === 'saas_acquisition' || v === 'realestate_leads' || v === 'ecommerce_retention') caseName = v;
      else { console.error(`Unknown case: ${v}`); process.exit(1); }
    }
  }
  return { caseName };
}

const CANNED_INPUTS = {
  saas_acquisition: {
    action: 'generate_content' as const,
    topic: 'Customer acquisition strategy for B2B SaaS — improving trial-to-paid conversion and reducing CAC',
    contentType: 'growth_analysis',
    targetAudience: 'B2B SaaS founders scaling from $1M to $10M ARR',
    tone: 'analytical and direct',
    campaignGoal: 'Double trial-to-paid conversion rate within 90 days',
  },
  realestate_leads: {
    action: 'generate_content' as const,
    topic: 'Lead generation strategy for luxury real estate market — increasing qualified buyer pipeline',
    contentType: 'growth_analysis',
    targetAudience: 'Luxury real estate agents and brokerages',
    tone: 'strategic and data-driven',
    campaignGoal: 'Generate 50 qualified luxury buyer leads per month',
  },
  ecommerce_retention: {
    action: 'generate_content' as const,
    topic: 'Customer retention strategy for DTC ecommerce — reducing churn and increasing repeat purchase rate',
    contentType: 'growth_analysis',
    targetAudience: 'DTC ecommerce founders doing $500K-$5M annual revenue',
    tone: 'practical and results-focused',
    campaignGoal: 'Increase repeat purchase rate from 20% to 35% in 6 months',
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

  console.log(`\n${hr}\nGROWTH ANALYST PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) fail('Load GM', new Error('No active GM. Run seed-growth-analyst-gm.js'));
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) fail('Brand DNA', new Error('Not configured'));
  console.log(`  ✓ Brand DNA loaded`);

  const specialist = getGrowthAnalyst();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'GROWTH_ANALYST',
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

  const validation = __internal.GrowthAnalysisResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ analysis.currentState: ${d.analysis.currentState.length} chars`);
  console.log(`  ✓ analysis.opportunities: ${d.analysis.opportunities.length}`);
  console.log(`  ✓ analysis.risks: ${d.analysis.risks.length}`);
  console.log(`  ✓ experiments: ${d.experiments.length}`);
  for (const e of d.experiments) {
    console.log(`      - [${e.effort}/${e.expectedImpact}] ${e.name} (${e.channel})`);
  }
  console.log(`  ✓ prioritizedActions: ${d.prioritizedActions.length}`);
  for (const a of d.prioritizedActions) {
    console.log(`      - [${a.priority}] ${a.action.slice(0, 80)}`);
  }
  console.log(`  ✓ kpiTargets: ${d.kpiTargets.length}`);
  for (const k of d.kpiTargets) {
    console.log(`      - ${k.metric}: ${k.currentEstimate} → ${k.target} (${k.timeframe})`);
  }
  console.log(`  ✓ contentStrategy: ${d.contentStrategy.length} chars`);

  const total = Date.now() - runStart;
  console.log(`\n${hr}\nRESULT: COMPLETED | Validation: PASS | LLM: ${llmDuration}ms | Total: ${total}ms\n${hr}`);
}

main().catch((err) => {
  console.error('Harness crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
