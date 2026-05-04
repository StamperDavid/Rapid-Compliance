/**
 * POST /api/jasper/insights/[id]/run-as-mission
 *
 * Operator clicked "Run as mission" on an insight. We:
 *   1. Read the insight to get its `suggestedMissionPrompt`.
 *   2. Hand that prompt to Jasper via the orchestrator chat handler — the
 *      SAME handler the dashboard chat panel uses, no HTTP indirection.
 *      Jasper produces a plan-pending mission via `propose_mission_plan`.
 *   3. Stamp the insight with `convertedToMissionId` so the popup hides
 *      it on the next render.
 *
 * Standing rule compliance: this route does NOT call OpenRouter directly.
 * The only LLM path is through Jasper's normal chat handler, which loads
 * Jasper's Golden Master with Brand DNA already baked in. We do not
 * modify Jasper's GM, we do not bypass plan-approval gates — this is a
 * shortcut for typing the prompt, nothing more.
 *
 * The chat handler is invoked in-process by importing its `POST` export
 * and calling it with a constructed `NextRequest`. This avoids the
 * round-trip through the framework's HTTP layer while reusing every
 * authentication / rate-limit / plan-gate / Firestore-write step.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { POST as orchestratorChatPost } from '@/app/api/orchestrator/chat/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface OrchestratorChatResponseShape {
  success: boolean;
  response?: string;
  metadata?: {
    missionId?: string;
    reviewLink?: string;
    [k: string]: unknown;
  };
  error?: string;
}

/**
 * The chat route does not always populate `metadata.missionId` directly
 * — but it always sets `metadata.reviewLink` to
 * `/mission-control?mission=<missionId>` when `propose_mission_plan` ran.
 * This mirrors `synthetic-trigger`'s extraction logic.
 */
function extractMissionId(resp: OrchestratorChatResponseShape): string | undefined {
  const direct = resp.metadata?.missionId;
  if (typeof direct === 'string' && direct.length > 0) { return direct; }
  const link = resp.metadata?.reviewLink;
  if (typeof link === 'string') {
    const match = link.match(/[?&]mission=([^&]+)/);
    if (match?.[1]) { return decodeURIComponent(match[1]); }
  }
  return undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  const { id } = await params;
  if (!id || id === '_meta' || id.length > 200) {
    return NextResponse.json(
      { success: false, error: 'Invalid insight id' },
      { status: 400 },
    );
  }

  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Firestore Admin SDK not initialized' },
      { status: 500 },
    );
  }
  const db = adminDb;

  // ── 1. Read the insight ─────────────────────────────────────────────
  const insightRef = db.collection(getSubCollection('jasperInsights')).doc(id);
  let suggestedMissionPrompt: string;
  try {
    const snap = await insightRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { success: false, error: 'Insight not found' },
        { status: 404 },
      );
    }
    const data = snap.data() ?? {};
    if (data.convertedToMissionId && typeof data.convertedToMissionId === 'string') {
      // Already converted — return the existing missionId, no double-fire.
      return NextResponse.json({
        success: true,
        missionId: data.convertedToMissionId,
        alreadyConverted: true,
      });
    }
    if (typeof data.suggestedMissionPrompt !== 'string' || data.suggestedMissionPrompt.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Insight has no suggestedMissionPrompt' },
        { status: 422 },
      );
    }
    suggestedMissionPrompt = data.suggestedMissionPrompt;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[insights/run-as-mission] insight read failed',
      err instanceof Error ? err : new Error(msg),
      { route: '/api/jasper/insights/[id]/run-as-mission', id },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to read insight' },
      { status: 500 },
    );
  }

  // ── 2. Hand the prompt to Jasper ────────────────────────────────────
  // We forward the operator's auth header so the chat handler's
  // `requireAuthOrSynthetic` accepts the call as a normal authenticated
  // user (no synthetic-trigger needed — this is operator-initiated).
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader) {
    // Should be unreachable since requireAuth above already passed,
    // but defensive: the chat handler reads the header directly.
    return NextResponse.json(
      { success: false, error: 'Missing authorization header' },
      { status: 401 },
    );
  }

  const chatBody = {
    message: suggestedMissionPrompt,
    context: 'admin' as const,
    conversationHistory: [],
    requestId: `insight_${id}_${Date.now()}`,
  };

  // Build an in-process NextRequest that the chat handler will read
  // exactly like a normal HTTP request. This avoids the framework
  // round-trip while still going through every Jasper pipeline step
  // (auth, rate limit, intent expander, GM load, plan gate, Firestore
  // mission write).
  const chatRequest = new Request('http://internal/api/orchestrator/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(chatBody),
  }) as unknown as NextRequest;

  let chatResponse: OrchestratorChatResponseShape;
  try {
    const response = await orchestratorChatPost(chatRequest);
    const text = await response.text();
    if (!response.ok) {
      logger.error(
        '[insights/run-as-mission] orchestrator chat returned non-2xx',
        new Error(`HTTP ${response.status}`),
        { id, status: response.status, bodySnippet: text.slice(0, 300) },
      );
      return NextResponse.json(
        { success: false, error: `Orchestrator returned HTTP ${response.status}: ${text.slice(0, 300)}` },
        { status: 502 },
      );
    }
    try {
      chatResponse = JSON.parse(text) as OrchestratorChatResponseShape;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Orchestrator returned non-JSON body' },
        { status: 502 },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[insights/run-as-mission] orchestrator chat threw',
      err instanceof Error ? err : new Error(msg),
      { id },
    );
    return NextResponse.json(
      { success: false, error: `Orchestrator call failed: ${msg}` },
      { status: 502 },
    );
  }

  const missionId = extractMissionId(chatResponse);
  if (!missionId) {
    logger.error(
      '[insights/run-as-mission] no missionId in orchestrator response',
      new Error('no missionId'),
      { id, chatResponseSnippet: JSON.stringify(chatResponse).slice(0, 500) },
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Jasper did not produce a mission. Open the dashboard chat to retry the prompt manually.',
      },
      { status: 502 },
    );
  }

  // ── 3. Stamp the insight ────────────────────────────────────────────
  try {
    await insightRef.set(
      {
        convertedToMissionId: missionId,
        convertedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    // The mission was created. Even if the stamp write fails, return
    // success — the operator's mission is in flight, the worst that
    // happens is the insight stays visible on the next refresh.
    logger.warn('[insights/run-as-mission] stamp write failed', {
      id,
      missionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ success: true, missionId });
}
