/**
 * Synthetic Jasper Trigger
 *
 * POST /api/orchestrator/synthetic-trigger
 *
 * The bridge between non-user backend events (cron, webhook) and Jasper.
 * This is what the inbound-DM dispatcher cron calls every minute. It
 * lets a backend driver kick off a real Jasper mission with a synthetic
 * user prompt — going through the SAME chat route, plan-gate, manager,
 * specialist, Mission Control flow that real user prompts use.
 *
 * Per `feedback_no_jasper_bypass_even_for_simple_replies`: this is the
 * ONLY way backend events drive Jasper. Direct OpenRouter calls or
 * hand-coded plans written to the missions collection are forbidden.
 *
 * Auth: caller must present `Authorization: Bearer ${CRON_SECRET}` AND
 * `x-synthetic-trigger: true` header. The body specifies which `scope`
 * is being used, and only routes that opted into that scope can be
 * driven (currently `inbound_dm_reply` opts in `/api/orchestrator/chat`).
 *
 * Auto-approve toggle: per `automation/inbound.<channel>.autoApprove`,
 * when ON the trigger drives plan-approve + step-execution + reply-send
 * programmatically (no operator click required). When OFF (default) the
 * mission lands in PLAN_PENDING_APPROVAL and waits for the operator
 * in Mission Control. Either path runs the same Jasper → manager →
 * specialist delegation; only the operator gates differ.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  approveAllPlanSteps,
  approvePlan,
  getMission,
  stampMissionSourceAndAutoApprove,
} from '@/lib/orchestrator/mission-persistence';
import { runMissionToCompletion } from '@/lib/orchestrator/step-runner';
import { getInboundAutomationConfig } from '@/lib/automation/inbound-automation-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPPORTED_SCOPES = ['inbound_dm_reply'] as const;
type SupportedScope = typeof SUPPORTED_SCOPES[number];

const triggerBodySchema = z.object({
  scope: z.enum(SUPPORTED_SCOPES),
  syntheticUserMessage: z.string().min(20).max(8000),
  sourceEvent: z.object({
    kind: z.enum(['inbound_x_dm', 'inbound_bluesky_dm']),
    eventId: z.string().min(1),
    senderId: z.string().optional(),
    senderHandle: z.string().optional(),
  }),
  triggerId: z.string().min(1).optional(),
});

function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && explicit.length > 0) { return explicit.replace(/\/+$/, ''); }
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.length > 0) { return `https://${vercel}`; }
  return 'http://localhost:3000';
}

interface JasperChatResponseShape {
  success: boolean;
  response?: string;
  metadata?: {
    missionId?: string;
    reviewLink?: string;
    toolExecuted?: string;
    [k: string]: unknown;
  };
  error?: string;
}

/**
 * The chat route does not populate `metadata.missionId` consistently
 * across every iteration shape, but it does always populate
 * `metadata.reviewLink` to `/mission-control?mission=<missionId>` when
 * propose_mission_plan ran. Extract the id from that as a fallback so
 * we don't depend on the chat route's metadata being internally
 * consistent.
 */
