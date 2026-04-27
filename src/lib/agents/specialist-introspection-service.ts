/**
 * Specialist Introspection Service
 *
 * Resolves specialist identity, active GM, last grade, and "currently
 * working" status for the Social Hub's per-specialist detail panels.
 *
 * Why this lives separately from `agent-registry.ts`:
 *   The marketing specialists (`BLUESKY_EXPERT`, `MASTODON_EXPERT`,
 *   `TWITTER_X_EXPERT`, `INSTAGRAM_EXPERT`, `PINTEREST_EXPERT`,
 *   `YOUTUBE_EXPERT`, `PAID_ADS_SPECIALIST`) ship with industry-scoped
 *   GMs and identity baked into their `SpecialistConfig` files but were
 *   added AFTER `agent-registry.ts` was authored. Rather than mutate
 *   the registry (which is consumed by other reporting code that may
 *   rely on its current shape), this service maintains a small
 *   marketing-specialist directory and falls through to the registry
 *   for everything else. Both sources match on `id`.
 *
 * The service is read-only — it never modifies GMs, never writes
 * feedback. It's pure aggregation for the Social Hub UI.
 *
 * @module agents/specialist-introspection-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  AGENT_REGISTRY,
  type AgentDefinition,
} from './agent-registry';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { SpecialistGoldenMaster, TrainingFeedback } from '@/types/training';
import type { Mission } from '@/lib/orchestrator/mission-persistence';

// ============================================================================
// MARKETING SPECIALIST DIRECTORY
// ============================================================================
//
// Identity records for the marketing specialists that aren't covered by
// the legacy `agent-registry.ts` IDs. These match the `identity` blocks
// in the specialist files (e.g. src/lib/agents/marketing/bluesky/specialist.ts).
// Capabilities pulled directly from each specialist's `CONFIG.identity.capabilities`.

const MARKETING_SPECIALIST_DIRECTORY: Record<string, AgentDefinition> = {
  TWITTER_X_EXPERT: {
    id: 'TWITTER_X_EXPERT',
    name: 'Twitter/X Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  BLUESKY_EXPERT: {
    id: 'BLUESKY_EXPERT',
    name: 'Bluesky Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  MASTODON_EXPERT: {
    id: 'MASTODON_EXPERT',
    name: 'Mastodon Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  LINKEDIN_EXPERT: {
    id: 'LINKEDIN_EXPERT',
    name: 'LinkedIn Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  FACEBOOK_ADS_EXPERT: {
    id: 'FACEBOOK_ADS_EXPERT',
    name: 'Facebook Ads Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  INSTAGRAM_EXPERT: {
    id: 'INSTAGRAM_EXPERT',
    name: 'Instagram Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  PINTEREST_EXPERT: {
    id: 'PINTEREST_EXPERT',
    name: 'Pinterest Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  YOUTUBE_EXPERT: {
    id: 'YOUTUBE_EXPERT',
    name: 'YouTube Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content'],
  },
  PAID_ADS_SPECIALIST: {
    id: 'PAID_ADS_SPECIALIST',
    name: 'Paid Advertising Specialist',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['plan_campaign', 'optimize_campaign', 'analyze_ad_performance'],
  },
  TIKTOK_EXPERT: {
    id: 'TIKTOK_EXPERT',
    name: 'TikTok Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content'],
  },
  SEO_EXPERT: {
    id: 'SEO_EXPERT',
    name: 'SEO Expert',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['keyword_research', 'domain_analysis'],
  },
  GROWTH_ANALYST: {
    id: 'GROWTH_ANALYST',
    name: 'Growth Analyst',
    role: 'specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['generate_content'],
  },
};

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface SpecialistIdentitySummary {
  id: string;
  name: string;
  role: 'specialist';
  reportsTo: string;
  capabilities: string[];
}

export interface SpecialistActiveGMSummary {
  version: number;
  industryKey: string;
  docId: string;
  deployedAt: string;
  model: string;
}

export interface SpecialistLastGradeSummary {
  grade: TrainingFeedback['grade'];
  explanation: string;
  submittedAt: string;
  submittedBy: string;
}

export interface SpecialistCurrentlyWorkingItem {
  missionId: string;
  missionTitle: string;
  stepName: string;
  status: 'IN_PROGRESS' | 'AWAITING_APPROVAL';
  startedAt: string;
}

export interface SpecialistRecentWorkItem {
  missionId: string;
  stepId: string;
  stepName: string;
  completedAt: string;
  outputExcerpt: string;
  platform: string | null;
  grade: SpecialistLastGradeSummary | null;
}

// ============================================================================
// IDENTITY RESOLUTION
// ============================================================================

/**
 * Resolve an identity record for any known specialist ID. Returns null if
 * the ID is not recognised in either the registry or the marketing
 * directory.
 */
