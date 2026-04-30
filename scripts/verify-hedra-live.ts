/**
 * Verify Hedra integration end-to-end against the LIVE Hedra API.
 *
 * Mirrors the structure of scripts/verify-zoom-integration.ts. Reads the Hedra
 * API key from Firestore (where the runtime apiKeyService reads it from),
 * authenticates against Hedra's models endpoint, fires a real tiny generation
 * job, and polls until the job completes or fails.
 *
 * Sections:
 *   1. Env / Firestore key check — print preview only
 *   2. Live auth probe         — GET /web-app/public/models with x-api-key
 *   3. Live generation submit  — POST /web-app/public/generations (Kling O3 T2V,
 *                                480p, 16:9, 5s prompt-only)
 *   4. Status polling          — GET /generations/{id}/status every 5s, max 3min
 *
 * Exits 0 on full pass, 1 on any failure.
 *
 * WARNING: This script SPENDS Hedra credits. Do not loop it. Owner runs manually:
 *   npx tsx scripts/verify-hedra-live.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Constants — mirror src/lib/video/hedra-service.ts so no runtime dependency
// on Next.js / @/ aliases (this script runs outside Next).
// ============================================================================

const HEDRA_BASE_URL = 'https://api.hedra.com/web-app/public';
const PLATFORM_ID = 'rapid-compliance-root';

/**
 * Kling O3 Standard T2V — prompt-only model that generates speaking characters
 * with native audio directly from a text prompt. Pulled from
 * src/lib/video/hedra-service.ts (PROMPT_T2V_MODEL_ID).
 */
const KLING_O3_PROMPT_MODEL_ID = 'b0e156da-da25-40b2-8386-937da7f47cc3';

const POLL_INTERVAL_MS = 5_000;
const MAX_WAIT_MS = 3 * 60 * 1_000; // 3 minutes

// ============================================================================
// Bootstrap
// ============================================================================

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) { process.env[m[1]] = v; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    throw new Error('No serviceAccountKey.json — drop the dev service-account file at the repo root');
  }
}

initAdmin();

// ============================================================================
// Helpers
// ============================================================================

function preview(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) { return '<missing>'; }
  if (value.length < 12) { return `<short: ${value.length} chars>`; }
  return `${value.slice(0, 6)}...${value.slice(-4)}  (len=${value.length})`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function readNestedString(obj: unknown, ...keys: string[]): string | null {
  let cursor: unknown = obj;
  for (const k of keys) {
    if (!isRecord(cursor)) { return null; }
    cursor = cursor[k];
  }
  return typeof cursor === 'string' && cursor.length > 0 ? cursor : null;
}

interface HedraModel {
  id: string;
  name?: string;
  type?: string;
}

interface HedraGenerationResponse {
  id?: string;
  status?: string;
  created_at?: string;
}

interface HedraStatusResponse {
  id?: string;
  status?: string;
  url?: string;
  video_url?: string;
  download_url?: string;
  progress?: number;
  error?: string;
  error_message?: string;
}

interface HedraErrorBody {
  detail?: unknown;
  message?: unknown;
  error?: unknown;
}

/**
 * Pull a usable error message out of any Hedra response body.
 * Hedra wraps validation errors as { detail: [{ msg, loc, ... }] }
 * and auth errors as { detail: "..." } — handle both.
 */
function extractErrorText(text: string): string {
  try {
    const parsed = JSON.parse(text) as HedraErrorBody;
    if (typeof parsed.detail === 'string') { return parsed.detail; }
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((d) => {
          if (isRecord(d) && typeof d.msg === 'string') { return d.msg; }
          return JSON.stringify(d);
        })
        .join('; ');
    }
    if (typeof parsed.message === 'string') { return parsed.message; }
    if (typeof parsed.error === 'string') { return parsed.error; }
    return text;
  } catch {
    return text;
  }
}

// ============================================================================
// Section 1 — Read Hedra key from Firestore
// ============================================================================

