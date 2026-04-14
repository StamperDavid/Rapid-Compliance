/**
 * Verify Brand DNA injection across all 16 updated specialists.
 *
 * Loads each specialist's loadGMConfig and checks that resolvedSystemPrompt
 * contains the "## Brand DNA" marker + tenant-specific values from Firestore.
 *
 * Usage: npx tsx scripts/verify-brand-dna-injection.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

interface SpecialistCheck {
  name: string;
  modulePath: string;
}

const SPECIALISTS: SpecialistCheck[] = [
  { name: 'AI Chat Sales Agent (Alex)', modulePath: '@/lib/agents/sales-chat/specialist' },
  { name: 'Lead Qualifier', modulePath: '@/lib/agents/sales/qualifier/specialist' },
  { name: 'Sales Outreach Specialist', modulePath: '@/lib/agents/sales/outreach/specialist' },
  { name: 'Merchandiser', modulePath: '@/lib/agents/sales/merchandiser/specialist' },
  { name: 'Deal Closer', modulePath: '@/lib/agents/sales/deal-closer/specialist' },
  { name: 'Objection Handler', modulePath: '@/lib/agents/sales/objection-handler/specialist' },
  { name: 'Review Specialist', modulePath: '@/lib/agents/trust/review/specialist' },
  { name: 'GMB Specialist', modulePath: '@/lib/agents/trust/gmb/specialist' },
  { name: 'Review Manager', modulePath: '@/lib/agents/trust/review-manager/specialist' },
  { name: 'Case Study Builder', modulePath: '@/lib/agents/trust/case-study/specialist' },
  { name: 'Inventory Manager', modulePath: '@/lib/agents/commerce/inventory/specialist' },
  { name: 'Scraper Specialist', modulePath: '@/lib/agents/intelligence/scraper/specialist' },
  { name: 'Competitor Researcher', modulePath: '@/lib/agents/intelligence/competitor/specialist' },
  { name: 'Technographic Scout', modulePath: '@/lib/agents/intelligence/technographic/specialist' },
  { name: 'Sentiment Analyst', modulePath: '@/lib/agents/intelligence/sentiment/specialist' },
  { name: 'Trend Scout', modulePath: '@/lib/agents/intelligence/trend/specialist' },
];

async function main() {
  console.log(`\nVerifying Brand DNA injection on ${SPECIALISTS.length} specialists...\n`);

  const results: Array<{ name: string; passed: boolean; reason: string }> = [];

  for (const spec of SPECIALISTS) {
    try {
      const mod = await import(spec.modulePath) as { __internal: { loadGMConfig: (k: string) => Promise<any>; DEFAULT_INDUSTRY_KEY: string } };
      if (!mod.__internal) {
        results.push({ name: spec.name, passed: false, reason: 'no __internal export' });
        continue;
      }
      const ctx = await mod.__internal.loadGMConfig(mod.__internal.DEFAULT_INDUSTRY_KEY) as {
        gm: { model: string };
        brandDNA?: { industry: string; toneOfVoice: string; companyDescription: string };
        resolvedSystemPrompt: string;
      };
      const hasBrandDNAField = ctx.brandDNA !== undefined;
      const hasBrandBlock = ctx.resolvedSystemPrompt.includes('## Brand DNA');
      const hasIndustry = ctx.brandDNA !== undefined && ctx.resolvedSystemPrompt.includes(ctx.brandDNA.industry);
      const hasTone = ctx.brandDNA !== undefined && ctx.resolvedSystemPrompt.includes(ctx.brandDNA.toneOfVoice);

      if (hasBrandDNAField && hasBrandBlock && hasIndustry && hasTone) {
        results.push({ name: spec.name, passed: true, reason: `GM loaded + Brand DNA injected (industry=${ctx.brandDNA?.industry})` });
      } else {
        const issues: string[] = [];
        if (!hasBrandDNAField) { issues.push('no brandDNA field on context'); }
        if (!hasBrandBlock) { issues.push('no ## Brand DNA block in prompt'); }
        if (!hasIndustry) { issues.push('industry not in prompt'); }
        if (!hasTone) { issues.push('tone not in prompt'); }
        results.push({ name: spec.name, passed: false, reason: issues.join('; ') });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: spec.name, passed: false, reason: `EXCEPTION: ${msg}` });
    }
  }

  console.log('\n=== Results ===\n');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const r of results) {
    const marker = r.passed ? '✓' : '✗';
    console.log(`  ${marker} ${r.name.padEnd(30)} ${r.reason}`);
  }

  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
