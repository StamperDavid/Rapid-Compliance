/**
 * Live verify: end-to-end orchestrated outreach via the FULL product path
 * (Jasper plan → Outreach Manager → Email Specialist compose → Mission COMPLETED).
 *
 * Replaces the gap flagged in today's verify-script audit: compose-head
 * (verify-outreach-sequence-action.ts — calls EmailSpecialist directly) and
 * dispatch-tail (verify-email-pipeline-live.ts — cron→SendGrid plumbing) are
 * tested separately. NOTHING tests them connected through Jasper. This
 * script closes that gap for the COMPOSE half.
 *
 * Per the delegate_to_outreach handler comments (jasper-tools.ts:5693): the
 * Outreach Manager's executeChannelOutreach uses Option B — compose-only.
 * The specialist composes a send-ready email; nothing actually sends. Send
 * is gated for human review per the rule that auto-send doesn't ship until
 * agent quality is validated. So this verify covers compose end-to-end;
 * the SendGrid send is verified separately via verify-email-pipeline-live.ts.
 *
 * Usage:
 *   npx tsx scripts/verify-outreach-orchestrated-live.ts
 *   npx tsx scripts/verify-outreach-orchestrated-live.ts --base-url=http://localhost:3000
 *
 * Pass criteria:
 *   - Mission COMPLETED (not FAILED, not AWAITING_APPROVAL)
 *   - Plan has a delegate_to_outreach step (may be only step OR part of a
 *     larger plan if Jasper proposed research first; we only assert presence)
 *   - The delegate_to_outreach step's toolResult contains REAL email content:
 *     non-empty subject, non-empty body of plausible length (>=80 chars)
 *   - The composedEmail's content is not a placeholder/template (rough
 *     hardcode-detector rejects "Lorem ipsum" and obvious LLM-fail strings)
 *
 * Real $ cost: 1 LLM call (EMAIL_SPECIALIST.compose_email). No SendGrid send.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import { initAdmin, mintIdToken, arg, extractMissionId, getSteps } from './lib/orchestrated-social-verify';

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const MISSIONS_COLLECTION = `organizations/${PLATFORM_ID}/missions`;
const db = admin.firestore();

const BASE_URL = arg('base-url', 'http://localhost:3000');
const EMAIL = arg('email', 'dstamper@rapidcompliance.us');
const TIMEOUT_MIN = Number(arg('timeout', '6'));

interface MissionStep {
  stepId: string;
  order: number;
  toolName: string;
  status: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  error?: string;
}

interface Mission {
  missionId: string;
  status: string;
  plannedSteps?: MissionStep[];
  steps?: MissionStep[];
}

async function postJson<T>(p: { idToken: string; pathStr: string; body: unknown; fireAndForget?: boolean }): Promise<T | null> {
  const url = `${BASE_URL}${p.pathStr}`;
  const promise = fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${p.idToken}` },
    body: JSON.stringify(p.body),
  });
  if (p.fireAndForget) {
    promise.catch(() => { /* mission status comes from Firestore */ });
    return null;
  }
  const res = await promise;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${p.pathStr} → ${res.status}: ${text}`);
  }
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

async function getMission(missionId: string): Promise<Mission | null> {
  const snap = await db.collection(MISSIONS_COLLECTION).doc(missionId).get();
  if (!snap.exists) { return null; }
  const data = snap.data();
  return data ? ({ missionId, ...data } as unknown as Mission) : null;
}

async function pollUntil(
  missionId: string,
  predicate: (m: Mission) => boolean,
  timeoutMs: number,
  intervalMs: number = 2000,
): Promise<Mission> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const m = await getMission(missionId);
    if (m && predicate(m)) { return m; }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const final = await getMission(missionId);
  throw new Error(`Timeout after ${timeoutMs / 1000}s. Last status: ${final?.status ?? 'unknown'}`);
}

const TAG = '[verify-outreach-orchestrated]';

async function main(): Promise<void> {
  console.log(`${TAG} base=${BASE_URL} email=${EMAIL}`);

  const idToken = await mintIdToken(EMAIL);
  console.log(`${TAG} ID token minted`);

  // Compose a clearly-outreach-shaped prompt that should produce a single
  // delegate_to_outreach step with channel=email and no other deliverables.
  const prompt =
    'Compose a cold outreach email to a software CEO about how SalesVelocity.ai\'s ' +
    'AI agent swarm replaces the typical marketing/sales tool stack. Single email, ' +
    'professional tone, soft CTA to learn more.';
  console.log(`${TAG} sending chat: ${prompt.slice(0, 100)}`);

  interface ChatResponse {
    metadata?: { missionId?: string; reviewLink?: string };
  }
  const chatRes = await postJson<ChatResponse>({
    idToken,
    pathStr: '/api/orchestrator/chat',
    body: { message: prompt, conversationHistory: [], context: 'admin' },
  });
  const missionId = extractMissionId(chatRes);
  if (!missionId) {
    throw new Error(`chat did not return missionId. Response: ${JSON.stringify(chatRes)}`);
  }
  console.log(`${TAG} mission created: ${missionId}`);

  // Wait for plan
  const planMission = await pollUntil(
    missionId,
    (m) => m.status === 'PLAN_PENDING_APPROVAL',
    60_000,
  );
  const plannedSteps = getSteps(planMission);
  console.log(`${TAG} plan has ${plannedSteps.length} steps:`);
  for (const s of plannedSteps) {
    console.log(`  ${s.order}. ${s.toolName}`);
  }

  // Plan must contain at least one delegate_to_outreach step. Jasper may add
  // a research step or query_docs step before it; that's fine.
  const outreachSteps = plannedSteps.filter((s) => s.toolName === 'delegate_to_outreach');
  if (outreachSteps.length === 0) {
    throw new Error('Plan does not contain a delegate_to_outreach step. Jasper interpreted the prompt incorrectly.');
  }
  const channelArg = String(outreachSteps[0].toolArgs?.channel ?? '').toLowerCase();
  if (channelArg && channelArg !== 'email' && channelArg !== 'auto') {
    console.warn(`${TAG} WARN: channel=${channelArg}, expected email/auto — proceeding anyway`);
  }
  console.log(`${TAG} plan shape OK (${outreachSteps.length} delegate_to_outreach steps)`);

  // Approve + run
  await postJson<unknown>({
    idToken,
    pathStr: `/api/orchestrator/missions/${missionId}/plan/approve-all-steps`,
    body: {},
  });
  console.log(`${TAG} all steps approved`);

  await postJson<unknown>({
    idToken,
    pathStr: `/api/orchestrator/missions/${missionId}/plan/approve`,
    body: {},
    fireAndForget: true,
  });
  console.log(`${TAG} plan/approve fired`);

  // Wait terminal
  const TERMINAL = new Set(['COMPLETED', 'FAILED', 'AWAITING_APPROVAL']);
  const final = await pollUntil(
    missionId,
    (m) => TERMINAL.has(m.status),
    TIMEOUT_MIN * 60 * 1000,
    3000,
  );

  console.log(`${TAG} terminal status: ${final.status}`);
  const steps = getSteps(final);
  for (const s of steps) {
    console.log(`  step ${s.order} (${s.toolName}): ${s.status}${s.error ? ` — ${s.error}` : ''}`);
  }

  if (final.status !== 'COMPLETED') {
    throw new Error(`Mission ended in ${final.status}, not COMPLETED.`);
  }

  // Validate the delegate_to_outreach step produced real composed content.
  const outreachStep = steps.find((s) => s.toolName === 'delegate_to_outreach');
  if (!outreachStep) { throw new Error('No delegate_to_outreach step in completed mission.'); }
  if (outreachStep.status !== 'COMPLETED') {
    throw new Error(`delegate_to_outreach status=${outreachStep.status}, error=${outreachStep.error ?? 'none'}`);
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(outreachStep.toolResult ?? '{}') as Record<string, unknown>;
  } catch {
    throw new Error(`outreach step toolResult was not JSON: ${(outreachStep.toolResult ?? '').slice(0, 400)}`);
  }

  // The EmailSpecialist's compose_email action returns these fields directly
  // on the toolResult JSON: subjectLine, previewText, bodyPlainText,
  // bodyHtml (optional), emailPurpose, etc. Older shapes (composedEmail
  // wrapper) supported as fallback for tolerance.
  const composed =
    (parsed.composedEmail as Record<string, unknown> | undefined) ??
    (parsed.composedContent as Record<string, unknown> | undefined) ??
    ((parsed.data as Record<string, unknown> | undefined)?.composedEmail as Record<string, unknown> | undefined) ??
    ((parsed.result as Record<string, unknown> | undefined)?.composedEmail as Record<string, unknown> | undefined) ??
    parsed;

  const subject =
    (composed.subjectLine as string | undefined) ??
    (composed.subject as string | undefined);
  const body =
    (composed.bodyPlainText as string | undefined) ??
    (composed.body as string | undefined) ??
    (composed.bodyText as string | undefined) ??
    (composed.content as string | undefined);

  if (!subject || subject.length < 5) {
    throw new Error(`composed email subject missing or too short: ${JSON.stringify(subject)}. Full result: ${JSON.stringify(parsed).slice(0, 400)}`);
  }
  if (!body || body.length < 80) {
    throw new Error(`composed email body missing or too short (<80 chars): ${JSON.stringify(body)}`);
  }
  // Hardcode/template detector — reject LLM failure modes. Note: `{{first_name}}`
  // and other handlebars-style merge tags are EXPECTED in outreach emails
  // (they get filled in per-lead at send time) and must NOT trip the detector.
  const lowerBody = body.toLowerCase();
  if (lowerBody.includes('lorem ipsum') || lowerBody.includes('[insert')) {
    throw new Error(`composed body looks like a template/placeholder: ${body.slice(0, 200)}`);
  }

  console.log(`\n✓ PASS — orchestrated outreach compose worked end-to-end`);
  console.log(`  subject (${subject.length} chars): ${subject}`);
  console.log(`  body (${body.length} chars): ${body.slice(0, 200)}${body.length > 200 ? '...' : ''}`);
  console.log(`  mission: ${missionId}`);
  console.log(`\nNote: Send is verified separately via verify-email-pipeline-live.ts.`);
  console.log('The Outreach Manager is compose-only by design (Option B from Apr 13 2026).');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ FAIL —', err instanceof Error ? err.message : err);
  process.exit(1);
});
