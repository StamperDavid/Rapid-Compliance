/**
 * Verify Jasper-mediated inbound X DM reply — end to end against the live dev server.
 *
 * Architecture under test:
 *   1. Synthetic inboundSocialEvents doc inserted (mimics the webhook)
 *   2. Cron `/api/cron/jasper-dm-dispatcher` invoked
 *   3. Dispatcher hits `/api/orchestrator/synthetic-trigger`
 *   4. Synthetic-trigger drives `/api/orchestrator/chat` with synthetic auth
 *   5. Jasper's plan-gate forces propose_mission_plan
 *   6. Plan: delegate_to_marketing(inboundContext) → fast-paths to X Expert.compose_dm_reply
 *   7. Mission lands in PLAN_PENDING_APPROVAL with the inbound metadata stamped
 *   8. Operator path: approve plan + steps (programmatic), run to completion
 *   9. X Expert composes a brand-voiced reply ≤240 chars
 *   10. Mission COMPLETED with composedReply on the step
 *
 * Send is verified via a separate live DM (operator manually messages
 * @salesvelocityai from a second account) — this script does NOT call
 * the real X DM API because the synthetic recipient id is fake. The
 * acceptance bar is "the orchestration produces a valid composed reply
 * with the right shape and lands it in Mission Control"; the real
 * dispatch is verified by the operator running the end-to-end manually.
 *
 * Cleanup: the synthetic inboundSocialEvents doc + the test mission are
 * removed at the end whether the run passed or failed.
 *
 * Usage:
 *   npx tsx scripts/verify-jasper-dm-reply-live.ts
 *
 * Requirements:
 *   - dev server running on localhost:3000 (or set BASE_URL)
 *   - .env.local has CRON_SECRET, FIREBASE_ADMIN_*
 *   - X Expert GM v2 deployed (run scripts/deploy-twitter-expert-gm-v2.ts first)
 */

import 'dotenv/config';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  approveAllPlanSteps,
  approvePlan,
  getMission,
} from '@/lib/orchestrator/mission-persistence';
import { runMissionToCompletion } from '@/lib/orchestrator/step-runner';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

interface DispatcherResponse {
  checked: number;
  dispatched: number;
  outcomes: Array<{ eventId: string; status: string; missionId?: string; reason?: string }>;
}

const FAKE_SENDER_ID = '999999999999999999';
const FAKE_SENDER_HANDLE = '@verify_jasper_dm';
const FAKE_INBOUND_TEXT = 'Hey, I saw your post about AI agent swarms — what does SalesVelocity actually do for sales teams?';

