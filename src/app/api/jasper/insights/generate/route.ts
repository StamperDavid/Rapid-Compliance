/**
 * POST /api/jasper/insights/generate
 *
 * Regenerates the Jasper Insights batch for the current tenant by:
 *   1. Snapshotting last-7-days platform state (`gatherSnapshot()`).
 *   2. Handing the snapshot to the INSIGHTS_ANALYST specialist
 *      (`runInsightsAnalyst()`) — the SOLE LLM call in this pipeline.
 *   3. Persisting the returned setupItems to `jasperInsights/_meta`
 *      and each insight to its own auto-id doc with a 24h `expiresAt`.
 *
 * Idempotency: if the last generation completed less than 30 minutes
 * ago, this returns the cached `_meta` + active insights without
 * re-running the LLM. Pass `?force=true` to bypass the cache (the
 * dashboard popup uses force on a manual "Refresh insights" click).
 *
 * 503 contract: if the INSIGHTS_ANALYST GM is missing or the specialist
 * module is not yet deployed, this returns 503 with a clear message so
 * the UI can render "Insights are warming up — try again in a moment".
 * It NEVER falls back to an inline system prompt — that would violate
 * the standing rule that ALL LLM agents spawn from their seeded GM.
 *
 * Standing rule compliance: the only LLM call in this file is via
 * `runInsightsAnalyst`. There is no direct OpenRouter / Anthropic /
 * OpenAI import.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { gatherSnapshot } from '@/lib/insights/data-snapshot';
import type { Insight, InsightsAnalystResult, SetupItem } from '@/types/jasper-insights';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const REGENERATE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SpecialistModule {
  runInsightsAnalyst: (snapshot: unknown) => Promise<InsightsAnalystResult>;
}

/**
 * Dynamically import the specialist module so a missing/not-yet-shipped
 * file produces a clean 503 instead of crashing module evaluation.
 */
