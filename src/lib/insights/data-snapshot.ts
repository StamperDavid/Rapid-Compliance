/**
 * Jasper Insights — platform-state snapshot for the INSIGHTS_ANALYST.
 *
 * `gatherSnapshot()` collects last-7-days activity for the current tenant
 * and returns an opaque object handed straight to `runInsightsAnalyst()`.
 * The shape is intentionally loose (the LLM JSON-stringifies it and reads
 * whatever is provided), but every field is fault-tolerant: each subquery
 * is wrapped in its own try/catch and substitutes zeros / empty arrays on
 * failure so a single broken collection cannot bring the whole snapshot
 * (and therefore the dashboard popup) down.
 *
 * Multi-tenant safe: every collection path resolves through
 * `getSubCollection(...)` so it lives under `organizations/{tenantId}/...`.
 *
 * Standing rule compliance: no LLM calls happen here. This module does
 * NOT import OpenRouter / Anthropic / OpenAI SDKs. The only consumer of
 * its output is `runInsightsAnalyst`, which is the single LLM path.
 */
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface ConnectedAccountSummary {
  id: string;
  provider?: string;
  accountEmail?: string;
  status?: string;
  connectedAt?: string | null;
}

export interface SnapshotMissionStats {
  total: number;
  completed: number;
  failed: number;
  awaitingApproval: number;
  planPending: number;
}

export interface SnapshotSocialStats {
  total: number;
  scheduled: number;
  published: number;
  draft: number;
  byPlatform: Record<string, number>;
}

export interface SnapshotCrmStats {
  totalLeads: number;
  newLeadsLast7d: number;
  totalDeals: number;
  openDealValue: number;
  closedWonValueLast7d: number;
}

export interface SnapshotCalendarStats {
  upcomingEvents7d: number;
}

export interface SnapshotContentStats {
  draftBlogPosts: number;
  publishedBlogPosts: number;
}

export interface SnapshotTaskStats {
  scheduledTasks: number;
  overdueTasks: number;
}

export interface InsightsSnapshot {
  generatedAt: string;
  windowDays: number;
  missions: SnapshotMissionStats;
  social: SnapshotSocialStats;
  crm: SnapshotCrmStats;
  calendar: SnapshotCalendarStats;
  content: SnapshotContentStats;
  tasks: SnapshotTaskStats;
  connectedAccounts: ConnectedAccountSummary[];
  /** Per-subquery error notes — the LLM can use these to recommend reconnection. */
  warnings: string[];
}

/**
 * Coerce a Firestore date-like value to a Date. Accepts ISO strings, JS
 * Date instances, Firestore Timestamps (toDate), and millisecond numbers.
 * Returns null if nothing usable.
 */
