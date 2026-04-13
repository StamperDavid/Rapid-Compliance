/**
 * Email Specialist — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-email-specialist.ts
 *   npx tsx scripts/test-email-specialist.ts --case=saas_cold_intro
 *   npx tsx scripts/test-email-specialist.ts --case=realestate_luxury_nurture
 *   npx tsx scripts/test-email-specialist.ts --case=ecommerce_dtc_reengagement
 */

import { getEmailSpecialist, __internal } from '../src/lib/agents/outreach/email/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import { getActiveEmailPurposeTypes } from '../src/lib/services/email-purpose-types-service';
import type { AgentMessage } from '../src/lib/agents/types';

type CaseName = 'saas_cold_intro' | 'realestate_luxury_nurture' | 'ecommerce_dtc_reengagement';

function parseFlags(): { caseName: CaseName } {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_cold_intro';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const v = arg.slice('--case='.length);
      if (v === 'saas_cold_intro' || v === 'realestate_luxury_nurture' || v === 'ecommerce_dtc_reengagement') {
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
  saas_cold_intro: {
    action: 'compose_email' as const,
    campaignName: 'Q2 2026 — Cold LinkedIn Outbound Hook',
    targetAudience: 'B2B SaaS founders and revenue operators scaling from $1M to $10M ARR who are currently running their own outbound and frustrated with cold-outreach agencies that over-promise and under-deliver',
    goal: 'Earn a reply or a 15-minute discovery call from a problem-aware founder',
    suggestedPurposeSlug: 'cold_intro',
    brief:
      'Write the first-touch cold email for SalesVelocity.ai targeting founders running their own outbound today. The recipient has connected with our LinkedIn outreach and seen a post about "stop sending more cold emails." We sell a complete sales velocity platform that pairs every client with real human specialists running their outbound, content, and pipeline — not a self-serve dashboard. Pricing is month-to-month with a 30-day results guarantee. The recipient has been burned by cold-outreach agencies before. We need to establish we are NOT another agency in the first two sentences. The CTA should be a low-commitment ask: a 15-minute call or a reply with the single biggest outbound blocker they are facing. Brand pillars to weave in: team-not-tools, results-before-retainer, no contracts ever.',
  },
  realestate_luxury_nurture: {
    action: 'compose_email' as const,
    campaignName: 'Q1 2026 — Quarterly Market Intelligence Nurture — Aspen Segment',
    targetAudience: 'Wealth-managed individuals, family office principals, and corporate executives who opted into the quarterly market intelligence report 60-90 days ago and have not yet engaged with a broker. They are evaluating $5M-$50M residential properties on 6-18 month sale cycles and are skeptical of glossy real estate outreach.',
    goal: 'Keep editorial authority warm and surface a specific recent listing or market movement that is relevant to the subscriber without asking for a broker conversation yet',
    suggestedPurposeSlug: 'nurture',
    sequenceStep: {
      stepNumber: 2,
      totalSteps: 6,
      priorInteractions: 'Subscribed 60 days ago. Opened the first quarterly report email (stage 1) but did not click through to any listing.',
    },
    brief:
      'Write the second-touch nurture email for a luxury real estate brokerage operating in Aspen, Naples, and the Hamptons. The recipient opted into the quarterly market intelligence report and opened the first delivery but did not click any listings. Do not ask for a broker conversation in this email — it is too early in the 6-18 month sale cycle and that ask will burn trust. Instead, surface one specific market movement (a luxury inventory shift in Aspen) with editorial framing and invite the reader to reply with any property preferences they are tracking. The tone is restrained editorial — Wall Street Journal feature article voice, not yacht-broker pitch. Visual restraint is the entire brand position. Brand pillars: market intelligence first, the curated few not the listing flood, discretion is the product.',
  },
  ecommerce_dtc_reengagement: {
    action: 'compose_email' as const,
    campaignName: 'Q2 2026 — Sleep Supplement Dormant Subscriber Reactivation',
    targetAudience: 'Mobile-first millennial and Gen Z subscribers who purchased the magnesium-glycinate sleep formula once 90-180 days ago and have not repurchased. They are skeptical of DTC subscription trap patterns and will unsubscribe immediately if the email reads as manipulative.',
    goal: 'Win back dormant subscribers with a single specific incentive and a clean easy-out — reactivate genuine buyers, cleanly lose the rest',
    suggestedPurposeSlug: 'reengagement',
    brief:
      'Write a re-engagement email for a DTC sleep-supplement brand targeting subscribers who purchased once 90-180 days ago and have not reordered. The audience is mobile-first millennial and Gen Z, fast-decision, skeptical of dropshipping and subscription-trap patterns. The brand has a real founder face (a chronic-insomnia survivor) and third-party batch testing — both should be invoked as trust signals. The offer is a single specific incentive: 25 percent off the next order of any product in the catalog, no coupon code required, expires in 7 days. Do NOT ask for feedback or a survey — the recipient has already bought and does not owe the brand an explanation. Do not manufacture false urgency. Include a clean easy-out (reply UNSUBSCRIBE to stop) because dormant subscribers who do not want to reactivate are a deliverability liability and should be removed cleanly.',
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

  console.log(`\n${hr}\nEMAIL SPECIALIST PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) { fail('Load GM', new Error('No active GM. Run node scripts/seed-email-specialist-gm.js')); }
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) { fail('Brand DNA', new Error('Not configured')); }
  console.log(`  ✓ Brand DNA loaded (industry=${brandDNA.industry})`);

  const purposeTypes = await getActiveEmailPurposeTypes();
  if (purposeTypes.length === 0) {
    fail('Purpose Types', new Error('Empty. Run node scripts/seed-email-purpose-types.js'));
  }
  console.log(`  ✓ Email Purpose Types loaded: ${purposeTypes.length} active`);
  console.log(`      ${purposeTypes.map(t => t.slug).join(', ')}`);

  const specialist = getEmailSpecialist();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'EMAIL_SPECIALIST',
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

  const validation = __internal.ComposeEmailResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ emailPurpose: ${d.emailPurpose}`);
  console.log(`  ✓ subjectLine (${d.subjectLine.length} chars): ${d.subjectLine}`);
  console.log(`  ✓ previewText (${d.previewText.length} chars): ${d.previewText}`);
  console.log(`  ✓ bodyPlainText: ${d.bodyPlainText.length} chars`);
  console.log(`      ${d.bodyPlainText.slice(0, 400)}...`);
  console.log(`  ✓ ctaLine: ${d.ctaLine}`);
  console.log(`  ✓ psLine: ${d.psLine}`);
  console.log(`  ✓ toneAndAngleReasoning: ${d.toneAndAngleReasoning.length} chars`);
  console.log(`      ${d.toneAndAngleReasoning.slice(0, 250)}...`);
  console.log(`  ✓ personalizationNotes: ${d.personalizationNotes.length} chars`);
  console.log(`      ${d.personalizationNotes.slice(0, 250)}...`);
  console.log(`  ✓ followupSuggestion: ${d.followupSuggestion.length} chars`);
  console.log(`      ${d.followupSuggestion.slice(0, 250)}...`);
  console.log(`  ✓ spamRiskNotes: ${d.spamRiskNotes.length} chars`);
  console.log(`      ${d.spamRiskNotes.slice(0, 250)}...`);
  console.log(`  ✓ rationale: ${d.rationale.length} chars`);
  console.log(`      ${d.rationale.slice(0, 350)}...`);

  const total = Date.now() - runStart;
  console.log(`\n${hr}\nRESULT: COMPLETED | Validation: PASS | LLM: ${llmDuration}ms | Total: ${total}ms\n${hr}`);
}

main().catch((err) => {
  console.error('Harness crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
