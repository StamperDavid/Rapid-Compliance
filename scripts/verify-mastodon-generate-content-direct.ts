/**
 * CREDENTIAL SMOKE TEST — direct specialist call, NOT product-path verification.
 *
 * What this DOES test:
 *   - MastodonExpert.execute({action:'generate_content'}) loads its GM from
 *     Firestore (getActiveSpecialistGMByIndustry) and makes a real LLM call
 *     via OpenRouterProvider to produce a Zod-validated MastodonContentResult
 *   - The specialist's schema contract (primaryPost ≤450 chars, alternatives,
 *     hashtags, strategyReasoning) is upheld end-to-end by the specialist alone
 *
 * What this does NOT test:
 *   - The product path through Jasper → SocialMediaManager → MastodonExpert
 *     → social_post tool → Mission Control
 *   - Whether the manager correctly delegates to this specialist when Jasper
 *     plans a Mastodon post intent. This script calls MastodonExpert directly,
 *     bypassing all delegation layers.
 *
 * Renamed Apr 29 2026 from `verify-mastodon-generate-content-live.ts` because
 * the old name implied full end-to-end coverage. The orchestrated product-path
 * verify lives at `scripts/verify-mastodon-orchestrated-post-live.ts`.
 *
 * Real product path: see `scripts/verify-mastodon-orchestrated-post-live.ts`
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { getMastodonExpert } from '@/lib/agents/marketing/mastodon/specialist';
import type { AgentMessage } from '@/lib/agents/types';

interface CliArgs {
  topic: string;
  verbatim?: string;
}

function parseArgs(): CliArgs {
  let topic = 'Announcing SalesVelocity.ai is now on Mastodon — AI agent swarms for sales-ops teams';
  let verbatim: string | undefined;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--topic=')) { topic = arg.slice('--topic='.length); }
    if (arg.startsWith('--verbatim=')) { verbatim = arg.slice('--verbatim='.length); }
  }
  return { topic, verbatim };
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log('[verify-mastodon-generate-content] starting');
  console.log(`  topic:    ${args.topic}`);
  if (args.verbatim) {
    console.log(`  verbatim: ${args.verbatim.slice(0, 100)}${args.verbatim.length > 100 ? '...' : ''}`);
  }

  const expert = getMastodonExpert();
  await expert.initialize();

  const message: AgentMessage = {
    id: `verify_mastodon_gc_${Date.now()}`,
    timestamp: new Date(),
    from: 'JASPER',
    to: 'MASTODON_EXPERT',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      action: 'generate_content',
      topic: args.topic,
      contentType: 'post',
      tone: 'professional',
      targetAudience: 'sales-ops and revenue-operations professionals',
      campaignGoal: 'Brand introduction on Mastodon',
      brandContext: {
        industry: 'B2B SaaS — sales operations automation',
        toneOfVoice: 'Plain-spoken, anti-corporate, conversational',
        keyPhrases: ['AI agent swarm', 'sales-ops', 'one platform'],
        avoidPhrases: ['revolutionary', 'game-changing', 'unlock'],
      },
      ...(args.verbatim ? { verbatimText: args.verbatim } : {}),
    },
    requiresResponse: true,
    traceId: `verify_mastodon_gc_${Date.now()}`,
  };

  const startedAt = Date.now();
  const report = await expert.execute(message);
  const durationMs = Date.now() - startedAt;

  console.log(`\nLLM call duration: ${durationMs}ms`);
  if (durationMs < 1000) {
    console.error('✗ FAIL — duration < 1s, suspicious of mocked/stubbed response');
    process.exit(2);
  }

  if (report.status !== 'COMPLETED' || !report.data) {
    console.error(`✗ FAIL — specialist returned ${report.status}`);
    if (report.errors) {
      for (const err of report.errors) { console.error(`  ${err}`); }
    }
    process.exit(3);
  }

  const data = report.data as {
    primaryPost?: string;
    alternativePosts?: string[];
    contentWarning?: string | null;
    hashtags?: string[];
    imageAltTextSuggestion?: string | null;
    bestPostingTime?: string;
    estimatedEngagement?: string;
    strategyReasoning?: string;
  };

  console.log('\n=== Generated Mastodon Post Plan ===');
  console.log(`primaryPost (${data.primaryPost?.length ?? 0} chars):`);
  console.log(`  "${data.primaryPost}"`);
  console.log('');
  console.log(`alternativePosts (${data.alternativePosts?.length ?? 0}):`);
  for (const alt of data.alternativePosts ?? []) {
    console.log(`  - "${alt}" (${alt.length} chars)`);
  }
  console.log('');
  console.log(`contentWarning: ${data.contentWarning ?? 'null'}`);
  console.log(`hashtags: ${(data.hashtags ?? []).map((h) => `#${h}`).join(' ') || '(none)'}`);
  console.log(`imageAltTextSuggestion: ${data.imageAltTextSuggestion ?? 'null'}`);
  console.log(`bestPostingTime: ${data.bestPostingTime}`);
  console.log(`estimatedEngagement: ${data.estimatedEngagement}`);
  console.log(`\nstrategyReasoning:`);
  console.log(`  ${data.strategyReasoning}`);

  // Sanity assertions
  let passed = true;
  if (!data.primaryPost || data.primaryPost.length < 10 || data.primaryPost.length > 450) {
    console.error(`\n✗ primaryPost length out of bounds: ${data.primaryPost?.length}`);
    passed = false;
  }
  if (!data.alternativePosts || data.alternativePosts.length < 2) {
    console.error(`\n✗ alternativePosts must have >=2 entries, got ${data.alternativePosts?.length}`);
    passed = false;
  }
  if (!data.strategyReasoning || data.strategyReasoning.length < 50) {
    console.error(`\n✗ strategyReasoning too short: ${data.strategyReasoning?.length}`);
    passed = false;
  }
  if (args.verbatim && data.primaryPost !== args.verbatim) {
    // For verbatim path, the LLM should use the exact text. Allow trim/whitespace
    // tolerance; alert on substantive divergence.
    const verbatimNormalized = args.verbatim.trim();
    const primaryNormalized = (data.primaryPost ?? '').trim();
    if (primaryNormalized !== verbatimNormalized) {
      console.warn(`\n⚠ verbatimText was provided but primaryPost differs:`);
      console.warn(`  expected: "${verbatimNormalized}"`);
      console.warn(`  got:      "${primaryNormalized}"`);
      console.warn('  (this may be acceptable if the verbatim exceeded 450 chars and the LLM trimmed)');
    }
  }

  if (!passed) {
    console.error('\n✗ FAIL — schema/content assertions failed');
    process.exit(4);
  }
  console.log('\n✓ PASS — real LLM call, valid structured output, all assertions satisfied');
}

main().catch((err) => { console.error(err); process.exit(1); });
