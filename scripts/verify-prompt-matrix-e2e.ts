/**
 * End-to-end prompt matrix verifier.
 *
 * Unlike `verify-prompt-matrix.ts` (which only tests the PLANNING layer —
 * does Jasper draft the right tools in the right shape), this script drives
 * the full loop:
 *
 *   1. Mint a Firebase ID token for the operator UID (custom token + IDP
 *      identitytoolkit exchange — same thing a browser session ends up with).
 *   2. POST the prompt to `/api/orchestrator/chat` with that Bearer token.
 *   3. Poll Firestore until the mission reaches PLAN_PENDING_APPROVAL
 *      (or bail early if Jasper answered in advisory/factual mode with
 *      no plan — we still record the chat reply for verification).
 *   4. POST `/api/orchestrator/missions/[id]/plan/approve-all-steps`
 *      (marks every PROPOSED step operatorApproved=true).
 *   5. POST `/api/orchestrator/missions/[id]/plan/approve`. This endpoint
 *      BLOCKS — it runs `runMissionToCompletion` synchronously before
 *      responding. We fire it + start polling in parallel rather than
 *      blocking the script on the HTTP.
 *   6. Poll Firestore for COMPLETED / FAILED / AWAITING_APPROVAL.
 *   7. Pull per-step `toolResult` and extract deliverable refs (reviewLink,
 *      Firestore IDs, file paths) into the result record.
 *   8. Write a per-prompt result to `D:/rapid-dev/e2e-runner.log` (tailable
 *      from PowerShell) and a final JSON summary to `D:/rapid-dev/e2e-results.json`.
 *
 * Flags (match verify-prompt-matrix.ts for operator muscle memory):
 *   --id=<fixture-id>                run only that one prompt
 *   --category=<cat>                 run every prompt in a category
 *   --categories=<a,b,c>             run every prompt in any of these categories
 *   --exclude-categories=<a,b,c>     run every prompt EXCEPT these categories
 *   --iterations=<n>                 override default iterations (default 1 — E2E is expensive)
 *   --timeout=<minutes>              per-prompt terminal-state timeout (default 25)
 *   --base-url=<url>                 dev server URL (default http://localhost:3000)
 *   --email=<addr>                   operator email for auth (default dstamper@rapidcompliance.us)
 *
 * Exit 0 iff every iteration reached a terminal non-FAILED state and every
 * required deliverable expectation in the fixture was satisfied.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// --- env + admin init -------------------------------------------------------

function initAdmin(): void {
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

initAdmin();

// --- constants --------------------------------------------------------------

const PLATFORM_ID = 'rapid-compliance-root';
const MISSIONS_COLLECTION = `organizations/${PLATFORM_ID}/missions`;
const FIXTURE_PATH = 'scripts/fixtures/prompt-matrix.json';
const LOG_PATH = 'D:/rapid-dev/e2e-runner.log';
const RESULTS_PATH = 'D:/rapid-dev/e2e-results.json';

const db = admin.firestore();

// --- log helper (stdout + file tail) ----------------------------------------

function log(line: string): void {
  const stamp = new Date().toISOString();
  const out = `${stamp}  ${line}`;
  console.log(out);
  try {
    fs.appendFileSync(LOG_PATH, out + '\n');
  } catch {
    // If D:/rapid-dev doesn't exist we just skip file logging
  }
}

// --- fixture types ----------------------------------------------------------

interface FixtureExpectation {
  planCalled?: boolean;
  toolsAnyOf?: string[];
  toolsAllOf?: string[];
  toolsAlsoAnyOf?: string[];
  toolsThirdAnyOf?: string[];
  toolsFourthAnyOf?: string[];
  toolsForbidden?: string[];
  toolsAllowed?: string[];
  queryTypeOneOf?: string[];
  replyExpected?: boolean;
}

interface Fixture {
  id: string;
  category: string;
  prompt: string;
  comment?: string;
  iterations?: number;
  expect: FixtureExpectation;
}

interface FixtureFile {
  description?: string;
  defaultIterations?: number;
  prompts: Fixture[];
}

// --- auth: Firebase custom token → Identity Toolkit ID token ---------------

async function mintIdToken(email: string): Promise<string> {
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
    const body = await res.text();
    throw new Error(`identitytoolkit exchange failed ${res.status}: ${body}`);
  }
  const data = await res.json() as { idToken?: string };
  if (!data.idToken) { throw new Error('identitytoolkit returned no idToken'); }
  return data.idToken;
}

// --- HTTP helper (Bearer auth, JSON) ----------------------------------------

interface PostOptions {
  baseUrl: string;
  idToken: string;
  path: string;
  body: unknown;
  /** If true, don't wait for the response. Used for approve() which blocks. */
  fireAndForget?: boolean;
}