export function resolveSpecialistIdentity(
  specialistId: string,
): SpecialistIdentitySummary | null {
  const fromMarketing = MARKETING_SPECIALIST_DIRECTORY[specialistId];
  if (fromMarketing) {
    return {
      id: fromMarketing.id,
      name: fromMarketing.name,
      role: 'specialist',
      reportsTo: fromMarketing.parentId ?? 'MASTER_ORCHESTRATOR',
      capabilities: fromMarketing.capabilities,
    };
  }

  const fromRegistry = AGENT_REGISTRY.find((a) => a.id === specialistId);
  if (fromRegistry?.tier === 'L3') {
    return {
      id: fromRegistry.id,
      name: fromRegistry.name,
      role: 'specialist',
      reportsTo: fromRegistry.parentId ?? 'MASTER_ORCHESTRATOR',
      capabilities: fromRegistry.capabilities,
    };
  }

  return null;
}

// ============================================================================
// ACTIVE GM
// ============================================================================

/**
 * Look up the currently active industry-scoped GM for a specialist and
 * shape it for the Social Hub. Returns null if no GM is seeded yet.
 */
export async function getSpecialistActiveGMSummary(
  specialistId: string,
  industryKey: string,
): Promise<SpecialistActiveGMSummary | null> {
  const gm = await getActiveSpecialistGMByIndustry(specialistId, industryKey);
  if (!gm) { return null; }
  return shapeGMSummary(gm);
}

function shapeGMSummary(gm: SpecialistGoldenMaster): SpecialistActiveGMSummary {
  const config = gm.config;
  const modelRaw = config.model;
  const model = typeof modelRaw === 'string' ? modelRaw : 'unknown';

  return {
    version: gm.version,
    industryKey: gm.industryKey ?? 'unknown',
    docId: gm.id,
    deployedAt: gm.deployedAt ?? gm.createdAt,
    model,
  };
}

// ============================================================================
// LAST GRADE
// ============================================================================

/**
 * Most recent training feedback record for a specialist, regardless of
 * status. Defensive query: single `where` only, sorted in JS, to avoid
 * requiring a composite index.
 */
export async function getSpecialistLastGrade(
  specialistId: string,
): Promise<SpecialistLastGradeSummary | null> {
  if (!adminDb) { return null; }

  try {
    const snapshot = await adminDb
      .collection(getSubCollection('trainingFeedback'))
      .where('targetSpecialistId', '==', specialistId)
      .get();

    if (snapshot.empty) { return null; }

    const records = snapshot.docs.map((d) => d.data() as TrainingFeedback);
    records.sort((a, b) => {
      const aT = new Date(a.createdAt).getTime();
      const bT = new Date(b.createdAt).getTime();
      return bT - aT;
    });

    const latest = records[0];
    return {
      grade: latest.grade,
      explanation: latest.explanation,
      submittedAt: latest.createdAt,
      submittedBy: latest.graderDisplayName ?? latest.graderUserId,
    };
  } catch (error) {
    logger.error(
      '[SpecialistIntrospection] getSpecialistLastGrade failed',
      error instanceof Error ? error : new Error(String(error)),
      { specialistId },
    );
    return null;
  }
}