function extractMissionIdFromResponse(resp: JasperChatResponseShape): string | undefined {
  const direct = resp.metadata?.missionId;
  if (typeof direct === 'string' && direct.length > 0) { return direct; }
  const link = resp.metadata?.reviewLink;
  if (typeof link === 'string') {
    const match = link.match(/[?&]mission=([^&]+)/);
    if (match?.[1]) { return decodeURIComponent(match[1]); }
  }
  return undefined;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cronAuthError = verifyCronAuth(request, '/api/orchestrator/synthetic-trigger');
  if (cronAuthError) { return cronAuthError; }

  let parsedBody;
  try {
    const raw: unknown = await request.json();
    parsedBody = triggerBodySchema.safeParse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `Invalid JSON body: ${msg}` }, { status: 400 });
  }
  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: parsedBody.error.errors[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }
  const body = parsedBody.data;
  const scope: SupportedScope = body.scope;
  const triggerId = body.triggerId ?? `${scope}_${body.sourceEvent.eventId}_${Date.now()}`;

  logger.info('[synthetic-trigger] Invoking Jasper', {
    scope,
    eventId: body.sourceEvent.eventId,
    triggerId,
  });

  // Read auto-approve policy BEFORE we kick the chat off so the stamp is
  // ready the moment the mission lands in Firestore. The chat route's
  // plan-gate will produce a PLAN_PENDING_APPROVAL mission; we stamp the
  // sourceEvent + autoApprove fields onto that mission and then either
  // wait (operator path) or drive (auto-approve path).
  const automationConfig = await getInboundAutomationConfig();
  const autoApproveOn = scope === 'inbound_dm_reply'
    ? automationConfig.xDmReply.autoApprove === true
    : false;

  const cronSecret = process.env.CRON_SECRET ?? '';
  if (!cronSecret) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const chatBody = {
    message: body.syntheticUserMessage,
    context: 'admin' as const,
    conversationHistory: [],
    requestId: triggerId,
  };

  const chatUrl = `${appBaseUrl()}/api/orchestrator/chat`;
  let chatResponseJson: JasperChatResponseShape;
  try {
    const chatResponse = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
        'x-synthetic-trigger': 'true',
        'x-synthetic-trigger-scope': scope,
        'x-synthetic-trigger-id': triggerId,
      },
      body: JSON.stringify(chatBody),
    });

    const chatText = await chatResponse.text();
    if (!chatResponse.ok) {
      logger.error('[synthetic-trigger] chat call failed', new Error(`HTTP ${chatResponse.status}`), {
        triggerId,
        status: chatResponse.status,
        bodySnippet: chatText.slice(0, 300),
      });
      return NextResponse.json(
        { success: false, error: `Chat invocation failed: HTTP ${chatResponse.status} ${chatText.slice(0, 300)}` },
        { status: 502 },
      );
    }
    try {
      chatResponseJson = JSON.parse(chatText) as JasperChatResponseShape;
    } catch {
      return NextResponse.json(
        { success: false, error: `Chat returned non-JSON body: ${chatText.slice(0, 200)}` },
        { status: 502 },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[synthetic-trigger] chat fetch threw', err instanceof Error ? err : new Error(msg), { triggerId });
    return NextResponse.json({ success: false, error: `Chat fetch failed: ${msg}` }, { status: 502 });
  }

  const missionId = extractMissionIdFromResponse(chatResponseJson);
  if (!missionId || typeof missionId !== 'string') {
    logger.error('[synthetic-trigger] chat returned no missionId', new Error('no missionId'), {
      triggerId,
      chatResponseSerialized: JSON.stringify(chatResponseJson).slice(0, 800),
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Jasper did not produce a mission. The plan-gate should have forced propose_mission_plan; check the chat route logs.',
        chatResponse: chatResponseJson,
      },
      { status: 502 },
    );
  }

  // Stamp the mission with the source event + auto-approve policy.
  const stamped = await stampMissionSourceAndAutoApprove({
    missionId,
    sourceEvent: {
      kind: body.sourceEvent.kind,
      eventId: body.sourceEvent.eventId,
      ...(body.sourceEvent.senderId ? { senderId: body.sourceEvent.senderId } : {}),
      ...(body.sourceEvent.senderHandle ? { senderHandle: body.sourceEvent.senderHandle } : {}),
    },
    autoApprove: autoApproveOn ? 'inbound_dm_reply' : undefined,
  });

  if (!stamped) {
    logger.warn('[synthetic-trigger] could not stamp source event onto mission', {
      missionId,
      triggerId,
    });
  }

  // OPERATOR PATH: leave the mission in PLAN_PENDING_APPROVAL.
  if (!autoApproveOn) {
    return NextResponse.json({
      success: true,
      missionId,
      autoApproved: false,
      message: 'Mission created and waiting for operator review in Mission Control.',
    });
  }

  // AUTO-APPROVE PATH: drive the mission programmatically.
  // Same gates the operator would click — Jasper-→-manager-→-specialist
  // delegation path itself is unchanged.
  logger.info('[synthetic-trigger] auto-approve enabled — driving mission to completion', {
    missionId,
    scope,
    triggerId,
  });

  const allApproved = await approveAllPlanSteps(missionId);
  if (!allApproved) {
    return NextResponse.json({
      success: false,
      missionId,
      autoApproved: false,
      error: 'approveAllPlanSteps failed — mission may not be in PLAN_PENDING_APPROVAL',
    }, { status: 500 });
  }

  const flipped = await approvePlan(missionId);
  if (!flipped) {
    return NextResponse.json({
      success: false,
      missionId,
      autoApproved: false,
      error: 'approvePlan failed',
    }, { status: 500 });
  }

  const planMission = await getMission(missionId);
  if (!planMission) {
    return NextResponse.json({
      success: false,
      missionId,
      autoApproved: false,
      error: 'mission disappeared after approve flip',
    }, { status: 500 });
  }

  const runResult = await runMissionToCompletion({
    missionId,
    userId: `synthetic_${scope}_${triggerId}`,
    conversationId: planMission.conversationId,
    userPrompt: planMission.userPrompt,
  });

  // After steps complete, the X Expert specialist's compose_dm_reply
  // result lives in the delegate_to_marketing step's toolResult. The
  // auto-approve driver fires the send-dm-reply endpoint internally to
  // dispatch the actual DM. The operator path skips this — the operator
  // clicks "Send reply" manually in Mission Control instead.
  let sendOutcome: { sent: boolean; messageId?: string; error?: string } | null = null;
  if (runResult.success && runResult.finalStatus === 'COMPLETED') {
    try {
      const sendUrl = `${appBaseUrl()}/api/orchestrator/missions/${encodeURIComponent(missionId)}/send-dm-reply`;
      const sendResp = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
          'x-synthetic-trigger': 'true',
          'x-synthetic-trigger-scope': scope,
          'x-synthetic-trigger-id': triggerId,
        },
        body: JSON.stringify({}),
      });
      const sendText = await sendResp.text();
      interface SendDmReplyResponse { success: boolean; messageId?: string; error?: string }
      let sendJson: SendDmReplyResponse | null = null;
      try { sendJson = JSON.parse(sendText) as SendDmReplyResponse; } catch { sendJson = null; }
      if (sendResp.ok && sendJson?.success) {
        sendOutcome = sendJson.messageId
          ? { sent: true, messageId: sendJson.messageId }
          : { sent: true };
      } else {
        sendOutcome = { sent: false, error: sendJson?.error ?? `HTTP ${sendResp.status} ${sendText.slice(0, 200)}` };
      }
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      sendOutcome = { sent: false, error: `send-dm-reply call failed: ${msg}` };
    }
  }

  return NextResponse.json({
    success: runResult.success && (sendOutcome?.sent ?? false),
    missionId,
    autoApproved: true,
    finalStatus: runResult.finalStatus,
    stepsRun: runResult.stepsRun,
    stepsFailed: runResult.stepsFailed,
    ...(runResult.haltedAtStepId ? { haltedAtStepId: runResult.haltedAtStepId } : {}),
    ...(runResult.error ? { runError: runResult.error } : {}),
    ...(sendOutcome ? { send: sendOutcome } : {}),
  });
}
