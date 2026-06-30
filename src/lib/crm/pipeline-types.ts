/**
 * Pipeline — type-only exports (client-safe).
 *
 * Lives apart from pipeline-service.ts (which imports the Admin Firestore
 * service) so 'use client' components can `import type { Pipeline }` and reuse
 * the DEFAULT_PIPELINE_ID constant without dragging firebase-admin into the
 * browser bundle. Mirrors the deal-service-types.ts pattern.
 */

/** A single ordered column in a pipeline (e.g. "Qualification"). */
export interface PipelineStage {
  /** Stable key persisted on each deal's `stage` field. Never renamed. */
  key: string;
  /** Human-friendly column heading shown in the UI. */
  label: string;
  /** Left-to-right position of the column. Lower numbers render first. */
  order: number;
  /** Default win probability (0-100) applied to deals entering this stage. */
  probability?: number;
  /** Whether this stage opens, wins, or loses the deal. Drives close-date logic. */
  type?: 'open' | 'won' | 'lost';
}

/** A named board of ordered stages. Deals carry a `pipelineId` pointing here. */
export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  /** Exactly one pipeline is the default; it can never be deleted. */
  isDefault: boolean;
  createdAt: Date | { toDate: () => Date };
  updatedAt: Date | { toDate: () => Date };
}

/**
 * Id of the lazily-seeded default pipeline. Existing deals that have no
 * `pipelineId` are treated as belonging to this pipeline everywhere, so the
 * board keeps rendering them after the multi-pipeline feature ships.
 */
export const DEFAULT_PIPELINE_ID = 'default';

/**
 * The six default stages — these EXACTLY match the original hardcoded
 * `DEAL_STAGES` so every pre-existing deal keeps its stage value and keeps
 * rendering. Do not rename these keys.
 */
export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { key: 'prospecting', label: 'Prospecting', order: 0, probability: 10, type: 'open' },
  { key: 'qualification', label: 'Qualification', order: 1, probability: 25, type: 'open' },
  { key: 'proposal', label: 'Proposal', order: 2, probability: 50, type: 'open' },
  { key: 'negotiation', label: 'Negotiation', order: 3, probability: 75, type: 'open' },
  { key: 'closed_won', label: 'Closed Won', order: 4, probability: 100, type: 'won' },
  { key: 'closed_lost', label: 'Closed Lost', order: 5, probability: 0, type: 'lost' },
];
