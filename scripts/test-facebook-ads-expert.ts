/**
 * Facebook Ads Expert — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-facebook-ads-expert.ts
 *   npx tsx scripts/test-facebook-ads-expert.ts --case=saas_lead_gen
 *   npx tsx scripts/test-facebook-ads-expert.ts --case=realestate_retargeting
 *   npx tsx scripts/test-facebook-ads-expert.ts --case=ecommerce_carousel
 */

import { getFacebookAdsExpert, __internal } from '../src/lib/agents/marketing/facebook/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import type { AgentMessage } from '../src/lib/agents/types';

type CaseName = 'saas_lead_gen' | 'realestate_retargeting' | 'ecommerce_carousel';

function parseFlags(): { caseName: CaseName } {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_lead_gen';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const v = arg.slice('--case='.length);
      if (v === 'saas_lead_gen' || v === 'realestate_retargeting' || v === 'ecommerce_carousel') caseName = v;
      else { console.error(`Unknown case: ${v}`); process.exit(1); }
    }
  }
  return { caseName };
}

const CANNED_INPUTS = {
  saas_lead_gen: {
    action: 'generate_content' as const,
    topic: 'AI-powered sales automation platform that replaces your entire SaaS tool stack',
    contentType: 'lead_ad',
    targetAudience: 'B2B SaaS founders, VPs of Sales, Revenue leaders',
    tone: 'professional and conversion-focused',
  },
  realestate_retargeting: {
    action: 'generate_content' as const,
    topic: 'Luxury home listings with virtual tour and AI-powered follow-up for open house attendees',
    contentType: 'retargeting',
    targetAudience: 'Home buyers who visited listing pages in last 30 days',
    tone: 'aspirational and urgent',
  },
  ecommerce_carousel: {
    action: 'generate_content' as const,
    topic: 'Summer fashion collection launch with 30% off early access for email subscribers',
    contentType: 'carousel',
    targetAudience: 'Women 25-45 interested in fashion and online shopping',
    tone: 'trendy and exclusive',
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

  console.log(`\n${hr}\nFACEBOOK ADS EXPERT PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) fail('Load GM', new Error('No active GM. Run seed-facebook-ads-expert-gm.js'));
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) fail('Brand DNA', new Error('Not configured'));
  console.log(`  ✓ Brand DNA loaded`);

  const specialist = getFacebookAdsExpert();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'FACEBOOK_ADS_EXPERT',
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

  const validation = __internal.FacebookAdContentResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ Headline: "${d.adCreative.primary.headline}"`);
  console.log(`  ✓ Primary text: ${d.adCreative.primary.primaryText.length} chars`);
  console.log(`  ✓ CTA: "${d.adCreative.primary.callToAction}"`);
  console.log(`  ✓ Variations: ${d.adCreative.variations.length}`);
  for (const v of d.adCreative.variations) {
    console.log(`      - "${v.headline}" [${v.angle.slice(0, 60)}...]`);
  }
  console.log(`  ✓ Performance: ${d.estimatedPerformance}`);
  console.log(`  ✓ Strategy: ${d.contentStrategy.length} chars`);

  console.log(`\n  FULL OUTPUT:`);
  console.log(JSON.stringify(report.data, null, 2));

  const total = Date.now() - runStart;
  console.log(`\n${hr}\nRESULT: COMPLETED | Validation: PASS | LLM: ${llmDuration}ms | Total: ${total}ms\n${hr}`);
}

main().catch((err) => {
  console.error('Harness crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
