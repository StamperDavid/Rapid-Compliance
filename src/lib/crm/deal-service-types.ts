/**
 * Deal Service — type-only exports.
 *
 * Lives apart from deal-service.ts (which dynamically imports
 * event-triggers → sequence-scheduler → google-calendar-service →
 * googleapis) so client components can `import type { Deal }` without
 * dragging that whole chain into the browser bundle.
 */

export interface Deal {
  id: string;
  name: string;
  company?: string;
  companyName?: string;
  contactId?: string;
  leadId?: string;
  value: number;
  currency?: string;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
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
