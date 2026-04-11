/**
 * Regression CLI — Seed Initial Case Corpus
 *
 * Creates the canned test cases for a given agent. Cases are authored inline
 * here so the corpus is reviewable in git history even though the documents
 * live in Firestore. Re-running the seed is a no-op for existing cases — use
 * --force to overwrite.
 *
 * Usage:
 *   npx tsx scripts/regression-seed-cases.ts --agent=COPYWRITER
 *   npx tsx scripts/regression-seed-cases.ts --agent=COPYWRITER --force
 */

import {
  createCase,
  upsertCasePreservingBaselines,
} from '../src/lib/regression/regression-service';
import type { RegressionCase } from '../src/types/regression';

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Copywriter cases
// ---------------------------------------------------------------------------

const COPYWRITER_CASES: Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[] = [
  {
    caseId: 'copywriter_home_page_4_sections',
    agentId: 'COPYWRITER',
    name: 'Home page with 4 sections',
    description:
      'The canonical page-copy case. Exercises the h2↔sections invariant, the sectionId mapping rule, and the avoid-phrases guard. Mirrors the input used in scripts/test-copywriter-specialist.ts so the harness tests the same contract the pirate proof-of-life covered.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['page_copy', 'hero', 'small'],
    createdBy: 'seed-script',
    inputPayload: {
      action: 'generate_page_copy',
      industryKey: 'saas_sales_ops',
      input: {
        pageId: 'home',
        pageName: 'Home Page',
        pagePurpose: 'Convert B2B SaaS revenue leaders into 15-minute pipeline reviews',
        sections: [
          { id: 'hero', name: 'Hero', purpose: 'Headline + subheadline + primary CTA' },
          { id: 'how_it_works', name: 'How It Works', purpose: '3-step process showing the AI agent swarm in action' },
          { id: 'proof', name: 'Proof', purpose: 'Why this is different from GoHighLevel and Vendasta' },
          { id: 'cta', name: 'Final CTA', purpose: 'Book a pipeline review' },
        ],
        seoKeywords: ['AI sales agents', 'revenue automation', 'SaaS sales operations'],
        toneOfVoice: 'direct, confident, no fluff',
        keyPhrases: ['AI agent swarm', 'sales velocity', 'every department'],
        avoidPhrases: ['cutting-edge', 'best-in-class', 'game-changer', 'revolutionary', 'solution'],
      },
    },
    notes: 'Baseline case — any delta here is a red flag for upgrades across the whole Copywriter surface.',
  },
  {
    caseId: 'copywriter_long_landing_6_sections',
    agentId: 'COPYWRITER',
    name: 'Long-form landing with 6 sections',
    description:
      'Stress-tests the h2↔sections invariant at higher section counts. Also exercises longer keyword lists and stricter avoid-phrase constraints. Catches regressions where a new model starts merging, reordering, or dropping sections.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['page_copy', 'long_form', 'stress'],
    createdBy: 'seed-script',
    inputPayload: {
      action: 'generate_page_copy',
      industryKey: 'saas_sales_ops',
      input: {
        pageId: 'features-landing',
        pageName: 'Features Landing',
        pagePurpose: 'Deep-dive feature page for buyers comparing SalesVelocity against tool-stack alternatives',
        sections: [
          { id: 'hero', name: 'Hero', purpose: 'Top-of-funnel hook for feature-comparison visitors' },
          { id: 'core_value', name: 'Core Value', purpose: 'What coordinated agent swarms replace' },
          { id: 'integrations', name: 'Integrations', purpose: 'Which tools we replace and which we connect to' },
          { id: 'automation', name: 'Automation', purpose: '24/7 autonomous execution across departments' },
          { id: 'proof', name: 'Proof', purpose: 'Real customer outcomes and integration breadth' },
          { id: 'cta', name: 'Final CTA', purpose: 'Book a demo walkthrough' },
        ],
        seoKeywords: ['AI business operations platform', 'sales and marketing automation', 'agent swarm replace stack'],
        toneOfVoice: 'confident, analytical, substantive',
        keyPhrases: ['all-in-one platform', 'AI agent swarm', 'replace your entire stack'],
        avoidPhrases: ['guaranteed', 'revolutionary', 'game-changer', 'seamless', 'synergy'],
      },
    },
    notes: 'Catches section-merge and ordering regressions that only appear at higher section counts.',
  },
  {
    caseId: 'copywriter_proposal_industrial_saas',
    agentId: 'COPYWRITER',
    name: 'Proposal for industrial SaaS lead',
    description:
      'The canonical proposal case. Exercises personalization fidelity (company name, contact name, pain points, tech stack) and the 3-5 sections invariant. Also tests the server-side overwrite of proposalId/leadId/generatedAt — those fields must appear in the output with server-provided values regardless of what the model returns.',
    mode: 'SINGLE_SHOT',
    active: true,
    tags: ['proposal', 'personalization', 'small'],
    createdBy: 'seed-script',
    shapeTolerances: [
      {
        path: '$.sections.length',
        kind: 'arrayLength',
        min: 3,
        max: 5,
        reason: 'Proposal spec allows 3-5 sections; any count inside the range is a valid editorial choice, not a regression.',
      },
    ],
    inputPayload: {
      action: 'generate_proposal',
      industryKey: 'saas_sales_ops',
      input: {
        leadId: 'regression_lead_acme_001',
        companyName: 'Acme Robotics',
        contactName: 'Dana Ruiz, VP of Revenue',
        industry: 'Industrial SaaS',
        painPoints: [
          'Outbound team of 4 SDRs hitting 32% of quota',
          'No content production — last blog post 7 months ago',
          'Pipeline reviews happening in spreadsheets',
        ],
        techStack: ['Salesforce', 'Outreach.io', 'Gong'],
        companySize: '180 employees',
        requestedInfo: ['pricing', 'implementation timeline', 'integration with Salesforce'],
      },
    },
    notes: 'Personalization regressions show up as invariant fails if the openingHook drops the company name or tech stack.',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface CliArgs {
  agent: string;
  force: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let agent = '';
  let force = false;
  for (const arg of argv) {
    if (arg.startsWith('--agent=')) agent = arg.slice('--agent='.length);
    else if (arg === '--force') force = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/regression-seed-cases.ts --agent=<ID> [--force]');
      process.exit(0);
    }
  }
  if (agent === '') {
    console.error('Missing --agent flag.');
    process.exit(1);
  }
  return { agent, force };
}

const AGENT_CASE_BANK: Record<string, Omit<RegressionCase, 'createdAt' | 'updatedAt' | 'baselines'>[]> = {
  COPYWRITER: COPYWRITER_CASES,
};

async function main(): Promise<void> {
  const args = parseArgs();
  const cases = AGENT_CASE_BANK[args.agent];
  if (!cases || cases.length === 0) {
    console.error(`No seed corpus defined for agent "${args.agent}".`);
    process.exit(1);
  }

  console.log(`\nSeeding ${cases.length} regression cases for ${args.agent}...\n`);

  let created = 0;
  let skipped = 0;
  let overwritten = 0;

  for (const c of cases) {
    if (args.force) {
      // Force mode: upsert everything except baselines (baselines are
      // preserved so tolerance/note/input edits don't destroy recorded work).
      try {
        await upsertCasePreservingBaselines(c);
        console.log(`  ~ ${c.caseId}  (${c.name})  [upserted, baselines preserved]`);
        overwritten += 1;
      } catch (err) {
        console.error(`  ✗ ${c.caseId}: ${err instanceof Error ? err.message : String(err)}`);
      }
      continue;
    }

    try {
      await createCase({
        ...c,
        createdAt: now(),
      });
      console.log(`  + ${c.caseId}  (${c.name})`);
      created += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists')) {
        console.log(`  = ${c.caseId}  (exists — skipped; use --force to upsert)`);
        skipped += 1;
      } else {
        console.error(`  ✗ ${c.caseId}: ${msg}`);
      }
    }
  }

  console.log(`\nDone. Created: ${created}, skipped: ${skipped}, overwritten: ${overwritten}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed script crashed:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
