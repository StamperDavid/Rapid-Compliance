/**
 * PHASE 2 MULTI-MANAGER VERIFY — end-to-end review gate tests
 *
 * Extends the Content Manager verification pattern to 3 more managers
 * with very different review criteria:
 *
 *   1. OUTREACH_MANAGER    — compliance-heavy (CAN-SPAM, TCPA). Tests a
 *                            clean cold email (should PASS) vs a non-
 *                            compliant SMS missing opt-out language
 *                            (should BLOCK).
 *
 *   2. INTELLIGENCE_MANAGER — specificity-heavy. Tests a sourced,
 *                             specific competitor brief (should PASS)
 *                             vs a vague "market is growing" brief
 *                             with no sources (should MAJOR/BLOCK).
 *
 *   3. REVENUE_DIRECTOR    — specialist review path. Tests a correctly-
 *                            scored BANT qualification (should PASS) vs
 *                            a qualification with wrong BANT math
 *                            (should MAJOR).
 *
 * Usage: npx tsx scripts/verify-managers-review.ts
 *
 * Exit code: 0 if all 6 cases (3 managers × 2 fixtures) match expected
 * verdicts, 1 otherwise.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) { process.env[key] = value; }
      }
    }
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

import { OutreachManager } from '../src/lib/agents/outreach/manager';
import { IntelligenceManager } from '../src/lib/agents/intelligence/manager';
import { RevenueDirector } from '../src/lib/agents/sales/revenue/manager';
import type { AgentReport } from '../src/lib/agents/types';
import type { ReviewResult } from '../src/lib/agents/base-manager';

// Probes that expose protected reviewOutput as public for direct testing
class ProbeOutreachManager extends OutreachManager {
  public async probeReview(report: AgentReport): Promise<ReviewResult> {
    return this.reviewOutput(report);
  }
}

class ProbeIntelligenceManager extends IntelligenceManager {
  public async probeReview(report: AgentReport): Promise<ReviewResult> {
    return this.reviewOutput(report);
  }
}

class ProbeRevenueDirector extends RevenueDirector {
  public async probeReview(report: AgentReport): Promise<ReviewResult> {
    return this.reviewOutput(report);
  }
}

// ============================================================================
// FIXTURES
// ============================================================================

// --- Outreach ---

function makeGoodEmailReport(): AgentReport {
  return {
    taskId: 'probe_outreach_good',
    agentId: 'EMAIL_SPECIALIST',
    timestamp: new Date(),
    status: 'COMPLETED',
    data: {
      emailPurpose: 'cold_outreach',
      subject: 'Quick question about Acme\'s outbound stack',
      preheader: 'Saw your Series A — curious how you\'re handling outbound volume at 15 reps',
      body: 'Hi John,\n\nI saw Acme\'s Series A last month — congrats. Scaling from 5 to 15 SDRs usually breaks outbound in the first 90 days because the volume jump outruns rep enablement.\n\nSalesVelocity.ai runs the pre-call grunt work (qualification, research, draft outreach) so your reps stay on calls instead of building lists. Setup is 15 minutes, free trial has no card.\n\nOpen to a 10-minute call next week?\n\nDave\nSalesVelocity.ai\n123 Market St, San Francisco CA\n\nPrefer not to hear from us? Unsubscribe: {{unsubscribe_url}}',
      cta: 'Book a 10-minute call',
      rationale: 'Persona is founder-tier, post-Series A. Subject is specific, body references the actual funding news (sourced), value prop is concrete (pre-call grunt work), CTA is low-commitment (10 min not 30). Unsubscribe acknowledged as footer placeholder. Sender identifies self and company with physical address.',
    },
  };
}

function makeBadSmsReport(): AgentReport {
  return {
    taskId: 'probe_outreach_bad',
    agentId: 'SMS_SPECIALIST',
    timestamp: new Date(),
    status: 'COMPLETED',
    data: {
      messageText: 'Hey John! This is SalesVelocity. We can 10x your sales overnight — guaranteed! Text us back NOW before this offer expires in 24 hours!!!',
      segmentCount: 1,
      optOutLanguage: null,
      sendWindowConstraints: {
        earliestLocal: '00:00',
        latestLocal: '23:59',
      },
      rationale: 'Punchy SMS to drive urgency',
    },
  };
}

// --- Intelligence ---

function makeGoodIntelligenceReport(): AgentReport {
  return {
    taskId: 'probe_intel_good',
    agentId: 'COMPETITOR_RESEARCHER',
    timestamp: new Date(),
    status: 'COMPLETED',
    data: {
      scope: 'Top 3 mid-market sales engagement platforms adjacent to SalesVelocity.ai, sampled from G2 Category Leaders 2026-Q1',
      competitorAudit: [
        {
          name: 'Outreach.io',
          positioning: 'Enterprise sales engagement platform focused on sequence automation. Targets 100+ rep orgs.',
          pricing: '$100-130/user/month Platform tier; enterprise custom. Confidence HIGH — 3 independent sources.',
          features: [
            'Multi-channel sequences (email + call + LinkedIn)',
            'AI-powered reply suggestions (launched 2024-Q3 per company blog)',
            'Revenue intelligence dashboards',
          ],
          marketShare: '18% ±3% of mid-to-enterprise sales engagement, per Forrester Wave: Sales Engagement Platforms, Q4 2025 report (published 2025-11-18, figure 2 p. 14).',
          strengths: [
            'Deep Salesforce integration (bi-directional sync)',
            'Mature analytics and forecasting',
            'Large user base = strong peer-training ecosystem',
          ],
          weaknesses: [
            'Pricing out of reach for <20 rep orgs',
            'AI features are bolt-ons, not core workflow',
            'Setup complexity — 4-6 weeks to full deploy per G2 review median',
          ],
          sources: [
            'https://g2.com/products/outreach-io/reviews (accessed 2026-04-10, sample n=85 reviews)',
            'Forrester Wave: Sales Engagement Platforms, Q4 2025 (Forrester report ID SEP-2025-Q4, 2025-11-18)',
            'Outreach.io pricing page (web.archive.org snapshot 2026-02-15)',
          ],
        },
        {
          name: 'Salesloft',
          positioning: 'Sales engagement + conversation intelligence. Positions as full-funnel revenue platform. Strong mid-market to enterprise.',
          pricing: '$125-165/user/month Advanced tier; enterprise custom. Confidence MEDIUM — 2 public sources, 1 indirect.',
          features: [
            'Cadence orchestration (email + phone + LinkedIn)',
            'Conversation intelligence (acquired Drift 2024)',
            'Coaching and call review workflows',
          ],
          marketShare: '14% ±3% of same segment per Forrester Wave Q4 2025 (figure 2 p. 14).',
          strengths: [
            'Conversation intelligence is a first-class workflow, not a bolt-on',
            'Strong RevOps focus appeals to enterprise buyers',
            'Channel partners and SI ecosystem',
          ],
          weaknesses: [
            'Price parity with Outreach without the market share to match',
            'Drift integration still rough per G2 reviews 2026-Q1',
            'Limited appeal below 50 reps',
          ],
          sources: [
            'https://g2.com/products/salesloft/reviews (accessed 2026-04-10, sample n=62 reviews)',
            'Forrester Wave: Sales Engagement Platforms, Q4 2025 (same report as above)',
            'Salesloft 2026 Investor Day deck (publicly posted 2026-02-22)',
          ],
        },
        {
          name: 'Apollo.io',
          positioning: 'All-in-one sales intelligence + engagement. Freemium model with aggressive land-and-expand. Targets 5-100 rep orgs.',
          pricing: '$49-99/user/month Professional/Organization tiers; $0 Free tier with limits. Confidence HIGH — public pricing page.',
          features: [
            'Prospect database (275M+ contacts per company claim, 2026-Q1)',
            'Sequences + dialer + email automation',
            'Basic CRM functionality',
          ],
          marketShare: '9% ±3% of same segment per Forrester Wave Q4 2025 (figure 2 p. 14). Growing segment share per YoY delta in same report.',
          strengths: [
            'Pricing accessible to SMB',
            'Integrated data + engagement in one tool',
            'Freemium acquisition funnel is strong',
          ],
          weaknesses: [
            'Data quality issues with contact accuracy (G2 common complaint)',
            'Enterprise features thin — not a threat to Outreach at 100+ reps',
            'UI complexity grows with feature count',
          ],
          sources: [
            'https://apollo.io/pricing (accessed 2026-04-10)',
            'https://g2.com/products/apollo-io/reviews (accessed 2026-04-10, sample n=94 reviews)',
            'Forrester Wave: Sales Engagement Platforms, Q4 2025 (same report)',
          ],
        },
      ],
      methodology: 'Cross-referenced G2 public reviews (4.4k+ reviews sampled across 3 competitors), Forrester Wave Q4 2025 report for market share anchors, direct pricing page scrapes for cost data. Confidence scored per data dimension below.',
      confidence: {
        pricing: 85,
        marketShare: 75,
        featureInventory: 80,
        strengthsWeaknesses: 70,
        overall: 77,
      },
      dataLimitations: 'Market share estimates inherit Forrester ±3% range. Pricing data is accurate as of Feb-April 2026 snapshots. G2 review sentiment may skew toward active complainers.',
    },
  };
}

function makeBadIntelligenceReport(): AgentReport {
  return {
    taskId: 'probe_intel_bad',
    agentId: 'TREND_SCOUT',
    timestamp: new Date(),
    status: 'COMPLETED',
    data: {
      trends: [
        {
          topic: 'AI is transforming the workplace',
          momentum: 'high',
          adoption_curve: 'accelerating',
          confidence: 95,
          insight: 'Companies that use AI have higher productivity',
        },
        {
          topic: 'Remote work is the future',
          momentum: 'very high',
          adoption_curve: 'mainstream',
          confidence: 98,
          insight: 'Remote workers are more productive',
        },
      ],
      summary: 'The market is growing rapidly. Companies should adopt AI to stay competitive in today\'s fast-paced digital landscape.',
      confidence: 96,
    },
  };
}

// --- Revenue ---

function makeGoodQualificationReport(): AgentReport {
  return {
    taskId: 'probe_revenue_good',
    agentId: 'LEAD_QUALIFIER',
    timestamp: new Date(),
    status: 'COMPLETED',
    data: {
      leadId: 'L_probe_001',
      qualification: {
        hasBudget: true,
        hasNeed: true,
        hasTimeline: true,
        isDecisionMaker: false,
        score: 80,
        status: 'qualified',
        notes: [
          'Prospect stated budget of $75k/year allocated for sales tools, approved by CFO in Feb 2026',
          'Current pain: 15 reps spending ~40% of time on manual lead enrichment (per their internal time-tracking audit)',
          'Target deploy: before end of Q2 to capture ramp period for new hires joining June 1',
          'Contact is VP Sales — needs sign-off from CRO (named Lisa Chen) on contracts over $50k',
          'Demo requested for April 22 with full sales leadership team (4 people)',
        ],
      },
      rationale: 'Score 80 = hasNeed(30) + hasBudget(25) + hasTimeline(25) + isDecisionMaker(0) = 80. Notes pulled from specific conversation transcript references. Status=qualified matches score range 75+.',
    },
  };
}

function makeBadQualificationReport(): AgentReport {
  return {
    taskId: 'probe_revenue_bad',
    agentId: 'LEAD_QUALIFIER',
    timestamp: new Date(),
    status: 'COMPLETED',
    data: {
      leadId: 'L_probe_002',
      qualification: {
        hasBudget: false,
        hasNeed: true,
        hasTimeline: false,
        isDecisionMaker: false,
        score: 85,
        status: 'qualified',
        notes: [
          'Good lead',
          'Seems interested',
          'Should close soon',
        ],
      },
      rationale: 'Hot lead, likely to close',
    },
  };
}

// ============================================================================
// RUNNER
// ============================================================================

interface Case {
  manager: string;
  label: 'GOOD' | 'BAD';
  report: AgentReport;
  reviewFn: (report: AgentReport) => Promise<ReviewResult>;
  expectApproved: boolean;
  expectSeverityIn: ReadonlyArray<ReviewResult['severity']>;
}

function summarize(c: Case, verdict: ReviewResult): { passed: boolean; line: string } {
  const passed = verdict.approved === c.expectApproved && c.expectSeverityIn.includes(verdict.severity);
  const marker = passed ? '✓' : '✗';
  const line = `  ${marker} ${c.manager.padEnd(22)} ${c.label.padEnd(5)} approved=${verdict.approved} severity=${verdict.severity} quality=${verdict.qualityScore}`;
  return { passed, line };
}

async function main(): Promise<void> {
  console.log('========================================================================');
  console.log('  PHASE 2 VERIFY — 3 managers × 2 fixtures each (6 cases total)');
  console.log('========================================================================');

  const outreach = new ProbeOutreachManager();
  const intelligence = new ProbeIntelligenceManager();
  const revenue = new ProbeRevenueDirector();

  await outreach.initialize();
  await intelligence.initialize();
  await revenue.initialize();

  const cases: Case[] = [
    {
      manager: 'OUTREACH_MANAGER',
      label: 'GOOD',
      report: makeGoodEmailReport(),
      reviewFn: (r) => outreach.probeReview(r),
      expectApproved: true,
      expectSeverityIn: ['PASS'],
    },
    {
      manager: 'OUTREACH_MANAGER',
      label: 'BAD',
      report: makeBadSmsReport(),
      reviewFn: (r) => outreach.probeReview(r),
      expectApproved: false,
      expectSeverityIn: ['MAJOR', 'BLOCK'],
    },
    {
      manager: 'INTELLIGENCE_MANAGER',
      label: 'GOOD',
      report: makeGoodIntelligenceReport(),
      reviewFn: (r) => intelligence.probeReview(r),
      expectApproved: true,
      expectSeverityIn: ['PASS'],
    },
    {
      manager: 'INTELLIGENCE_MANAGER',
      label: 'BAD',
      report: makeBadIntelligenceReport(),
      reviewFn: (r) => intelligence.probeReview(r),
      expectApproved: false,
      expectSeverityIn: ['MAJOR', 'BLOCK'],
    },
    {
      manager: 'REVENUE_DIRECTOR',
      label: 'GOOD',
      report: makeGoodQualificationReport(),
      reviewFn: (r) => revenue.probeReview(r),
      expectApproved: true,
      expectSeverityIn: ['PASS'],
    },
    {
      manager: 'REVENUE_DIRECTOR',
      label: 'BAD',
      report: makeBadQualificationReport(),
      reviewFn: (r) => revenue.probeReview(r),
      expectApproved: false,
      expectSeverityIn: ['MAJOR', 'BLOCK'],
    },
  ];

  const results: Array<{ c: Case; verdict: ReviewResult; passed: boolean }> = [];

  for (const c of cases) {
    console.log(`\n→ ${c.manager} / ${c.label}...`);
    const verdict = await c.reviewFn(c.report);
    const { passed, line } = summarize(c, verdict);
    console.log(line);
    if (verdict.feedback.length > 0) {
      for (const f of verdict.feedback.slice(0, 3)) {
        const preview = f.length > 200 ? `${f.slice(0, 200)}...` : f;
        console.log(`      - ${preview}`);
      }
    }
    results.push({ c, verdict, passed });
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n========================================================================');
  console.log('  SUMMARY');
  console.log('========================================================================');
  for (const r of results) {
    const marker = r.passed ? '✓' : '✗';
    console.log(`  ${marker} ${r.c.manager.padEnd(22)} ${r.c.label.padEnd(5)} ${r.verdict.severity} (expected: ${r.c.expectApproved ? 'PASS' : 'MAJOR/BLOCK'})`);
  }
  console.log(`\n  ${passed} / ${results.length} passed, ${failed} failed\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
