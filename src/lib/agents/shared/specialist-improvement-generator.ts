/**
 * Specialist Improvement Generator
 *
 * Analyzes failure patterns from a specialist's performance history
 * and generates improvement requests with proposed changes.
 *
 * Uses OpenRouter to analyze patterns and propose:
 * - System prompt adjustments for LLM-backed specialists
 * - Configuration parameter changes for decision-tree specialists
 *
 * @module agents/shared/specialist-improvement-generator
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { DEFAULT_COACHING_MODEL } from '@/lib/coaching/coaching-models';
import { getSpecialistHistory } from './specialist-metrics';
import type { AgentPerformanceEntry, SpecialistImprovementRequest, ProposedSpecialistChange } from '@/types/training';
import type { ModelName } from '@/types/ai-models';

// ============================================================================
// CONSTANTS
// ============================================================================

const IMPROVEMENT_REQUESTS_COLLECTION = 'specialistImprovementRequests';
const MIN_ENTRIES_FOR_ANALYSIS = 5;

function getImprovementRequestsPath(): string {
  return getSubCollection(IMPROVEMENT_REQUESTS_COLLECTION);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate an improvement request for a specialist based on performance data.
 *
 * 1. Collects last N performance entries
 * 2. Analyzes failure patterns from failureMode and feedback fields
 * 3. Uses OpenRouter to propose system prompt or config changes
 * 4. Creates SpecialistImprovementRequest in Firestore
 */
export async function generateImprovementRequest(
  specialistId: string,
  specialistName: string,
  entryLimit: number = 20
): Promise<SpecialistImprovementRequest | null> {
  logger.info(`[ImprovementGenerator] Analyzing specialist: ${specialistId}`);

  // 1. Collect recent performance entries
  const entries = await getSpecialistHistory(specialistId, entryLimit);

  if (entries.length < MIN_ENTRIES_FOR_ANALYSIS) {
    logger.info(`[ImprovementGenerator] Not enough entries (${entries.length}/${MIN_ENTRIES_FOR_ANALYSIS}) for ${specialistId}`);
    return null;
  }

  // 2. Analyze failure patterns
  const failureAnalysis = analyzeFailurePatterns(entries);

  if (failureAnalysis.failedEntries.length === 0 && failureAnalysis.lowQualityEntries.length === 0) {
    logger.info(`[ImprovementGenerator] No failure patterns found for ${specialistId}`);
    return null;
  }

  // 3. Use LLM to propose improvements
  const proposedChanges = await generateProposedChanges(
    specialistId,
    specialistName,
    failureAnalysis
  );

  if (proposedChanges.length === 0) {
    logger.info(`[ImprovementGenerator] LLM returned no proposed changes for ${specialistId}`);
    return null;
  }

  // 4. Build the improvement request
  const request: SpecialistImprovementRequest = {
    id: `simp_${specialistId}_${Date.now()}`,
    specialistId,
    specialistName,
    sourcePerformanceEntries: entries.map(e => e.id),
    proposedChanges,
    impactAnalysis: {
      expectedImprovement: estimateImprovement(failureAnalysis, proposedChanges),
      areasImproved: [...new Set(proposedChanges.map(c => c.field))],
      risks: [
        'Changes generated from AI analysis — verify with production testing',
        `Based on ${entries.length} execution samples`,
      ],
      confidence: Math.min(0.9, 0.5 + (entries.length / 50) * 0.4),
    },
    status: 'pending_review',
    createdAt: new Date().toISOString(),
  };

  // 5. Persist to Firestore
  if (adminDb) {
    await adminDb
      .collection(getImprovementRequestsPath())
      .doc(request.id)
      .set(request);

    logger.info(`[ImprovementGenerator] Created improvement request: ${request.id}`);
  }

  return request;
}

/**
 * Get all improvement requests, optionally filtered by status.
 */
export async function getImprovementRequests(
  status?: SpecialistImprovementRequest['status'],
  limit: number = 50
): Promise<SpecialistImprovementRequest[]> {
  if (!adminDb) { return []; }

  let query = adminDb.collection(getImprovementRequestsPath()) as FirebaseFirestore.Query;

  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('createdAt', 'desc').limit(limit);

  const snap = await query.get();
  return snap.docs.map(doc => doc.data() as SpecialistImprovementRequest);
}

/**
 * Get a single improvement request by ID.
 */
export async function getImprovementRequest(
  requestId: string
): Promise<SpecialistImprovementRequest | null> {
  if (!adminDb) { return null; }

  const doc = await adminDb
    .collection(getImprovementRequestsPath())
    .doc(requestId)
    .get();

  if (!doc.exists) { return null; }
  return doc.data() as SpecialistImprovementRequest;
}

// ============================================================================
// INTERNAL — FAILURE PATTERN ANALYSIS
// ============================================================================