function coerceDate(value: unknown): Date | null {
  if (!value) { return null; }
  if (value instanceof Date) { return value; }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const ts = value as { toDate?: () => Date };
    if (typeof ts.toDate === 'function') {
      try {
        const d = ts.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function safeCount<T>(
  label: string,
  warnings: string[],
  fallback: T,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[insights/snapshot] ${label} subquery failed`, { error: msg });
    warnings.push(`${label}: ${msg}`);
    return fallback;
  }
}

export async function gatherSnapshot(): Promise<InsightsSnapshot> {
  const generatedAt = new Date();
  const since = new Date(generatedAt.getTime() - SEVEN_DAYS_MS);
  const sinceIso = since.toISOString();
  const warnings: string[] = [];

  const empty: InsightsSnapshot = {
    generatedAt: generatedAt.toISOString(),
    windowDays: 7,
    missions: { total: 0, completed: 0, failed: 0, awaitingApproval: 0, planPending: 0 },
    social: { total: 0, scheduled: 0, published: 0, draft: 0, byPlatform: {} },
    crm: {
      totalLeads: 0,
      newLeadsLast7d: 0,
      totalDeals: 0,
      openDealValue: 0,
      closedWonValueLast7d: 0,
    },
    calendar: { upcomingEvents7d: 0 },
    content: { draftBlogPosts: 0, publishedBlogPosts: 0 },
    tasks: { scheduledTasks: 0, overdueTasks: 0 },
    connectedAccounts: [],
    warnings,
  };

  if (!adminDb) {
    warnings.push('admin-db: Firestore Admin SDK not initialized');
    return empty;
  }
  const db = adminDb;

  // ── Missions (last 7d) ────────────────────────────────────────────────
  const missions = await safeCount('missions', warnings, empty.missions, async () => {
    const snap = await db
      .collection(getSubCollection('missions'))
      .where('createdAt', '>=', sinceIso)
      .limit(500)
      .get();
    let completed = 0;
    let failed = 0;
    let awaitingApproval = 0;
    let planPending = 0;
    for (const doc of snap.docs) {
      const status = String(doc.get('status') ?? '').toUpperCase();
      if (status === 'COMPLETED') { completed += 1; }
      else if (status === 'FAILED') { failed += 1; }
      else if (status === 'AWAITING_APPROVAL') { awaitingApproval += 1; }
      else if (status === 'PLAN_PENDING_APPROVAL') { planPending += 1; }
    }
    return {
      total: snap.size,
      completed,
      failed,
      awaitingApproval,
      planPending,
    };
  });

  // ── Social posts (last 7d) ───────────────────────────────────────────
  const social = await safeCount('socialPosts', warnings, empty.social, async () => {
    // Some social posts have createdAt as a Timestamp, others ISO string —
    // pull recent ones unfiltered and filter in-memory so we don't pin the
    // query to a single field type.
    const snap = await db
      .collection(getSubCollection('socialPosts'))
      .limit(500)
      .get();
    let scheduled = 0;
    let published = 0;
    let draft = 0;
    const byPlatform: Record<string, number> = {};
    let total = 0;
    for (const doc of snap.docs) {
      const created = coerceDate(doc.get('createdAt')) ?? coerceDate(doc.get('updatedAt'));
      if (!created || created < since) { continue; }
      total += 1;
      const status = String(doc.get('status') ?? 'draft').toLowerCase();
      if (status === 'scheduled') { scheduled += 1; }
      else if (status === 'published') { published += 1; }
      else if (status === 'draft') { draft += 1; }
      const platform = String(doc.get('platform') ?? 'unknown').toLowerCase();
      byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
    }
    return { total, scheduled, published, draft, byPlatform };
  });

  // ── CRM: leads ────────────────────────────────────────────────────────
  const crmLeads = await safeCount(
    'leads',
    warnings,
    { totalLeads: 0, newLeadsLast7d: 0 },
    async () => {
      const snap = await db.collection(getSubCollection('leads')).limit(2000).get();
      let newLeads = 0;
      for (const doc of snap.docs) {
        const created = coerceDate(doc.get('createdAt'));
        if (created && created >= since) { newLeads += 1; }
      }
      return { totalLeads: snap.size, newLeadsLast7d: newLeads };
    },
  );

  // ── CRM: deals ────────────────────────────────────────────────────────
  const crmDeals = await safeCount(
    'deals',
    warnings,
    { totalDeals: 0, openDealValue: 0, closedWonValueLast7d: 0 },
    async () => {
      const snap = await db.collection(getSubCollection('deals')).limit(2000).get();
      let openValue = 0;
      let closedWon7d = 0;
      for (const doc of snap.docs) {
        const stage = String(doc.get('stage') ?? '').toLowerCase();
        const valueRaw: unknown = doc.get('value');
        const value = typeof valueRaw === 'number' ? valueRaw : Number(valueRaw ?? 0);
        const safeValue = Number.isFinite(value) ? value : 0;
        if (stage === 'closed_won' || stage === 'closed-won' || stage === 'won') {
          const closedAt = coerceDate(doc.get('closedAt')) ?? coerceDate(doc.get('updatedAt'));
          if (closedAt && closedAt >= since) { closedWon7d += safeValue; }
        } else if (stage !== 'closed_lost' && stage !== 'closed-lost' && stage !== 'lost') {
          openValue += safeValue;
        }
      }
      return {
        totalDeals: snap.size,
        openDealValue: Math.round(openValue),
        closedWonValueLast7d: Math.round(closedWon7d),
      };
    },
  );

  // ── Calendar (next 7d) ────────────────────────────────────────────────
  const calendar = await safeCount('calendarEvents', warnings, empty.calendar, async () => {
    const horizon = new Date(generatedAt.getTime() + SEVEN_DAYS_MS).toISOString();
    const snap = await db
      .collection(getSubCollection('calendarEvents'))
      .where('startTime', '<=', horizon)
      .limit(200)
      .get();
    let upcoming = 0;
    for (const doc of snap.docs) {
      const start = coerceDate(doc.get('startTime'));
      if (start && start >= generatedAt) { upcoming += 1; }
    }
    return { upcomingEvents7d: upcoming };
  });

  // ── Content drafts ───────────────────────────────────────────────────
  const content = await safeCount('blogPosts', warnings, empty.content, async () => {
    const snap = await db.collection(getSubCollection('blogPosts')).limit(500).get();
    let draftBlogPosts = 0;
    let publishedBlogPosts = 0;
    for (const doc of snap.docs) {
      const status = String(doc.get('status') ?? 'draft').toLowerCase();
      if (status === 'published') { publishedBlogPosts += 1; }
      else { draftBlogPosts += 1; }
    }
    return { draftBlogPosts, publishedBlogPosts };
  });

  // ── Scheduled tasks ──────────────────────────────────────────────────
  const tasks = await safeCount('tasks', warnings, empty.tasks, async () => {
    const snap = await db.collection(getSubCollection('tasks')).limit(500).get();
    let scheduledTasks = 0;
    let overdueTasks = 0;
    for (const doc of snap.docs) {
      const status = String(doc.get('status') ?? '').toLowerCase();
      if (status === 'completed' || status === 'cancelled') { continue; }
      scheduledTasks += 1;
      const dueAt = coerceDate(doc.get('dueAt')) ?? coerceDate(doc.get('dueDate'));
      if (dueAt && dueAt < generatedAt) { overdueTasks += 1; }
    }
    return { scheduledTasks, overdueTasks };
  });

  // ── Connected integrations ───────────────────────────────────────────
  const connectedAccounts = await safeCount<ConnectedAccountSummary[]>(
    'connectedAccounts',
    warnings,
    [],
    async () => {
      const snap = await db.collection(getSubCollection('connectedAccounts')).limit(50).get();
      return snap.docs.map((doc) => {
        const data = doc.data() ?? {};
        const summary: ConnectedAccountSummary = {
          id: doc.id,
          provider: typeof data.provider === 'string' ? data.provider : doc.id,
          accountEmail: typeof data.accountEmail === 'string' ? data.accountEmail : undefined,
          status: typeof data.status === 'string' ? data.status : 'connected',
          connectedAt: typeof data.connectedAt === 'string' ? data.connectedAt : null,
        };
        return summary;
      });
    },
  );

  return {
    generatedAt: generatedAt.toISOString(),
    windowDays: 7,
    missions,
    social,
    crm: {
      totalLeads: crmLeads.totalLeads,
      newLeadsLast7d: crmLeads.newLeadsLast7d,
      totalDeals: crmDeals.totalDeals,
      openDealValue: crmDeals.openDealValue,
      closedWonValueLast7d: crmDeals.closedWonValueLast7d,
    },
    calendar,
    content,
    tasks,
    connectedAccounts,
    warnings,
  };
}