async function getHedraKeyFromFirestore(): Promise<string | null> {
  const db = admin.firestore();
  // apiKeyService writes to organizations/{PLATFORM_ID}/apiKeys/{PLATFORM_ID}
  // and reads keys.video.hedra.apiKey for the 'hedra' service.
  const doc = await db
    .collection(`organizations/${PLATFORM_ID}/apiKeys`)
    .doc(PLATFORM_ID)
    .get();

  if (!doc.exists) { return null; }
  const data = doc.data() as Record<string, unknown> | undefined;
  if (!data) { return null; }

  return readNestedString(data, 'video', 'hedra', 'apiKey');
}

// ============================================================================
// Section 2 — Auth probe
// ============================================================================

async function probeHedraAuth(apiKey: string): Promise<{ ok: boolean; modelCount: number; status: number; errBody: string }> {
  const res = await fetch(`${HEDRA_BASE_URL}/models`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey, 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, modelCount: 0, status: res.status, errBody: body };
  }

  const json = (await res.json()) as HedraModel[];
  return { ok: true, modelCount: Array.isArray(json) ? json.length : 0, status: res.status, errBody: '' };
}

// ============================================================================
// Section 3 — Live generation submit
// ============================================================================

async function submitTinyGeneration(apiKey: string): Promise<{ generationId: string | null; status: number; errBody: string }> {
  const payload = {
    type: 'video' as const,
    ai_model_id: KLING_O3_PROMPT_MODEL_ID,
    generated_video_inputs: {
      text_prompt: 'A cheerful animated cat waving at the camera, simple cartoon style',
      resolution: '480p',
      aspect_ratio: '16:9',
      duration_ms: 5_000,
    },
  };

  const res = await fetch(`${HEDRA_BASE_URL}/generations`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { generationId: null, status: res.status, errBody: body };
  }

  const json = (await res.json()) as HedraGenerationResponse;
  return { generationId: json.id ?? null, status: res.status, errBody: '' };
}

// ============================================================================
// Section 4 — Poll status
// ============================================================================

interface PollResult {
  finalStatus: string;
  videoUrl: string | null;
  errBody: string;
  pollCount: number;
  elapsedMs: number;
}