async function pause(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  if (!adminDb) {
    console.error('adminDb not initialized — check FIREBASE_ADMIN_* env vars');
    process.exit(1);
  }
  if (!CRON_SECRET) {
    console.error('CRON_SECRET missing in env');
    process.exit(1);
  }

  console.log(`[verify-dm-reply] BASE_URL=${BASE_URL}`);

  const eventId = `verify_dm_${Date.now()}`;
  const eventsCollection = getSubCollection('inboundSocialEvents');
  const eventRef = adminDb.collection(eventsCollection).doc(eventId);

  // Pretend webhook payload — mimics what /api/webhooks/twitter writes.
  const fakeEventDoc = {
    id: eventId,
    provider: 'twitter',
    receivedAt: new Date().toISOString(),
    processed: false,
    kind: 'direct_message_events',
    payload: {
      for_user_id: 'salesvelocityai_brand_id',
      direct_message_events: [
        {
          type: 'message_create',
          id: `msg_${Date.now()}`,
          message_create: {
            sender_id: FAKE_SENDER_ID,
            target: { recipient_id: 'salesvelocityai_brand_id' },
            message_data: { text: FAKE_INBOUND_TEXT },
          },
        },
      ],
    },
  };

  let createdMissionId: string | null = null;

  try {
    console.log(`[verify-dm-reply] Creating synthetic event ${eventId}`);
    await eventRef.set(fakeEventDoc);

    console.log(`[verify-dm-reply] Hitting dispatcher /api/cron/jasper-dm-dispatcher`);
    const dispatchResp = await fetch(`${BASE_URL}/api/cron/jasper-dm-dispatcher`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    if (!dispatchResp.ok) {
      const txt = await dispatchResp.text();
      throw new Error(`Dispatcher returned HTTP ${dispatchResp.status}: ${txt.slice(0, 300)}`);
    }
    const dispatchJson = (await dispatchResp.json()) as DispatcherResponse;
    console.log(`[verify-dm-reply] Dispatcher response:`, JSON.stringify(dispatchJson, null, 2));

    const outcome = dispatchJson.outcomes.find((o) => o.eventId === eventId);
    if (!outcome) {
      throw new Error(`Dispatcher did not see our event ${eventId}`);
    }
    if (outcome.status !== 'dispatched' || !outcome.missionId) {
      throw new Error(`Dispatcher did not dispatch the event: status=${outcome.status} reason=${outcome.reason ?? '?'}`);
    }
    createdMissionId = outcome.missionId;
    console.log(`[verify-dm-reply] ✓ Mission ${createdMissionId} created`);

    // Verify mission shape
    let mission = await getMission(createdMissionId);
    if (!mission) { throw new Error('Mission not found after dispatch'); }

    if (mission.status !== 'PLAN_PENDING_APPROVAL') {
      throw new Error(`Mission status is ${mission.status}, expected PLAN_PENDING_APPROVAL`);
    }
    if (mission.sourceEvent?.kind !== 'inbound_x_dm' || mission.sourceEvent.eventId !== eventId) {
      throw new Error(`Mission sourceEvent missing or wrong: ${JSON.stringify(mission.sourceEvent)}`);
    }
    if (mission.steps.length !== 1) {
      throw new Error(`Expected 1 step in plan, got ${mission.steps.length}: ${mission.steps.map((s) => s.toolName).join(', ')}`);
    }
    const planStep = mission.steps[0];
    if (planStep.toolName !== 'delegate_to_marketing') {
      throw new Error(`Step 1 should be delegate_to_marketing, got ${planStep.toolName}`);
    }
    const stepArgs = planStep.toolArgs as Record<string, unknown> | undefined;
    const ic = stepArgs?.inboundContext as Record<string, unknown> | undefined;
    if (!ic || ic.platform !== 'x' || ic.inboundEventId !== eventId) {
      throw new Error(`Step inboundContext missing or wrong: ${JSON.stringify(ic)}`);
    }
    console.log(`[verify-dm-reply] ✓ Plan shape valid: 1 delegate_to_marketing step with inboundContext`);

    // Approve plan + run to completion (simulates operator click)
    console.log(`[verify-dm-reply] Approving + running mission`);
    const approvedAll = await approveAllPlanSteps(createdMissionId);
    if (!approvedAll) { throw new Error('approveAllPlanSteps failed'); }
    const flipped = await approvePlan(createdMissionId);
    if (!flipped) { throw new Error('approvePlan failed'); }

    const runResult = await runMissionToCompletion({
      missionId: createdMissionId,
      userId: 'verify_dm_reply',
      conversationId: mission.conversationId,
      userPrompt: mission.userPrompt,
    });

    console.log(`[verify-dm-reply] Run result:`, runResult);
    if (!runResult.success || runResult.finalStatus !== 'COMPLETED') {
      throw new Error(`Mission did not complete cleanly: success=${runResult.success} finalStatus=${runResult.finalStatus} error=${runResult.error ?? '?'}`);
    }

    mission = await getMission(createdMissionId);
    if (!mission) { throw new Error('Mission disappeared after run'); }

    const completedStep = mission.steps[0];
    if (completedStep.status !== 'COMPLETED') {
      throw new Error(`Step did not complete: status=${completedStep.status} error=${completedStep.error ?? '?'}`);
    }

    const toolResultRaw = completedStep.toolResult ?? '';
    if (!toolResultRaw) { throw new Error('Step toolResult is empty'); }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(toolResultRaw) as Record<string, unknown>; }
    catch { throw new Error(`Step toolResult is not JSON: ${toolResultRaw.slice(0, 200)}`); }

    const dataField = parsed.data as Record<string, unknown> | undefined;
    if (!dataField) { throw new Error(`Step result has no .data field: ${toolResultRaw.slice(0, 300)}`); }

    if (dataField.mode !== 'INBOUND_DM_REPLY') {
      throw new Error(`Marketing Manager did not run the inbound-DM fast-path. mode=${String(dataField.mode)}`);
    }

    const composedReply = dataField.composedReply as Record<string, unknown> | undefined;
    if (!composedReply) {
      throw new Error('No composedReply in step result');
    }
    const replyText = composedReply.replyText;
    const reasoning = composedReply.reasoning;
    const confidence = composedReply.confidence;

    if (typeof replyText !== 'string' || replyText.length === 0 || replyText.length > 240) {
      throw new Error(`replyText invalid: type=${typeof replyText} len=${typeof replyText === 'string' ? replyText.length : '?'}`);
    }
    if (typeof reasoning !== 'string' || reasoning.length < 20) {
      throw new Error(`reasoning invalid: type=${typeof reasoning} len=${typeof reasoning === 'string' ? reasoning.length : '?'}`);
    }
    if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') {
      throw new Error(`confidence invalid: ${String(confidence)}`);
    }

    console.log(`[verify-dm-reply] ✓ X Expert composed valid reply:`);
    console.log(`    replyText (${replyText.length} chars): ${replyText}`);
    console.log(`    confidence: ${String(confidence)}`);
    console.log(`    reasoning (${reasoning.length} chars): ${reasoning.slice(0, 200)}${reasoning.length > 200 ? '...' : ''}`);

    // Verify the send-dm-reply endpoint receives the right shape. We
    // don't expect the actual X DM API call to succeed (sender id is
    // fake), but the endpoint should attempt it and return a structured
    // failure with the right metadata.
    console.log(`[verify-dm-reply] Calling send-dm-reply with synthetic auth (expecting structured failure due to fake sender id)`);
    const sendResp = await fetch(`${BASE_URL}/api/orchestrator/missions/${encodeURIComponent(createdMissionId)}/send-dm-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
        'x-synthetic-trigger': 'true',
        'x-synthetic-trigger-scope': 'inbound_dm_reply',
        'x-synthetic-trigger-id': `verify_send_${Date.now()}`,
      },
      body: JSON.stringify({}),
    });
    const sendText = await sendResp.text();
    let sendJson: { success?: boolean; error?: string; httpStatus?: number; messageId?: string } = {};
    try { sendJson = JSON.parse(sendText) as typeof sendJson; } catch { sendJson = {}; }
    console.log(`[verify-dm-reply] send-dm-reply HTTP ${sendResp.status}:`, sendJson);

    // Two acceptable outcomes:
    //   - 502 with X DM error (real API rejected the fake user id) — orchestration is correct
    //   - 200 success (X actually accepted the test user id, unlikely) — also fine
    if (sendResp.ok && sendJson.success) {
      console.log(`[verify-dm-reply] ✓ send-dm-reply succeeded (X accepted the fake recipient — surprising but valid)`);
    } else if (sendResp.status === 502 && typeof sendJson.error === 'string') {
      console.log(`[verify-dm-reply] ✓ send-dm-reply returned expected structured failure: ${sendJson.error.slice(0, 150)}`);
    } else {
      throw new Error(`send-dm-reply returned unexpected shape: HTTP ${sendResp.status} body=${sendText.slice(0, 300)}`);
    }

    console.log('');
    console.log('==========================================================');
    console.log('✓ VERIFICATION PASSED');
    console.log('==========================================================');
    console.log('Architecture validated:');
    console.log('  - Webhook → inboundSocialEvents (synthetic stand-in)');
    console.log('  - Cron dispatcher → synthetic-trigger');
    console.log('  - Synthetic-trigger → /api/orchestrator/chat (synthetic auth)');
    console.log('  - Jasper plan-gate → propose_mission_plan');
    console.log('  - delegate_to_marketing.inboundContext → MarketingManager fast-path');
    console.log('  - X Expert.compose_dm_reply → valid 240-char on-brand reply');
    console.log('  - Mission Control flow → step COMPLETED with composedReply');
    console.log('  - send-dm-reply endpoint → wired correctly (real send TBD with real DM)');
  } finally {
    // Cleanup synthetic event + test mission, regardless of pass/fail.
    try {
      console.log('');
      console.log(`[verify-dm-reply] Cleaning up...`);
      await eventRef.delete();
      console.log(`[verify-dm-reply]   deleted event ${eventId}`);
      if (createdMissionId) {
        await adminDb.collection(getSubCollection('missions')).doc(createdMissionId).delete();
        console.log(`[verify-dm-reply]   deleted mission ${createdMissionId}`);
      }
    } catch (cleanupErr) {
      console.warn('[verify-dm-reply] Cleanup failed (non-fatal):', cleanupErr);
    }
  }

  // Give the dev server a moment to flush logs before exit.
  await pause(500);
  process.exit(0);
}

main().catch((err) => {
  console.error('verify-dm-reply FAILED:', err);
  process.exit(1);
});
