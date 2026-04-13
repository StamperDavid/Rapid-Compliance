/**
 * SMS Specialist — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-sms-specialist.ts
 *   npx tsx scripts/test-sms-specialist.ts --case=saas_flash_offer
 *   npx tsx scripts/test-sms-specialist.ts --case=realestate_appointment_reminder
 *   npx tsx scripts/test-sms-specialist.ts --case=ecommerce_shipping_update
 */

import { getSmsSpecialist, __internal } from '../src/lib/agents/outreach/sms/specialist';
import { getActiveSpecialistGMByIndustry } from '../src/lib/training/specialist-golden-master-service';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';
import { getActiveSmsPurposeTypes } from '../src/lib/services/sms-purpose-types-service';
import { getSmsSettings } from '../src/lib/services/sms-settings-service';
import type { AgentMessage } from '../src/lib/agents/types';

type CaseName = 'saas_flash_offer' | 'realestate_appointment_reminder' | 'ecommerce_shipping_update';

function parseFlags(): { caseName: CaseName } {
  const argv = process.argv.slice(2);
  let caseName: CaseName = 'saas_flash_offer';
  for (const arg of argv) {
    if (arg.startsWith('--case=')) {
      const v = arg.slice('--case='.length);
      if (v === 'saas_flash_offer' || v === 'realestate_appointment_reminder' || v === 'ecommerce_shipping_update') {
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
  saas_flash_offer: {
    action: 'compose_sms' as const,
    campaignName: 'Q2 2026 — SalesVelocity Annual Upgrade Flash Sale',
    targetAudience:
      'Existing SalesVelocity.ai monthly-plan customers who have been active for 60+ days and have hit their trial limit on at least one outbound sequence. They know the product and use it weekly.',
    goal: 'Drive upgrade from monthly to annual plan with a limited-time discount',
    suggestedPurposeSlug: 'flash_offer',
    brief:
      'Write a flash-offer SMS to existing monthly-plan customers inviting them to upgrade to annual and save 20 percent. Offer window: 48 hours. This audience already knows the product, so skip the pitch — just deliver the offer and the expiry. CTA should be a short landing page link (svai.link/annual-20). Customers expect us to be professional and concise, not cute or hype-heavy. Brand pillars: team-not-tools, results-before-retainer, no contracts ever.',
  },
  realestate_appointment_reminder: {
    action: 'compose_sms' as const,
    campaignName: 'Aspen Q2 Private Viewing Confirmations',
    targetAudience:
      'Luxury real estate prospects with scheduled private property viewings in the next 24 hours. They booked through a broker conversation and expect a professional, restrained communication style consistent with the brokerage brand.',
    goal: 'Confirm the upcoming appointment and give a low-friction reschedule option',
    suggestedPurposeSlug: 'appointment_reminder',
    brief:
      'Write an appointment reminder SMS for a luxury real estate brokerage (Aspen, Naples, Hamptons). The recipient has a private viewing scheduled tomorrow at {{appointment_time}} at {{property_address}} with broker {{broker_name}}. Include the property address and time. Offer a reschedule option via reply ("Reply 1 to confirm, 2 to reschedule"). Tone is restrained editorial — these are wealth-managed buyers who expect discretion, not emoji-heavy consumer SMS. Keep it short and dignified.',
  },
  ecommerce_shipping_update: {
    action: 'compose_sms' as const,
    campaignName: 'Sleep Supplement Launch — Order Shipped Notification',
    targetAudience:
      'Customers who just purchased the magnesium-glycinate sleep supplement during the launch window and whose order has been picked up by the carrier. They are mobile-first, expect fast delivery, and have a strong preference for tracking information delivered proactively.',
    goal: 'Inform the customer that their order has shipped and give them a tracking link',
    suggestedPurposeSlug: 'shipping_update',
    brief:
      'Write a shipping update SMS for a DTC sleep-supplement brand. The recipient just had their order shipped and needs the tracking link. The body should name the product ({{product_name}}), mention the carrier ({{carrier_name}}) and expected delivery window ({{delivery_window}}), and include a shortened tracking link (svai.link/track/{{order_id}}). This is a transactional message so TCPA compliance is lighter, but still include STOP keyword footer. Voice is warm and specific — the brand has a real founder face (chronic-insomnia survivor) and that personality should come through without burning characters.',
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

  console.log(`\n${hr}\nSMS SPECIALIST PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) { fail('Load GM', new Error('No active GM. Run node scripts/seed-sms-specialist-gm.js')); }
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) { fail('Brand DNA', new Error('Not configured')); }
  console.log(`  ✓ Brand DNA loaded (industry=${brandDNA.industry})`);

  const purposeTypes = await getActiveSmsPurposeTypes();
  if (purposeTypes.length === 0) {
    fail('Purpose Types', new Error('Empty. Run node scripts/seed-sms-purpose-types.js'));
  }
  console.log(`  ✓ SMS Purpose Types loaded: ${purposeTypes.length} active`);
  console.log(`      ${purposeTypes.map(t => t.slug).join(', ')}`);

  const smsSettings = await getSmsSettings();
  console.log(`  ✓ SMS Settings loaded: maxCharCap=${smsSettings.maxCharCap}, region=${smsSettings.complianceRegion}, requireFooter=${smsSettings.requireComplianceFooter}`);

  const specialist = getSmsSpecialist();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'SMS_SPECIALIST',
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

  const validation = __internal.ComposeSmsResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  const totalLen = d.primaryMessage.length + d.complianceFooter.length;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ smsPurpose: ${d.smsPurpose}`);
  console.log(`  ✓ segmentStrategy: ${d.segmentStrategy}`);
  console.log(`  ✓ primaryMessage (${d.primaryMessage.length} chars):`);
  console.log(`      ${d.primaryMessage}`);
  console.log(`  ✓ charCount (self-reported): ${d.charCount}`);
  console.log(`  ✓ complianceFooter (${d.complianceFooter.length} chars): ${d.complianceFooter}`);
  console.log(`  ✓ TOTAL send length: ${totalLen} chars (${totalLen <= smsSettings.maxCharCap ? 'WITHIN' : 'OVER'} cap of ${smsSettings.maxCharCap})`);
  console.log(`  ✓ ctaText: ${d.ctaText}`);
  console.log(`  ✓ linkPlacementNotes: ${d.linkPlacementNotes.length} chars`);
  console.log(`      ${d.linkPlacementNotes.slice(0, 220)}...`);
  console.log(`  ✓ personalizationNotes: ${d.personalizationNotes.length} chars`);
  console.log(`      ${d.personalizationNotes.slice(0, 220)}...`);
  console.log(`  ✓ toneAndAngleReasoning: ${d.toneAndAngleReasoning.length} chars`);
  console.log(`      ${d.toneAndAngleReasoning.slice(0, 220)}...`);
  console.log(`  ✓ followupSuggestion: ${d.followupSuggestion.length} chars`);
  console.log(`      ${d.followupSuggestion.slice(0, 220)}...`);
  console.log(`  ✓ complianceRisks: ${d.complianceRisks.length} chars`);
  console.log(`      ${d.complianceRisks.slice(0, 220)}...`);
  console.log(`  ✓ rationale: ${d.rationale.length} chars`);
  console.log(`      ${d.rationale.slice(0, 300)}...`);

  const total = Date.now() - runStart;
  console.log(`\n${hr}\nRESULT: COMPLETED | Validation: PASS | LLM: ${llmDuration}ms | Total: ${total}ms\n${hr}`);
}

main().catch((err) => {
  console.error('Harness crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
