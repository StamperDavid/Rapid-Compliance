/**
 * UX/UI Specialist — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-ux-ui-specialist.ts
 *   npx tsx scripts/test-ux-ui-specialist.ts --case=saas_sales_ops_landing
 *   npx tsx scripts/test-ux-ui-specialist.ts --case=realestate_luxury_homepage
 *   npx tsx scripts/test-ux-ui-specialist.ts --case=ecommerce_dtc_launch_landing
 *
 * NOTE: This is the Architect-layer UX/UI Specialist (strategic design picker),
 * NOT the Builder-layer UX/UI Architect (test-ux-ui-architect.ts, Task #35).
 * Different files, different jobs.
 */

import { getUXUISpecialist, __internal } from '../src/lib/agents/architect/ux-ui/specialist';
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
    action: 'design_page' as const,
    pageType: 'landing',
    industry: 'B2B SaaS — sales velocity platform',
    toneOfVoice: 'confident and direct, peer-to-peer founder voice — never corporate marketing speak',
    funnelType: 'lead_generation',
    sections: ['hero', 'social_proof', 'problem', 'solution', 'features', 'pricing', 'testimonials', 'faq', 'cta_footer'],
    brief:
      'Design the cold-traffic landing page for SalesVelocity.ai targeting founders running their own outbound today. Visitors arrive from a LinkedIn ad about "stop sending more cold emails." We sell a complete sales velocity platform that pairs every client with real human specialists running their outbound, content, and pipeline — not a self-serve dashboard. Pricing is month-to-month with a 30-day results guarantee. The page must convert problem-aware visitors who have been burned by cold-outreach agencies. Mobile traffic is roughly 40% of LinkedIn ad traffic. Brand visual restraint is important — the audience associates loud color and emoji-heavy design with consumer apps, and they are evaluating an enterprise-credible operations partner.',
  },
  realestate_luxury_homepage: {
    action: 'design_page' as const,
    pageType: 'homepage',
    industry: 'Luxury residential real estate',
    toneOfVoice: 'restrained editorial — confident without being loud, sophisticated without being stuffy. Think Wall Street Journal feature article, not yacht-broker pitch deck.',
    funnelType: 'lead_capture_long_cycle',
    sections: ['editorial_hero', 'market_intelligence_lead_magnet', 'curated_listings', 'broker_credentials', 'client_stories', 'contact_footer'],
    brief:
      'Design the homepage for a luxury real estate brokerage operating in three markets (Aspen, Naples, Hamptons) representing a small curated portfolio of $5M-$50M residential properties. The page must establish editorial credibility with wealth-managed individuals, family offices, and corporate executives evaluating properties on 6-18 month sale cycles. The lead magnet is a quarterly market intelligence report. Visitors are skeptical of glossy real estate sites and read boldness as cheap. Desktop traffic dominates — these visitors research from desks, not phones, and the page needs editorial print-heritage gravitas. Visual restraint is the entire brand position.',
  },
  ecommerce_dtc_launch_landing: {
    action: 'design_page' as const,
    pageType: 'product_launch',
    industry: 'DTC lifestyle products — wellness and home',
    toneOfVoice: 'energetic and confident with a founder-led voice. Specific product details, real founder face, no marketing-speak. The brand is small enough to be authentic, large enough to ship reliably.',
    funnelType: 'paid_traffic_to_purchase',
    sections: ['hero_with_product', 'founder_video', 'ingredient_breakdown', 'reviews', 'lab_test_proof', 'pricing_offer', 'guarantee', 'faq', 'mobile_sticky_cta'],
    brief:
      'Design the launch landing page for a new DTC sleep-supplement product (a melatonin-free magnesium-glycinate complex with L-theanine). The page must convert cold paid traffic from TikTok and Instagram in under 90 seconds on mobile. Mobile traffic is 90% of total. The offer is launch pricing ($39 down from $49) for the first 1,000 orders, free shipping over $35, and a 60-day money-back guarantee. The audience is millennial and Gen Z, mobile-first, fast-decision, but skeptical of dropshipping fronts. They check reviews, founder stories, and shipping policy before tapping buy. The brand has a real founder face (a chronic-insomnia survivor) and third-party batch testing — both must be visually prominent.',
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

  console.log(`\n${hr}\nUX/UI SPECIALIST PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) { fail('Load GM', new Error('No active GM. Run node scripts/seed-ux-ui-strategist-gm.js')); }
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) { fail('Brand DNA', new Error('Not configured')); }
  console.log(`  ✓ Brand DNA loaded (industry=${brandDNA.industry})`);

  const specialist = getUXUISpecialist();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'UX_UI_STRATEGIST',
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

  const validation = __internal.DesignPageResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ colorPsychology (${d.colorPsychology.length} chars): ${d.colorPsychology}`);
  console.log(`  ✓ typographyStyle (${d.typographyStyle.length} chars): ${d.typographyStyle}`);
  console.log(`  ✓ colorPaletteDirection: ${d.colorPaletteDirection.length} chars`);
  console.log(`      ${d.colorPaletteDirection.slice(0, 250)}...`);
  console.log(`  ✓ typographyDirection: ${d.typographyDirection.length} chars`);
  console.log(`      ${d.typographyDirection.slice(0, 250)}...`);
  console.log(`  ✓ componentSelectionDirection: ${d.componentSelectionDirection.length} chars`);
  console.log(`      ${d.componentSelectionDirection.slice(0, 250)}...`);
  console.log(`  ✓ layoutDirection: ${d.layoutDirection.length} chars`);
  console.log(`      ${d.layoutDirection.slice(0, 250)}...`);
  console.log(`  ✓ responsiveDirection: ${d.responsiveDirection.length} chars`);
  console.log(`      ${d.responsiveDirection.slice(0, 250)}...`);
  console.log(`  ✓ accessibilityDirection: ${d.accessibilityDirection.length} chars`);
  console.log(`      ${d.accessibilityDirection.slice(0, 250)}...`);
  console.log(`  ✓ designPrinciples: ${d.designPrinciples.length}`);
  for (const p of d.designPrinciples) {
    console.log(`      - ${p.slice(0, 200)}`);
  }
  console.log(`  ✓ keyDesignDecisions: ${d.keyDesignDecisions.length}`);
  for (const k of d.keyDesignDecisions) {
    console.log(`      - ${k.slice(0, 200)}`);
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