async function loadSpecialist(): Promise<SpecialistModule | null> {
  try {
    const mod = (await import('@/lib/agents/intelligence/insights-analyst/specialist')) as Partial<SpecialistModule>;
    if (typeof mod.runInsightsAnalyst !== 'function') {
      return null;
    }
    return { runInsightsAnalyst: mod.runInsightsAnalyst };
  } catch (err) {
    logger.warn('[insights/generate] specialist module not available', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function urgencyRank(urgency: string | undefined): number {
  if (urgency === 'high') { return 3; }
  if (urgency === 'medium') { return 2; }
  if (urgency === 'low') { return 1; }
  return 0;
}

function sanitizeSetupItem(raw: unknown): SetupItem | null {
  if (!raw || typeof raw !== 'object') { return null; }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.key !== 'string' || obj.key.length === 0) { return null; }
  if (typeof obj.title !== 'string' || obj.title.length === 0) { return null; }
  const urgency = obj.urgency === 'high' || obj.urgency === 'medium' || obj.urgency === 'low'
    ? obj.urgency
    : 'medium';
  const item: SetupItem = {
    key: obj.key,
    title: obj.title,
    description: typeof obj.description === 'string' ? obj.description : '',
    ctaLabel: typeof obj.ctaLabel === 'string' && obj.ctaLabel.length > 0 ? obj.ctaLabel : 'Open',
    urgency,
  };
  if (typeof obj.ctaHref === 'string' && obj.ctaHref.length > 0) {
    item.ctaHref = obj.ctaHref;
  }
  return item;
}

function sanitizeInsight(raw: unknown, generatedAt: string, expiresAt: string): Omit<Insight, 'id'> | null {
  if (!raw || typeof raw !== 'object') { return null; }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.title !== 'string' || obj.title.length === 0) { return null; }
  if (typeof obj.summary !== 'string' || obj.summary.length === 0) { return null; }
  if (typeof obj.suggestedMissionPrompt !== 'string' || obj.suggestedMissionPrompt.length < 5) { return null; }
  const urgency = obj.urgency === 'high' || obj.urgency === 'medium' || obj.urgency === 'low'
    ? obj.urgency
    : 'medium';
  const category =
    obj.category === 'pipeline'
    || obj.category === 'content'
    || obj.category === 'social'
    || obj.category === 'engagement'
    || obj.category === 'platform_health'
      ? obj.category
      : 'platform_health';
  const signals = Array.isArray(obj.signalsSeen)
    ? obj.signalsSeen.filter((s): s is string => typeof s === 'string')
    : [];
  return {
    title: obj.title,
    summary: obj.summary,
    urgency,
    category,
    signalsSeen: signals,
    suggestedMissionPrompt: obj.suggestedMissionPrompt,
    generatedAt,
    expiresAt,
  };
}

async function readActiveBatch(insightsPath: string): Promise<{
  setupItems: SetupItem[];
  insights: Insight[];
  lastGeneratedAt: string | null;
}> {
  if (!adminDb) {
    return { setupItems: [], insights: [], lastGeneratedAt: null };
  }
  const db = adminDb;

  let setupItems: SetupItem[] = [];
  let lastGeneratedAt: string | null = null;
  try {
    const metaDoc = await db.collection(insightsPath).doc('_meta').get();
    if (metaDoc.exists) {
      const data = metaDoc.data() ?? {};
      if (Array.isArray(data.setupItems)) {
        setupItems = data.setupItems
          .map(sanitizeSetupItem)
          .filter((x: SetupItem | null): x is SetupItem => x !== null);
      }
      if (typeof data.lastGeneratedAt === 'string') {
        lastGeneratedAt = data.lastGeneratedAt;
      }
    }
  } catch (err) {
    logger.warn('[insights/generate] reading meta doc failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const nowIso = new Date().toISOString();
  let insights: Insight[] = [];
  try {
    const snap = await db
      .collection(insightsPath)
      .where('expiresAt', '>', nowIso)
      .limit(50)
      .get();
    const rows: Insight[] = [];
    for (const doc of snap.docs) {
      if (doc.id === '_meta') { continue; }
      const data = doc.data() as Record<string, unknown>;
      if (data.dismissedAt) { continue; }
      if (data.convertedToMissionId) { continue; }
      const sanitized = sanitizeInsight(
        data,
        typeof data.generatedAt === 'string' ? data.generatedAt : nowIso,
        typeof data.expiresAt === 'string' ? data.expiresAt : nowIso,
      );
      if (!sanitized) { continue; }
      rows.push({ id: doc.id, ...sanitized });
    }
    rows.sort((a, b) => {
      const u = urgencyRank(b.urgency) - urgencyRank(a.urgency);
      if (u !== 0) { return u; }
      return b.generatedAt.localeCompare(a.generatedAt);
    });
    insights = rows.slice(0, 10);
  } catch (err) {
    logger.warn('[insights/generate] reading insights batch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { setupItems, insights, lastGeneratedAt };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Firestore Admin SDK not initialized' },
      { status: 500 },
    );
  }
  const db = adminDb;

  const force = request.nextUrl.searchParams.get('force') === 'true';

  const insightsPath = getSubCollection('jasperInsights');

  // Idempotency: cooldown unless force=true.
  if (!force) {
    try {
      const metaDoc = await db.collection(insightsPath).doc('_meta').get();
      if (metaDoc.exists) {
        const lastIso: unknown = metaDoc.get('lastGeneratedAt');
        if (typeof lastIso === 'string') {
          const last = new Date(lastIso).getTime();
          if (!Number.isNaN(last) && Date.now() - last < REGENERATE_COOLDOWN_MS) {
            const cached = await readActiveBatch(insightsPath);
            return NextResponse.json({
              success: true,
              fromCache: true,
              ...cached,
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[insights/generate] cooldown read failed — continuing to generate', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Load specialist module before snapshot work — fail fast on 503.
  const specialist = await loadSpecialist();
  if (!specialist) {
    return NextResponse.json(
      {
        success: false,
        error: 'INSIGHTS_ANALYST specialist not available — Golden Master may not be seeded yet. Try again shortly.',
      },
      { status: 503 },
    );
  }

  // Snapshot the platform.
  const snapshot = await gatherSnapshot();

  // Single LLM call — through the specialist, with Brand DNA baked in.
  let result: InsightsAnalystResult;
  try {
    result = await specialist.runInsightsAnalyst(snapshot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Treat GM-missing / config errors as warming-up (503); any other
    // failure is a true 500 so it shows up loudly in logs.
    const looksWarmingUp = /golden\s*master|gm\s+missing|not\s+seeded|not\s+configured|systemPrompt/i.test(msg);
    if (looksWarmingUp) {
      logger.warn('[insights/generate] specialist GM not seeded', { error: msg });
      return NextResponse.json(
        {
          success: false,
          error: 'Insights are warming up — try again in a moment.',
        },
        { status: 503 },
      );
    }
    logger.error(
      '[insights/generate] specialist call failed',
      err instanceof Error ? err : new Error(msg),
      { route: '/api/jasper/insights/generate' },
    );
    return NextResponse.json(
      { success: false, error: `Failed to generate insights: ${msg}` },
      { status: 500 },
    );
  }

  // Sanitize specialist output before persisting — model output is never trusted as-is.
  const generatedAt = new Date();
  const generatedAtIso = generatedAt.toISOString();
  const expiresAtIso = new Date(generatedAt.getTime() + INSIGHT_TTL_MS).toISOString();

  const setupItems: SetupItem[] = Array.isArray(result.setupItems)
    ? result.setupItems
        .map(sanitizeSetupItem)
        .filter((x): x is SetupItem => x !== null)
    : [];

  const insightInputs = Array.isArray(result.insights)
    ? result.insights
        .map((raw) => sanitizeInsight(raw, generatedAtIso, expiresAtIso))
        .filter((x): x is Omit<Insight, 'id'> => x !== null)
    : [];

  // Persist using a batched write so partial failures don't leave the
  // batch half-written.
  const writtenInsights: Insight[] = [];
  try {
    const batch = db.batch();

    const metaRef = db.collection(insightsPath).doc('_meta');
    batch.set(
      metaRef,
      {
        setupItems,
        lastGeneratedAt: generatedAtIso,
        snapshotWarnings: snapshot.warnings,
        snapshotWindowDays: snapshot.windowDays,
      },
      { merge: true },
    );

    for (const ins of insightInputs) {
      const docRef = db.collection(insightsPath).doc();
      const payload: InsightDocPayload = {
        ...ins,
        id: docRef.id,
        dismissedAt: null,
        convertedToMissionId: null,
      };
      batch.set(docRef, payload);
      writtenInsights.push({
        ...ins,
        id: docRef.id,
      });
    }

    await batch.commit();
  } catch (err) {
    logger.error(
      '[insights/generate] batch write failed',
      err instanceof Error ? err : new Error(String(err)),
      { route: '/api/jasper/insights/generate' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to persist generated insights' },
      { status: 500 },
    );
  }

  writtenInsights.sort((a, b) => {
    const u = urgencyRank(b.urgency) - urgencyRank(a.urgency);
    if (u !== 0) { return u; }
    return b.generatedAt.localeCompare(a.generatedAt);
  });

  return NextResponse.json({
    success: true,
    fromCache: false,
    setupItems,
    insights: writtenInsights.slice(0, 10),
    lastGeneratedAt: generatedAtIso,
  });
}

interface InsightDocPayload extends Omit<Insight, 'id'> {
  id: string;
  dismissedAt: string | null;
  convertedToMissionId: string | null;
}
