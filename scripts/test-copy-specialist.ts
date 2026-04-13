/**
 * Copy Specialist — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-copy-specialist.ts
 *   npx tsx scripts/test-copy-specialist.ts --case=saas_sales_ops_landing
 *   npx tsx scripts/test-copy-specialist.ts --case=realestate_luxury_homepage
 *   npx tsx scripts/test-copy-specialist.ts --case=ecommerce_dtc_launch_landing
 *
 * NOTE: This is the Architect-layer Copy Specialist (strategic messaging picker),
 * NOT the Content-layer Copywriter (test-copywriter.ts). Different files, different jobs.
 */

import { getCopySpecialist, __internal } from '../src/lib/agents/architect/copy/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

type CaseName = 'saas_sales_ops_landing' | 'realestate_luxury_homepage' | 'ecommerce_dtc_launch_landing';

function parseFlags(): { caseName: CaseName } {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_sales_ops_landing';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const v = arg.slice('--case='.length);
      if (v === 'saas_sales_ops_landing' || v === 'realestate_luxury_homepage' || v === 'ecommerce_dtc_launch_landing') {
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
  saas_sales_ops_landing: {
    action: 'generate_copy' as const,
    pageType: 'landing',
    funnelType: 'lead_generation',
    targetAudience: 'B2B SaaS founders and revenue operators ($1M-$10M ARR) drowning in disconnected sales tools and frustrated with cold-outreach agencies that promise leads but deliver spam',
    toneOfVoice: 'confident and direct, peer-to-peer founder voice — never corporate marketing speak',
    industry: 'B2B SaaS — sales velocity platform',
    brief:
      'Build the cold-traffic landing page for SalesVelocity.ai targeting founders running their own outbound today. The page must convert problem-aware visitors who arrived from a LinkedIn ad about "stop sending more cold emails." We sell a complete sales velocity platform that pairs every client with real human specialists running their outbound, content, and pipeline — not a self-serve dashboard. Pricing is month-to-month with a 30-day results guarantee. Top objections we see in sales calls: "I just signed a 12-month agency contract three months ago," "I do not have time to onboard another tool," and "how is this different from a VA service." Brand pillars we want repeated: team-not-tools, results-before-retainer, no contracts ever.',
  },
  realestate_luxury_homepage: {
    action: 'generate_copy' as const,
    pageType: 'homepage',
    funnelType: 'lead_capture_long_cycle',
    targetAudience:
      'Wealth-managed individuals, family offices, and corporate executives evaluating luxury residential properties in markets with 6-18 month average sale cycles. They have seen every glossy real estate site and are skeptical of agents who lead with "exclusive" and "luxury" as adjectives.',
    toneOfVoice:
      'restrained editorial — confident without being loud, sophisticated without being stuffy. Think Wall Street Journal feature article, not yacht-broker pitch deck.',
    industry: 'Luxury residential real estate',
    brief:
      'Build the homepage for a luxury real estate brokerage operating in three markets (Aspen, Naples, Hamptons). The brokerage represents a small curated portfolio of $5M-$50M residential properties. The page must establish editorial credibility and capture leads who are 6-18 months away from purchase. The lead magnet is a quarterly market intelligence report tied to wealth-preservation themes. Top objections: "every luxury agent claims discretion and access — what makes you different," "I already have a relationship with another broker in this market," and "I am not ready to look yet, I am just researching." Brand pillars: market intelligence first sales second, the curated few not the listing flood, discretion is the product.',
  },
  ecommerce_dtc_launch_landing: {
    action: 'generate_copy' as const,
    pageType: 'product_launch',
    funnelType: 'paid_traffic_to_purchase',
    targetAudience:
      'Mobile-first millennial and Gen Z lifestyle shoppers who arrived from a TikTok or Instagram ad. Decision speed is fast (60-90 seconds on the page) but they are skeptical of dropshipping fronts. They check reviews, founder stories, and shipping policy before tapping buy.',
    toneOfVoice:
      'energetic and confident with a founder-led voice. Specific product details, real founder face, no marketing-speak. The brand is small enough to be authentic, large enough to ship reliably.',
    industry: 'DTC lifestyle products — wellness and home',
    brief:
      'Build the launch landing page for a new DTC sleep-supplement product (a melatonin-free magnesium-glycinate complex with L-theanine). The page must convert cold paid traffic from TikTok and Instagram in under 90 seconds on mobile. The offer is launch pricing ($39 down from $49) for the first 1,000 orders, free shipping over $35, and a 60-day money-back guarantee. Top objections: "is this just another generic supplement," "how do I know this will not just be melatonin in a fancy bottle," and "I have been burned by Instagram ads before." Brand pillars: the formula your sleep doctor would actually approve, founder is a real chronic-insomnia survivor, third-party tested every batch.',
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

  console.log(`\n${hr}\nCOPY SPECIALIST PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) { fail('Load GM', new Error('No active GM. Run node scripts/seed-copy-specialist-gm.js')); }
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) { fail('Brand DNA', new Error('Not configured')); }
  console.log(`  ✓ Brand DNA loaded (industry=${brandDNA.industry})`);

  const specialist = getCopySpecialist();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'COPY_SPECIALIST',
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

  const validation = __internal.GenerateCopyResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ framework: ${d.framework}`);
  console.log(`      reasoning: ${d.frameworkReasoning.slice(0, 200)}...`);
  console.log(`  ✓ ctaStrategy: ${d.ctaStrategy}`);
  console.log(`      reasoning: ${d.ctaStrategyReasoning.slice(0, 200)}...`);
  console.log(`  ✓ voiceAndToneDirection: ${d.voiceAndToneDirection.length} chars`);
  console.log(`      ${d.voiceAndToneDirection.slice(0, 250)}...`);
  console.log(`  ✓ siteWideMessagingPillars: ${d.siteWideMessagingPillars.length}`);
  for (const p of d.siteWideMessagingPillars) {
    console.log(`      - ${p.slice(0, 200)}`);
  }
  console.log(`  ✓ keyObjections: ${d.keyObjections.length}`);
  for (const o of d.keyObjections) {
    console.log(`      - ${o.slice(0, 200)}`);
  }
  console.log(`  ✓ socialProofPlacementDescription: ${d.socialProofPlacementDescription.length} chars`);
  console.log(`      ${d.socialProofPlacementDescription.slice(0, 200)}...`);
  console.log(`  ✓ pageMessagingNotes: ${d.pageMessagingNotes.length} chars`);
  console.log(`      ${d.pageMessagingNotes.slice(0, 250)}...`);
  console.log(`  ✓ headlineDirection: ${d.headlineDirection.length} chars`);
  console.log(`      ${d.headlineDirection.slice(0, 250)}...`);
  console.log(`  ✓ rationale: ${d.rationale.length} chars`);
  console.log(`      ${d.rationale.slice(0, 350)}...`);

  const total = Date.now() - runStart;
  console.log(`\n${hr}\nRESULT: COMPLETED | Validation: PASS | LLM: ${llmDuration}ms | Total: ${total}ms\n${hr}`);
}

main().catch((err) => {
  console.error('Harness crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
