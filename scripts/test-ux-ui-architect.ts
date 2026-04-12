/**
 * UX/UI Architect — Proof of Life Harness
 *
 * Usage:
 *   npx tsx scripts/test-ux-ui-architect.ts
 *   npx tsx scripts/test-ux-ui-architect.ts --case=saas_b2b
 *   npx tsx scripts/test-ux-ui-architect.ts --case=realestate_luxury
 *   npx tsx scripts/test-ux-ui-architect.ts --case=ecommerce_dtc
 */

import { getUxUiArchitect, __internal } from '../src/lib/agents/builder/ux-ui/specialist';
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
    action: 'generate_design_system' as const,
    context:
      'B2B SaaS sales velocity platform — clean, data-dense dashboard UI, trust-building marketing site, converts enterprise buyers',
    requirements: {
      targetAudience: 'B2B SaaS founders and revenue operators scaling from $1M to $10M ARR',
      accessibilityLevel: 'AA' as const,
      industryHint: 'saas_sales_ops',
      styleDirection: 'modern, confident, precise — not playful, not corporate',
      priorityComponents: ['Button', 'Input', 'Card', 'Table', 'Modal'],
    },
  },
  realestate_luxury: {
    action: 'generate_design_system' as const,
    context:
      'Luxury real estate brokerage website — editorial photography, generous whitespace, slow reveal animations, high-end buyer experience',
    requirements: {
      targetAudience: 'Affluent buyers and sellers shopping $2M-$20M properties',
      accessibilityLevel: 'AA' as const,
      industryHint: 'real_estate',
      styleDirection: 'editorial, understated, timeless — never loud or trendy',
      priorityComponents: ['Button', 'Input', 'Card', 'Gallery', 'Nav'],
    },
  },
  ecommerce_dtc: {
    action: 'generate_design_system' as const,
    context:
      'DTC ecommerce brand — high-velocity product pages, fast checkout, mobile-first, bold photography and confident CTAs',
    requirements: {
      targetAudience: 'Millennial and Gen-Z shoppers on mobile, repeat purchasers of lifestyle goods',
      accessibilityLevel: 'AA' as const,
      industryHint: 'ecommerce_dtc',
      styleDirection: 'bold, energetic, playful but premium',
      priorityComponents: ['Button', 'Input', 'Card', 'ProductCard', 'Badge'],
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

  console.log(`\n${hr}\nUX/UI ARCHITECT PROOF OF LIFE — ${caseName}\n${hr}`);

  const gmRecord = await getActiveSpecialistGMByIndustry(__internal.SPECIALIST_ID, __internal.DEFAULT_INDUSTRY_KEY);
  if (!gmRecord) {fail('Load GM', new Error('No active GM. Run node scripts/seed-ux-ui-architect-gm.js'));}
  console.log(`  ✓ GM: ${gmRecord.id}, v${gmRecord.version}`);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {fail('Brand DNA', new Error('Not configured'));}
  console.log(`  ✓ Brand DNA loaded (industry=${brandDNA.industry})`);

  const specialist = getUxUiArchitect();
  await specialist.initialize();

  const message: AgentMessage = {
    id: `harness_${caseName}_${Date.now()}`,
    timestamp: new Date(),
    from: 'HARNESS',
    to: 'UX_UI_ARCHITECT',
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

  const validation = __internal.DesignSystemResultSchema.safeParse(report.data);
  if (!validation.success) {
    fail('Zod', new Error(validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
  }

  const d = validation.data;
  console.log(`  ✓ Zod PASS`);
  console.log(`  ✓ tokens.colors:`);
  console.log(`      primary:   ${d.tokens.colors.primary.hex} — ${d.tokens.colors.primary.usage.slice(0, 80)}`);
  console.log(`      secondary: ${d.tokens.colors.secondary.hex} — ${d.tokens.colors.secondary.usage.slice(0, 80)}`);
  console.log(`      accent:    ${d.tokens.colors.accent.hex} — ${d.tokens.colors.accent.usage.slice(0, 80)}`);
  console.log(`      neutral:   ${d.tokens.colors.neutral.length} steps`);
  for (const n of d.tokens.colors.neutral) {
    console.log(`        - ${n.name.padEnd(20)} ${n.hex}`);
  }
  console.log(`      semantic:`);
  console.log(`        success: ${d.tokens.colors.semantic.success.hex}`);
  console.log(`        warning: ${d.tokens.colors.semantic.warning.hex}`);
  console.log(`        error:   ${d.tokens.colors.semantic.error.hex}`);
  console.log(`        info:    ${d.tokens.colors.semantic.info.hex}`);
  console.log(`  ✓ tokens.typography: ${d.tokens.typography.scale.length} scale steps, sans=${d.tokens.typography.fontFamilies.sans.slice(0, 40)}`);
  for (const s of d.tokens.typography.scale) {
    console.log(`      - ${s.name.padEnd(6)} size=${s.sizePx}px  lh=${s.lineHeight}  weight=${s.weight}`);
  }
  console.log(`  ✓ tokens.spacing: grid=${d.tokens.spacing.grid}, scale=${d.tokens.spacing.scale.length} steps [${d.tokens.spacing.scale.join(', ')}]`);
  console.log(`  ✓ tokens.radius: sm=${d.tokens.radius.sm}  md=${d.tokens.radius.md}  lg=${d.tokens.radius.lg}  full=${d.tokens.radius.full}`);
  console.log(`  ✓ tokens.shadows: sm/md/lg`);
  console.log(`  ✓ tokens.breakpoints: mobile=${d.tokens.breakpoints.mobile} tablet=${d.tokens.breakpoints.tablet} desktop=${d.tokens.breakpoints.desktop} wide=${d.tokens.breakpoints.wide}`);
  console.log(`  ✓ componentGuidelines: ${d.componentGuidelines.length}`);
  for (const c of d.componentGuidelines) {
    console.log(`      - ${c.name}: ${c.purpose.slice(0, 100)}`);
    console.log(`          variants: ${c.variantsDescription.slice(0, 150)}`);
    console.log(`          states:   ${c.statesCoveredDescription.slice(0, 150)}`);
  }
  console.log(`  ✓ designPrinciples: ${d.designPrinciples.length}`);
  for (const p of d.designPrinciples) {
    console.log(`      - ${p}`);
  }
  console.log(`  ✓ accessibilityStrategy: ${d.accessibilityStrategy.length} chars`);
  console.log(`      ${d.accessibilityStrategy.slice(0, 200)}...`);
  console.log(`  ✓ rationale: ${d.rationale.length} chars`);
  console.log(`      ${d.rationale.slice(0, 300)}...`);

  const total = Date.now() - runStart;
  console.log(`\n${hr}\nRESULT: COMPLETED | Validation: PASS | LLM: ${llmDuration}ms | Total: ${total}ms\n${hr}`);
}

main().catch((err) => {
  console.error('Harness crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
