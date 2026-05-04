/**
 * GET /api/jasper/insights
 *
 * Returns the most recent batch of Jasper Insights for the dashboard
 * popup, plus the operator's setup-reminder gaps with their dismissed
 * keys filtered out.
 *
 * Read-only. Does NOT call the LLM. Does NOT regenerate. The popup hits
 * `/generate` separately on first login of the day to refresh the batch.
 *
 * Multi-tenant safe — every read goes through `getSubCollection(...)`.
 *
 * Standing rule compliance: this route does not import OpenRouter /
 * Anthropic / OpenAI SDKs. The only LLM path is `runInsightsAnalyst()`,
 * called from the `/generate` route.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { Insight, SetupItem } from '@/types/jasper-insights';

export const dynamic = 'force-dynamic';

const INSIGHTS_LIMIT = 10;

interface InsightDoc extends Insight {
  dismissedAt?: string | null;
  convertedToMissionId?: string | null;
}

function urgencyRank(urgency: string | undefined): number {
  if (urgency === 'high') { return 3; }
  if (urgency === 'medium') { return 2; }
  if (urgency === 'low') { return 1; }
  return 0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Firestore Admin SDK not initialized' },
      { status: 500 },
    );
  }
  const db = adminDb;

  try {
    const insightsCollectionPath = getSubCollection('jasperInsights');
    const setupRemindersCollectionPath = getSubCollection('setupReminders');

    // Read dismissed setup-reminder keys.
    let dismissedKeys = new Set<string>();
    try {
      const dismissedDoc = await db
        .collection(setupRemindersCollectionPath)
        .doc('dismissed')
        .get();
      if (dismissedDoc.exists) {
        const data = (dismissedDoc.data() ?? {}) as Record<string, unknown>;
        const map = data.keys;
        if (map && typeof map === 'object') {
          dismissedKeys = new Set(Object.keys(map as Record<string, unknown>));
        }
      }
    } catch (err) {
      logger.warn('[insights/GET] reading dismissed reminders failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Read the meta doc for setupItems + lastGeneratedAt.
    let setupItems: SetupItem[] = [];
    let lastGeneratedAt: string | null = null;
    try {
      const metaDoc = await db
        .collection(insightsCollectionPath)
        .doc('_meta')
        .get();
      if (metaDoc.exists) {
        const data = metaDoc.data() ?? {};
        const rawItems = Array.isArray(data.setupItems) ? data.setupItems : [];
        setupItems = rawItems
          .filter((item: unknown): item is SetupItem => {
            if (!item || typeof item !== 'object') { return false; }
            const obj = item as Record<string, unknown>;
            return typeof obj.key === 'string' && typeof obj.title === 'string';
          })
          .filter((item: SetupItem) => !dismissedKeys.has(item.key));
        if (typeof data.lastGeneratedAt === 'string') {
          lastGeneratedAt = data.lastGeneratedAt;
        }
      }
    } catch (err) {
      logger.warn('[insights/GET] reading meta doc failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Read the active insights batch.
    const nowIso = new Date().toISOString();
    let insights: Insight[] = [];
    try {
      // Note: composite index on (expiresAt, generatedAt) may not exist.
      // We do an in-memory filter + sort to keep things robust without
      // requiring an index migration. Limit pulled to 50 to bound memory.
      const snap = await db
        .collection(insightsCollectionPath)
        .where('expiresAt', '>', nowIso)
        .limit(50)
        .get();
      const rows: InsightDoc[] = [];
      for (const doc of snap.docs) {
        if (doc.id === '_meta') { continue; }
        const data = doc.data() as Partial<InsightDoc>;
        if (data.dismissedAt) { continue; }
        if (data.convertedToMissionId) { continue; }
        rows.push({
          id: doc.id,
          title: typeof data.title === 'string' ? data.title : '',
          summary: typeof data.summary === 'string' ? data.summary : '',
          urgency: data.urgency === 'high' || data.urgency === 'medium' || data.urgency === 'low' ? data.urgency : 'low',
          category: (data.category as Insight['category']) ?? 'platform_health',
          signalsSeen: Array.isArray(data.signalsSeen) ? data.signalsSeen.filter((s): s is string => typeof s === 'string') : [],
          suggestedMissionPrompt: typeof data.suggestedMissionPrompt === 'string' ? data.suggestedMissionPrompt : '',
          generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : nowIso,
          expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : nowIso,
        });
      }
      rows.sort((a, b) => {
        const u = urgencyRank(b.urgency) - urgencyRank(a.urgency);
        if (u !== 0) { return u; }
        return b.generatedAt.localeCompare(a.generatedAt);
      });
      insights = rows.slice(0, INSIGHTS_LIMIT);
    } catch (err) {
      logger.warn('[insights/GET] reading insights batch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json({
      success: true,
      insights,
      setupItems,
      lastGeneratedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[insights/GET] unexpected failure',
      err instanceof Error ? err : new Error(msg),
      { route: '/api/jasper/insights' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load Jasper Insights' },
      { status: 500 },
    );
  }
}
