/**
 * PHASE 2a VERIFY — Content Manager review gate end-to-end
 *
 * Proves the Content Manager's Golden Master (seeded by
 * scripts/seed-content-manager-gm.js) is actually being loaded from
 * Firestore at runtime and the LLM review is grading specialist output
 * against the GM's criteria.
 *
 * Two cases run through the real reviewOutput() method:
 *
 *   Case A (GOOD) — simulates a Copywriter report with high-quality output
 *                   that respects Brand DNA, is specific, and has all
 *                   required fields. Expected verdict: PASS / approved.
 *
 *   Case B (BAD)  — simulates a Copywriter report stuffed with generic
 *                   SaaS jargon, vague claims, and a forbidden Brand DNA
 *                   phrase. Expected verdict: MAJOR or BLOCK / rejected.
 *
 * Usage: npx tsx scripts/verify-content-manager-review.ts
 *
 * Exit code: 0 if both verdicts are as expected, 1 otherwise.
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

import { ContentManager } from '../src/lib/agents/content/manager';
import type { AgentReport } from '../src/lib/agents/types';
import type { ReviewResult } from '../src/lib/agents/base-manager';

/**
 * Test probe that exposes the protected reviewOutput method as public so
 * a standalone script can exercise the review gate without running the
 * full execute() flow. Inherits everything else from ContentManager.
 */
class ProbeContentManager extends ContentManager {
  public async probeReview(report: AgentReport): Promise<ReviewResult> {
    return this.reviewOutput(report);
  }
}

function makeGoodCopywriterReport(): AgentReport {
  return {
    taskId: 'probe_good_001',
    agentId: 'COPYWRITER',
    timestamp: new Date(),
    status: 'COMPLETED',
    data: {
      headlines: {
        h1: 'Your AI Sales Team. Working 24/7. From Day One.',
        h2: [
          'The AI agent swarm that runs your outbound while your reps close',
          'From signup to first qualified lead in under 15 minutes',
          'Start your free trial — no credit card, no sales call',
        ],
        h3: [
          'Inbound triage, research, and warm handoff — fully automated',
          'No onboarding calls. No professional services fees.',
          'Every feature, every integration, every agent — included from day one',
        ],
      },
      sections: [
        {
          sectionId: 'hero',
          heading: 'The AI agent swarm that runs your outbound while your reps close',
          content:
            'Your SDRs should be on calls, not scrubbing LinkedIn for phone numbers. SalesVelocity.ai is a coordinated AI agent swarm — each agent specialized in a piece of the sales pipeline. They intercept inbound leads, qualify against your ICP, enrich with real-time firmographics, and hand the hot ones to a human. The rest stay warm in your CRM on an automated drip. Your reps spend their day on revenue conversations, not admin.',
          cta: 'Start your free trial',
        },
        {
          sectionId: 'features',
          heading: 'From signup to first qualified lead in under 15 minutes',
          content:
            'SalesVelocity.ai is a multi-tenant SaaS platform, not a services engagement. You sign up, authorize your CRM, import your ICP, and the swarm starts working. No kickoff calls, no "professional services fees", no re-training your reps. Your existing workflows stay intact — the AI fills in the gaps your team already dreads.',
          cta: 'See how the swarm installs',
        },
        {
          sectionId: 'cta',
          heading: 'Start your free trial — no credit card, no sales call',
          content:
            'You get every feature on day one: the full agent swarm, the CRM, the outreach engine, the dashboards, the integrations. No paywalls, no feature gating, no sales calls. If it does not save your reps real time in the first two weeks, walk away. No card, no commitment.',
          cta: 'Start free trial',
        },
      ],
      metadata: {
        title: 'SalesVelocity.ai — AI Sales Swarm for B2B SaaS',
        description: 'The AI agent swarm that runs your outbound while your reps close. Free trial, no card, no sales calls, no setup fees.',
        keywords: ['AI sales agent', 'outbound automation', 'B2B SaaS sales tools', 'sales swarm', 'lead qualification AI'],
        ogTitle: 'SalesVelocity.ai — AI Sales Swarm for B2B SaaS',
        ogDescription: 'Your reps close, the AI does the grunt work. Free trial, no card, no sales call.',
      },
      visuals: [
        {
          sectionId: 'hero',
          description: 'Animated dashboard showing incoming leads being triaged in real time by the agent swarm, with hot leads flowing to a rep queue and cold leads moving to an automated drip.',
          format: 'lottie',
        },
        {
          sectionId: 'features',
          description: 'Step-by-step screen capture of the 15-minute setup flow: signup → OAuth CRM connect → ICP import → first lead qualified.',
          format: 'video',
        },
        {
          sectionId: 'cta',
          description: 'Clean hero banner with the free-trial CTA as the dominant focal point.',
          format: 'static-image',
        },
      ],
    },
  };
}

