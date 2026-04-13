/**
 * Funnel Engineer — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-funnel-engineer.ts
 *   npx tsx scripts/test-funnel-engineer.ts --case=saas_b2b
 *   npx tsx scripts/test-funnel-engineer.ts --case=realestate_luxury
 *   npx tsx scripts/test-funnel-engineer.ts --case=ecommerce_dtc
 */

import { getFunnelEngineer, __internal } from '../src/lib/agents/builder/funnel/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

type CaseName = 'saas_b2b' | 'realestate_luxury' | 'ecommerce_dtc';

function parseFlags(): { caseName: CaseName } {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_b2b';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const v = arg.slice('--case='.length);
      if (v === 'saas_b2b' || v === 'realestate_luxury' || v === 'ecommerce_dtc') {
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
  saas_b2b: {
    action: 'design_funnel' as const,
    context:
      'B2B SaaS sales velocity platform targeting B2B SaaS founders and revenue operators scaling $1M-$10M ARR. Primary goal: drive qualified free trial signups that convert to paid within 30 days.',
    requirements: {
      funnelType: 'free_trial',
      businessModel: 'saas_sales_ops',
      targetAudience: 'B2B SaaS founders and revenue operators scaling from $1M to $10M ARR',
      pricePoint: 'mid' as const,
      productName: 'SalesVelocity.ai',
      trafficSource: 'LinkedIn paid + organic content + SEO',
    },
  },
  realestate_luxury: {
    action: 'design_funnel' as const,
    context:
      'Luxury real estate brokerage funnel for high-ticket property transactions. Sales cycle is 6-18 months. Primary goal: move qualified affluent buyers from awareness through in-person property viewings.',
    requirements: {
      funnelType: 'high_ticket_consultation',
      businessModel: 'real_estate_luxury',
      targetAudience: 'Affluent buyers shopping $2M-$20M properties',
      pricePoint: 'high' as const,
      productName: 'Legacy Estates Brokerage',
      trafficSource: 'Editorial content + Google Ads + broker referrals',
    },
  },
  ecommerce_dtc: {
    action: 'design_funnel' as const,
    context:
      'DTC ecommerce brand for premium lifestyle goods. Fast-velocity mobile-first purchase flow with emphasis on repeat purchase and subscription conversion.',
    requirements: {
      funnelType: 'dtc_repeat_purchase',
      businessModel: 'ecommerce_dtc',
      targetAudience: 'Millennial and Gen-Z shoppers on mobile, repeat purchasers of lifestyle goods',
      pricePoint: 'low' as const,
      productName: 'North Point Goods',
      trafficSource: 'TikTok + Meta paid social + influencer partnerships',
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

  console.log(`\n${hr}\nFUNNEL ENGINEER PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) {fail('Load GM', new Error('No active GM. Run node scripts/seed-funnel-engineer-gm.js'));}
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {fail('Brand DNA', new Error('Not configured'));}
  console.log(`  ✓ Brand DNA loaded (industry=${brandDNA.industry})`);

  const specialist = getFunnelEngineer();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'FUNNEL_ENGINEER',
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

  const validation = __internal.FunnelDesignResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ funnelSummary:`);
  console.log(`      type:             ${d.funnelSummary.funnelType}`);
  console.log(`      businessModel:    ${d.funnelSummary.businessModel}`);
  console.log(`      primaryObjective: ${d.funnelSummary.primaryObjective.slice(0, 200)}`);
  console.log(`  ✓ stages: ${d.stages.length}`);
  for (const s of d.stages) {
    console.log(`      - ${s.name} (est ${s.estimatedConversionPct}%, risk ${s.bottleneckRisk}): ${s.purpose.slice(0, 80)}`);
    console.log(`          tactics: ${s.tacticsDescription.slice(0, 150)}`);
    console.log(`          kpis:    ${s.kpiDescription.slice(0, 150)}`);
  }
  console.log(`  ✓ expectedOverallConversionPct: ${d.expectedOverallConversionPct}%`);
  console.log(`  ✓ estimatedCpa: ${d.estimatedCpa.slice(0, 200)}`);
  console.log(`  ✓ keyBottleneckRisks: ${d.keyBottleneckRisks.length}`);
  for (const r of d.keyBottleneckRisks) {
    console.log(`      - ${r.slice(0, 150)}`);
  }
  console.log(`  ✓ abTestRoadmap: ${d.abTestRoadmap.length}`);
  for (const t of d.abTestRoadmap) {
    console.log(`      - [${t.priority}] ${t.testName}: ${t.hypothesis.slice(0, 120)}`);
  }
  console.log(`  ✓ recommendations: ${d.recommendations.length} chars`);
  console.log(`      ${d.recommendations.slice(0, 300)}...`);
  console.log(`  ✓ rationale: ${d.rationale.length} chars`);
  console.log(`      ${d.rationale.slice(0, 300)}...`);

  const total = Date.now() - runStart;
  console.log(`\n${hr}\nRESULT: COMPLETED | Validation: PASS | LLM: ${llmDuration}ms | Total: ${total}ms\n${hr}`);
}

main().catch((err) => {
  console.error('Harness crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
