/**
 * Funnel Pathologist — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-funnel-pathologist.ts
 *   npx tsx scripts/test-funnel-pathologist.ts --case=saas_sales_ops_free_trial
 *   npx tsx scripts/test-funnel-pathologist.ts --case=realestate_luxury_lead_capture
 *   npx tsx scripts/test-funnel-pathologist.ts --case=ecommerce_dtc_launch_direct_checkout
 *
 * NOTE: This is the Architect-layer Funnel Pathologist (strategic funnel
 * diagnosis), NOT the Builder-layer Funnel Engineer (test-funnel-engineer.ts,
 * Task #36). Different files, different jobs.
 */

import { getFunnelPathologist, __internal } from '../src/lib/agents/architect/funnel/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

type CaseName = 'saas_sales_ops_free_trial' | 'realestate_luxury_lead_capture' | 'ecommerce_dtc_launch_direct_checkout';

function parseFlags(): { caseName: CaseName } {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_sales_ops_free_trial';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const v = arg.slice('--case='.length);
      if (v === 'saas_sales_ops_free_trial' || v === 'realestate_luxury_lead_capture' || v === 'ecommerce_dtc_launch_direct_checkout') {
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
  saas_sales_ops_free_trial: {
    action: 'analyze_funnel' as const,
    funnelType: 'free_trial',
    businessType: 'B2B SaaS — sales velocity platform',
    stages: [
      { name: 'awareness', goal: 'capture problem-aware founders from LinkedIn ads', pages: ['landing'] },
      { name: 'trial_signup', goal: 'convert landing visitors to free trial accounts', pages: ['pricing', 'signup'] },
      { name: 'activation', goal: 'hit first-value moment within 48 hours of signup', pages: ['onboarding', 'dashboard'] },
      { name: 'day_14_upgrade', goal: 'trigger upgrade prompt when trial value limit is hit', pages: ['upgrade_modal'] },
      { name: 'paid_conversion', goal: 'convert engaged trial users to paid plans', pages: ['checkout'] },
    ],
    conversionPoints: [
      { location: 'landing_hero', action: 'click_start_trial', target: 'signup' },
      { location: 'pricing_page', action: 'select_plan', target: 'signup' },
      { location: 'day_14_upgrade_modal', action: 'click_upgrade', target: 'checkout' },
    ],
    brief:
      'Diagnose the cold-traffic free-trial funnel for SalesVelocity.ai targeting founders running their own outbound today. Visitors arrive from a LinkedIn ad about "stop sending more cold emails." We sell a complete sales velocity platform that pairs every client with real human specialists running their outbound, content, and pipeline — not a self-serve dashboard. Pricing is month-to-month with a 30-day results guarantee. The page must convert problem-aware visitors who have been burned by cold-outreach agencies. Mobile traffic is roughly 40% of LinkedIn ad traffic. Previous attempts at this funnel hit trust issues on the pricing page — founders ask "how is this different from another agency that promised leads." Activation after signup requires a 30-minute onboarding call with a human specialist which is a conversion risk vs self-serve SaaS norms.',
  },
  realestate_luxury_lead_capture: {
    action: 'analyze_funnel' as const,
    funnelType: 'lead_capture_long_cycle',
    businessType: 'Luxury residential real estate',
    stages: [
      { name: 'editorial_awareness', goal: 'attract wealth-managed individuals via quarterly market intelligence', pages: ['homepage', 'market_report_landing'] },
      { name: 'lead_magnet_optin', goal: 'capture email in exchange for the market intelligence report', pages: ['optin_form'] },
      { name: 'nurture', goal: 'build authority over 6-18 months via quarterly reports and curated listings', pages: ['email_sequence', 'listings'] },
      { name: 'broker_conversation', goal: 'convert nurtured leads into broker conversations', pages: ['broker_contact'] },
    ],
    conversionPoints: [
      { location: 'homepage_hero', action: 'click_market_report_cta', target: 'optin_form' },
      { location: 'email_sequence', action: 'click_listing_detail', target: 'listings' },
      { location: 'listing_detail', action: 'request_private_showing', target: 'broker_contact' },
    ],
    brief:
      'Diagnose the long-cycle lead-capture funnel for a luxury real estate brokerage operating in three markets (Aspen, Naples, Hamptons) representing a small curated portfolio of $5M-$50M residential properties. The funnel must establish editorial credibility with wealth-managed individuals, family offices, and corporate executives evaluating properties on 6-18 month sale cycles. The lead magnet is a quarterly market intelligence report. Visitors are skeptical of glossy real estate sites and read boldness as cheap. Desktop traffic dominates — these visitors research from desks, not phones. The biggest historical loss for this brokerage has been visitors opting into the report but never returning — the nurture sequence has not converted browsers into broker conversations. Visual restraint is the entire brand position.',
  },
  ecommerce_dtc_launch_direct_checkout: {
    action: 'analyze_funnel' as const,
    funnelType: 'paid_traffic_to_purchase',
    businessType: 'DTC lifestyle products — wellness and home',
    stages: [
      { name: 'paid_ad_click', goal: 'capture cold traffic from TikTok and Instagram ads', pages: ['landing'] },
      { name: 'product_review', goal: 'overcome skepticism with founder story and third-party testing', pages: ['landing', 'founder_video'] },
      { name: 'offer_decision', goal: 'convert to purchase within 90 seconds on mobile', pages: ['pricing_offer'] },
      { name: 'checkout', goal: 'complete purchase flow with minimal friction', pages: ['cart', 'checkout', 'confirmation'] },
    ],
    conversionPoints: [
      { location: 'landing_hero', action: 'click_add_to_cart', target: 'cart' },
      { location: 'founder_video', action: 'watch_then_click_cta', target: 'pricing_offer' },
      { location: 'cart', action: 'click_checkout', target: 'checkout' },
      { location: 'checkout', action: 'click_complete_order', target: 'confirmation' },
    ],
    brief:
      'Diagnose the direct-checkout funnel for a new DTC sleep-supplement product launch (a melatonin-free magnesium-glycinate complex with L-theanine). The funnel must convert cold paid traffic from TikTok and Instagram in under 90 seconds on mobile. Mobile traffic is 90% of total. The offer is launch pricing ($39 down from $49) for the first 1,000 orders, free shipping over $35, and a 60-day money-back guarantee. The audience is millennial and Gen Z, mobile-first, fast-decision, but skeptical of dropshipping fronts. They check reviews, founder stories, and shipping policy before tapping buy. Previous launches in this category have lost conversions at checkout when shipping costs appeared on the final step — the audience expects either free shipping or transparent upfront shipping framing. The brand has a real founder face (a chronic-insomnia survivor) and third-party batch testing — both must be visually prominent.',
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

  console.log(`\n${hr}\nFUNNEL PATHOLOGIST PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) { fail('Load GM', new Error('No active GM. Run node scripts/seed-funnel-pathologist-gm.js')); }
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) { fail('Brand DNA', new Error('Not configured')); }
  console.log(`  ✓ Brand DNA loaded (industry=${brandDNA.industry})`);

  const specialist = getFunnelPathologist();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'FUNNEL_PATHOLOGIST',
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

  const validation = __internal.AnalyzeFunnelResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ funnelFramework: ${d.funnelFramework}`);
  console.log(`  ✓ frameworkReasoning (${d.frameworkReasoning.length} chars):`);
  console.log(`      ${d.frameworkReasoning.slice(0, 250)}...`);
  console.log(`  ✓ primaryConversionLeak: ${d.primaryConversionLeak}`);
  console.log(`  ✓ leakDiagnosis: ${d.leakDiagnosis.length} chars`);
  console.log(`      ${d.leakDiagnosis.slice(0, 250)}...`);
  console.log(`  ✓ stageRiskProfile: ${d.stageRiskProfile.length} chars`);
  console.log(`      ${d.stageRiskProfile.slice(0, 250)}...`);
  console.log(`  ✓ criticalLeakPoints: ${d.criticalLeakPoints.length}`);
  for (const p of d.criticalLeakPoints) {
    console.log(`      - ${p.slice(0, 200)}`);
  }
  console.log(`  ✓ trustSignalStrategy: ${d.trustSignalStrategy.length} chars`);
  console.log(`      ${d.trustSignalStrategy.slice(0, 250)}...`);
  console.log(`  ✓ pricingPsychologyDirection: ${d.pricingPsychologyDirection.length} chars`);
  console.log(`      ${d.pricingPsychologyDirection.slice(0, 250)}...`);
  console.log(`  ✓ urgencyAndScarcityDirection: ${d.urgencyAndScarcityDirection.length} chars`);
  console.log(`      ${d.urgencyAndScarcityDirection.slice(0, 250)}...`);
  console.log(`  ✓ recoveryPlays: ${d.recoveryPlays.length}`);
  for (const p of d.recoveryPlays) {
    console.log(`      - ${p.slice(0, 200)}`);
  }
  console.log(`  ✓ keyMetricsToWatch: ${d.keyMetricsToWatch.length}`);
  for (const m of d.keyMetricsToWatch) {
    console.log(`      - ${m}`);
  }
  console.log(`  ✓ rationale: ${d.rationale.length} chars`);
  console.log(`      ${d.rationale.slice(0, 350)}...`);

  const total = Date.now() - runStart;
  console.log(`\n${hr}\nRESULT: COMPLETED | Validation: PASS | LLM: ${llmDuration}ms | Total: ${total}ms\n${hr}`);
}

main().catch((err) => {
  console.error('Harness crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