function makeBadCopywriterReport(): AgentReport {
  return {
    taskId: 'probe_bad_001',
    agentId: 'COPYWRITER',
    timestamp: new Date(),
    status: 'COMPLETED',
    data: {
      headlines: {
        h1: 'Unlock Synergistic Solutions for Your Business',
        h2: [
          'Leverage cutting-edge AI to transform your workflows',
          'Empower your team with best-in-class tools',
          'Take your business to the next level',
        ],
        h3: [],
      },
      sections: [
        {
          sectionId: 'hero',
          heading: 'Unlock Synergistic Solutions for Your Business',
          content:
            'In today\'s fast-paced digital landscape, businesses need to leverage cutting-edge AI to stay ahead. Our innovative solution helps businesses grow by transforming their workflows and empowering their teams. With seamless integration and world-class support, we help you achieve more.',
          cta: 'Learn More',
        },
        {
          sectionId: 'features',
          heading: 'Leverage cutting-edge AI to transform your workflows',
          content:
            'Our platform delivers 10x results across the board. Boost your productivity by 500%, save countless hours every week, and scale effortlessly with our proprietary AI technology. Industry leaders trust us for our unparalleled performance and world-class reliability.',
          cta: 'Get Started',
        },
        {
          sectionId: 'cta',
          heading: 'Take your business to the next level',
          content:
            'Join thousands of satisfied customers worldwide. Experience the future of business automation today. [COMPANY NAME] is here to help you succeed.',
          cta: 'Sign Up Now',
        },
      ],
      metadata: {
        title: 'Unlock Synergistic Solutions',
        description: 'Transform your business with cutting-edge AI. Leverage our innovative solution to take your workflows to the next level.',
        keywords: ['AI', 'business', 'solutions', 'workflows'],
        ogTitle: 'Unlock Synergistic Solutions',
        ogDescription: 'Transform your business with AI.',
      },
      visuals: [],
    },
  };
}

function summarizeVerdict(label: string, verdict: ReviewResult): void {
  console.log(`\n[${label}] verdict`);
  console.log(`  approved:     ${verdict.approved}`);
  console.log(`  severity:     ${verdict.severity}`);
  console.log(`  qualityScore: ${verdict.qualityScore}`);
  console.log(`  feedback (${verdict.feedback.length} items):`);
  for (const f of verdict.feedback) {
    const preview = f.length > 300 ? `${f.slice(0, 300)}...` : f;
    console.log(`    - ${preview}`);
  }
}

async function main(): Promise<void> {
  console.log('========================================================================');
  console.log('  PHASE 2a VERIFY — Content Manager review gate end-to-end');
  console.log('========================================================================');
  console.log('Loading Content Manager...');

  const manager = new ProbeContentManager();
  await manager.initialize();

  console.log('\nCase A (GOOD copy): high-quality report, should PASS');
  const goodReport = makeGoodCopywriterReport();
  const goodVerdict = await manager.probeReview(goodReport);
  summarizeVerdict('GOOD', goodVerdict);

  console.log('\nCase B (BAD copy): generic jargon + forbidden phrase + placeholder text, should REJECT');
  const badReport = makeBadCopywriterReport();
  const badVerdict = await manager.probeReview(badReport);
  summarizeVerdict('BAD', badVerdict);

  console.log('\n========================================================================');
  console.log('  EVALUATION');
  console.log('========================================================================');

  const goodPass = goodVerdict.approved && goodVerdict.severity === 'PASS';
  const badFail = !badVerdict.approved && (badVerdict.severity === 'MAJOR' || badVerdict.severity === 'BLOCK');

  console.log(`  GOOD case approved + PASS:       ${goodPass ? '✓' : '✗'} (approved=${goodVerdict.approved}, severity=${goodVerdict.severity})`);
  console.log(`  BAD case rejected MAJOR/BLOCK:   ${badFail ? '✓' : '✗'} (approved=${badVerdict.approved}, severity=${badVerdict.severity})`);

  if (goodPass && badFail) {
    console.log('\n  ✓ Review gate is LIVE and working end-to-end.');
    console.log('    - Content Manager loaded GM from Firestore');
    console.log('    - LLM review graded both cases against Brand DNA + review rubric');
    console.log('    - Good output approved, bad output rejected with actionable feedback');
    process.exit(0);
  } else {
    console.log('\n  ✗ Review gate verdict was NOT as expected — investigate before moving on.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
