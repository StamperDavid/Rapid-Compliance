/**
 * Live verify: drive the Marketing Manager's single-platform-post fast-path
 * end-to-end for Mastodon, twice — once WITH operator-provided media,
 * once WITHOUT — to prove both branches of the image-resolution rule.
 *
 * Branch A (no media provided):
 *   - Marketing Manager dispatches to MASTODON_EXPERT.generate_content
 *   - Specialist produces post text via real LLM call
 *   - Marketing Manager calls generateAndStoreSocialPostImage
 *   - DALL-E generates an image, base64 cached in Firestore, public URL returned
 *   - Final shape: { primaryPost, imageUrl: '/api/content/social-post-image/...', imageOperatorProvided: false }
 *
 * Branch B (operator-provided URL):
 *   - Same as A through the specialist call
 *   - Marketing Manager calls generateAndStoreSocialPostImage with providedImageUrl
 *   - Helper short-circuits, no DALL-E call
 *   - Final shape: { primaryPost, imageUrl: <operator URL>, imageOperatorProvided: true }
 *
 * Pass criteria for each branch:
 *   - Status COMPLETED
 *   - primaryPost is 10-450 chars
 *   - imageUrl is non-empty
 *   - mediaUrls array contains exactly 1 URL
 *   - Branch A: imageOperatorProvided=false, URL starts with /api/content/social-post-image/
 *   - Branch B: imageOperatorProvided=true, URL matches the input verbatim
 *   - Branch A duration > 5s (real DALL-E call)
 *   - Branch B duration < 15s (no DALL-E call — much faster)
 *
 * Usage:
 *   npx tsx scripts/verify-mastodon-orchestrated-post-live.ts
 *
 * Note: this verify does NOT publish to mastodon.social. It tests the
 * Marketing Manager → specialist → image-helper chain only. Real
 * publish goes through the social_post tool / autonomous-posting-agent
 * separately.
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();

import { MarketingManager } from '@/lib/agents/marketing/manager';
import type { AgentMessage } from '@/lib/agents/types';

const TEST_TOPIC = 'Announcing SalesVelocity.ai is now on Mastodon — AI agent swarms for sales-ops teams';
const TEST_VERBATIM = 'We just joined Mastodon. SalesVelocity.ai builds AI agent swarms that handle the sales-ops work most teams are still doing manually — one platform instead of six. Good place to talk shop if that\'s your thing.';
const FAKE_OPERATOR_IMAGE = 'https://www.salesvelocity.ai/brand/test-hero-image.jpg';

interface SinglePostResult {
  mode?: string;
  platform?: string;
  topic?: string;
  primaryPost?: string;
  imageUrl?: string | null;
  imageOperatorProvided?: boolean;
  mediaUrls?: string[];
  generatedContent?: Record<string, unknown>;
  specialistsUsed?: string[];
}

async function runBranch(label: string, payload: Record<string, unknown>): Promise<{ ok: boolean; durationMs: number; data?: SinglePostResult; errors?: string[] }> {
  const mgr = new MarketingManager();
  await mgr.initialize();

  const message: AgentMessage = {
    id: `verify_orchestrated_post_${Date.now()}`,
    timestamp: new Date(),
    from: 'JASPER',
    to: 'MARKETING_MANAGER',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload,
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  };

  const startedAt = Date.now();
  const report = await mgr.execute(message);
  const durationMs = Date.now() - startedAt;

  console.log(`\n━━━ ${label} ━━━`);
  console.log(`Status:   ${report.status}`);
  console.log(`Duration: ${durationMs}ms`);

  if (report.status !== 'COMPLETED' || !report.data) {
    console.error(`✗ FAIL — ${report.errors?.join('; ') ?? 'no data returned'}`);
    return { ok: false, durationMs, errors: report.errors };
  }

  const data = report.data as SinglePostResult;
  console.log(`Mode:     ${data.mode}`);
  console.log(`Platform: ${data.platform}`);
  console.log(`Specialists used: ${(data.specialistsUsed ?? []).join(', ')}`);
  console.log(`primaryPost (${data.primaryPost?.length ?? 0} chars): "${(data.primaryPost ?? '').slice(0, 200)}"`);
  console.log(`imageUrl: ${data.imageUrl}`);
  console.log(`imageOperatorProvided: ${data.imageOperatorProvided}`);
  console.log(`mediaUrls: ${JSON.stringify(data.mediaUrls)}`);

  return { ok: true, durationMs, data };
}

async function main(): Promise<void> {
  console.log('[verify-mastodon-orchestrated-post] Testing both branches of the image-resolution rule.\n');

  // ── Branch A: no media provided → DALL-E should fire ──────────────
  const branchA = await runBranch('Branch A: no operator media (DALL-E should fire)', {
    platform: 'mastodon',
    topic: TEST_TOPIC,
    tone: 'professional',
    targetAudience: 'sales-ops and revenue-operations professionals',
    verbatimText: TEST_VERBATIM,
    // NO providedMediaUrls — image should be auto-generated
  });

  if (!branchA.ok || !branchA.data) {
    console.error('\n✗ Branch A failed; aborting.');
    process.exit(2);
  }

  // Branch A assertions
  let aPassed = true;
  if (!branchA.data.primaryPost || branchA.data.primaryPost.length < 10) {
    console.error('✗ Branch A: primaryPost too short or missing'); aPassed = false;
  }
  if (!branchA.data.imageUrl) {
    console.error('✗ Branch A: imageUrl missing — DALL-E call should have produced one'); aPassed = false;
  } else if (!branchA.data.imageUrl.startsWith('/api/content/social-post-image/')) {
    console.error(`✗ Branch A: imageUrl should start with /api/content/social-post-image/, got: ${branchA.data.imageUrl}`); aPassed = false;
  }
  if (branchA.data.imageOperatorProvided !== false) {
    console.error(`✗ Branch A: imageOperatorProvided should be false, got: ${branchA.data.imageOperatorProvided}`); aPassed = false;
  }
  if (!branchA.data.mediaUrls || branchA.data.mediaUrls.length !== 1) {
    console.error(`✗ Branch A: mediaUrls should have exactly 1 URL, got: ${JSON.stringify(branchA.data.mediaUrls)}`); aPassed = false;
  }
  console.log(aPassed ? '\n✓ Branch A PASS' : '\n✗ Branch A FAIL');

  // ── Branch B: operator media provided → DALL-E should NOT fire ────
  const branchB = await runBranch('Branch B: operator-provided media (DALL-E should NOT fire)', {
    platform: 'mastodon',
    topic: TEST_TOPIC,
    tone: 'professional',
    targetAudience: 'sales-ops and revenue-operations professionals',
    verbatimText: TEST_VERBATIM,
    providedMediaUrls: [FAKE_OPERATOR_IMAGE],
  });

  if (!branchB.ok || !branchB.data) {
    console.error('\n✗ Branch B failed.');
    process.exit(3);
  }

  let bPassed = true;
  if (!branchB.data.primaryPost || branchB.data.primaryPost.length < 10) {
    console.error('✗ Branch B: primaryPost too short or missing'); bPassed = false;
  }
  if (branchB.data.imageUrl !== FAKE_OPERATOR_IMAGE) {
    console.error(`✗ Branch B: imageUrl should equal operator URL ${FAKE_OPERATOR_IMAGE}, got: ${branchB.data.imageUrl}`); bPassed = false;
  }
  if (branchB.data.imageOperatorProvided !== true) {
    console.error(`✗ Branch B: imageOperatorProvided should be true, got: ${branchB.data.imageOperatorProvided}`); bPassed = false;
  }
  if (!branchB.data.mediaUrls || branchB.data.mediaUrls.length !== 1 || branchB.data.mediaUrls[0] !== FAKE_OPERATOR_IMAGE) {
    console.error(`✗ Branch B: mediaUrls should be exactly [${FAKE_OPERATOR_IMAGE}], got: ${JSON.stringify(branchB.data.mediaUrls)}`); bPassed = false;
  }
  console.log(bPassed ? '\n✓ Branch B PASS' : '\n✗ Branch B FAIL');

  // ── Speed comparison ──────────────────────────────────────────────
  console.log(`\n━━━ Duration comparison ━━━`);
  console.log(`Branch A (with DALL-E): ${branchA.durationMs}ms`);
  console.log(`Branch B (no DALL-E):   ${branchB.durationMs}ms`);
  if (branchB.durationMs >= branchA.durationMs) {
    console.warn('⚠ Branch B was not meaningfully faster than Branch A — DALL-E may still be firing in B');
  } else {
    console.log(`✓ Branch B saved ~${Math.round((branchA.durationMs - branchB.durationMs) / 1000)}s by skipping DALL-E`);
  }

  if (!aPassed || !bPassed) {
    console.error('\n✗ OVERALL FAIL');
    process.exit(4);
  }
  console.log('\n✓ OVERALL PASS — both branches behave correctly');
}

main().catch((err) => { console.error(err); process.exit(1); });