/**
 * Look up grades for a list of mission/step keys, then index by stepId.
 * Used by the recent-work view to attach a grade summary to each output.
 */
async function loadGradesByStepIds(
  stepIds: readonly string[],
): Promise<Map<string, SpecialistLastGradeSummary>> {
  const out = new Map<string, SpecialistLastGradeSummary>();
  if (!adminDb || stepIds.length === 0) { return out; }

  try {
    // Firestore `in` queries cap at 30 values per query — chunk defensively.
    const CHUNK = 30;
    const chunks: string[][] = [];
    const stepIdsCopy = [...stepIds];
    for (let i = 0; i < stepIdsCopy.length; i += CHUNK) {
      chunks.push(stepIdsCopy.slice(i, i + CHUNK));
    }

    for (const chunk of chunks) {
      const snap = await adminDb
        .collection(getSubCollection('trainingFeedback'))
        .where('sourceReportTaskId', 'in', chunk)
        .get();

      // Multiple grades for the same step are possible — keep the latest.
      const byStep = new Map<string, TrainingFeedback>();
      for (const doc of snap.docs) {
        const r = doc.data() as TrainingFeedback;
        const existing = byStep.get(r.sourceReportTaskId);
        if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
          byStep.set(r.sourceReportTaskId, r);
        }
      }

      for (const [stepId, r] of byStep) {
        out.set(stepId, {
          grade: r.grade,
          explanation: r.explanation,
          submittedAt: r.createdAt,
          submittedBy: r.graderDisplayName ?? r.graderUserId,
        });
      }
    }
  } catch (error) {
    logger.error(
      '[SpecialistIntrospection] loadGradesByStepIds failed',
      error instanceof Error ? error : new Error(String(error)),
      { stepCount: stepIds.length },
    );
  }

  return out;
}

// ============================================================================
// CURRENTLY WORKING / RECENT WORK
// ============================================================================

/**
 * Missions a specialist is actively contributing to right now.
 * Filters in-flight or operator-halted missions and returns one entry per
 * (mission, step) pair belonging to the specialist.
 *
 * Defensive query: single-field `array-contains` only, then in-JS filter
 * by status. No composite index required.
 */
export async function getSpecialistCurrentlyWorking(
  specialistId: string,
): Promise<SpecialistCurrentlyWorkingItem[]> {
  if (!adminDb) { return []; }

  try {
    const missions = await loadMissionsForSpecialist(specialistId);
    const results: SpecialistCurrentlyWorkingItem[] = [];

    for (const mission of missions) {
      if (mission.status !== 'IN_PROGRESS' && mission.status !== 'AWAITING_APPROVAL') { continue; }

      for (const step of mission.steps) {
        const stepSpecialists = step.specialistsUsed ?? [];
        if (!stepSpecialists.includes(specialistId)) { continue; }
        if (step.status !== 'RUNNING' && step.status !== 'PROPOSED' && step.status !== 'FAILED') { continue; }

        const stepName = step.summary && step.summary.length > 0
          ? step.summary
          : step.toolName;

        results.push({
          missionId: mission.missionId,
          missionTitle: mission.title,
          stepName,
          status: mission.status,
          startedAt: step.startedAt,
        });
      }
    }

    return results;
  } catch (error) {
    logger.error(
      '[SpecialistIntrospection] getSpecialistCurrentlyWorking failed',
      error instanceof Error ? error : new Error(String(error)),
      { specialistId },
    );
    return [];
  }
}

/**
 * Recent COMPLETED outputs by a specialist, with grade hooks. Walks each
 * matching mission's steps and emits one entry per step the specialist
 * executed, capped at `limit` entries total (newest first by completion).
 */
