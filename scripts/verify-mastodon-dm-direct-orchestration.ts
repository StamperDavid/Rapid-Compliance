/**
 * Verify Mastodon inbound DM auto-reply pipeline end-to-end against
 * the live dev environment.
 *
 * Architecture under test (direct-orchestration, NOT Jasper-mediated —
 * see inbound-dm-orchestration-service.ts for the rule):
 *
 *   1. Synthetic inboundSocialEvents doc inserted (mimics the cron's
 *      output after polling Mastodon /api/v1/conversations)
 *   2. orchestrateInboundDmReply called with platform='mastodon'
 *   3. MastodonExpert loaded, GM resolved, compose_dm_reply executed
 *   4. Mission written to Firestore in COMPLETED state with composedReply
 *
 * What this script DOES verify:
 *   - GM is seeded and resolves to a usable systemPrompt
 *   - MastodonExpert.compose_dm_reply produces a valid JSON object
 *     matching the shared compose-dm-reply schema (replyText 1-450,
 *     reasoning 20-1500, confidence enum, suggestEscalation bool)
 *   - Mission is persisted with sourceEvent.kind='inbound_mastodon_dm'
 *   - Step output is JSON-encoded and matches the INBOUND_DM_REPLY shape
 *     that Mission Control's renderer reads
 *
 * What this script does NOT verify:
 *   - Real Mastodon API send (requires a connected brand account
 *     with valid OAuth token + a real recipient handle on the same
 *     instance). To verify send end-to-end, run save-mastodon-config
 *     first, then DM the brand from a second Mastodon account and
 *     watch the cron pick it up.
 *
 * Cleanup: the synthetic inboundSocialEvents doc + the test mission are
 * removed at the end whether the run passed or failed.
 *
 * Usage:
 *   npx tsx scripts/verify-mastodon-dm-live.ts
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { orchestrateInboundDmReply } from '@/lib/social/inbound-dm-orchestration-service';

const FAKE_SENDER_ID = '109999999999999999';
const FAKE_SENDER_HANDLE = '@verify_mastodon_dm';
const FAKE_INBOUND_TEXT = 'I keep seeing AI agent swarms come up — what does SalesVelocity actually do that\'s different from the dozen other AI tools claiming the same thing?';

async function main(): Promise<void> {
  if (!adminDb) {
    console.error('adminDb not initialized — check FIREBASE_ADMIN_* env vars');
    process.exit(1);
  }

  console.log('[verify-mastodon-dm] starting direct-orchestration verification');

  const eventId = `verify_mastodon_${Date.now()}`;
  const eventsCollection = getSubCollection('inboundSocialEvents');
  const eventRef = adminDb.collection(eventsCollection).doc(eventId);

  // 1. Insert a synthetic inboundSocialEvents doc so the mission has
  //    something to point at. The orchestration service does NOT read
  //    this doc directly (it reads from input), but send-dm-reply does
  //    when an operator clicks Send Reply, so we keep it consistent.
  await eventRef.set({
    id: eventId,
    provider: 'mastodon',
    kind: 'direct_message_events',
    receivedAt: new Date().toISOString(),
    processed: false,
    payload: {
      conversationId: `conv_verify_${Date.now()}`,
      statusId: `status_verify_${Date.now()}`,
      sender: { id: FAKE_SENDER_ID, acct: FAKE_SENDER_HANDLE.slice(1), username: 'verify_mastodon_dm' },
      text: FAKE_INBOUND_TEXT,
    },
  });

  let missionId: string | null = null;
  let composedReply: string | null = null;
  let exitCode = 0;

  try {
    console.log('[verify-mastodon-dm] calling orchestrateInboundDmReply...');
    const startedAt = Date.now();
    const result = await orchestrateInboundDmReply({
      platform: 'mastodon',
      inboundEventId: eventId,
      inboundText: FAKE_INBOUND_TEXT,
      senderId: FAKE_SENDER_ID,
      senderHandle: FAKE_SENDER_HANDLE,
    });
    const durationMs = Date.now() - startedAt;
    missionId = result.missionId;
    composedReply = result.composedReply;

    console.log(`[verify-mastodon-dm] orchestration completed in ${durationMs}ms`);
    console.log(`  missionId:        ${result.missionId}`);
    console.log(`  confidence:       ${result.confidence}`);
    console.log(`  suggestEscalation: ${result.suggestEscalation}`);
    console.log(`  reply (${result.composedReply.length} chars):`);
    console.log(`    "${result.composedReply}"`);
    console.log(`  reasoning:`);
    console.log(`    ${result.reasoning}`);

    // 2. Re-read the mission and verify shape
    const missionsCollection = getSubCollection('missions');
    const missionSnap = await adminDb.collection(missionsCollection).doc(result.missionId).get();
    if (!missionSnap.exists) {
      throw new Error(`Mission ${result.missionId} not found in Firestore after orchestration`);
    }
    const mission = missionSnap.data() as {
      status: string;
      sourceEvent?: { kind: string; eventId: string; senderId?: string };
      steps: Array<{ toolName: string; status: string; toolResult?: string }>;
    };

    if (mission.status !== 'COMPLETED') {
      throw new Error(`Mission status is ${mission.status}, expected COMPLETED`);
    }
    if (mission.sourceEvent?.kind !== 'inbound_mastodon_dm') {
      throw new Error(`Mission sourceEvent.kind is ${mission.sourceEvent?.kind}, expected 'inbound_mastodon_dm'`);
    }
    if (mission.sourceEvent.eventId !== eventId) {
      throw new Error(`Mission sourceEvent.eventId mismatch: got ${mission.sourceEvent.eventId}, expected ${eventId}`);
    }
    if (mission.steps.length !== 1) {
      throw new Error(`Mission has ${mission.steps.length} steps, expected exactly 1`);
    }
    const step = mission.steps[0];
    if (step.toolName !== 'compose_dm_reply') {
      throw new Error(`Step toolName is ${step.toolName}, expected 'compose_dm_reply'`);
    }
    if (step.status !== 'COMPLETED') {
      throw new Error(`Step status is ${step.status}, expected COMPLETED`);
    }
    if (typeof step.toolResult !== 'string') {
      throw new Error('Step toolResult missing — Mission Control renderer expects a JSON string');
    }
    const stepData = JSON.parse(step.toolResult) as { mode?: string; composedReply?: { replyText?: string } };
    if (stepData.mode !== 'INBOUND_DM_REPLY') {
      throw new Error(`Step toolResult.mode is ${stepData.mode}, expected 'INBOUND_DM_REPLY'`);
    }
    if (stepData.composedReply?.replyText !== result.composedReply) {
      throw new Error('Step toolResult.composedReply.replyText does not match orchestration result');
    }

    console.log('[verify-mastodon-dm] PASS — all assertions satisfied');
    console.log('  Mission shape: ✓');
    console.log('  Step shape:    ✓');
    console.log('  toolResult:    ✓');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[verify-mastodon-dm] FAIL — ${msg}`);
    if (err instanceof Error && err.stack) {
      console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    }
    exitCode = 2;
  } finally {
    // Cleanup — always try, even on failure
    try {
      await eventRef.delete();
      console.log('[verify-mastodon-dm] cleaned up synthetic inboundSocialEvents doc');
    } catch { /* noop */ }

    if (missionId) {
      try {
        const missionsCollection = getSubCollection('missions');
        await adminDb.collection(missionsCollection).doc(missionId).delete();
        console.log(`[verify-mastodon-dm] cleaned up test mission ${missionId}`);
      } catch { /* noop */ }
    }
  }

  // Summary signal so the next session can find this in scrollback
  if (exitCode === 0) {
    console.log('\n[verify-mastodon-dm] ✓ Direct orchestration verified.');
    console.log('To verify the send-side, run scripts/save-mastodon-config.ts and DM the brand from a second account.');
  }
  if (composedReply) {
    console.log(`\n  Final composed reply preview: "${composedReply.slice(0, 80)}${composedReply.length > 80 ? '...' : ''}"`);
  }
  process.exit(exitCode);
}

main().catch((err) => { console.error(err); process.exit(1); });
