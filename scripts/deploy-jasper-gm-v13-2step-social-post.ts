/**
 * Deploy Jasper GM v13: enforce 2-step plan for organic social posts.
 *
 * Operator-delegated edit (Apr 26 2026) per the
 * `feedback_delegation_vs_self_training` memory — owner explicitly directed
 * the correction with specific wording, so the pipeline runs end-to-end
 * (createJasperGMVersionFromEdit + deployJasperGMVersion) without pausing
 * for click-approval at each proposal.
 *
 * Root cause being fixed:
 *   Jasper GM v12 contains the line:
 *     `NOTE: For SOCIAL MEDIA POSTS, use social_post directly.`
 *   This caused Jasper to plan 1-step missions where social_post fires
 *   without a preceding content/media generation step. Result: posts
 *   publish without images, violating the "all posts need media" rule.
 *
 * Fix:
 *   Replace the single line with a multi-line directive specifying that
 *   social posts MUST plan 2 steps:
 *     Step 1: delegate_to_marketing (Marketing Manager produces post +
 *             image atomically via the single-platform fast-path)
 *     Step 2: social_post (publish with mediaUrls from step 1)
 *   Includes the operator-provided media path (providedMediaUrls).
 *
 * Idempotent: refuses to apply if `currentText` is not present verbatim
 * (Prompt Engineer service guarantees this via `createJasperGMVersionFromEdit`).
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  createJasperGMVersionFromEdit,
  deployJasperGMVersion,
} from '@/lib/training/jasper-golden-master-service';

const SOURCE_FEEDBACK_ID = `tfb_jasper_2step_social_post_${Date.now()}`;
const CREATED_BY = 'operator-delegated:claude:apr-26-2026';

const CURRENT_TEXT = `  Delegation tool: delegate_to_content
  NOTE: For SOCIAL MEDIA POSTS, use social_post directly.
  For EMAIL COPY, use draft_outreach_email or delegate_to_marketing.
  For BLOG POSTS, you CAN use delegate_to_content — the Blog Writer specialist handles it.`;

const PROPOSED_TEXT = `  Delegation tool: delegate_to_content
  NOTE: For SOCIAL MEDIA POSTS, plan EXACTLY 2 STEPS — NEVER plan social_post directly without a preceding delegate_to_marketing step. Posts without media are INVALID.
    Step 1: delegate_to_marketing
      args: { platform: <"twitter"|"x"|"bluesky"|"mastodon"|"linkedin"|"facebook"|"instagram"|"pinterest">, topic: <subject>, verbatimText: <exact text if user provided it, otherwise omit>, providedMediaUrls: <JSON-encoded array of operator-supplied image/video URLs if user provided any, otherwise omit> }
      what it does: Marketing Manager dispatches to the platform specialist (TWITTER_X_EXPERT, BLUESKY_EXPERT, MASTODON_EXPERT, LINKEDIN_EXPERT, INSTAGRAM_EXPERT, FACEBOOK_ADS_EXPERT, PINTEREST_EXPERT) and returns the post text + an accompanying image. If providedMediaUrls is supplied, the helper short-circuits and uses the operator's URL AS-IS (no DALL-E call, no API spend). If omitted, an image is auto-generated via DALL-E and cached.
    Step 2: social_post
      args: { platform: <same as step 1>, action: "POST", content: <step 1 primaryPost output>, mediaUrls: <step 1 mediaUrls output> }
      what it does: actually publishes to the platform with media attached.
    Even when the user provides VERBATIM TEXT, you MUST still plan both steps — Marketing Manager handles image generation, which is required for every post.
    Even when the user provides a MEDIA URL, you MUST still plan both steps — Marketing Manager passes the URL through and prepares the publish payload.
    Single-step plans calling social_post directly are FORBIDDEN.
  For EMAIL COPY, use draft_outreach_email or delegate_to_marketing.
  For BLOG POSTS, you CAN use delegate_to_content — the Blog Writer specialist handles it.`;

const RATIONALE = 'Operator-directed correction: Jasper v12 was instructing direct social_post calls, producing 1-step plans that publish text-only posts with no image. The v13 rule mandates a 2-step plan (delegate_to_marketing → social_post) so the Marketing Manager fast-path produces post + image atomically before publish, including the operator-provided-media path. This aligns with the existing blog flow (Content Manager produces blog + featured image atomically) and the rule that posts without media are invalid.';

async function ensureFeedbackRecord(): Promise<void> {
  if (!adminDb) { throw new Error('adminDb not initialized'); }
  const path = getSubCollection('trainingFeedback');
  const ref = adminDb.collection(path).doc(SOURCE_FEEDBACK_ID);
  const now = new Date().toISOString();
  await ref.set({
    id: SOURCE_FEEDBACK_ID,
    targetSpecialistId: 'JASPER_ORCHESTRATOR',
    targetSpecialistName: 'Jasper Orchestrator',
    sourceReportTaskId: 'mission_req_1777259377744_0wjr5x',
    sourceReportExcerpt: 'Plan title: "Post announcement to Mastodon". Steps: 1 step (delegate_to_marketing only, no social_post). Result: content + image generated, but mission completed without publishing to Mastodon. Operator scrapped + re-ran twice with same outcome.',
    grade: 'request_revision',
    explanation: 'For ANY social post — including those where the user provides verbatim text or a media URL — Jasper MUST plan exactly 2 steps: delegate_to_marketing followed by social_post. The Marketing Manager handles content + image atomically; social_post publishes. Single-step plans that publish without media OR plans missing the publish step are both invalid.',
    graderUserId: CREATED_BY,
    graderDisplayName: 'Operator (David) via Claude',
    status: 'applied',
    linkedImprovementRequestId: null,
    createdAt: now,
    updatedAt: now,
    appliedAt: now,
    notes: 'Operator-delegated direct GM edit per feedback_delegation_vs_self_training memory.',
  });
  console.log(`✓ TrainingFeedback record created: ${SOURCE_FEEDBACK_ID}`);
}

async function main(): Promise<void> {
  if (!adminDb) { throw new Error('adminDb not initialized'); }

  await ensureFeedbackRecord();

  console.log('\n[1/3] Creating Jasper GM v13 from surgical edit...');
  const newVersion = await createJasperGMVersionFromEdit(
    {
      currentText: CURRENT_TEXT,
      proposedText: PROPOSED_TEXT,
      rationale: RATIONALE,
      sourceFeedbackId: SOURCE_FEEDBACK_ID,
    },
    CREATED_BY,
  );
  if (!newVersion) {
    console.error('✗ createJasperGMVersionFromEdit returned null');
    process.exit(2);
  }
  console.log(`  ✓ Created ${newVersion.id} (v${newVersion.versionNumber})`);
  console.log(`  systemPrompt length: ${newVersion.systemPrompt.length} chars`);

  console.log(`\n[2/3] Deploying ${newVersion.id} (atomic switch v12 → v${newVersion.versionNumber})...`);
  const deployed = await deployJasperGMVersion(newVersion.versionNumber, CREATED_BY);
  if (!deployed) {
    console.error('✗ deployJasperGMVersion returned null');
    process.exit(3);
  }
  console.log(`  ✓ Deployed: ${deployed.id} is now active`);

  console.log('\n[3/3] Verifying — re-loading active GM...');
  const { getActiveJasperGoldenMaster, invalidateJasperGMCache } = await import('@/lib/orchestrator/jasper-golden-master');
  invalidateJasperGMCache();
  const active = await getActiveJasperGoldenMaster();
  if (!active) {
    console.error('✗ No active GM after deploy');
    process.exit(4);
  }
  if (active.id !== deployed.id) {
    console.error(`✗ Active GM is ${active.id} but expected ${deployed.id}`);
    process.exit(5);
  }
  if (!active.systemPrompt.includes('plan EXACTLY 2 STEPS')) {
    console.error('✗ Active GM does not contain the new rule text');
    process.exit(6);
  }
  console.log(`  ✓ Active GM is ${active.id} and contains the new rule`);

  console.log('\n=== ✓ Jasper v13 deployed ===');
  console.log('Next: have operator re-run the post prompt. Jasper should now plan 2 steps (delegate_to_marketing → social_post).');
  console.log(`Rollback if needed: deployJasperGMVersion(12, '<reason>')`);
}

main().catch((err) => { console.error(err); process.exit(1); });
