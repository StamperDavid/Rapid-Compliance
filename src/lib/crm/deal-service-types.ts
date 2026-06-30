/**
 * Deal Service — type-only exports.
 *
 * Lives apart from deal-service.ts (which dynamically imports
 * event-triggers → sequence-scheduler → google-calendar-service →
 * googleapis) so client components can `import type { Deal }` without
 * dragging that whole chain into the browser bundle.
 */

/**
 * The six original/default deal stages. These keys are also the default
 * pipeline's stage keys, so they keep type-safety everywhere they're used.
 */
export type DefaultDealStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

/**
 * Stage stored on a deal. The six defaults keep literal autocomplete and
 * type-safety; custom pipelines may define their own stage keys, so any string
 * is accepted at runtime. (`string & {}` preserves the literal suggestions.)
 */
export type DealStage = DefaultDealStage | (string & {});

export interface Deal {
  id: string;
  name: string;
  company?: string;
  companyName?: string;
  /** FK to the linked Company record. The `company` string is kept for display/legacy fallback. */
  companyId?: string;
  contactId?: string;
  leadId?: string;
  /** Pipeline this deal lives in. When absent the deal belongs to the default pipeline. */
  pipelineId?: string;
  value: number;
  currency?: string;
  stage: DealStage;
  probability: number;
  expectedCloseDate?: Date | { toDate: () => Date };
  actualCloseDate?: Date | { toDate: () => Date };
  ownerId?: string;
  source?: string;
  lostReason?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
  createdAt: Date | { toDate: () => Date };
  updatedAt?: Date | { toDate: () => Date };
}