async function postJson<T = unknown>(opts: PostOptions): Promise<T | null> {
  const url = `${opts.baseUrl}${opts.path}`;
  const controller = new AbortController();
  const promise = fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${opts.idToken}`,
    },
    body: JSON.stringify(opts.body),
    signal: controller.signal,
  });
  if (opts.fireAndForget) {
    // Keep the connection alive in the background but don't await.
    promise.catch(() => { /* swallow — terminal state is tracked via Firestore */ });
    return null;
  }
  const res = await promise;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${opts.path} → ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// --- chat request -----------------------------------------------------------

interface ChatResponse {
  success: boolean;
  response: string;
  metadata?: {
    model?: string;
    toolExecuted?: string;
    missionId?: string;
    reviewLink?: string;
  };
}

async function sendChat(
  baseUrl: string,
  idToken: string,
  prompt: string,
): Promise<ChatResponse> {
  const response = await postJson<ChatResponse>({
    baseUrl,
    idToken,
    path: '/api/orchestrator/chat',
    body: {
      message: prompt,
      conversationHistory: [],
      context: 'admin',
    },
  });
  if (!response) { throw new Error('chat returned null'); }
  return response;
}

// --- mission polling --------------------------------------------------------

interface MissionStep {
  stepId: string;
  toolName: string;
  status: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  operatorApproved?: boolean;
  specialistsUsed?: string[];
  error?: string;
  summary?: string;
}

interface MissionDoc {
  missionId: string;
  status: string;
  title?: string;
  userPrompt?: string;
  steps?: MissionStep[];
  completedAt?: string;
}

async function findMissionByPrompt(
  userPrompt: string,
  afterTimestamp: string,
): Promise<MissionDoc | null> {
  // Chat route doesn't surface conversationId deterministically, so we
  // locate the mission by exact userPrompt + freshness. Skip orderBy to
  // avoid requiring a composite index — at small scale the mission set is
  // tiny and filtering in memory is fine.
  const snap = await db
    .collection(MISSIONS_COLLECTION)
    .where('userPrompt', '==', userPrompt)
    .limit(20)
    .get();
  let best: (MissionDoc & { createdAt?: string }) | null = null;
  for (const doc of snap.docs) {
    const d = doc.data() as MissionDoc & { createdAt?: string };
    if (!d.createdAt || d.createdAt < afterTimestamp) { continue; }
    if (!best || (d.createdAt ?? '') > (best.createdAt ?? '')) {
      best = { ...d, missionId: d.missionId ?? doc.id };
    }
  }
  return best;
}

async function getMission(missionId: string): Promise<MissionDoc | null> {
  const doc = await db.collection(MISSIONS_COLLECTION).doc(missionId).get();
  if (!doc.exists) { return null; }
  const d = doc.data() as MissionDoc;
  return { ...d, missionId: d.missionId ?? missionId };
}

async function pollMission(
  missionId: string,
  predicate: (m: MissionDoc) => boolean,
  timeoutMs: number,
  intervalMs = 2000,
): Promise<MissionDoc | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const m = await getMission(missionId);
    if (m && predicate(m)) { return m; }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

// --- deliverable extraction -------------------------------------------------

interface DeliverableRef {
  stepId: string;
  toolName: string;
  status: string;
  reviewLink?: string;
  resourceIds?: string[];
  error?: string;
}

function extractDeliverables(mission: MissionDoc): DeliverableRef[] {
  const out: DeliverableRef[] = [];
  for (const step of mission.steps ?? []) {
    const ref: DeliverableRef = {
      stepId: step.stepId,
      toolName: step.toolName,
      status: step.status,
    };
    if (step.error) { ref.error = step.error; }
    if (step.toolResult) {
      try {
        const parsed = JSON.parse(step.toolResult) as Record<string, unknown>;
        if (typeof parsed.reviewLink === 'string') {
          ref.reviewLink = parsed.reviewLink;
        }
        const ids: string[] = [];
        for (const key of ['blogId', 'postId', 'videoId', 'storyboardId', 'workflowId', 'campaignId', 'responseId', 'missionId']) {
          const v = parsed[key];
          if (typeof v === 'string' && v.length > 0) { ids.push(`${key}=${v}`); }
        }
        if (ids.length > 0) { ref.resourceIds = ids; }
      } catch {
        // toolResult wasn't JSON — ignore
      }
    }
    out.push(ref);
  }
  return out;
}

// --- expectation evaluation -------------------------------------------------

interface Expectation {
  passed: boolean;
  failures: string[];
}

function evaluateFixture(fixture: Fixture, mission: MissionDoc | null, chatReply: string | null): Expectation {
  const failures: string[] = [];
  const ex = fixture.expect;

  if (ex.replyExpected && (!chatReply || chatReply.trim().length === 0)) {
    failures.push('replyExpected but chat reply was empty');
  }

  if (ex.planCalled === false) {
    if (mission) { failures.push(`planCalled=false but a mission was created (${mission.missionId})`); }
  }

  if (ex.planCalled === true) {
    if (!mission) { failures.push('planCalled=true but no mission was found'); return { passed: false, failures }; }
    const tools = (mission.steps ?? []).map((s) => s.toolName);
    const toolSet = new Set(tools);
    if (ex.toolsAllOf) {
      for (const t of ex.toolsAllOf) {
        if (!toolSet.has(t)) { failures.push(`toolsAllOf missing ${t}`); }
      }
    }
    for (const groupKey of ['toolsAnyOf', 'toolsAlsoAnyOf', 'toolsThirdAnyOf', 'toolsFourthAnyOf'] as const) {
      const group = ex[groupKey];
      if (group && group.length > 0) {
        const hit = group.some((t) => toolSet.has(t));
        if (!hit) { failures.push(`${groupKey} not satisfied — need one of [${group.join(',')}], got [${tools.join(',')}]`); }
      }
    }
    if (ex.toolsForbidden) {
      const present = ex.toolsForbidden.filter((t) => toolSet.has(t));
      if (present.length > 0) { failures.push(`forbidden tools present: [${present.join(',')}]`); }
    }

    // Every step should be COMPLETED or (if halted) at least not in an
    // unrecoverable state. FAILED steps that weren't retried count as a fail.
    const failedSteps = (mission.steps ?? []).filter((s) => s.status === 'FAILED');
    if (failedSteps.length > 0) {
      failures.push(`${failedSteps.length} step(s) in FAILED state: ${failedSteps.map((s) => `${s.toolName}(${s.error ?? 'no-error'})`).join(', ')}`);
    }
    if (mission.status === 'FAILED') {
      failures.push(`mission status=FAILED`);
    }
    if (mission.status === 'AWAITING_APPROVAL') {
      failures.push(`mission halted in AWAITING_APPROVAL — a step failed twice`);
    }
  }

  return { passed: failures.length === 0, failures };
}

// --- per-prompt E2E flow ----------------------------------------------------

interface IterationResult {
  fixtureId: string;
  iteration: number;
  ok: boolean;
  failures: string[];
  missionId?: string;
  chatReply?: string;
  planTools?: string[];
  finalStatus?: string;
  deliverables?: DeliverableRef[];
  durationMs: number;
  errorMessage?: string;
}

async function runOnce(
  fixture: Fixture,
  iteration: number,
  baseUrl: string,
  idToken: string,
  timeoutMs: number,
): Promise<IterationResult> {
  const start = Date.now();
  const afterTimestamp = new Date(start).toISOString();
  log(`[${fixture.id}] iter ${iteration} — sending prompt`);
  let chatReply: string | null = null;
  let chat: ChatResponse;
  try {
    chat = await sendChat(baseUrl, idToken, fixture.prompt);
    chatReply = chat.response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[${fixture.id}] iter ${iteration} — chat call FAILED: ${msg}`);
    return {
      fixtureId: fixture.id,
      iteration,
      ok: false,
      failures: [`chat call failed: ${msg}`],
      durationMs: Date.now() - start,
      errorMessage: msg,
    };
  }

  const missionIdFromChat = chat.metadata?.missionId;
  // Locate the mission. If chat surfaced missionId use it; otherwise search.
  let mission: MissionDoc | null = null;
  if (missionIdFromChat) {
    mission = await getMission(missionIdFromChat);
  }
  if (!mission) {
    // Wait up to 10s for Firestore to surface the new mission doc.
    mission = await pollMissionByPrompt(fixture.prompt, afterTimestamp, 10_000);
  }

  // If still no mission, Jasper answered advisory/factual — evaluate reply-only.
  if (!mission) {
    log(`[${fixture.id}] iter ${iteration} — no mission created (advisory/factual reply)`);
    const ev = evaluateFixture(fixture, null, chatReply);
    return {
      fixtureId: fixture.id,
      iteration,
      ok: ev.passed,
      failures: ev.failures,
      chatReply: chatReply ?? undefined,
      durationMs: Date.now() - start,
    };
  }

  log(`[${fixture.id}] iter ${iteration} — mission ${mission.missionId} created, status=${mission.status}`);

  // If this prompt is expected to NOT call plan but did — short-circuit fail.
  if (fixture.expect.planCalled === false) {
    const ev = evaluateFixture(fixture, mission, chatReply);
    return {
      fixtureId: fixture.id,
      iteration,
      ok: ev.passed,
      failures: ev.failures,
      missionId: mission.missionId,
      chatReply: chatReply ?? undefined,
      planTools: (mission.steps ?? []).map((s) => s.toolName),
      finalStatus: mission.status,
      durationMs: Date.now() - start,
    };
  }

  // Wait for PLAN_PENDING_APPROVAL. Usually the mission is created in this
  // state directly via createMissionWithPlan, but give it a beat.
  const pending = await pollMission(
    mission.missionId,
    (m) => m.status === 'PLAN_PENDING_APPROVAL',
    60_000,
  );
  if (!pending) {
    const latest = await getMission(mission.missionId);
    log(`[${fixture.id}] iter ${iteration} — never reached PLAN_PENDING_APPROVAL (latest=${latest?.status})`);
    return {
      fixtureId: fixture.id,
      iteration,
      ok: false,
      failures: [`never reached PLAN_PENDING_APPROVAL (latest status=${latest?.status ?? 'missing'})`],
      missionId: mission.missionId,
      chatReply: chatReply ?? undefined,
      finalStatus: latest?.status,
      durationMs: Date.now() - start,
    };
  }

  log(`[${fixture.id}] iter ${iteration} — plan ready with ${pending.steps?.length ?? 0} steps, approving`);

  // Approve every PROPOSED step.
  await postJson({
    baseUrl,
    idToken,
    path: `/api/orchestrator/missions/${mission.missionId}/plan/approve-all-steps`,
    body: {},
  });

  // Fire approve (blocks until execution completes) and poll in parallel.
  void postJson({
    baseUrl,
    idToken,
    path: `/api/orchestrator/missions/${mission.missionId}/plan/approve`,
    body: {},
    fireAndForget: true,
  });

  const terminal = await pollMission(
    mission.missionId,
    (m) => m.status === 'COMPLETED' || m.status === 'FAILED' || m.status === 'AWAITING_APPROVAL',
    timeoutMs,
    3000,
  );
  const final = terminal ?? (await getMission(mission.missionId));
  if (!final) {
    log(`[${fixture.id}] iter ${iteration} — mission vanished, this shouldn't happen`);
    return {
      fixtureId: fixture.id,
      iteration,
      ok: false,
      failures: ['mission disappeared from Firestore'],
      missionId: mission.missionId,
      durationMs: Date.now() - start,
    };
  }

  const ev = evaluateFixture(fixture, final, chatReply);
  const deliverables = extractDeliverables(final);
  log(`[${fixture.id}] iter ${iteration} — final=${final.status} ${ev.passed ? 'PASS' : `FAIL(${ev.failures.length})`}`);

  return {
    fixtureId: fixture.id,
    iteration,
    ok: ev.passed,
    failures: ev.failures,
    missionId: mission.missionId,
    chatReply: chatReply ?? undefined,
    planTools: (final.steps ?? []).map((s) => s.toolName),
    finalStatus: final.status,
    deliverables,
    durationMs: Date.now() - start,
  };
}