async function pollUntilDone(apiKey: string, generationId: string): Promise<PollResult> {
  const start = Date.now();
  let pollCount = 0;

  while (Date.now() - start < MAX_WAIT_MS) {
    pollCount += 1;
    const elapsed = Math.round((Date.now() - start) / 1000);

    const res = await fetch(`${HEDRA_BASE_URL}/generations/${generationId}/status`, {
      method: 'GET',
      headers: { 'x-api-key': apiKey, 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        finalStatus: `http_${res.status}`,
        videoUrl: null,
        errBody: body,
        pollCount,
        elapsedMs: Date.now() - start,
      };
    }

    const data = (await res.json()) as HedraStatusResponse;
    const status = data.status ?? 'unknown';
    const progress = typeof data.progress === 'number' ? `${data.progress}%` : 'n/a';

    console.log(`   [poll #${pollCount} t+${elapsed}s] status=${status} progress=${progress}`);

    if (status === 'complete' || status === 'completed') {
      const videoUrl = data.url ?? data.video_url ?? data.download_url ?? null;
      return {
        finalStatus: status,
        videoUrl,
        errBody: '',
        pollCount,
        elapsedMs: Date.now() - start,
      };
    }

    if (status === 'failed' || status === 'error') {
      const errMsg = data.error_message ?? data.error ?? '<no error message>';
      return {
        finalStatus: status,
        videoUrl: null,
        errBody: errMsg,
        pollCount,
        elapsedMs: Date.now() - start,
      };
    }

    // pending / queued / processing / anything else — keep polling
    await new Promise<void>((resolve) => { setTimeout(resolve, POLL_INTERVAL_MS); });
  }

  return {
    finalStatus: 'timeout',
    videoUrl: null,
    errBody: `Did not complete within ${MAX_WAIT_MS / 1000}s`,
    pollCount,
    elapsedMs: Date.now() - start,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  let pass = true;

  console.log('=== Hedra integration verification (LIVE) ===\n');
  console.log('WARNING: This script makes a real Hedra generation request.');
  console.log('         Each run consumes Hedra credits.\n');

  // ── Section 1 ─────────────────────────────────────────────────────────
  console.log('1. Hedra API key (Firestore organizations/rapid-compliance-root/apiKeys/rapid-compliance-root):');
  let apiKey: string | null = null;
  try {
    apiKey = await getHedraKeyFromFirestore();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   FAIL — Firestore read threw: ${msg}`);
    pass = false;
  }

  if (!apiKey) {
    console.log('   FAIL — video.hedra.apiKey not set in apiKeys doc');
    console.log('   Set it via Settings > API Keys in the dashboard');
    console.log('\n=== FAIL ===');
    process.exit(1);
  }

  console.log(`   video.hedra.apiKey: ${preview(apiKey)}`);
  console.log('   OK');

  // ── Section 2 ─────────────────────────────────────────────────────────
  console.log('\n2. Live auth probe (GET /web-app/public/models):');
  let authOk = false;
  try {
    const auth = await probeHedraAuth(apiKey);
    if (auth.ok) {
      console.log(`   OK — ${auth.modelCount} models returned, status=${auth.status}`);
      authOk = true;
    } else {
      console.log(`   FAIL — Hedra returned ${auth.status}`);
      console.log(`   Auth header used: x-api-key: <key>`);
      console.log(`   Hedra response body: ${extractErrorText(auth.errBody).slice(0, 500)}`);
      if (auth.status === 401 || auth.status === 403) {
        console.log('   → API key is invalid, expired, or lacks permission. Verify in Hedra dashboard.');
      }
      pass = false;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   FAIL — request threw: ${msg}`);
    pass = false;
  }

  if (!authOk) {
    console.log('\n=== FAIL ===');
    process.exit(1);
  }

  // ── Section 3 ─────────────────────────────────────────────────────────
  console.log('\n3. Live generation submit (POST /web-app/public/generations):');
  console.log('   model_id:      Kling O3 Standard T2V');
  console.log(`   model_id_uuid: ${KLING_O3_PROMPT_MODEL_ID}`);
  console.log('   resolution:    480p');
  console.log('   aspect_ratio:  16:9');
  console.log('   duration_ms:   5000');
  console.log('   prompt:        "A cheerful animated cat waving at the camera, simple cartoon style"');

  let generationId: string | null = null;
  try {
    const submit = await submitTinyGeneration(apiKey);
    if (submit.generationId) {
      generationId = submit.generationId;
      console.log(`   OK — generationId=${generationId} (HTTP ${submit.status})`);
    } else {
      console.log(`   FAIL — Hedra returned ${submit.status}`);
      console.log(`   Hedra response body: ${extractErrorText(submit.errBody).slice(0, 1000)}`);
      pass = false;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   FAIL — request threw: ${msg}`);
    pass = false;
  }

  if (!generationId) {
    console.log('\n=== FAIL ===');
    process.exit(1);
  }

  // ── Section 4 ─────────────────────────────────────────────────────────
  console.log(`\n4. Status polling (GET /generations/${generationId}/status):`);
  console.log(`   Poll interval: ${POLL_INTERVAL_MS / 1000}s   Max wait: ${MAX_WAIT_MS / 1000}s\n`);

  try {
    const result = await pollUntilDone(apiKey, generationId);
    console.log('');
    console.log(`   Final status: ${result.finalStatus}`);
    console.log(`   Polls fired:  ${result.pollCount}`);
    console.log(`   Elapsed:      ${Math.round(result.elapsedMs / 1000)}s`);

    if (result.finalStatus === 'complete' || result.finalStatus === 'completed') {
      if (result.videoUrl) {
        console.log(`   Video URL:    ${result.videoUrl}`);
        console.log('   OK — generation completed and produced a video URL');
      } else {
        console.log('   FAIL — generation reported complete but no video URL was returned');
        pass = false;
      }
    } else {
      console.log('   FAIL — generation did not complete successfully');
      if (result.errBody) {
        console.log(`   Hedra error body: ${extractErrorText(result.errBody).slice(0, 1000)}`);
      }
      pass = false;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   FAIL — polling threw: ${msg}`);
    pass = false;
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n=== ${pass ? 'PASS' : 'FAIL'} ===`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