interface FailureAnalysis {
  failedEntries: AgentPerformanceEntry[];
  lowQualityEntries: AgentPerformanceEntry[];
  failureModeFrequency: Map<string, number>;
  commonFeedback: Map<string, number>;
  avgQualityScore: number;
  failureRate: number;
  retryRate: number;
}

function analyzeFailurePatterns(entries: AgentPerformanceEntry[]): FailureAnalysis {
  const failedEntries = entries.filter(e => !e.approved);
  const lowQualityEntries = entries.filter(e => e.qualityScore < 70 && e.approved);
  const retriedEntries = entries.filter(e => e.retryCount > 0);

  // Count failure modes
  const failureModeFrequency = new Map<string, number>();
  for (const entry of failedEntries) {
    if (entry.failureMode) {
      failureModeFrequency.set(entry.failureMode, (failureModeFrequency.get(entry.failureMode) ?? 0) + 1);
    }
  }

  // Count feedback items
  const commonFeedback = new Map<string, number>();
  for (const entry of [...failedEntries, ...lowQualityEntries]) {
    for (const fb of entry.feedback) {
      commonFeedback.set(fb, (commonFeedback.get(fb) ?? 0) + 1);
    }
  }

  const totalQuality = entries.reduce((sum, e) => sum + e.qualityScore, 0);

  return {
    failedEntries,
    lowQualityEntries,
    failureModeFrequency,
    commonFeedback,
    avgQualityScore: entries.length > 0 ? totalQuality / entries.length : 0,
    failureRate: entries.length > 0 ? failedEntries.length / entries.length : 0,
    retryRate: entries.length > 0 ? retriedEntries.length / entries.length : 0,
  };
}

// ============================================================================
// INTERNAL — LLM-BASED IMPROVEMENT PROPOSAL
// ============================================================================

async function generateProposedChanges(
  specialistId: string,
  specialistName: string,
  analysis: FailureAnalysis
): Promise<ProposedSpecialistChange[]> {
  const provider = new OpenRouterProvider({});

  const failureModes = Array.from(analysis.failureModeFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([mode, count]) => `- ${mode} (${count} occurrences)`)
    .join('\n');

  const feedbackItems = Array.from(analysis.commonFeedback.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fb, count]) => `- ${fb} (${count} occurrences)`)
    .join('\n');

  const systemPrompt = `You are an AI system performance analyst. You analyze patterns in specialist agent execution failures and propose concrete improvements. Your output must be valid JSON only — no markdown, no explanation, just the JSON array.`;

  const userPrompt = `Analyze this specialist agent's performance data and propose improvement changes.

SPECIALIST: ${specialistName} (ID: ${specialistId})
AVERAGE QUALITY SCORE: ${Math.round(analysis.avgQualityScore)}
FAILURE RATE: ${Math.round(analysis.failureRate * 100)}%
RETRY RATE: ${Math.round(analysis.retryRate * 100)}%

FAILURE MODES:
${failureModes || '(none recorded)'}

COMMON REVIEW FEEDBACK:
${feedbackItems || '(none recorded)'}

Based on these patterns, propose 1-3 concrete changes to improve this specialist's output quality. Each change should target a specific aspect of the specialist's behavior.

Return a JSON array of objects with this exact structure:
[
  {
    "field": "string - the config field to change (e.g., 'systemPrompt.tone', 'outputFormat', 'maxRetries', 'temperature')",
    "currentValue": "string - description of current behavior causing issues",
    "proposedValue": "string - the proposed new value or behavior",
    "reason": "string - why this change should improve performance",
    "confidence": number between 0 and 1
  }
]`;

  try {
    const response = await provider.chat({
      model: DEFAULT_COACHING_MODEL as ModelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });

    const content = response.content.trim();

    // Parse the JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn(`[ImprovementGenerator] Failed to parse LLM response as JSON for ${specialistId}`);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      field: string;
      currentValue: unknown;
      proposedValue: unknown;
      reason: string;
      confidence: number;
    }>;

    // Validate and sanitize
    return parsed
      .filter(c => c.field && c.reason && typeof c.confidence === 'number')
      .map(c => ({
        field: String(c.field),
        currentValue: c.currentValue,
        proposedValue: c.proposedValue,
        reason: String(c.reason),
        confidence: Math.max(0, Math.min(1, c.confidence)),
      }));
  } catch (error) {
    logger.error(
      '[ImprovementGenerator] LLM analysis failed',
      error instanceof Error ? error : new Error(String(error)),
      { specialistId }
    );
    return [];
  }
}

function estimateImprovement(
  analysis: FailureAnalysis,
  changes: ProposedSpecialistChange[]
): number {
  // Estimate based on failure rate and number of targeted changes
  const baseImprovement = analysis.failureRate * 30; // Up to 30% from fixing failures
  const changeBonus = changes.length * 3; // Each change adds ~3%
  return Math.min(25, Math.round(baseImprovement + changeBonus));
}