export async function getSpecialistRecentWork(
  specialistId: string,
  limit: number,
): Promise<SpecialistRecentWorkItem[]> {
  if (!adminDb) { return []; }

  try {
    const missions = await loadMissionsForSpecialist(specialistId);

    // Walk every COMPLETED mission, collect every step the specialist ran.
    type Candidate = { mission: Mission; step: Mission['steps'][number] };
    const candidates: Candidate[] = [];

    for (const mission of missions) {
      if (mission.status !== 'COMPLETED') { continue; }
      for (const step of mission.steps) {
        const stepSpecialists = step.specialistsUsed ?? [];
        if (!stepSpecialists.includes(specialistId)) { continue; }
        if (step.status !== 'COMPLETED') { continue; }
        if (!step.completedAt) { continue; }
        candidates.push({ mission, step });
      }
    }

    candidates.sort((a, b) => {
      const aT = a.step.completedAt ? new Date(a.step.completedAt).getTime() : 0;
      const bT = b.step.completedAt ? new Date(b.step.completedAt).getTime() : 0;
      return bT - aT;
    });

    const top = candidates.slice(0, limit);
    const stepIds = top.map((c) => c.step.stepId);
    const gradeMap = await loadGradesByStepIds(stepIds);

    return top.map(({ mission, step }) => {
      const stepName = step.summary && step.summary.length > 0
        ? step.summary
        : step.toolName;

      const outputRaw = step.toolResult ?? '';
      const outputExcerpt = outputRaw.length > 200
        ? `${outputRaw.slice(0, 200)}…`
        : outputRaw;

      return {
        missionId: mission.missionId,
        stepId: step.stepId,
        stepName,
        completedAt: step.completedAt ?? '',
        outputExcerpt,
        platform: extractPlatformFromArgs(step.toolArgs),
        grade: gradeMap.get(step.stepId) ?? null,
      };
    });
  } catch (error) {
    logger.error(
      '[SpecialistIntrospection] getSpecialistRecentWork failed',
      error instanceof Error ? error : new Error(String(error)),
      { specialistId },
    );
    return [];
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Single Firestore round-trip for missions where the specialist appears in
 * the `specialistsUsed` array on any step. We use a top-level
 * `array-contains` against `specialistsUsed` rolled up at the mission
 * level. Since the mission doc embeds steps as an array, we filter the
 * step matches in JS. To make `array-contains` work without writing a
 * mission-level field at write time, we walk every mission written with
 * the `specialistsUsed` field populated on at least one step. To keep
 * this cheap we cap the result set on the caller side via composite
 * downstream filters — for the dashboards we care about (active +
 * completed) the working set is a few hundred docs at most.
 *
 * Implementation note: Firestore does not have a "field-on-array-element"
 * filter, so we cannot push the specialist filter to the server. We pull
 * the most-recent N missions and filter in-process. N is bounded so this
 * stays sane even on large tenants.
 */
async function loadMissionsForSpecialist(
  specialistId: string,
): Promise<Mission[]> {
  if (!adminDb) { return []; }

  // We pull the most recent missions ordered by createdAt desc and filter
  // in-process. 200 is a defensive cap — even an active tenant rarely has
  // that many in-flight missions, and recent work older than the most
  // recent 200 is by definition not "recent".
  const MAX_SCAN = 200;

  const snap = await adminDb
    .collection(getSubCollection('missions'))
    .orderBy('createdAt', 'desc')
    .limit(MAX_SCAN)
    .get();

  const all = snap.docs.map((d) => d.data() as Mission);
  return all.filter((m) =>
    m.steps.some((s) => (s.specialistsUsed ?? []).includes(specialistId)),
  );
}

/**
 * Extract a platform string from a step's toolArgs. Looks at common
 * argument names used across the Marketing/Content delegations.
 */
function extractPlatformFromArgs(args: Record<string, unknown> | undefined): string | null {
  if (!args) { return null; }
  const raw = args.platform ?? args.channel ?? args.network;
  if (typeof raw === 'string' && raw.length > 0) { return raw.toLowerCase(); }
  return null;
}