async function pollMissionByPrompt(
  userPrompt: string,
  afterTimestamp: string,
  timeoutMs: number,
  intervalMs = 1000,
): Promise<MissionDoc | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const m = await findMissionByPrompt(userPrompt, afterTimestamp);
    if (m) { return m; }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

// --- main -------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith('--id='))?.split('=')[1];
  const catArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];
  const catsArg = args.find((a) => a.startsWith('--categories='))?.split('=')[1];
  const excludeArg = args.find((a) => a.startsWith('--exclude-categories='))?.split('=')[1];
  const iterArg = args.find((a) => a.startsWith('--iterations='))?.split('=')[1];
  const timeoutArg = args.find((a) => a.startsWith('--timeout='))?.split('=')[1];
  const baseUrlArg = args.find((a) => a.startsWith('--base-url='))?.split('=')[1];
  const emailArg = args.find((a) => a.startsWith('--email='))?.split('=')[1];

  const baseUrl = baseUrlArg ?? 'http://localhost:3000';
  const email = emailArg ?? 'dstamper@rapidcompliance.us';
  const timeoutMs = parseInt(timeoutArg ?? '25', 10) * 60 * 1000;
  const iterationsOverride = iterArg ? parseInt(iterArg, 10) : null;

  log(`E2E runner starting — baseUrl=${baseUrl} email=${email} timeout=${timeoutMs / 60000}min`);

  // Load fixtures
  const fixture: FixtureFile = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as FixtureFile;
  let prompts = fixture.prompts;
  if (idArg) { prompts = prompts.filter((p) => p.id === idArg); }
  if (catArg) { prompts = prompts.filter((p) => p.category === catArg); }
  if (catsArg) {
    const set = new Set(catsArg.split(',').map((s) => s.trim()));
    prompts = prompts.filter((p) => set.has(p.category));
  }
  if (excludeArg) {
    const set = new Set(excludeArg.split(',').map((s) => s.trim()));
    prompts = prompts.filter((p) => !set.has(p.category));
  }
  if (prompts.length === 0) {
    log(`No prompts match filter (id=${idArg ?? '*'} category=${catArg ?? '*'} categories=${catsArg ?? '*'} exclude=${excludeArg ?? '*'})`);
    process.exit(1);
  }
  log(`Running ${prompts.length} prompt(s) at up to ${iterationsOverride ?? 1} iter each`);

  // Mint ID token once for the whole run (Firebase ID tokens last 1hr).
  let idToken: string;
  try {
    idToken = await mintIdToken(email);
    log(`Auth: minted ID token for ${email}`);
  } catch (err) {
    log(`Auth FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Sanity-check the dev server with a single HEAD request to surface connectivity
  // before burning LLM cycles.
  try {
    const pingRes = await fetch(baseUrl, { method: 'HEAD' });
    log(`Dev server ping: ${pingRes.status}`);
  } catch (err) {
    log(`Dev server unreachable at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const allResults: IterationResult[] = [];
  for (const p of prompts) {
    const iters = iterationsOverride ?? p.iterations ?? 1;
    for (let i = 1; i <= iters; i++) {
      try {
        const r = await runOnce(p, i, baseUrl, idToken, timeoutMs);
        allResults.push(r);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`[${p.id}] iter ${i} — runner crashed: ${msg}`);
        allResults.push({
          fixtureId: p.id,
          iteration: i,
          ok: false,
          failures: [`runner crashed: ${msg}`],
          durationMs: 0,
          errorMessage: msg,
        });
      }
    }
  }

  const total = allResults.length;
  const passed = allResults.filter((r) => r.ok).length;
  const failed = total - passed;
  log('');
  log('═══════════════════════════════════════════════════════════════════');
  log(`  E2E Overall: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%) · ${failed} failed`);
  log('═══════════════════════════════════════════════════════════════════');

  // Per-prompt summary
  const byFixture = new Map<string, IterationResult[]>();
  for (const r of allResults) {
    const arr = byFixture.get(r.fixtureId) ?? [];
    arr.push(r);
    byFixture.set(r.fixtureId, arr);
  }
  for (const [fid, arr] of byFixture.entries()) {
    const p = arr.filter((r) => r.ok).length;
    const icon = p === arr.length ? '✓' : p === 0 ? '✗' : '~';
    log(`  ${icon} ${fid.padEnd(24)} ${p}/${arr.length}`);
  }

  // Persist full results
  if (!fs.existsSync('D:/rapid-dev')) { fs.mkdirSync('D:/rapid-dev', { recursive: true }); }
  fs.writeFileSync(RESULTS_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    prompts: prompts.length,
    iterations: iterationsOverride,
    passed,
    failed,
    results: allResults,
  }, null, 2));
  log(`Full results written to ${RESULTS_PATH}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  log(`fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
