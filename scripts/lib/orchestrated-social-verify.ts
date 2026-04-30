/**
 * Shared driver for product-path social-post verification.
 *
 * Used by:
 *   - scripts/verify-twitter-orchestrated-post-live.ts
 *   - scripts/verify-bluesky-orchestrated-post-live.ts
 *   - scripts/verify-mastodon-orchestrated-post-live.ts
 *
 * Each platform script provides only the platform name + a function that
 * extracts the platform-specific identifier (tweet ID / AT URI / status ID)
 * from the social_post step's toolResult and returns a public URL.
 *
 * Why this exists: every prior verify-*-post-live.ts hand-built auth and
 * POSTed directly to the platform API, completely bypassing TwitterService /
 * BlueskyService / MastodonService, the social_post tool router, the
 * Marketing Manager, and Jasper. That's how today's X OAuth bug went
 * undetected for weeks despite "verify-twitter-post-live.ts" passing.
 *
 * This driver exercises the FULL product path:
 *   /api/orchestrator/chat → propose_mission_plan → PLAN_PENDING_APPROVAL
 *   → /api/orchestrator/missions/[id]/plan/approve-all-steps
 *   → /api/orchestrator/missions/[id]/plan/approve (runs to completion)
 *   → Marketing Manager → {Platform}_EXPERT.generate_content
 *   → social_post tool → {Platform}Service.postX → real post on platform
 *
 * Pass criteria:
 *   - Mission status = COMPLETED
 *   - Plan has exactly 2 steps (per Jasper v13 social-post rule)
 *   - Step 1 = delegate_to_marketing(platform=<expected>)
 *   - Step 2 = social_post(platform=<expected>)
 *   - social_post step COMPLETED with a platform-specific identifier
 *     (tweet ID / AT URI / status ID) — not just a generic "ok" response
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Env + admin SDK init
// ---------------------------------------------------------------------------

export function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) {
        const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[m[1]]) { process.env[m[1]] = v; }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

// ---------------------------------------------------------------------------
// Argv helpers
// ---------------------------------------------------------------------------

export function arg(name: string, def: string): string {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(`--${name}=`.length) : def;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_ID = 'rapid-compliance-root';
const MISSIONS_COLLECTION = `organizations/${PLATFORM_ID}/missions`;

// ---------------------------------------------------------------------------
// Firebase ID-token mint (custom-token → identitytoolkit exchange)
// ---------------------------------------------------------------------------

export async function mintIdToken(email: string): Promise<string> {
  const user = await admin.auth().getUserByEmail(email);
  const customToken = await admin.auth().createCustomToken(user.uid);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) { throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing'); }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    throw new Error(`identitytoolkit exchange failed ${res.status}: ${await res.text()}`);
  }
  const data = await res.json() as { idToken?: string };
  if (!data.idToken) { throw new Error('identitytoolkit returned no idToken'); }
  return data.idToken;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

interface PostOptions {
  baseUrl: string;
  idToken: string;
  pathStr: string;
  body: unknown;
  fireAndForget?: boolean;
}

async function postJson<T>(opts: PostOptions): Promise<T | null> {
  const url = `${opts.baseUrl}${opts.pathStr}`;
  const promise = fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.idToken}` },
    body: JSON.stringify(opts.body),
  });
  if (opts.fireAndForget) {
    promise.catch(() => { /* mission status comes from Firestore polling */ });
    return null;
  }
  const res = await promise;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${opts.pathStr} → ${res.status}: ${text}`);
  }
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

// ---------------------------------------------------------------------------
// Mission shape
// ---------------------------------------------------------------------------

export interface MissionStep {
  stepId: string;
  order: number;
  toolName: string;
  status: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  error?: string;
}

export interface Mission {
  missionId: string;
  status: string;
  // The mission persistence layer uses `steps` for both plan-time and run-time
  // step records. Older code referenced `plannedSteps`; supporting both for
  // tolerance, but `steps` is the source of truth.
  plannedSteps?: MissionStep[];
  steps?: MissionStep[];
}

function getSteps(m: Mission): MissionStep[] {
  return m.steps ?? m.plannedSteps ?? [];
}

export { getSteps };

async function getMission(missionId: string): Promise<Mission | null> {
  const db = admin.firestore();
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

// ---------------------------------------------------------------------------
// Mission-ID extractor — handles both shapes the chat route returns:
//   { metadata: { missionId } }                          (when set explicitly)
//   { metadata: { reviewLink: "/mission-control?mission=mission_xyz" } }
// Plus the legacy embedded-in-text fallback for older responses.
// ---------------------------------------------------------------------------

export function extractMissionId(chatRes: { metadata?: { missionId?: string; reviewLink?: string } } | null | undefined): string | null {
  if (!chatRes?.metadata) { return null; }
  if (typeof chatRes.metadata.missionId === 'string' && chatRes.metadata.missionId.length > 0) {
    return chatRes.metadata.missionId;
  }
  const reviewLink = chatRes.metadata.reviewLink;
  if (typeof reviewLink === 'string') {
    const match = /[?&]mission=([^&\s]+)/.exec(reviewLink);
    if (match) { return match[1]; }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Run options + driver
// ---------------------------------------------------------------------------

export interface VerifyOptions {
  /** Logical platform name passed to Jasper in the prompt (e.g. "X/Twitter", "Bluesky", "Mastodon"). */
  platformLabel: string;
  /** Acceptable values for plan_step_1.toolArgs.platform (lowercased). */
  acceptablePlatformArgs: string[];
  /** Test post text. */
  testText: string;
  /**
   * Extract a platform-specific public URL from the social_post step's
   * toolResult JSON. Return null if the result doesn't contain enough info
   * to confirm a real post landed (which is a verification failure).
   */
  extractPublicUrl: (toolResult: Record<string, unknown>) => string | null;
}

export async function verifyOrchestratedSocialPost(opts: VerifyOptions): Promise<void> {
  initAdmin();

  const baseUrl = arg('base-url', 'http://localhost:3000');
  const email = arg('email', 'dstamper@rapidcompliance.us');
  const timeoutMin = Number(arg('timeout', '6'));
  const tag = `[verify-${opts.platformLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-orchestrated-post]`;

  console.log(`${tag} base=${baseUrl} email=${email}`);
  console.log(`${tag} test text: ${opts.testText.slice(0, 80)}...`);

  const idToken = await mintIdToken(email);
  console.log(`${tag} ID token minted`);

  // Send chat
  const prompt = `Post the following to ${opts.platformLabel} exactly: "${opts.testText}"`;
  console.log(`${tag} sending chat: ${prompt.slice(0, 100)}`);

  interface ChatResponse {
    metadata?: { missionId?: string; reviewLink?: string };
  }
  const chatRes = await postJson<ChatResponse>({
    baseUrl,
    idToken,
    pathStr: '/api/orchestrator/chat',
    body: { message: prompt, conversationHistory: [], context: 'admin' },
  });
  const missionId = extractMissionId(chatRes);
  if (!missionId) {
    throw new Error(`chat did not return missionId. Response: ${JSON.stringify(chatRes)}`);
  }
  console.log(`${tag} mission created: ${missionId}`);

  // Wait for plan
  const planMission = await pollUntil(
    missionId,
    (m) => m.status === 'PLAN_PENDING_APPROVAL',
    60_000,
  );
  const plannedSteps = getSteps(planMission);
  console.log(`${tag} plan has ${plannedSteps.length} steps:`);
  for (const s of plannedSteps) {
    console.log(`  ${s.order}. ${s.toolName}`);
  }

  if (plannedSteps.length !== 2) {
    throw new Error(`Expected 2-step plan (Jasper v13 social-post rule), got ${plannedSteps.length}`);
  }
  if (plannedSteps[0].toolName !== 'delegate_to_marketing') {
    throw new Error(`Expected step 1 = delegate_to_marketing, got ${plannedSteps[0].toolName}`);
  }
  if (plannedSteps[1].toolName !== 'social_post') {
    throw new Error(`Expected step 2 = social_post, got ${plannedSteps[1].toolName}`);
  }
  const platformArg = String(plannedSteps[0].toolArgs?.platform ?? '').toLowerCase();
  if (!opts.acceptablePlatformArgs.includes(platformArg)) {
    throw new Error(`Expected platform=${opts.acceptablePlatformArgs.join('|')}, got ${platformArg}`);
  }
  console.log(`${tag} plan shape OK`);

  // Approve
  await postJson<unknown>({
    baseUrl,
    idToken,
    pathStr: `/api/orchestrator/missions/${missionId}/plan/approve-all-steps`,
    body: {},
  });
  console.log(`${tag} all steps approved`);

  await postJson<unknown>({
    baseUrl,
    idToken,
    pathStr: `/api/orchestrator/missions/${missionId}/plan/approve`,
    body: {},
    fireAndForget: true,
  });
  console.log(`${tag} plan/approve fired`);

  // Wait for terminal state
  const TERMINAL = new Set(['COMPLETED', 'FAILED', 'AWAITING_APPROVAL']);
  const final = await pollUntil(
    missionId,
    (m) => TERMINAL.has(m.status),
    timeoutMin * 60 * 1000,
    3000,
  );

  console.log(`${tag} terminal status: ${final.status}`);
  const steps = getSteps(final);
  for (const s of steps) {
    console.log(`  step ${s.order} (${s.toolName}): ${s.status}${s.error ? ` — ${s.error}` : ''}`);
  }

  if (final.status !== 'COMPLETED') {
    throw new Error(`Mission ended in ${final.status}, not COMPLETED.`);
  }

  const socialStep = steps.find((s) => s.toolName === 'social_post');
  if (!socialStep) { throw new Error('No social_post step found in completed mission.'); }
  if (socialStep.status !== 'COMPLETED') {
    throw new Error(`social_post step status=${socialStep.status}, error=${socialStep.error ?? 'none'}`);
  }

  const resultText = socialStep.toolResult ?? '';
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(resultText) as Record<string, unknown>;
  } catch {
    throw new Error(`social_post toolResult was not JSON: ${resultText.slice(0, 400)}`);
  }

  const publicUrl = opts.extractPublicUrl(parsed);
  if (!publicUrl) {
    throw new Error(`social_post step did not surface a verifiable public URL. Result: ${JSON.stringify(parsed).slice(0, 400)}`);
  }

  console.log(`\n✓ PASS — orchestrated ${opts.platformLabel} post landed`);
  console.log(`  public:   ${publicUrl}`);
  console.log(`  mission:  ${missionId}`);
}

export function runVerify(opts: VerifyOptions): void {
  verifyOrchestratedSocialPost(opts).then(
    () => process.exit(0),
    (err) => {
      console.error('\n✗ FAIL —', err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
